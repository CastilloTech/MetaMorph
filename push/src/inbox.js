// Inbox: log things without opening the app. An iPhone shortcut (Siri, Back Tap, a home-screen button)
// sends a short message here; the app picks the messages up the next time it opens and applies them
// with the time they were sent. Your data stays on your phone; only these short messages pass through.
//
//   POST /inbox        body: plain text, {"text": "..."} or text=...   header: X-Companion-Code
//                      replies with a short plain-text confirmation (Shortcuts can show or speak it)
//   GET  /inbox        the waiting messages (for the app)
//   POST /inbox/ack    {"ids": [...]} removes messages the app has applied
import { sameCode } from './chat.js';

const KEY = 'inbox';
const MAX_ITEMS = 100, MAX_TEXT = 1000;

// Understands a few quick commands; anything else is a note for your companion to read.
export function parseInbox(raw) {
  const text = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT);
  const lower = text.toLowerCase().replace(/[.!]+$/, '');
  if (/^(done|finished|complete|completed|did it|i'?m done)$/.test(lower)) return { kind: 'done', text };
  const num = lower.match(/(\d+(?:\.\d+)?)/), n = num ? parseFloat(num[1]) : null;
  if (/\b(weight|weigh|weighed|scale)\b/.test(lower) && n) return { kind: 'weight', value: n, unit: /\b(kg|kgs|kilos?|kilograms?)\b/.test(lower) ? 'kg' : 'lb', text };
  if (/\bwater\b/.test(lower) && lower.split(' ').length <= 6) {
    const unit = /\b(oz|ounces?)\b/.test(lower) ? 'oz' : /\b(ml|milliliters?|millilitres?)\b/.test(lower) ? 'ml' : /\b(l|liters?|litres?)\b/.test(lower) ? 'l' : null;
    return { kind: 'water', amount: n, unit, text };
  }
  return { kind: 'note', text };
}

function say(x) {
  if (x.kind === 'done') return 'Got it. Your current routine will be marked done as of now.';
  if (x.kind === 'weight') return `Got it: ${x.value} ${x.unit}.`;
  if (x.kind === 'water') return !x.amount ? 'Got it: a glass of water.' : x.unit ? `Got it: ${x.amount} ${x.unit} of water.` : `Got it: water, ${x.amount} in your usual unit.`;
  return 'Got it. I’ll go over it with you when you open MetaMorph.';
}

async function load(env) { try { return JSON.parse((await env.SUBS.get(KEY)) || '[]'); } catch (e) { return []; } }

async function readText(req) {
  const type = req.headers.get('Content-Type') || '', raw = await req.text();
  if (raw.length > 20_000) return null;
  if (type.includes('json')) { try { const j = JSON.parse(raw); return typeof j === 'string' ? j : j.text ?? j.message ?? ''; } catch (e) { return raw; } }
  if (type.includes('form')) return new URLSearchParams(raw).get('text') || '';
  return raw;
}

export async function handleInbox(req, env, json, path) {
  if (!env.COMPANION_CODE) return json({ error: 'not_configured' }, 503);
  if (!sameCode(req.headers.get('X-Companion-Code') || '', env.COMPANION_CODE)) return json({ error: 'bad_code' }, 401);
  if (req.method === 'GET' && path === '/inbox') return json({ items: await load(env) });
  if (req.method === 'POST' && path === '/inbox/ack') {
    const body = await req.json().catch(() => ({})), ids = new Set(Array.isArray(body.ids) ? body.ids : []);
    const left = (await load(env)).filter(x => !ids.has(x.id));
    await env.SUBS.put(KEY, JSON.stringify(left));
    return json({ ok: true, left: left.length });
  }
  if (req.method === 'POST' && path === '/inbox') {
    const text = await readText(req);
    if (text == null) return new Response('That message is too long.', { status: 413 });
    if (!String(text).trim()) return new Response('Nothing to log: the message was empty.', { status: 400 });
    const item = { id: crypto.randomUUID(), t: Date.now(), ...parseInbox(text) };
    const items = [...(await load(env)), item].slice(-MAX_ITEMS);
    await env.SUBS.put(KEY, JSON.stringify(items));
    return new Response(say(item), { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  return json({ error: 'not found' }, 404);
}
