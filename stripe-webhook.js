'use strict';

// Receives Stripe events, verifies their signature, and is the only writer of
// subscriptions/<uid> in the Realtime Database. The browser never reports its
// own payment state, so editing the site's JavaScript cannot unlock listings.

const crypto = require('crypto');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const FIREBASE_DATABASE_URL = (process.env.FIREBASE_DATABASE_URL || '').replace(/\/+$/, '');
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || '';
const FIREBASE_PRIVATE_KEY = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const SIGNATURE_TOLERANCE_SECONDS = 300;

function base64url(buf) {
    return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let tokenCache = null;

async function getAccessToken() {
    if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.value;
    if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) throw new Error('Firebase service account is not configured');

    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(JSON.stringify({
        iss: FIREBASE_CLIENT_EMAIL,
        scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
    }));
    const signature = crypto.createSign('RSA-SHA256').update(`${header}.${claims}`).sign(FIREBASE_PRIVATE_KEY);
    const assertion = `${header}.${claims}.${base64url(signature)}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
    });
    if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
    const data = await res.json();
    tokenCache = { value: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
    return tokenCache.value;
}

async function rtdbRequest(path, method, body) {
    const token = await getAccessToken();
    const res = await fetch(`${FIREBASE_DATABASE_URL}/${path}.json`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Database ${method} failed (${res.status})`);
    return res.json();
}

async function stripeGet(path) {
    const res = await fetch(`https://api.stripe.com${path}`, {
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, 'Stripe-Version': '2023-10-16' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data.error && data.error.message) || `Stripe request failed (${res.status})`);
    return data;
}

function verifySignature(rawBody, signatureHeader) {
    if (!signatureHeader || !STRIPE_WEBHOOK_SECRET) return false;
    let timestamp = '';
    const signatures = [];
    for (const part of signatureHeader.split(',')) {
        const index = part.indexOf('=');
        if (index === -1) continue;
        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        if (key === 't') timestamp = value;
        else if (key === 'v1') signatures.push(value);
    }
    if (!timestamp || signatures.length === 0) return false;
    if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return false;

    const expected = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${rawBody}`).digest();
    return signatures.some((candidate) => {
        const received = Buffer.from(candidate, 'hex');
        return received.length === expected.length && crypto.timingSafeEqual(received, expected);
    });
}

function periodEndMillis(subscription) {
    const item = subscription.items && subscription.items.data && subscription.items.data[0];
    const seconds = subscription.current_period_end || (item && item.current_period_end) || 0;
    return Number(seconds) * 1000;
}

async function resolveUid(subscription) {
    const fromMetadata = subscription.metadata && subscription.metadata.uid;
    if (fromMetadata) return fromMetadata;
    if (subscription.customer) {
        const mapped = await rtdbRequest(`stripeCustomers/${subscription.customer}`, 'GET');
        if (mapped) return mapped;
    }
    return null;
}

async function saveSubscription(uid, subscription) {
    const item = subscription.items && subscription.items.data && subscription.items.data[0];
    await rtdbRequest(`subscriptions/${uid}`, 'PATCH', {
        status: subscription.status || 'incomplete',
        currentPeriodEnd: periodEndMillis(subscription),
        cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
        stripeCustomerId: subscription.customer || null,
        stripeSubscriptionId: subscription.id || null,
        priceId: (item && item.price && item.price.id) || null,
        updatedAt: Date.now()
    });
    if (subscription.customer) await rtdbRequest(`stripeCustomers/${subscription.customer}`, 'PUT', uid);
}

async function handleEvent(stripeEvent) {
    const object = stripeEvent.data && stripeEvent.data.object;
    if (!object) return;

    switch (stripeEvent.type) {
        case 'checkout.session.completed': {
            const uid = object.client_reference_id || (object.metadata && object.metadata.uid);
            if (!uid || !object.subscription) return;
            const subscription = await stripeGet(`/v1/subscriptions/${object.subscription}`);
            await saveSubscription(uid, subscription);
            return;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            const uid = await resolveUid(object);
            if (!uid) return;
            const subscription = stripeEvent.type === 'customer.subscription.deleted'
                ? Object.assign({}, object, { status: 'canceled', current_period_end: 0 })
                : object;
            await saveSubscription(uid, subscription);
            return;
        }
        case 'invoice.paid':
        case 'invoice.payment_failed': {
            const subscriptionId = object.subscription || (object.parent && object.parent.subscription_details
                && object.parent.subscription_details.subscription);
            if (!subscriptionId) return;
            const subscription = await stripeGet(`/v1/subscriptions/${subscriptionId}`);
            const uid = await resolveUid(subscription);
            if (!uid) return;
            await saveSubscription(uid, subscription);
            return;
        }
        default:
    }
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

    const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
    const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'] || '';

    if (!verifySignature(rawBody, signature)) return { statusCode: 400, body: 'Invalid signature' };

    let stripeEvent;
    try {
        stripeEvent = JSON.parse(rawBody);
    } catch {
        return { statusCode: 400, body: 'Invalid payload' };
    }

    try {
        await handleEvent(stripeEvent);
        return { statusCode: 200, body: JSON.stringify({ received: true }) };
    } catch (error) {
        console.error('stripe-webhook:', stripeEvent.type, error.message);
        return { statusCode: 500, body: 'Handler error' };
    }
};
