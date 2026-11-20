// Shared helpers for the AI functions (AI Gateway via Anthropic SDK).
export const MODEL = 'claude-sonnet-5-5';

export const clip = (v, n) => String(v ?? '').slice(0, n);

// Reduce a car record to the fields the AI needs (never images or contact data).
export function compactCar(c) {
    if (!c || typeof c !== 'object') return null;
    return {
        id: clip(c.id, 64),
        name: clip(c.name, 80),
        year: clip(c.year, 8),
        price: clip(c.price, 16),
        engine: clip(c.engine, 40),
        gear: clip(c.gear, 20),
        fuel: clip(c.fuel, 20),
        fuelInfo: clip(c.fuelInfo, 30),
        accidents: clip(c.accidents, 30),
        paint: clip(c.paint, 30),
        firstOwner: clip(c.firstOwner, 4),
        verifiedSeller: !!c.ownerVerified,
    };
}

export function textOf(message) {
    return (message.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

export const json = (status, body) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
