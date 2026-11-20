'use strict';

// Imports dealer inventory feeds (CSV / TSV / XML) into the "cars" node.
//
// Feeds are configured by a controller under admin/feeds/<feedId>:
//   { enabled, dealerName, ownerUid, phone, url, format, maxCars }
//
// The importer runs on a schedule (see netlify.toml) and can also be triggered
// manually by a controller/admin from the site. It writes with the Firebase
// service account, so listings created here do not consume a dealer's
// subscription; the dealer's written authorisation is what makes the import
// legitimate, not the code.

const crypto = require('crypto');

const SITE_URL = (process.env.SITE_URL || 'https://golden-wheel-cars.netlify.app').replace(/\/+$/, '');
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || '';
const FIREBASE_DATABASE_URL = (process.env.FIREBASE_DATABASE_URL || '').replace(/\/+$/, '');
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || '';
const FIREBASE_PRIVATE_KEY = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const CONTROLLER_EMAILS = (process.env.CONTROLLER_EMAILS || 'aaageorgegt@gmail.com,aageorgetoffi@gmail.com')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

const DEFAULT_MAX_CARS = 200;
const HARD_MAX_CARS = 1000;
const MAX_FEED_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30000;
const MAX_IMAGES = 12;

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

async function rtdbWrite(method, path, value) {
    const token = await getAccessToken();
    const res = await fetch(`${FIREBASE_DATABASE_URL}/${path}.json`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(value)
    });
    if (!res.ok) throw new Error(`Database write failed (${res.status})`);
    return res.json().catch(() => ({}));
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
    return { uid: user.localId, email: (user.email || '').toLowerCase() };
}

// ---------------------------------------------------------------- feed fetch

function assertSafeUrl(raw) {
    let url;
    try {
        url = new URL(String(raw || ''));
    } catch {
        throw new Error('Feed URL is not a valid URL');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new Error('Feed URL must start with http:// or https:// (FTP feeds must be mirrored to a URL first)');
    }
    const host = url.hostname.toLowerCase();
    const blocked = host === 'localhost' || host === '::1' || host.endsWith('.internal') || host.endsWith('.local')
        || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)
        || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (blocked) throw new Error('Feed URL points to a private address');
    return url;
}

async function fetchFeed(rawUrl) {
    const url = assertSafeUrl(rawUrl);
    const headers = { Accept: 'text/csv, application/xml, text/xml, text/plain, */*' };
    if (url.username || url.password) {
        headers.Authorization = 'Basic ' + Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString('base64');
        url.username = '';
        url.password = '';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url.toString(), { headers, redirect: 'follow', signal: controller.signal });
        if (!res.ok) throw new Error(`Feed download failed (HTTP ${res.status})`);
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > MAX_FEED_BYTES) throw new Error('Feed file is too large');
        return { text: buffer.toString('utf8'), contentType: (res.headers.get('content-type') || '').toLowerCase() };
    } finally {
        clearTimeout(timer);
    }
}

// -------------------------------------------------------------------- parsing

function splitDelimited(text, delimiter) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (quoted) {
            if (char === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
            } else {
                field += char;
            }
            continue;
        }
        if (char === '"') { quoted = true; continue; }
        if (char === delimiter) { row.push(field); field = ''; continue; }
        if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
        if (char === '\r') continue;
        field += char;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((cell) => String(cell).trim() !== ''));
}

function parseDelimited(text) {
    const firstLine = text.split(/\r?\n/, 1)[0] || '';
    const counts = { ',': 0, '\t': 0, ';': 0, '|': 0 };
    for (const char of firstLine) if (char in counts) counts[char]++;
    const delimiter = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    if (!counts[delimiter]) throw new Error('Could not detect the column separator in this file');

    const rows = splitDelimited(text, delimiter);
    if (rows.length < 2) throw new Error('Feed has no data rows');
    const headers = rows[0].map((h) => String(h).trim());
    return rows.slice(1).map((cells) => {
        const record = {};
        headers.forEach((headerName, index) => { record[headerName] = cells[index] === undefined ? '' : String(cells[index]).trim(); });
        return record;
    });
}

function stripCdata(value) {
    return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function decodeEntities(value) {
    return String(value)
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function parseXml(text) {
    const tagCounts = {};
    const openTags = text.match(/<([A-Za-z_][\w.:-]*)\b[^>]*>/g) || [];
    for (const tag of openTags) {
        const name = tag.replace(/^<\s*/, '').split(/[\s>/]/)[0];
        tagCounts[name] = (tagCounts[name] || 0) + 1;
    }
    const preferred = ['vehicle', 'car', 'item', 'listing', 'inventory', 'unit', 'record'];
    let itemTag = Object.keys(tagCounts)
        .filter((name) => preferred.includes(name.toLowerCase()))
        .sort((a, b) => tagCounts[b] - tagCounts[a])[0];
    if (!itemTag) {
        itemTag = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a])[0];
    }
    if (!itemTag) throw new Error('Could not find vehicle records in this XML feed');

    const itemRegex = new RegExp(`<${itemTag}\\b[^>]*>([\\s\\S]*?)<\\/${itemTag}>`, 'gi');
    const records = [];
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
        const body = match[1];
        const record = {};
        const fieldRegex = /<([A-Za-z_][\w.:-]*)\b[^>]*>([\s\S]*?)<\/\1>/g;
        let field;
        while ((field = fieldRegex.exec(body)) !== null) {
            const name = field[1];
            const raw = decodeEntities(stripCdata(field[2])).trim();
            if (/</.test(field[2]) && !/^\s*<!\[CDATA\[/.test(field[2])) continue; // container tag, handled by its children
            if (record[name] === undefined) record[name] = raw;
            else record[name] += `|${raw}`;
        }
        const urls = (body.match(/https?:\/\/[^\s"'<>|]+\.(?:jpe?g|png|webp)(?:\?[^\s"'<>|]*)?/gi) || []).slice(0, MAX_IMAGES);
        if (urls.length) record.__images = urls.join('|');
        if (Object.keys(record).length) records.push(record);
    }
    if (!records.length) throw new Error('XML feed contains no vehicle records');
    return records;
}

function parseFeed(text, format, contentType) {
    const trimmed = text.replace(/^\uFEFF/, '').trim();
    const looksXml = trimmed.startsWith('<');
    const chosen = (format && format !== 'auto') ? format : (looksXml || contentType.includes('xml') ? 'xml' : 'csv');
    return chosen === 'xml' ? parseXml(trimmed) : parseDelimited(trimmed);
}

// ---------------------------------------------------------------- normalising

const FIELD_ALIASES = {
    vin: ['vin', 'vinnumber', 'vehicleidentificationnumber'],
    year: ['year', 'modelyear', 'vehicleyear'],
    make: ['make', 'manufacturer', 'brand'],
    model: ['model', 'modelname'],
    trim: ['trim', 'trimlevel', 'series', 'style'],
    price: ['price', 'sellingprice', 'internetprice', 'saleprice', 'askingprice', 'listprice', 'retailprice', 'ourprice'],
    msrp: ['msrp', 'listprice', 'retailvalue'],
    mileage: ['mileage', 'odometer', 'miles', 'kilometers', 'km'],
    color: ['exteriorcolor', 'extcolor', 'color', 'colour', 'exterior'],
    transmission: ['transmission', 'trans', 'transmissiondescription', 'gear', 'gearbox'],
    fuel: ['fueltype', 'fuel', 'enginefueltype'],
    engine: ['engine', 'enginedescription', 'enginedisplacement', 'enginesize', 'cylinders'],
    mpgCity: ['citympg', 'mpgcity', 'epacity'],
    mpgHighway: ['highwaympg', 'mpghighway', 'epahighway'],
    images: ['imageurls', 'imageurl', 'photourls', 'photourl', 'images', 'image', 'photos', 'photo', 'pictures', 'picture', 'mainphoto', 'imagelist'],
    description: ['description', 'comments', 'sellerscomments', 'vehiclecomments', 'dealercomments', 'details'],
    stock: ['stocknumber', 'stock', 'stockno', 'stockid'],
    phone: ['phone', 'dealerphone', 'contactphone', 'sellerphone', 'telephone'],
    dealerName: ['dealername', 'dealer', 'sellername', 'storename'],
    condition: ['condition', 'type', 'vehicletype', 'newused', 'usednew'],
    doors: ['doors', 'doorcount'],
    drivetrain: ['drivetrain', 'drive', 'drivetype']
};

function normaliseKey(key) {
    return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildLookup(record) {
    const lookup = {};
    Object.keys(record).forEach((key) => {
        const normalised = normaliseKey(key);
        if (lookup[normalised] === undefined || lookup[normalised] === '') lookup[normalised] = record[key];
    });
    return lookup;
}

function pick(lookup, field) {
    for (const alias of FIELD_ALIASES[field] || []) {
        const value = lookup[alias];
        if (value !== undefined && String(value).trim() !== '') return String(value).trim();
    }
    return '';
}

function toNumber(value) {
    const digits = String(value).replace(/[^0-9.]/g, '');
    const num = Number(digits);
    return Number.isFinite(num) ? num : 0;
}

function splitImages(value) {
    return String(value)
        .split(/[|,;\s]+/)
        .map((url) => url.trim())
        .filter((url) => /^https?:\/\//i.test(url))
        .slice(0, MAX_IMAGES);
}

function mapFuel(raw) {
    const value = String(raw).toLowerCase();
    if (!value) return '';
    if (value.includes('electric') || value === 'ev') return 'Electric';
    if (value.includes('hybrid')) return 'Hybrid';
    if (value.includes('diesel')) return 'Diesel';
    if (value.includes('gas') || value.includes('petrol') || value.includes('unleaded')) return 'Petrol';
    return raw;
}

function mapTransmission(raw) {
    const value = String(raw).toLowerCase();
    if (!value) return '';
    if (value.includes('cvt')) return 'CVT';
    if (value.includes('manual')) return 'Manual';
    if (value.includes('auto')) return 'Automatic';
    return raw;
}

function safeKeyPart(value) {
    return String(value).replace(/[.#$/\[\]]/g, '_').replace(/\s+/g, '').slice(0, 40);
}

function normaliseVehicle(record, feed) {
    const lookup = buildLookup(record);
    const vin = pick(lookup, 'vin').toUpperCase();
    const stock = pick(lookup, 'stock');
    const identity = vin || stock;
    if (!identity) return null;

    const year = pick(lookup, 'year');
    const make = pick(lookup, 'make');
    const model = pick(lookup, 'model');
    const trim = pick(lookup, 'trim');
    const price = toNumber(pick(lookup, 'price') || pick(lookup, 'msrp'));
    const mileage = toNumber(pick(lookup, 'mileage'));
    const images = splitImages(record.__images || pick(lookup, 'images'));
    const name = [year, make, model, trim].filter(Boolean).join(' ').trim().slice(0, 200);

    if (!name || !price || !images.length) return null;

    const mpgCity = pick(lookup, 'mpgCity');
    const mpgHighway = pick(lookup, 'mpgHighway');
    const consumption = mpgCity && mpgHighway ? `${mpgCity}/${mpgHighway} MPG` : (mpgCity || mpgHighway ? `${mpgCity || mpgHighway} MPG` : '');

    const descriptionParts = [pick(lookup, 'description')];
    if (mileage) descriptionParts.push(`Mileage: ${mileage.toLocaleString('en-US')} mi`);
    if (pick(lookup, 'color')) descriptionParts.push(`Exterior color: ${pick(lookup, 'color')}`);
    if (pick(lookup, 'drivetrain')) descriptionParts.push(`Drivetrain: ${pick(lookup, 'drivetrain')}`);
    if (vin) descriptionParts.push(`VIN: ${vin}`);
    if (stock) descriptionParts.push(`Stock #: ${stock}`);

    return {
        key: `feed_${safeKeyPart(feed.id)}_${safeKeyPart(identity)}`,
        fields: {
            name,
            price: String(Math.round(price)),
            year: year || '',
            engine: pick(lookup, 'engine'),
            gear: mapTransmission(pick(lookup, 'transmission')),
            fuel: mapFuel(pick(lookup, 'fuel')),
            fuelInfo: consumption,
            accidents: '',
            paint: '',
            firstOwner: '',
            color: pick(lookup, 'color'),
            mileage: mileage || 0,
            vin,
            stock,
            description: descriptionParts.filter(Boolean).join('\n').slice(0, 5000),
            images,
            phone: String(pick(lookup, 'phone') || feed.phone || '').replace(/\D/g, ''),
            ownerUid: feed.ownerUid || null,
            ownerId: `feed:${feed.id}`,
            ownerName: pick(lookup, 'dealerName') || feed.dealerName || 'Dealer',
            ownerVerified: true,
            isSold: false,
            soldAt: null,
            source: 'feed',
            feedId: feed.id,
            updatedAt: Date.now()
        }
    };
}

// ------------------------------------------------------------------ importing

function chunk(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

async function importFeed(feedId, feed) {
    const config = {
        id: feedId,
        url: feed.url,
        format: feed.format || 'auto',
        ownerUid: feed.ownerUid || null,
        dealerName: feed.dealerName || '',
        phone: feed.phone || '',
        maxCars: Math.min(Number(feed.maxCars) || DEFAULT_MAX_CARS, HARD_MAX_CARS)
    };

    const { text, contentType } = await fetchFeed(config.url);
    const records = parseFeed(text, config.format, contentType);

    const seen = new Set();
    const vehicles = [];
    for (const record of records) {
        if (vehicles.length >= config.maxCars) break;
        const vehicle = normaliseVehicle(record, config);
        if (!vehicle || seen.has(vehicle.key)) continue;
        seen.add(vehicle.key);
        vehicles.push(vehicle);
    }
    if (!vehicles.length) throw new Error('No usable vehicles found (each row needs a VIN or stock number, a price and at least one photo URL)');

    const previous = (await rtdbGet(`admin/feedItems/${feedId}`)) || {};
    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const group of chunk(vehicles, 40)) {
        const patch = {};
        for (const vehicle of group) {
            const isNew = !previous[vehicle.key];
            if (isNew) { patch[`${vehicle.key}/createdAt`] = now; created++; } else { updated++; }
            Object.entries(vehicle.fields).forEach(([field, value]) => { patch[`${vehicle.key}/${field}`] = value; });
        }
        await rtdbWrite('PATCH', 'cars', patch);
    }

    const currentKeys = new Set(vehicles.map((vehicle) => vehicle.key));
    const removedKeys = Object.keys(previous).filter((key) => !currentKeys.has(key));
    for (const group of chunk(removedKeys, 60)) {
        const patch = {};
        for (const key of group) {
            patch[`${key}/isSold`] = true;
            patch[`${key}/soldAt`] = now;
            patch[`${key}/updatedAt`] = now;
        }
        if (Object.keys(patch).length) await rtdbWrite('PATCH', 'cars', patch);
    }

    const index = {};
    currentKeys.forEach((key) => { index[key] = true; });
    await rtdbWrite('PUT', `admin/feedItems/${feedId}`, index);

    return { feedId, dealerName: config.dealerName, imported: vehicles.length, created, updated, soldOut: removedKeys.length };
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: JSON_HEADERS, body: '' };
    if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });
    if (!FIREBASE_DATABASE_URL || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
        return reply(500, { error: 'Feed import is not configured yet' });
    }

    const isScheduled = String(event.headers['x-nf-event'] || event.headers['X-Nf-Event'] || '') === 'schedule';

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

    if (!isScheduled) {
        const authHeader = event.headers.authorization || event.headers.Authorization || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        if (!idToken) return reply(401, { error: 'Sign in required' });
        const user = await verifyIdToken(idToken).catch(() => null);
        if (!user) return reply(401, { error: 'Sign in required' });

        let allowed = CONTROLLER_EMAILS.includes(user.email);
        if (!allowed) {
            const adminFlag = await rtdbGet(`admin/admins/${user.uid}`).catch(() => null);
            allowed = adminFlag === true;
        }
        if (!allowed) return reply(403, { error: 'Admins only' });
    }

    if (body.preview) {
        try {
            const config = {
                id: 'preview',
                url: body.url,
                format: body.format || 'auto',
                ownerUid: null,
                dealerName: body.dealerName || '',
                phone: body.phone || ''
            };
            const { text, contentType } = await fetchFeed(config.url);
            const records = parseFeed(text, config.format, contentType);
            const samples = [];
            let usable = 0;
            for (const record of records) {
                const vehicle = normaliseVehicle(record, config);
                if (!vehicle) continue;
                usable++;
                if (samples.length < 3) samples.push(vehicle.fields);
            }
            return reply(200, { preview: true, rows: records.length, usable, samples });
        } catch (error) {
            return reply(400, { error: String(error.message || error).slice(0, 300) });
        }
    }

    try {
        const feeds = (await rtdbGet('admin/feeds')) || {};
        const wanted = body.feedId ? [body.feedId] : Object.keys(feeds);
        if (!wanted.length) return reply(200, { results: [], message: 'No feeds configured' });

        const results = [];
        for (const feedId of wanted) {
            const feed = feeds[feedId];
            if (!feed || !feed.url) { results.push({ feedId, error: 'Feed is missing a URL' }); continue; }
            if (feed.enabled === false && !body.feedId) { results.push({ feedId, skipped: true }); continue; }

            try {
                const result = await importFeed(feedId, feed);
                await rtdbWrite('PATCH', `admin/feeds/${feedId}`, {
                    lastRun: Date.now(), lastCount: result.imported, lastError: null
                });
                results.push(result);
            } catch (error) {
                await rtdbWrite('PATCH', `admin/feeds/${feedId}`, {
                    lastRun: Date.now(), lastError: String(error.message || error).slice(0, 300)
                }).catch(() => {});
                results.push({ feedId, error: String(error.message || error).slice(0, 300) });
            }
        }
        return reply(200, { results });
    } catch (error) {
        console.error('import-feeds:', error.message);
        return reply(500, { error: 'Feed import failed. Please try again.' });
    }
};
