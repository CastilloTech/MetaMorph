  /* ----- cloud backup: encrypted on this phone with your passphrase, kept on your own server ----- */
  // Format: "MMB1" | flags (1 = gzip) | salt (16) | iv (12) | AES-GCM ciphertext of the same JSON as a backup file.
  // The key is derived from your passphrase (PBKDF2-SHA256) and kept only on this device, never in your data,
  // a backup or on the server, so the server holds bytes it can't read.

  const CB = () => S.cloud;
  const CB_MAGIC = [0x4d, 0x4d, 0x42, 0x31], CB_ITER = 310000, CB_EVERY = 20 * 3600000;
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = u => btoa(String.fromCharCode(...u)), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const cat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
  const gzip = async (bytes, back) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(back ? new DecompressionStream('gzip') : new CompressionStream('gzip'))).arrayBuffer());

  async function cbDerive(pass, salt) {
    const base = await crypto.subtle.importKey('raw', te.encode(pass.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: CB_ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  let cbKey = null;
  const cbKeyReady = idb.get('cloudKey').then(k => { cbKey = k || null; }).catch(() => {});

  async function cbEncrypt(json) {
    let bytes = te.encode(json), flags = 0;
    if (window.CompressionStream) { bytes = await gzip(bytes); flags = 1; }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cbKey, bytes));
    return cat(new Uint8Array(CB_MAGIC), new Uint8Array([flags]), unb64(CB().salt), iv, ct);
  }
  // returns { data, salt, key } or throws 'not_a_backup' / 'wrong_passphrase'
  async function cbDecrypt(buf, pass) {
    const u = new Uint8Array(buf);
    if (u.length < 40 || !CB_MAGIC.every((b, i) => u[i] === b)) throw new Error('not_a_backup');
    const flags = u[4], salt = u.slice(5, 21), iv = u.slice(21, 33), key = await cbDerive(pass, salt);
    let bytes;
    try { bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, u.slice(33))); } catch (e) { throw new Error('wrong_passphrase'); }
    if (flags & 1) bytes = await gzip(bytes, true);
    const payload = JSON.parse(td.decode(bytes)), data = payload && payload.data ? payload.data : payload;
    if (!valid(data)) throw new Error('not_a_backup');
    return { data, salt, key, exported: payload.exported };
  }

  let cbBusy = false;
  async function cloudBackup(manual = false) {
    await cbKeyReady;
    if (!CB().on || !cbKey || !PUSH_URL || !SV().code || cbBusy) return false;
    cbBusy = true;
    try {
      const body = await cbEncrypt(JSON.stringify({ app: 'metamorph', exported: new Date().toISOString(), data: S }));
      const res = await fetch(`${PUSH_URL}/backup?date=${today()}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'X-Companion-Code': SV().code }, body });
      if (!res.ok) throw new Error(res.status === 401 ? 'The pairing code was refused.' : res.status === 413 ? 'Your data is too large for a cloud backup.' : `The server answered ${res.status}.`);
      CB().last = Date.now(); CB().size = body.length; CB().err = null; save();
      if (V.data) render();
      if (manual) snack('Backed up to your server');
      return true;
    } catch (e) {
      CB().err = /fetch|network|load failed/i.test(e.message) ? 'Couldn’t reach your server.' : e.message; save();
      if (V.data) render();
      if (manual) snack(`Backup failed: ${CB().err}`);
      return false;
    } finally { cbBusy = false; }
  }
  // once a day, whenever the app is in use
  const cbDue = () => CB().on && Date.now() - (CB().last || 0) > CB_EVERY;
  booted.then(() => setTimeout(() => { if (cbDue()) cloudBackup(); }, 4000));
  document.addEventListener('visibilitychange', () => { if (cbDue()) cloudBackup(); });

  async function cbTurnOn(pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    snack('Securing your backups…');
    cbKey = await cbDerive(pass, salt);
    await idb.set('cloudKey', cbKey);
    Object.assign(CB(), { on: true, salt: b64(salt), err: null });
    save(); render();
    await cloudBackup(true);
  }
  async function cbTurnOff() {
    cbKey = null;
    await idb.set('cloudKey', null).catch(() => {});
    Object.assign(CB(), { on: false, salt: null });
    save(); render(); snack('Cloud backup off. Backups already on your server stay for up to 30 days.');
  }

  function cloudSettings() {
    if (!PUSH_URL) return '';
    const c = CB(), when = t => `${ago(t)} ${hm(t)}`;
    const head = '<p class="label" style="margin-top:18px">Cloud backup</p>';
    if (!SV().code) return `${head}<p class="note" style="margin:0 0 6px">Backs up your data, encrypted, to your own server every day. First enter the pairing code from your server setup.</p>
      <form id="cbcodef"><div class="field"><input id="cbcode" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Pairing code"></div><button class="btn block" type="submit">Save code</button></form>`;
    if (!c.on) return `${head}<p class="note" style="margin:0 0 6px">Every day your data is encrypted on this phone with a passphrase only you know, then saved to your server, which can’t read it. If you lose or reset your phone, restore it here. Photos and videos aren’t included (use the media backup in Body → Media).</p>
      <form id="cbonf"><div class="field"><label>Passphrase</label><input type="password" id="cbpass" autocomplete="new-password" minlength="8" placeholder="At least 8 characters"></div>
        <div class="field"><label>Type it again</label><input type="password" id="cbpass2" autocomplete="new-password"></div>
        <p class="note" style="margin:-2px 0 8px"><b>Write it down.</b> Without it, your backups can’t be opened by anyone, including you.</p>
        <button class="btn primary block" type="submit">Turn on cloud backup</button></form>
      <button class="btn ghost block" data-act="cb-restore" style="margin-top:8px">Restore from a cloud backup</button>`;
    return `${head}
      <div class="kv"><span>Last cloud backup</span><span class="v ${c.err ? 'warn' : c.last ? 'good' : ''}">${c.last ? `${when(c.last)} · ${Math.max(1, Math.round(c.size / 1024))} KB` : 'Not yet'}</span></div>
      ${c.err ? `<p class="note warn" style="margin:4px 0">${esc(c.err)}</p>` : ''}
      <p class="note" style="margin:4px 0 8px">Daily while you use the app, encrypted with your passphrase. The last 30 days are kept.</p>
      <div class="grid2"><button class="btn" data-act="cb-now">Back up now</button><button class="btn" data-act="cb-restore">Restore…</button></div>
      <div class="row spread" style="margin-top:8px"><button class="linkbtn" data-act="cb-change">Change passphrase</button><button class="linkbtn" data-act="cb-off">Turn off</button></div>`;
  }

  /* --- restore (also how you move to a new phone) --- */
  function cbRestoreSheet() {
    const r = V.cbr;
    let body;
    if (r.step === 'pass') body = `<p class="note">Enter the passphrase you used for cloud backup. ${SV().code ? '' : 'You’ll also need your pairing code.'}</p>
      <form id="cbrf">${SV().code ? '' : '<div class="field"><label>Pairing code</label><input id="cbrcode" autocomplete="off" autocapitalize="off" spellcheck="false"></div>'}
        <div class="field"><label>Passphrase</label><input type="password" id="cbrpass" autocomplete="current-password"></div>
        <button class="btn primary block" type="submit" ${r.busy ? 'disabled' : ''}>${r.busy ? 'Looking…' : 'Find my backups'}</button></form>`;
    else body = `<p class="note">Pick a day. Restoring replaces everything on this phone with that backup.</p>
      ${r.list.length ? `<ul class="cblist">${r.list.slice(0, 30).map((b, i) => `<li><span><b>${esc(parseKey(b.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }))}</b><small class="num">${hm(b.t)} · ${Math.max(1, Math.round(b.size / 1024))} KB${i === 0 ? ' · latest' : ''}</small></span>
        <button class="btn small ${i === 0 ? 'primary' : ''}" data-act="cb-pick" data-v="${esc(b.date)}" ${r.busy ? 'disabled' : ''}>Restore</button></li>`).join('')}</ul>` : '<p class="muted">No backups on your server yet.</p>'}`;
    return `<div class="sheet-bg ${r.fresh ? 'enter' : ''}" data-act="cb-close-bg"><div class="sheet"><div class="grab" aria-hidden="true"></div>
      <h2>Restore from cloud</h2>${body}${r.err ? `<p class="note warn">${esc(r.err)}</p>` : ''}
      <button class="btn ghost block" data-act="cb-close" style="margin-top:8px">Cancel</button></div></div>`;
  }
  async function cbFetchList() {
    const res = await fetch(PUSH_URL + '/backups', { headers: { 'X-Companion-Code': SV().code } });
    if (res.status === 401) throw new Error('That pairing code was refused.');
    if (!res.ok) throw new Error('Couldn’t reach your server.');
    return (await res.json()).backups || [];
  }
  async function cbRestore(date) {
    const r = V.cbr;
    r.busy = true; r.err = null; render();
    try {
      const res = await fetch(`${PUSH_URL}/backup?date=${encodeURIComponent(date)}`, { headers: { 'X-Companion-Code': SV().code } });
      if (!res.ok) throw new Error('not_found');
      const got = await cbDecrypt(await res.arrayBuffer(), r.pass);
      const label = parseKey(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      r.busy = false; render();
      if (!(await ask({ title: 'Replace this phone’s data?', text: `Everything here will be replaced with your backup from ${label}.`, ok: 'Restore', danger: true }))) return;
      const code = SV().code;
      replaceState(got.data);
      // keep this device connected and keep backing up with the same passphrase
      S.servitor.code = code; S.onboarded = true; V.onboard = null;
      cbKey = got.key; await idb.set('cloudKey', cbKey);
      Object.assign(S.cloud, { on: true, salt: b64(got.salt), err: null });
      save(); flushIdb();
      V.cbr = null; render(); snack(`Restored your data from ${label}`);
    } catch (e) {
      r.busy = false;
      r.err = e.message === 'wrong_passphrase' ? 'That passphrase doesn’t open this backup. (If you changed it, older backups use the old one.)' : e.message === 'not_a_backup' ? 'That backup couldn’t be read.' : 'Couldn’t download that backup.';
      render();
    }
  }

  $app.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || !el.dataset.act.startsWith('cb-')) return;
    // a redraw can reuse the tapped element for another button: stop the generic handlers from acting on it too
    e.stopImmediatePropagation();
    switch (el.dataset.act) {
      case 'cb-now': cloudBackup(true); break;
      case 'cb-off': ask({ title: 'Turn off cloud backup?', text: 'New backups stop. The ones on your server stay for up to 30 days.', ok: 'Turn off', danger: true }).then(y => { if (y) cbTurnOff(); }); break;
      case 'cb-change': Object.assign(CB(), { on: false }); save(); render(); snack('Choose a new passphrase below. Older backups keep the old one.'); break;
      case 'cb-restore': V.data = false; V.cbr = { step: 'pass', fresh: true, list: [], pass: '' }; render(); V.cbr.fresh = false; break;
      case 'cb-close-bg': if (e.target !== el) break;   // falls through
      case 'cb-close': V.cbr = null; render(); break;
      case 'cb-pick': cbRestore(el.dataset.v); break;
    }
  });
  $app.addEventListener('submit', async e => {
    const f = e.target;
    if (f.id === 'cbcodef') {
      e.preventDefault();
      const code = document.getElementById('cbcode').value.trim();
      if (code.length < 8) return snack('That code looks too short.');
      SV().code = code; save(); render();
    }
    if (f.id === 'cbonf') {
      e.preventDefault();
      const a = document.getElementById('cbpass').value, b = document.getElementById('cbpass2').value;
      if (a.length < 8) return snack('Use at least 8 characters.');
      if (a !== b) return snack('The two passphrases don’t match.');
      cbTurnOn(a);
    }
    if (f.id === 'cbrf') {
      e.preventDefault();
      const r = V.cbr, codeEl = document.getElementById('cbrcode'), pass = document.getElementById('cbrpass').value;
      if (codeEl) { if (codeEl.value.trim().length < 8) return snack('Enter your pairing code.'); SV().code = codeEl.value.trim(); save(); }
      if (!pass) return snack('Enter your passphrase.');
      r.pass = pass; r.busy = true; r.err = null; render();
      try { r.list = await cbFetchList(); r.step = 'pick'; } catch (err) { r.err = err.message; }
      r.busy = false; render();
    }
  });
