'use strict';

// Creates a Stripe Checkout session for the "Dealer" subscription that unlocks
// car listings. The price is taken from STRIPE_PRICE_ID on the server, never
// from the request body, so the amount cannot be tampered with by the client.

const crypto = require('crypto');

const SITE_URL = (process.env.SITE_URL || 'https://golden-wheel-cars.netlify.app').replace(/\/+$/, '');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || '';
const FIREBASE_DATABASE_URL = (process.env.FIREBASE_DATABASE_URL || '').replace(/\/+$/, '');
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || '';
const FIREBASE_PRIVATE_KEY = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': SITE_URL,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function reply(statusCode, body) {
    return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

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

async function rtdbGet(path) {
    const token = await getAccessToken();
    const res = await fetch(`${FIREBASE_DATABASE_URL}/${path}.json`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Database read failed (${res.status})`);
    return res.json();
}

async function verifyIdToken(idToken) {
    if (!FIREBASE_API_KEY) throw new Error('FIREBASE_API_KEY is not configured');
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const user = data.users && data.users[0];
    if (!user || !user.localId) return null;
    return { uid: user.localId, email: user.email || '' };
}

function toForm(value, prefix, out) {
    if (value === undefined || value === null) return out;
    if (Array.isArray(value)) {
        value.forEach((item, i) => toForm(item, `${prefix}[${i}]`, out));
    } else if (typeof value === 'object') {
        Object.keys(value).forEach((key) => toForm(value[key], prefix ? `${prefix}[${key}]` : key, out));
    } else {
        out.append(prefix, String(value));
    }
    return out;
}

async function stripeRequest(path, params) {
    const res = await fetch(`https://api.stripe.com${path}`, {
        method: params ? 'POST' : 'GET',
        headers: {
            Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Stripe-Version': '2023-10-16'
        },
        body: params ? toForm(params, '', new URLSearchParams()).toString() : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data.error && data.error.message) || `Stripe request failed (${res.status})`);
    return data;
}

function isActive(subscription) {
    if (!subscription) return false;
    const status = String(subscription.status || '');
    if (status !== 'active' && status !== 'trialing') return false;
    return Number(subscription.currentPeriodEnd || 0) > Date.now();
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: JSON_HEADERS, body: '' };
    if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

    if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) return reply(500, { error: 'Payments are not configured yet' });

    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!idToken) return reply(401, { error: 'Sign in required' });

    try {
        const user = await verifyIdToken(idToken);
        if (!user) return reply(401, { error: 'Sign in required' });

        const existing = await rtdbGet(`subscriptions/${user.uid}`);
        if (isActive(existing)) return reply(200, { alreadyActive: true });

        const params = {
            mode: 'subscription',
            client_reference_id: user.uid,
            success_url: `${SITE_URL}/sell.html?checkout=success`,
            cancel_url: `${SITE_URL}/index.html?checkout=cancelled`,
            allow_promotion_codes: 'true',
            line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
            metadata: { uid: user.uid },
            subscription_data: { metadata: { uid: user.uid } }
        };
        if (existing && existing.stripeCustomerId) params.customer = existing.stripeCustomerId;
        else if (user.email) params.customer_email = user.email;

        const session = await stripeRequest('/v1/checkout/sessions', params);
        return reply(200, { url: session.url });
    } catch (error) {
        console.error('create-checkout-session:', error.message);
        return reply(500, { error: 'Could not start checkout. Please try again.' });
    }
};
