// MetaMorph push server (Cloudflare Worker).
// Stores each device's push subscription and reminder schedule, and once a minute sends whatever is due
// in that device's timezone. Messages are encrypted end to end (RFC 8291) and signed with VAPID (RFC 8292).
//
// Bindings (wrangler.toml / secrets):
//   SUBS                KV namespace holding all subscriptions under one key
//   VAPID_PUBLIC        uncompressed P-256 public key, base64url
//   VAPID_PRIVATE_JWK   matching private key as a JWK string (secret)
//   VAPID_SUBJECT       mailto: contact the push services can reach
//   ALLOWED_ORIGINS     comma-separated origins allowed to call the API
//   (the companion chat's bindings are listed in chat.js)
import { handleChat } from './chat.js';
import { handleInbox } from './inbox.js';
import { handleBackup } from './backup.js';

const KEY = 'subs';

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || '*', 'Access-Control-Allow-Methods': 'POST, GET, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Companion-Code', Vary: 'Origin' };
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (allowed.length && origin && !allowed.includes(origin)) return json({ error: 'origin not allowed' }, 403);

    const url = new URL(req.url);
    try {
      if (req.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'metamorph-push' });
      if (req.method === 'POST' && url.pathname === '/chat') return await handleChat(req, env, json);
      if (url.pathname === '/inbox' || url.pathname === '/inbox/ack') return await handleInbox(req, env, json, url.pathname);
      if (url.pathname === '/backup' || url.pathname === '/backups') return await handleBackup(req, env, json, url.pathname, url, cors);
      if (req.method === 'POST' && url.pathname === '/sync') {
        const body = await req.json();
        if (!validId(body.id) || !body.sub || !body.sub.endpoint || !body.sub.keys) return json({ error: 'bad request' }, 400);
        if (JSON.stringify(body).length > 200_000) return json({ error: 'schedule too large' }, 413);
        const all = await load(env);
        all[body.id] = { sub: body.sub, tz: String(body.tz || 'UTC'), items: Array.isArray(body.items) ? body.items.slice(0, 2000) : [], updated: Date.now() };
        await env.SUBS.put(KEY, JSON.stringify(all));
        return json({ ok: true, items: all[body.id].items.length });
      }
      if (req.method === 'POST' && url.pathname === '/unsubscribe') {
        const body = await req.json(), all = await load(env);
        if (validId(body.id) && all[body.id]) { delete all[body.id]; await env.SUBS.put(KEY, JSON.stringify(all)); }
        return json({ ok: true });
      }
      if (req.method === 'POST' && url.pathname === '/test') {
        const body = await req.json(), all = await load(env), u = validId(body.id) && all[body.id];
        if (!u) return json({ error: 'not subscribed' }, 404);
        const r = await sendPush(env, u.sub, { title: 'MetaMorph', body: 'Reminders are working.', tag: 'test' });
        return json({ ok: r.ok, status: r.status });
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
  },

  // every minute: send whatever is due right now in each device's own timezone
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env, new Date(event.scheduledTime || Date.now())));
  },
};

const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(id);
async function load(env) { return JSON.parse((await env.SUBS.get(KEY)) || '{}'); }

// the local date, weekday and HH:MM for a moment in a timezone
export function localParts(date, tz) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(date).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}
export function dueItems(items, now) {
  return items.filter(it => it.at === now.time
    && (!it.date || it.date === now.date)
    && (!Array.isArray(it.days) || it.days.includes(now.dow))
    && !(Array.isArray(it.skip) && it.skip.includes(now.date)));
}

export async function tick(env, when = new Date()) {
  const all = await load(env);
  let changed = false, sent = 0;
  for (const [id, u] of Object.entries(all)) {
    let now;
    try { now = localParts(when, u.tz); } catch (e) { now = localParts(when, 'UTC'); }
    for (const it of dueItems(u.items, now)) {
      const r = await sendPush(env, u.sub, { title: it.title, body: it.body, tag: it.tag || it.id, url: it.url || './' });
      sent++;
      // the browser unsubscribed or the subscription expired: forget it
      if (r.status === 404 || r.status === 410) { delete all[id]; changed = true; break; }
    }
  }
  if (changed) await env.SUBS.put(KEY, JSON.stringify(all));
  return sent;
}

/* ---------- Web Push: VAPID signature + aes128gcm encryption, using only WebCrypto ---------- */

const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const concat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

async function vapidHeader(env, endpoint) {
  const aud = new URL(endpoint).origin;
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:noreply@example.com' })));
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`;
}

// RFC 8291: encrypt a payload for one subscription (single record)
export async function encryptPayload(sub, plaintext) {
  const uaPublic = unb64u(sub.keys.p256dh), authSecret = unb64u(sub.keys.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prkKey = await hmac(authSecret, shared);
  const ikm = (await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])))).slice(0, 32);
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const padded = concat(enc.encode(plaintext), new Uint8Array([2]));   // 0x02 marks the last (only) record
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, padded));
  const rs = new Uint8Array([0, 0, 16, 0]);   // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

export async function sendPush(env, sub, payload) {
  const body = await encryptPayload(sub, JSON.stringify(payload));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidHeader(env, sub.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '3600', Urgency: 'high' },
    body,
  });
  return { ok: res.ok, status: res.status };
}
