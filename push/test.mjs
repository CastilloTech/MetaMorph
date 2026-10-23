// Checks the push server without any network: decrypts a message the way a browser would (RFC 8291),
// verifies the VAPID signature, and checks the timezone / due-time logic. Run: node push/test.mjs
import worker, { encryptPayload, localParts, dueItems, tick } from './src/worker.js';
import { SYSTEM, TOOLS, DEFAULT_MODEL } from './src/chat.js';
import { parseInbox } from './src/inbox.js';

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

// companion chat: pairing code, limits, the request sent to Claude, and what comes back
{
  const ORIGIN = 'https://castillotech.github.io';
  let seen = null;
  const reply = { id: 'msg_1', type: 'message', role: 'assistant', model: DEFAULT_MODEL, stop_reason: 'tool_use', stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
    content: [{ type: 'thinking', thinking: '', signature: 'sig' }, { type: 'text', text: 'Nice! Logging that.' },
              { type: 'tool_use', id: 'toolu_1', name: 'log_food', input: { name: '3 eggs', meal: 'Breakfast', kcal: 210, protein_g: 18, carbs_g: 1, fat_g: 15 } }] };
  const fakeApi = async (url, init) => {
    seen = { url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) };
    return new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_1' } });
  };
  const kvc = { data: {}, async get(k) { return this.data[k] ?? null; }, async put(k, v) { this.data[k] = v; } };
  const cenv = { SUBS: kvc, ALLOWED_ORIGINS: ORIGIN, ANTHROPIC_API_KEY: 'sk-test', COMPANION_CODE: 'pair-code-123', ANTHROPIC_FETCH: fakeApi, CHAT_DAILY_LIMIT: '3' };
  const chat = (body, code = 'pair-code-123', e = cenv) => worker.fetch(new Request('https://w.example/chat', {
    method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(code ? { 'X-Companion-Code': code } : {}) }, body: JSON.stringify(body) }), e);
  const msgs = [{ role: 'user', content: [{ type: 'text', text: '<app_state>name: Nyx</app_state>' }, { type: 'text', text: 'I had 3 eggs' }] }];
  ok('chat without the pairing code is refused', (await chat({ messages: msgs }, '')).status === 401 && (await chat({ messages: msgs }, 'wrong')).status === 401);
  ok('chat without an API key says not configured', (await chat({ messages: msgs }, 'x', { ...cenv, ANTHROPIC_API_KEY: '' })).status === 503);
  ok('malformed conversation is refused', (await chat({ messages: [{ role: 'assistant', content: 'hi' }] })).status === 400);
  const r = await chat({ messages: msgs }), out = await r.json();
  ok(`chat answers (${r.status} ${out.error || ''})`, r.status === 200 && out.content.some(b => b.type === 'tool_use' && b.name === 'log_food') && out.content.some(b => b.type === 'text'));
  const b = seen && seen.body;
  ok(`request uses ${b && b.model}, low effort, adaptive thinking`, !!b && b.model === DEFAULT_MODEL && b.output_config.effort === 'low' && b.thinking.type === 'adaptive' && b.thinking.block_binding.prefix_mismatch_behavior === 'drop_block');
  ok('request carries the fixed system prompt and tools, cached', !!b && b.system === SYSTEM && JSON.stringify(b.tools) === JSON.stringify(TOOLS) && b.cache_control.type === 'ephemeral');
  ok('tools are strict with every field required', TOOLS.every(t => t.strict && t.input_schema.additionalProperties === false && t.input_schema.required.length === Object.keys(t.input_schema.properties).length));
  ok('Haiku: thinking controls sent, no refusal fallback (Haiku has none)', !!seen && /thinking-binding-controls-2026-08-01/.test(seen.headers.get('anthropic-beta')) && !/server-side-fallback/.test(seen.headers.get('anthropic-beta')) && !('fallbacks' in b));
  await chat({ messages: msgs }, 'pair-code-123', { ...cenv, CHAT_MODEL: 'claude-opus-5-5', SUBS: { async get() { return null; }, async put() {} } });
  ok('Opus: refusal fallback is sent', seen.body.model === 'claude-opus-5-5' && /server-side-fallback-2026-07-01/.test(seen.headers.get('anthropic-beta')) && seen.body.fallbacks === 'default');
  ok('API key goes only to Anthropic', !!seen && seen.url.startsWith('https://api.anthropic.com/') && [seen.headers.get('x-api-key'), seen.headers.get('authorization')].some(v => v === 'sk-test' || v === 'Bearer sk-test'));
  await chat({ messages: msgs }); await chat({ messages: msgs });   // 3 of 3 used
  ok('daily limit stops further messages', (await chat({ messages: msgs })).status === 429);
  const pre = await worker.fetch(new Request('https://w.example/chat', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), cenv);
  ok('browser may send the pairing header', /X-Companion-Code/.test(pre.headers.get('Access-Control-Allow-Headers')));
}

// inbox: quick logging from Siri / Shortcuts, picked up by the app later
{
  const P = s => JSON.stringify(parseInbox(s));
  ok('parses water amounts and units', parseInbox('water 500').amount === 500 && parseInbox('Log 16 oz water').unit === 'oz' && parseInbox('water').amount === null && parseInbox('1.5 liters of water').unit === 'l');
  ok('parses done and weight', parseInbox('Done').kind === 'done' && parseInbox("I'm done.").kind === 'done' && parseInbox('weight 182.4').value === 182.4 && parseInbox('weighed 80 kg').unit === 'kg' && parseInbox('weight 182').unit === 'lb');
  ok('anything else is a note for the companion', parseInbox('had a chicken bowl and a shake').kind === 'note' && parseInbox('drank water with lunch and then went for a long walk outside').kind === 'note' && P('done with lunch').includes('note'));
  const kvi = { data: {}, async get(k) { return this.data[k] ?? null; }, async put(k, v) { this.data[k] = v; } };
  const ienv = { SUBS: kvi, COMPANION_CODE: 'pair-code-123', ALLOWED_ORIGINS: 'https://castillotech.github.io' };
  const call = (method, path, body, { code = 'pair-code-123', type = 'text/plain' } = {}) => worker.fetch(new Request('https://w.example' + path, {
    method, headers: { ...(code ? { 'X-Companion-Code': code } : {}), ...(body != null ? { 'Content-Type': type } : {}) }, ...(body != null ? { body } : {}) }), ienv);
  ok('inbox refuses a wrong code', (await call('POST', '/inbox', 'water', { code: 'nope' })).status === 401);
  const r1 = await call('POST', '/inbox', 'water 500');
  ok(`shortcut gets a plain confirmation (“${await r1.clone().text()}”)`, r1.status === 200 && /water, 500 in your usual unit/.test(await r1.text()));
  await call('POST', '/inbox', JSON.stringify({ text: 'had a chicken bowl' }), { type: 'application/json' });
  await call('POST', '/inbox', 'text=Done', { type: 'application/x-www-form-urlencoded' });
  const got = await (await call('GET', '/inbox')).json();
  ok(`app reads the waiting messages (${got.items.map(x => x.kind).join(',')})`, got.items.map(x => x.kind).join(',') === 'water,note,done' && got.items.every(x => x.id && x.t > 0));
  await call('POST', '/inbox/ack', JSON.stringify({ ids: got.items.slice(0, 2).map(x => x.id) }), { type: 'application/json' });
  ok('acknowledged messages are removed', (await (await call('GET', '/inbox')).json()).items.map(x => x.kind).join() === 'done');
  ok('empty messages are refused', (await call('POST', '/inbox', '   ')).status === 400);
}

// cloud backup: stores encrypted bytes it can't read, one per day plus the latest
{
  const store = new Map();
  const kvb = {
    async get(k) { return store.has(k) ? store.get(k).v : null; },
    async put(k, v, o = {}) { store.set(k, { v: v instanceof Uint8Array ? v.slice().buffer : v, m: o.metadata || null }); },
    async getWithMetadata(k) { const x = store.get(k); return x ? { value: x.v, metadata: x.m } : { value: null, metadata: null }; },
    async list({ prefix }) { return { keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name, metadata: store.get(name).m })), list_complete: true }; },
  };
  const benv = { SUBS: kvb, COMPANION_CODE: 'pair-code-123', ALLOWED_ORIGINS: 'https://castillotech.github.io' };
  const req = (method, path, body, code = 'pair-code-123') => worker.fetch(new Request('https://w.example' + path, { method, headers: { Origin: 'https://castillotech.github.io', ...(code ? { 'X-Companion-Code': code } : {}) }, ...(body ? { body } : {}) }), benv);
  const blob = d => new Uint8Array([0x4d, 0x4d, 0x42, 0x31, ...new Array(60).fill(d)]);
  ok('backup refuses a wrong code', (await req('PUT', '/backup', blob(1), 'nope')).status === 401);
  ok('backup refuses something that is not a backup', (await req('PUT', '/backup', new Uint8Array(80))).status === 400);
  ok('backup saved', (await req('PUT', '/backup?date=2026-10-22', blob(1))).status === 200 && (await req('PUT', '/backup?date=2026-10-23', blob(2))).status === 200);
  const list = (await (await req('GET', '/backups')).json()).backups;
  ok(`one copy per day listed, newest first (${list.map(x => x.date).join(', ')})`, list.map(x => x.date).join() === '2026-10-23,2026-10-22' && list[0].size === 64);
  const latest = await req('GET', '/backup'), older = await req('GET', '/backup?date=2026-10-22');
  const lb = new Uint8Array(await latest.arrayBuffer()), ob = new Uint8Array(await older.arrayBuffer());
  ok('latest and a chosen day download intact', lb[10] === 2 && ob[10] === 1 && lb.length === 64);
  ok('download is readable from the app (CORS)', latest.headers.get('Access-Control-Allow-Origin') === 'https://castillotech.github.io');
}

console.log(failed ? `\n${failed} failed` : '\nall push checks passed');
process.exit(failed ? 1 : 0);
