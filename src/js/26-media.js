  /* ----- media: physique and form photos/videos ----- */

  // files are kept in a separate database so the main data stays small and fast
  const mdb = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const q = indexedDB.open('metamorph-media', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('files');
      q.onsuccess = () => { const db = q.result; db.onversionchange = () => { db.close(); dbp = null; }; res(db); };
      q.onerror = () => rej(q.error);
    }));
    const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
      const t = db.transaction('files', mode), out = fn(t.objectStore('files'));
      t.oncomplete = () => res(out && out.result);
      t.onerror = () => rej(t.error);
    }));
    return { get: id => tx('readonly', st => st.get(id)), put: (id, blob) => tx('readwrite', st => { st.put(blob, id); }), del: id => tx('readwrite', st => { st.delete(id); }) };
  })();
  const MAX_SIDE = 1600;
  // previews are kept in the media database too (not in the main save), cached here for drawing
  const thumbs = {};
  async function loadThumbs() {
    let moved = 0;
    for (const x of S.media) {
      if (x.thumb) { thumbs[x.id] = x.thumb; await mdb.put('thumb:' + x.id, x.thumb).catch(() => {}); delete x.thumb; moved++; }
      else if (!thumbs[x.id]) { const t = await mdb.get('thumb:' + x.id).catch(() => null); if (t) thumbs[x.id] = t; }
    }
    if (moved) save();
    if (S.media.length) render();
  }
  const extOf = type => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }[type] || (type.split('/')[1] || 'bin'));
  const fmtBytes = n => n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`;

  async function shrinkPhoto(file) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    const t = document.createElement('canvas'), tk = 260 / Math.max(c.width, c.height);
    t.width = Math.round(c.width * tk); t.height = Math.round(c.height * tk);
    t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
    return { blob: blob || file, thumb: t.toDataURL('image/jpeg', 0.7), w: c.width, h: c.height };
  }
  function videoThumb(file) {
    return new Promise(res => {
      const v = document.createElement('video'), url = URL.createObjectURL(file);
      let done = false;
      const finish = th => { if (done) return; done = true; URL.revokeObjectURL(url); res(th); };
      v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = url;
      v.onloadeddata = () => { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); } catch (e) { finish(null); } };
      v.onseeked = () => {
        try {
          const c = document.createElement('canvas'), k = 260 / Math.max(v.videoWidth || 1, v.videoHeight || 1);
          c.width = Math.round((v.videoWidth || 260) * k); c.height = Math.round((v.videoHeight || 260) * k);
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          finish({ thumb: c.toDataURL('image/jpeg', 0.7), dur: v.duration });
        } catch (e) { finish(null); }
      };
      v.onerror = () => finish(null);
      setTimeout(() => finish(null), 6000);
    });
  }

  // In-app camera for physique photos: a faint ghost of your last photo in the same pose helps you line up.
  let camStream = null, camTimer = 0;
  function camSheet() {
    const c = V.cam;
    return `<div class="camera">
      <div class="camstage ${c.facing === 'user' ? 'mirror' : ''}">
        <video id="camvid" playsinline muted autoplay></video>
        ${c.ghost ? `<img class="ghost" src="${c.ghost}" alt="">` : ''}
        ${c.count ? `<div class="camcount num">${c.count}</div>` : ''}
      </div>
      <div class="camctl">
        <div class="opts" style="justify-content:center">${['Front', 'Side', 'Back'].map(x => `<button data-act="cam-pose" data-v="${x}" class="${c.pose === x ? 'on' : ''}">${x}</button>`).join('')}</div>
        <p class="camhint">${c.ghost ? 'Line up with the faint outline of your last ' + c.pose.toLowerCase() + ' photo' : 'No earlier ' + c.pose.toLowerCase() + ' photo yet; this one becomes your guide'}</p>
        <div class="camrow">
          <button class="btn" data-act="cam-close">Close</button>
          <button class="shutter" data-act="cam-shoot" aria-label="Take photo"></button>
          <button class="btn" data-act="cam-flip" aria-label="Switch camera">Flip</button>
        </div>
        <div class="opts" style="justify-content:center;margin-top:8px">${[[0, 'No timer'], [3, '3 s'], [10, '10 s']].map(([v, l]) => `<button data-act="cam-timer" data-v="${v}" class="${c.timer === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div>
    </div>`;
  }
  async function camGhost() {
    const c = V.cam; if (!c) return;
    if (c.ghost) URL.revokeObjectURL(c.ghost);
    c.ghost = null;
    const last = S.media.filter(x => x.tag === 'physique' && x.kind === 'photo' && x.pose === c.pose).sort((a, b) => b.date.localeCompare(a.date) || b.t - a.t)[0];
    if (last) { const blob = await mdb.get(last.id).catch(() => null); if (blob && V.cam === c) c.ghost = URL.createObjectURL(blob); }
    render(); attachCam();
  }
  function attachCam() { const v = document.getElementById('camvid'); if (v && camStream && v.srcObject !== camStream) { v.srcObject = camStream; v.play().catch(() => {}); } }
  async function camStart() {
    camStop();
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: V.cam.facing, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false });
      attachCam();
    } catch (e) { V.cam = null; render(); snack('Camera unavailable. Use + Photo instead.'); }
  }
  function camStop() { clearInterval(camTimer); if (camStream) camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  async function camShoot() {
    const v = document.getElementById('camvid');
    if (!v || !v.videoWidth) return snack('Camera is still starting');
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
    const pose = V.cam.pose;
    beep(880, 0.08, 0); buzz();
    await importMedia([new File([blob], `physique-${today()}.jpg`, { type: 'image/jpeg' })], { tag: 'physique', pose, date: today(), note: '' });
    camGhost();
  }

  async function importMedia(files, meta) {
    let n = 0, big = 0;
    snack(`Adding ${files.length} item${files.length === 1 ? '' : 's'}…`);
    for (const file of files) {
      const isVideo = file.type.startsWith('video/'), id = uid();
      try {
        let blob = file, thumb = null, extra = {};
        if (isVideo) { const th = await videoThumb(file); if (th) { thumb = th.thumb; extra.dur = th.dur; } if (file.size > 150e6) big++; }
        else { const r = await shrinkPhoto(file); blob = r.blob; thumb = r.thumb; extra = { w: r.w, h: r.h }; }
        await mdb.put(id, blob);
        if (thumb) { await mdb.put('thumb:' + id, thumb); thumbs[id] = thumb; }
        S.media.push({ id, kind: isVideo ? 'video' : 'photo', type: blob.type || file.type, size: blob.size, date: meta.date, t: Date.now(),
                       tag: meta.tag, pose: meta.tag === 'physique' ? meta.pose : null, exercise: meta.tag === 'form' ? meta.exercise : null, note: meta.note || '', ...extra });
        n++;
      } catch (e) { console.warn('media import failed', e); }
    }
    save(); render();
    snack(n ? `Added ${n}${big ? ' · large videos use a lot of space; back them up and delete old ones' : ''}` : 'Couldn’t add that file.');
  }

  function mediaView() {
    const f = V.mfilter, all = [...S.media].sort((a, b) => b.date.localeCompare(a.date) || b.t - a.t);
    const list = all.filter(x => f === 'all' || x.tag === f);
    const groups = [];
    for (const x of list) { const m = x.date.slice(0, 7); let g = groups.find(y => y.m === m); if (!g) groups.push(g = { m, xs: [] }); g.xs.push(x); }
    const used = S.media.reduce((t, x) => t + (x.size || 0), 0);
    return `
      <div class="grid3" style="margin-bottom:10px">
        <button class="btn primary" data-act="cam-open">Camera</button>
        <button class="btn" data-act="m-add" data-kind="image">+ Photo</button>
        <button class="btn" data-act="m-add" data-kind="video">+ Video</button>
      </div>
      <input type="file" id="mfile" accept="image/*" multiple hidden>
      <input type="file" id="mfilev" accept="video/*" hidden>
      <div class="opts" style="margin-bottom:12px">${[['all', 'All'], ['physique', 'Physique'], ['form', 'Form']].map(([k, l]) => `<button data-act="m-filter" data-v="${k}" class="${f === k ? 'on' : ''}">${l}</button>`).join('')}
        ${S.media.filter(x => x.tag === 'physique' && x.kind === 'photo').length > 1 ? '<button data-act="m-compare">Compare</button>' : ''}</div>
      ${groups.length ? groups.map(g => `<div class="grouphead"><h3>${esc(parseKey(g.m + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))}</h3><span class="muted num" style="font-size:13px">${g.xs.length}</span></div>
        <div class="mgrid">${g.xs.map(x => `<button class="mtile" data-act="m-open" data-id="${x.id}" aria-label="${esc(x.kind)} ${esc(dayLabel(x.date))}">
          ${thumbs[x.id] || x.thumb ? `<img src="${thumbs[x.id] || x.thumb}" alt="" draggable="false">` : `<span class="mph">${x.kind === 'video' ? '▶' : '◻'}</span>`}
          ${x.kind === 'video' ? '<span class="mbadge">▶</span>' : ''}
          <span class="mcap">${esc(x.tag === 'form' ? (x.exercise || 'Form') : (x.pose || 'Physique'))}</span></button>`).join('')}</div>`).join('')
        : '<p class="muted">Add progress photos (front, side, back) to see your physique change, and videos of your lifts to check your form.</p>'}
      <div class="card" style="margin-top:16px">
        <div class="row spread"><span class="label" style="margin:0">Media backup</span><span class="muted num" style="font-size:13px">${S.media.length} items · ${fmtBytes(used)}</span></div>
        <p class="note" style="margin:6px 0 10px">Photos and videos aren’t in the regular backup. Save them as a ZIP to Drive or Files; it restores on any device.</p>
        <div class="grid2"><button class="btn" data-act="m-backup" ${S.media.length ? '' : 'disabled'}>Back up media</button><button class="btn" data-act="m-restore">Restore media</button></div>
        <input type="file" id="mzip" accept=".zip,application/zip" hidden>
      </div>`;
  }

  function mediaUpSheet() {
    const u = V.mup, lib = WK().library.filter(x => x.kind === 'strength');
    return `<div class="sheet-bg ${u.fresh ? 'enter' : ''}" data-act="m-up-cancel-bg"><form class="sheet" id="mupf" autocomplete="off"><div class="grab" aria-hidden="true"></div>
      <h2>Add ${u.files.length} ${u.video ? 'video' : u.files.length === 1 ? 'photo' : 'photos'}</h2>
      <div class="opts" style="margin-bottom:12px">${[['physique', 'Physique'], ['form', 'Form check']].map(([k, l]) => `<button type="button" data-act="m-tag" data-v="${k}" class="${u.tag === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${u.tag === 'physique' ? `<p class="label">Pose</p><div class="opts" style="margin-bottom:12px">${['Front', 'Side', 'Back', 'Other'].map(x => `<button type="button" data-act="m-pose" data-v="${x}" class="${u.pose === x ? 'on' : ''}">${x}</button>`).join('')}</div>`
        : `<div class="field"><label>Exercise</label><input name="exercise" list="m-ex" value="${esc(u.exercise || '')}" placeholder="Squat, bench press…" autocapitalize="words"><datalist id="m-ex">${lib.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist></div>`}
      <div class="grid2"><div class="field"><label>Date</label><input name="date" type="date" value="${u.date}" max="${today()}"></div><div class="field"><label>Note</label><input name="note" value="${esc(u.note || '')}" placeholder="optional"></div></div>
      <button class="btn primary block" type="submit" style="margin-bottom:8px">Save</button>
      <button class="btn block" type="button" data-act="m-up-cancel">Cancel</button></form></div>`;
  }

  function mediaViewSheet() {
    const x = S.media.find(m => m.id === V.mview);
    if (!x) return '';
    const src = V.murl;
    return `<div class="sheet-bg ${V.mviewFresh ? 'enter' : ''}" data-act="m-close-bg"><div class="sheet mviewer"><div class="grab" aria-hidden="true"></div>
      <div class="mstage">${!src ? '<p class="muted">Loading…</p>' : x.kind === 'video' ? `<video src="${src}" controls playsinline preload="metadata"></video>` : `<img src="${src}" alt="${esc(x.pose || 'photo')}">`}</div>
      <p style="margin:10px 0 2px;font-weight:600">${esc(x.tag === 'form' ? `Form · ${x.exercise || 'exercise'}` : `Physique · ${x.pose || ''}`)}</p>
      <p class="muted" style="margin:0 0 10px;font-size:14px">${esc(dayLabel(x.date))}${x.size ? ` · ${fmtBytes(x.size)}` : ''}${x.dur ? ` · ${Math.round(x.dur)}s` : ''}${x.note ? ` · ${esc(x.note)}` : ''}</p>
      <div class="grid2"><button class="btn" data-act="m-save" data-id="${x.id}">Save / share</button><button class="btn danger" data-act="m-del" data-id="${x.id}">Delete</button></div>
      <button class="btn ghost block" data-act="m-close" style="margin-top:8px">Close</button></div></div>`;
  }

  function compareSheet() {
    const c = V.mcmp, ph = S.media.filter(x => x.tag === 'physique' && x.kind === 'photo').sort((a, b) => a.date.localeCompare(b.date));
    const pick = (side, id) => `<select data-mcmp="${side}">${ph.map(x => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${esc(dayLabel(x.date))} · ${esc(x.pose || '')}</option>`).join('')}</select>`;
    return `<div class="sheet-bg ${c.fresh ? 'enter' : ''}" data-act="m-cmp-close-bg"><div class="sheet"><div class="grab" aria-hidden="true"></div>
      <h2>Compare</h2>
      <div class="cmpgrid">
        <div>${c.urlA ? `<img src="${c.urlA}" alt="before">` : '<p class="muted">…</p>'}${pick('a', c.a)}</div>
        <div>${c.urlB ? `<img src="${c.urlB}" alt="after">` : '<p class="muted">…</p>'}${pick('b', c.b)}</div>
      </div>
      <p class="muted num" style="text-align:center;font-size:13px;margin:8px 0 0">${(() => { const A = ph.find(x => x.id === c.a), Bb = ph.find(x => x.id === c.b); return A && Bb ? `${Math.abs(daysBetween(A.date, Bb.date))} days apart` : ''; })()}</p>
      <button class="btn ghost block" data-act="m-cmp-close" style="margin-top:8px">Close</button></div></div>`;
  }
  async function loadCompare() {
    const c = V.mcmp; if (!c) return;
    for (const side of ['A', 'B']) {
      const id = c[side.toLowerCase()];
      if (c['for' + side] === id) continue;
      if (c['url' + side]) URL.revokeObjectURL(c['url' + side]);
      const blob = await mdb.get(id).catch(() => null);
      c['url' + side] = blob ? URL.createObjectURL(blob) : null; c['for' + side] = id;
    }
    render();
  }

  // the JSZip library is only loaded when backing up or restoring media
  function loadZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'vendor/jszip.min.js'; sc.onload = () => res(window.JSZip); sc.onerror = rej; document.head.appendChild(sc); });
  }
  async function backupMedia() {
    const total = S.media.reduce((t, x) => t + (x.size || 0), 0);
    if (total > 600e6 && !(await ask({ title: 'Large backup', text: `About ${fmtBytes(total)}. Building it may be slow on a phone. Continue?`, ok: 'Continue' }))) return;
    snack('Building media backup…');
    const JSZip = await loadZip(), zip = new JSZip(), meta = [];
    for (const x of S.media) {
      const blob = await mdb.get(x.id).catch(() => null);
      if (!blob) continue;
      const name = `media/${x.id}.${extOf(x.type)}`;
      zip.file(name, blob, { binary: true });
      meta.push({ ...x, thumb: thumbs[x.id] || x.thumb || null, file: name });
    }
    zip.file('manifest.json', JSON.stringify({ app: 'metamorph-media', exported: new Date().toISOString(), items: meta }, null, 1));
    const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    S.lastMediaBackup = Date.now(); save();
    const zipBlob = new Blob([out], { type: 'application/zip' });
    // building takes a moment, so ask for a fresh tap before opening the share sheet
    if (await ask({ title: 'Media backup ready', text: `${meta.length} items · ${fmtBytes(zipBlob.size)}. Save it somewhere off this phone (Drive, Files, email).`, ok: 'Save / share' }))
      deliver(zipBlob, `metamorph-media-${today()}.zip`, 'MetaMorph media backup');
  }
  async function restoreMedia(file) {
    try {
      snack('Reading backup…');
      const JSZip = await loadZip(), zip = await JSZip.loadAsync(file);
      const man = JSON.parse(await zip.file('manifest.json').async('string'));
      if (man.app !== 'metamorph-media') return snack('That isn’t a MetaMorph media backup.');
      let n = 0;
      for (const it of man.items) {
        if (S.media.some(x => x.id === it.id)) continue;
        const f = zip.file(it.file); if (!f) continue;
        const blob = new Blob([await f.async('arraybuffer')], { type: it.type });
        await mdb.put(it.id, blob);
        const { file: _, thumb: th, ...meta } = it;
        if (th) { await mdb.put('thumb:' + it.id, th); thumbs[it.id] = th; }
        S.media.push(meta); n++;
      }
      save(); render(); snack(n ? `Restored ${n} item${n === 1 ? '' : 's'}` : 'Everything in that backup is already here.');
    } catch (e) { snack('Couldn’t read that file as a media backup.'); }
  }

