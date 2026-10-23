// Cloud backup: the app uploads its data already encrypted with a passphrase that never leaves the phone,
// so this server only ever holds unreadable bytes. One copy per day is kept for 30 days, plus the latest.
//
//   PUT  /backup              body: the encrypted backup (binary)        header: X-Companion-Code
//   GET  /backup[?date=...]   the latest backup, or the one from that day
//   GET  /backups             list of saved days with their sizes
import { sameCode } from './chat.js';

const MAX_BYTES = 20 * 1024 * 1024;
const MAGIC = [0x4d, 0x4d, 0x42, 0x31];   // "MMB1": every backup the app makes starts with this

export async function handleBackup(req, env, json, path, url, cors = {}) {
  if (!env.COMPANION_CODE) return json({ error: 'not_configured' }, 503);
  if (!sameCode(req.headers.get('X-Companion-Code') || '', env.COMPANION_CODE)) return json({ error: 'bad_code' }, 401);

  if (req.method === 'PUT' && path === '/backup') {
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length > MAX_BYTES) return json({ error: 'too_large' }, 413);
    if (buf.length < 40 || !MAGIC.every((b, i) => buf[i] === b)) return json({ error: 'not_a_backup' }, 400);
    const t = Date.now(), date = typeof url.searchParams.get('date') === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('date')) ? url.searchParams.get('date') : new Date(t).toISOString().slice(0, 10);
    const meta = { t, size: buf.length, date };
    await env.SUBS.put('backup:latest', buf, { metadata: meta });
    await env.SUBS.put('backup:' + date, buf, { metadata: meta, expirationTtl: 30 * 86400 });
    return json({ ok: true, ...meta });
  }
  if (req.method === 'GET' && path === '/backups') {
    const out = [];
    let cursor;
    do {
      const page = await env.SUBS.list({ prefix: 'backup:', cursor });
      for (const k of page.keys) if (k.name !== 'backup:latest' && k.metadata) out.push(k.metadata);
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    out.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.t - a.t);
    return json({ backups: out });
  }
  if (req.method === 'GET' && path === '/backup') {
    const date = url.searchParams.get('date'), key = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? 'backup:' + date : 'backup:latest';
    const { value, metadata } = await env.SUBS.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!value) return json({ error: 'none' }, 404);
    return new Response(value, { headers: { ...cors, 'Content-Type': 'application/octet-stream', 'X-Backup-Time': String((metadata && metadata.t) || ''), 'Access-Control-Expose-Headers': 'X-Backup-Time' } });
  }
  return json({ error: 'not found' }, 404);
}
