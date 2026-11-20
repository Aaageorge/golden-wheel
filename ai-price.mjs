// AI price estimate for a new listing, using similar cars on the site as context.
import Anthropic from '@anthropic-ai/sdk';
import { MODEL, clip, compactCar, textOf, json } from '../lib/ai-shared.mjs';

const anthropic = new Anthropic();

export default async (req) => {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    let body;
    try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }

    const car = compactCar({ ...(body.car || {}), id: 'new' });
    if (!car || !car.name.trim()) return json(400, { error: 'Car name is required' });
    const comparables = (Array.isArray(body.comparables) ? body.comparables : [])
        .slice(0, 40).map(compactCar).filter(Boolean);

    const prompt = `Estimate a fair asking price in USD for this used car being listed on a luxury car marketplace.

Car: ${JSON.stringify(car)}
Seller's intended price (may be empty): ${clip(car.price, 16) || 'not set'}
Similar listings currently on the site: ${JSON.stringify(comparables)}

Consider make/model, year, engine, transmission, fuel, accident history, paint condition and first-owner status.
Respond with ONLY a JSON object, no other text:
{"low": number, "high": number, "fair": number, "verdict": "great" | "fair" | "high" | "low" | "unknown", "summary": "1-2 sentences explaining the estimate and how the seller's price compares, in the same language as the car name if it is not English", "tips": ["up to 3 short tips to sell faster or for more"]}
"verdict" compares the seller's price to the fair range ("unknown" if no price was set).`;

    try {
        const message = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 500,
            messages: [{ role: 'user', content: prompt }],
        });
        const raw = textOf(message);
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('No JSON in model output');
        const r = JSON.parse(match[0]);
        const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
        return json(200, {
            low: num(r.low),
            high: num(r.high),
            fair: num(r.fair),
            verdict: ['great', 'fair', 'high', 'low', 'unknown'].includes(r.verdict) ? r.verdict : 'unknown',
            summary: clip(r.summary, 600),
            tips: (Array.isArray(r.tips) ? r.tips : []).slice(0, 3).map((t) => clip(t, 200)),
        });
    } catch (err) {
        console.error('ai-price error', err);
        return json(502, { error: 'Could not estimate a price right now. Please try again.' });
    }
};

export const config = { path: '/api/ai-price' };
