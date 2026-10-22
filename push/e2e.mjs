// End-to-end push check on this machine: runs the worker locally (real keys from ~/.metamorph/vapid.json),
// serves the app pointed at it, subscribes a real browser, syncs, then fires a reminder through the real push service.
// Run from the repo root: node push/e2e.mjs
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import worker, { tick } from './src/worker.js';

const require = createRequire(import.meta.url);
const puppeteer = require('../node_modules/puppeteer-core');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const vapid = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.metamorph', 'vapid.json'), 'utf8'));
const APP_PORT = 8766, API_PORT = 8787, ORIGIN = `http://127.0.0.1:${APP_PORT}`;
const kv = { data: {}, async get(k) { return this.data[k] ?? null; }, async put(k, v) { this.data[k] = v; } };
const env = { SUBS: kv, VAPID_PUBLIC: vapid.publicKey, VAPID_PRIVATE_JWK: JSON.stringify(vapid.privateJwk), VAPID_SUBJECT: 'https://github.com/CastilloTech/MetaMorph', ALLOWED_ORIGINS: ORIGIN };
let failed = 0;
const ok = (n, v) => { console.log((v ? 'PASS ' : 'FAIL ') + n); if (!v) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// the worker behind a plain node server
const api = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const r = await worker.fetch(new Request(`http://127.0.0.1:${API_PORT}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(API_PORT, '127.0.0.1');

// the app, with PUSH_URL pointing at the local worker
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const app = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html', file = path.join(ROOT, 'app', rel);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(file);
  if (rel === 'index.html') body = Buffer.from(body.toString().replace(/const PUSH_URL = '[^']*';/, `const PUSH_URL = 'http://127.0.0.1:${API_PORT}';`));
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body);
}).listen(APP_PORT, '127.0.0.1');

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
try {
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(ORIGIN, ['notifications']);
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('page error:', e.message));
  await p.goto(ORIGIN + '/index.html');
  await p.waitForFunction(() => navigator.serviceWorker.controller, { timeout: 20000 });
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('metamorph.v1')); s.onboarded = true; s.seenVersion = 999; localStorage.setItem('metamorph.v1', JSON.stringify(s)); });
  await p.reload(); await sleep(800);
  await p.$eval('[data-act=data]', e => e.click()); await sleep(300);
  ok('Settings offers "Turn on reminders"', !!(await p.$('[data-act=rm-on]')));
  await p.$eval('[data-act=rm-on]', e => e.click()); await sleep(6000);
  const users = JSON.parse(kv.data.subs || '{}'), u = Object.values(users)[0];
  ok(`subscribed with a real push service (${u ? new URL(u.sub.endpoint).host : 'none'})`, !!u && u.sub.endpoint.startsWith('https://'));
  ok(`schedule synced (${u ? u.items.length : 0} reminders, tz ${u && u.tz})`, !!u && u.items.length > 0 && u.tz === Intl.DateTimeFormat().resolvedOptions().timeZone);
  ok('Settings shows reminders on', (await p.$eval('.sheet', e => e.textContent)).includes('Up to date'));
  // make one reminder due right now and fire it through the push service
  if (u) {
    const now = new Date(), hh = String(now.getHours()).padStart(2, '0'), mm = String(now.getMinutes()).padStart(2, '0');
    u.items.push({ id: 'e2e', at: `${hh}:${mm}`, title: 'E2E reminder', body: 'delivered through the real push service', tag: 'e2e' });
    await kv.put('subs', JSON.stringify(users));
    const sent = await tick(env, now);
    ok(`push accepted by the push service (${sent} sent)`, sent >= 1);
    let shown = [];
    for (let i = 0; i < 20 && !shown.some(n => n.title === 'E2E reminder'); i++) {
      await sleep(1000);
      shown = await p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map(n => ({ title: n.title, body: n.body })));
    }
    ok(`notification shown on the device (${shown.map(n => n.title).join(', ') || 'none'})`, shown.some(n => n.title === 'E2E reminder' && n.body.includes('real push service')));
  }
} catch (e) { ok('CRASH ' + e.message, false); }
await browser.close(); api.close(); app.close();
console.log(failed ? `\n${failed} failed` : '\nend-to-end push works');
process.exit(failed ? 1 : 0);
