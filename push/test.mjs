// Checks the push server without any network: decrypts a message the way a browser would (RFC 8291),
// verifies the VAPID signature, and checks the timezone / due-time logic. Run: node push/test.mjs
import { encryptPayload, localParts, dueItems, tick } from './src/worker.js';

const { subtle } = crypto;
const b64u = buf => Buffer.from(buf).toString('base64url');
const unb64u = s => new Uint8Array(Buffer.from(s, 'base64url'));
const enc = new TextEncoder(), dec = new TextDecoder();
const concat = (...p) => Buffer.concat(p.map(x => Buffer.from(x)));
const hmac = async (k, d) => new Uint8Array(await subtle.sign('HMAC', await subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), d));
let failed = 0;
const ok = (name, v) => { console.log((v ? 'PASS ' : 'FAIL ') + name); if (!v) failed++; };

// a fake browser subscription
const ua = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const uaPublic = new Uint8Array(await subtle.exportKey('raw', ua.publicKey)), auth = crypto.getRandomValues(new Uint8Array(16));
const sub = { endpoint: 'https://push.example.com/abc', keys: { p256dh: b64u(uaPublic), auth: b64u(auth) } };

// encrypt, then decrypt as the browser
const message = JSON.stringify({ title: 'Morning routine', body: 'Hygiene · starts now', tag: 'r1' });
const body = await encryptPayload(sub, message);
const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0), idlen = body[20], asPublic = body.slice(21, 21 + idlen), cipher = body.slice(21 + idlen);
ok(`header layout (rs ${rs}, key ${idlen} bytes)`, rs === 4096 && idlen === 65 && asPublic[0] === 4);
const asKey = await subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
const prkKey = await hmac(auth, shared);
const ikm = (await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, [1]))).slice(0, 32);
const prk = await hmac(salt, ikm);
const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), [1]))).slice(0, 16);
const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), [1]))).slice(0, 12);
let plain = null;
try { plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']), cipher)); } catch (e) {}
ok('browser-side decryption succeeds', !!plain);
ok('padding delimiter is 0x02', plain && plain[plain.length - 1] === 2);
ok('decrypted text matches', plain && dec.decode(plain.slice(0, -1)) === message);

// VAPID signature verifies with the public key
const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await subtle.exportKey('jwk', kp.privateKey), pubRaw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
let sent = null;
globalThis.fetch = async (url, opts) => { sent = { url, opts }; return new Response(null, { status: 201 }); };
const kv = { data: {}, async get(k) { return this.data[k] ?? null; }, async put(k, v) { this.data[k] = v; } };
const env = { SUBS: kv, VAPID_PUBLIC: b64u(pubRaw), VAPID_PRIVATE_JWK: JSON.stringify(jwk), VAPID_SUBJECT: 'https://example.com' };
const now = new Date('2026-10-22T11:30:00Z');   // 7:30 AM in New York (EDT), Thursday
kv.data.subs = JSON.stringify({ dev1abcdefghijklmnop: { sub, tz: 'America/New_York', items: [
  { id: 'a', at: '07:30', title: 'Morning routine', body: 'now' },
  { id: 'b', at: '07:30', days: [1, 3, 5], title: 'Mon/Wed/Fri only', body: 'x' },
  { id: 'c', at: '07:31', title: 'Next minute', body: 'x' },
  { id: 'd', at: '07:30', date: '2026-10-22', title: 'Dated today', body: 'x' },
  { id: 'e', at: '07:30', skip: ['2026-10-22'], title: 'Already done today', body: 'x' },
] } });
const p = localParts(now, 'America/New_York');
ok(`local time in New York (${p.date} ${p.time} dow ${p.dow})`, p.date === '2026-10-22' && p.time === '07:30' && p.dow === 4);
const due = dueItems(JSON.parse(kv.data.subs).dev1abcdefghijklmnop.items, p).map(x => x.id);
ok(`due right now: ${due.join(',')}`, due.join(',') === 'a,d');
const count = await tick(env, now);
ok(`tick sends exactly those (${count})`, count === 2);
const authz = sent.opts.headers.Authorization, [, jwt, k] = authz.match(/^vapid t=([^,]+), k=(.+)$/);
const [h, c, s] = jwt.split('.');
const claims = JSON.parse(Buffer.from(c, 'base64url'));
const valid = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, unb64u(s), enc.encode(`${h}.${c}`));
ok('VAPID signature verifies', valid && k === env.VAPID_PUBLIC);
ok(`VAPID audience is the push service origin (${claims.aud})`, claims.aud === 'https://push.example.com' && claims.exp > Date.now() / 1000);
ok('sent with aes128gcm encoding and a TTL', sent.opts.headers['Content-Encoding'] === 'aes128gcm' && sent.opts.headers.TTL === '3600');

// expired subscriptions are removed
globalThis.fetch = async () => new Response(null, { status: 410 });
await tick(env, now);
ok('expired subscription forgotten', !JSON.parse(kv.data.subs).dev1abcdefghijklmnop);

console.log(failed ? `\n${failed} failed` : '\nall push checks passed');
process.exit(failed ? 1 : 0);
