// "Golden AI" — conversational car advisor grounded in the live inventory.
import Anthropic from '@anthropic-ai/sdk';
import { MODEL, clip, compactCar, textOf, json } from '../lib/ai-shared.mjs';

const anthropic = new Anthropic();

export default async (req) => {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    let body;
    try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }

    const messages = (Array.isArray(body.messages) ? body.messages : [])
        .slice(-12)
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
        .map((m) => ({ role: m.role, content: clip(m.content, 2000) }));
    while (messages.length && messages[0].role !== 'user') messages.shift();
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
        return json(400, { error: 'A user message is required' });
    }

    const inventory = (Array.isArray(body.inventory) ? body.inventory : [])
        .slice(0, 150).map(compactCar).filter((c) => c && c.id);

    const system = `You are "Golden AI", the expert car advisor for Golden Wheel, a luxury and premium car marketplace.
Help shoppers find the right car, compare options, understand specs, ownership costs and financing basics, and give tips for buying or selling.

Rules:
- Reply in the same language the user writes in (Arabic or English, etc.).
- Be concise, warm and practical. Use short paragraphs or bullet points. No markdown headings or tables.
- When recommending cars that are listed on the site, ONLY use cars from the inventory below and reference each with the exact token [[car:ID]] (the card is rendered automatically, so don't repeat every spec).
- Never invent listings, prices or seller details. If nothing in stock matches, say so and suggest how to adjust the search.
- Prices are in USD. Flag accident history or repaints honestly when relevant.
- For general car knowledge you may answer from expertise, but say when something should be verified with an inspection.

Current inventory (${inventory.length} available cars, JSON):
${JSON.stringify(inventory)}`;

    try {
        const message = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 900,
            system,
            messages,
        });
        return json(200, { reply: textOf(message) });
    } catch (err) {
        console.error('ai-assistant error', err);
        const status = err?.status === 429 ? 429 : 502;
        return json(status, { error: status === 429 ? 'The assistant is busy, please try again in a moment.' : 'The assistant is unavailable right now.' });
    }
};

export const config = { path: '/api/ai-assistant' };
