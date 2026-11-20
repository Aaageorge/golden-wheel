'use strict';

// Opens the Stripe customer portal so a subscriber can update their card or
// cancel. The customer id comes from the database, never from the request.

const crypto = require('crypto');

const SITE_URL = (process.env.SITE_URL || 'https://golden-wheel-cars.netlify.app').replace(/\/+$/, '');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
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

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: JSON_HEADERS, body: '' };
    if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });
    if (!STRIPE_SECRET_KEY) return reply(500, { error: 'Payments are not configured yet' });

    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!idToken) return reply(401, { error: 'Sign in required' });

    try {
        const user = await verifyIdToken(idToken);
        if (!user) return reply(401, { error: 'Sign in required' });

        const subscription = await rtdbGet(`subscriptions/${user.uid}`);
        const customerId = subscription && subscription.stripeCustomerId;
        if (!customerId) return reply(404, { error: 'No subscription found' });

        const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Stripe-Version': '2023-10-16'
            },
            body: new URLSearchParams({ customer: customerId, return_url: `${SITE_URL}/profile.html` }).toString()
        });
        const data = await res.json();
        if (!res.ok) throw new Error((data.error && data.error.message) || `Stripe request failed (${res.status})`);
        return reply(200, { url: data.url });
    } catch (error) {
        console.error('create-portal-session:', error.message);
        return reply(500, { error: 'Could not open the billing portal. Please try again.' });
    }
};
