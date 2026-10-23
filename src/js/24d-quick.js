  /* ----- quick logging: Siri & Shortcuts inbox, reminder taps that open to the action, quick bar ----- */

  /* --- reminder taps (and links) open straight to the action --- */
  function quickFromUrl(href, draw = true) {
    let u;
    try { u = new URL(href, location.href); } catch (e) { return; }
    const d = u.searchParams.get('do');
    if (!d) return;
    if (d === 'review') { const dd = pdayDate(); V.review = keyOf(addDays(dd, -((dd.getDay() + 6) % 7))); V.reviewFresh = true; }
    else if (d === 'chat') { if (svBorn()) { V.sv = 'chat'; V.svFresh = true; } }
    else if (['water', 'routine', 'todo'].includes(d)) V.quick = { do: d, id: u.searchParams.get('id'), ml: +u.searchParams.get('ml') || 0, fresh: true };
    if (location.search.includes('do=')) history.replaceState(null, '', location.pathname);
    if (draw) { render(); V.reviewFresh = false; V.svFresh = false; }
  }
  quickFromUrl(location.href, false);   // drawn by the first render
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.type === 'quick' && e.data.url) quickFromUrl(e.data.url);
  });

  function quickSheet() {
    const q = V.quick;
    let body;
    if (q.do === 'water') {
      const st = wState(), ml = q.ml || W().pour;
      body = `<div class="qhead">${DROP}<div><h2>Log ${fmtW(ml)} of water?</h2><span class="muted num">${fmtW(st.got)} of ${fmtW(st.target)} so far today</span></div></div>
        <button class="btn water block" data-act="q-water" data-ml="${ml}">Log ${fmtW(ml)}</button>`;
    } else if (q.do === 'routine') {
      const f = svFindRoutine(q.id);
      if (!f) body = '<h2>That routine no longer exists</h2>';
      else {
        const { gate, r } = f, st = status(r);
        body = `<div class="qhead">${orb(gate, 48)}<div><h2>${esc(r.title)}</h2><span class="muted num">${gateOf(gate).name} · ${clock(startFor(r))} · ${dur(total(r))}</span></div></div>
          ${st === 'done' ? `<p class="muted">Already done today ✓</p>`
            : `<p class="muted" style="margin:0 0 12px">${st === 'now' ? 'On now.' : st === 'upcoming' ? `Starts ${untilText(r)}.` : 'Overdue. Completing now records it as done late.'}</p>
          <button class="btn primary block" data-act="q-done" data-gate="${gate}" data-id="${r.id}">${st === 'open' ? 'Done (late)' : 'Complete'}</button>
          <div class="grid2" style="margin-top:8px"><button class="btn" data-act="q-run" data-gate="${gate}" data-id="${r.id}">Open timer</button><button class="btn" data-act="q-skip" data-id="${r.id}">Skip today</button></div>`}`;
      }
    } else {
      const x = S.todos.find(t => t.id === q.id);
      body = !x ? '<h2>That task no longer exists</h2>' : `<h2>${esc(x.text)}</h2><p class="muted">${x.done ? 'Already done ✓' : `Due ${x.time ? clock(x.time) : 'today'}`}</p>
        ${x.done ? '' : `<button class="btn primary block" data-act="q-todo" data-id="${x.id}">Mark done</button>`}`;
    }
    return `<div class="sheet-bg ${q.fresh ? 'enter' : ''}" data-act="q-close-bg"><div class="sheet qsheet"><div class="grab" aria-hidden="true"></div>
      ${body}<button class="btn ghost block" data-act="q-close" style="margin-top:8px">Not now</button></div></div>`;
  }

  /* --- quick bar on Today --- */
  function lastFood() {
    let best = null;
    for (let i = 0; i < 14; i++) for (const e of nLog(keyOf(addDays(pdayDate(), -i)))) if (!best || e.t > best.t) best = e;
    return best;
  }
  function quickBar() {
    const chips = [], last = on('macros') ? lastFood() : null;
    if (on('water')) chips.push(`<button class="qchip" data-act="w-add" data-ml="${W().pour}"><span class="qi w">${ICONS.drop}</span><span>+${fmtW(W().pour)}</span></button>`);
    if (last) chips.push(`<button class="qchip" data-act="q-again" title="Log ${esc(last.name)} again"><span class="qi">${ICONS.again}</span><span>${esc(last.name.length > 18 ? last.name.slice(0, 17) + '…' : last.name)}</span></button>`);
    if (on('body')) chips.push(`<button class="qchip" data-act="q-weigh"><span class="qi">${ICONS.scale}</span><span>Weight</span></button>`);
    if (on('companion') && svBorn()) chips.push(`<button class="qchip" data-act="sv-tab" data-v="chat"><span class="qi">${ICONS.chat}</span><span>${esc(svName())}</span></button>`);
    return chips.length > 1 ? `<div class="qbar" role="toolbar" aria-label="Quick log">${chips.join('')}</div>` : '';
  }

  /* --- Siri & Shortcuts inbox --- */
  // log water at the moment it was sent, checking off the sip it belongs to
  function addWaterAt(ml, t) {
    const k = pdayOf(t);
    if (k === today()) {
      const row = wState().rows.find(e => !e.done && t >= e.at - 20 * 60000 && t <= e.at + SIP_GRACE);
      if (row) { W().hit[k] = W().hit[k] || {}; W().hit[k][row.id] = true; }
    }
    (W().log[k] = W().log[k] || []).push({ t, ml: Math.round(ml) });
  }
  // the routine that was on when "done" was sent (or the latest one that had started)
  function routineAt(t) {
    const k = pdayOf(t), list = allRoutines(parseKey(k)).filter(({ r }) => !isDone(r.id, k));
    return { k, pick: list.find(({ r }) => { const w = windowOf(r, k); return t >= w.start && t <= w.end; }) || list.filter(({ r }) => windowOf(r, k).start <= t).pop() };
  }
  function applyInbox(x) {
    if (x.kind === 'water') {
      const n = +x.amount || 0, unit = x.unit || W().unit;
      const ml = !n ? W().pour : unit === 'oz' ? n * ML_OZ : unit === 'l' ? n * 1000 : n;
      if (ml < 1 || ml > 5000) return null;
      addWaterAt(ml, x.t);
      return `${fmtW(ml)} water`;
    }
    if (x.kind === 'weight') {
      const lb = Math.round((x.unit === 'kg' ? x.value * 2.20462 : +x.value) * 10) / 10;
      if (!(lb > 50 && lb < 1000)) return null;
      B().entries.push({ id: uid(), t: x.t, date: pdayOf(x.t), weight: lb });
      return `weight ${lb} lb`;
    }
    if (x.kind === 'done') {
      const { k, pick } = routineAt(x.t);
      if (!pick) return `nothing was on at ${hm(x.t)} to mark done`;
      completeRoutine(pick.r, true, k, false);
      setFin(pick.r.id, x.t, k);
      if (k === today()) checkHeld(pick.r, k);
      return `${pick.r.title} done at ${hm(x.t)}`;
    }
    return null;
  }
  let inboxBusy = false;
  async function pullInbox() {
    if (inboxBusy || !PUSH_URL || !SV().code || document.visibilityState !== 'visible') return;
    inboxBusy = true;
    try {
      const res = await fetch(PUSH_URL + '/inbox', { headers: { 'X-Companion-Code': SV().code } });
      if (!res.ok) return;
      const items = ((await res.json()).items || []).filter(x => x && x.id);
      const seen = SV().inboxSeen || (SV().inboxSeen = []);
      const fresh = items.filter(x => !seen.includes(x.id)).sort((a, b) => a.t - b.t);
      const said = [], notes = [];
      for (const x of fresh) {
        seen.push(x.id);
        if (x.kind === 'note') { notes.push(x); continue; }
        const r = applyInbox(x);
        if (r) said.push(r);
      }
      if (seen.length > 300) seen.splice(0, seen.length - 300);
      if (notes.length) {
        const when = x => `${pdayOf(x.t) === today() ? '' : parseKey(pdayOf(x.t)).toLocaleDateString(undefined, { weekday: 'short' }) + ' '}${hm(x.t)}`;
        if (svBorn() && svChatReady()) {
          SV().unread = true;
          svSend(notes.map(x => `(Sent from my phone at ${when(x)}) ${x.text}`).join('\n'));
        } else for (const x of notes) S.todos.push({ id: uid(), text: `From Siri (${when(x)}): ${x.text}`.slice(0, 200), date: today(), time: null, done: false, doneAt: null, created: Date.now() });
      }
      if (fresh.length) { save(); render(); }
      if (said.length) snack('From your phone: ' + said.join(' · '));
      // clear everything we've now seen, including anything applied before a failed clean-up
      if (items.length) fetch(PUSH_URL + '/inbox/ack', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Companion-Code': SV().code }, body: JSON.stringify({ ids: items.map(x => x.id) }) }).catch(() => {});
    } catch (e) {
    } finally { inboxBusy = false; }
  }
  booted.then(() => setTimeout(pullInbox, 700));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(pullInbox, 300); });

  /* --- setup screen: Siri & Shortcuts --- */
  function siriSheet() {
    const code = SV().code, addr = PUSH_URL + '/inbox', name = svBorn() ? svName() : 'your companion';
    const step = (title, text, extra = '') => `<li><b>${title}</b><span>${text}</span>${extra}</li>`;
    return `<div class="sheet-bg ${V.siriFresh ? 'enter' : ''}" data-act="siri-close-bg"><div class="sheet siri"><div class="grab" aria-hidden="true"></div>
      <h2>Siri &amp; Shortcuts</h2>
      <p class="note">Log from anywhere without opening MetaMorph: say “Hey Siri, log water”, double-tap the back of your phone, or tap a home-screen button. What you send waits on your server and goes in, with the time you sent it, the next time you open the app.</p>
      ${!PUSH_URL ? '<p class="note">This needs the reminder server, which isn’t set up in this copy of the app.</p>' : !code
        ? `<p class="label">First, your pairing code</p><form id="svcodef"><div class="field"><input id="svcode" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="xxxx-xxxx-xxxx-xxxx"></div><button class="btn primary block" type="submit">Save code</button></form>`
        : `<p class="label">You’ll paste these into each shortcut</p>
      <div class="kv"><span>Address</span><span class="v mono">${esc(addr)}</span></div><button class="btn small" data-act="siri-copy" data-v="${esc(addr)}">Copy address</button>
      <div class="kv"><span>Header name</span><span class="v mono">X-Companion-Code</span></div><button class="btn small" data-act="siri-copy" data-v="X-Companion-Code">Copy header name</button>
      <div class="kv"><span>Header value</span><span class="v mono">${esc(code)}</span></div><button class="btn small" data-act="siri-copy" data-v="${esc(code)}">Copy your code</button>

      <p class="label">Make the “Log water” shortcut</p>
      <ol class="steps">
        ${step('Open Shortcuts', 'Tap + (top right). Tap the name at the top and call it <i>Log water</i>.')}
        ${step('Add “Get Contents of URL”', 'Search for it in the action bar. Tap <i>URL</i> and paste the address.')}
        ${step('Set it to send', 'Tap the arrow (Show More). Method: <i>POST</i>. Headers: Add new header, key <i>X-Companion-Code</i>, value your code. Request Body: <i>JSON</i>, Add new field → Text, key <i>text</i>, value <i>water 500</i> (or <i>water 16 oz</i>).')}
        ${step('Add “Show Result”', 'So you see (and Siri says) the confirmation. Tap Done.')}
      </ol>
      <p class="label">Then three more, the same way</p>
      <ol class="steps">
        ${step('Done', 'Text value <i>done</i>. Marks the routine that’s on right now as done, at the time you ran it.')}
        ${step('Weight', 'Before “Get Contents of URL”, add <i>Ask for Input</i> (type Number, prompt “Your weight?”). Text value: <i>weight</i>, a space, then insert the <i>Provided Input</i> variable. Add <i>kg</i> at the end if you weigh in kilos.')}
        ${step(`Tell ${esc(name)}`, `Before “Get Contents of URL”, add <i>Dictate Text</i>. Text value: insert the <i>Dictated Text</i> variable. Say what you ate or anything else; ${esc(name)} turns it into cards to accept when you open the app.`)}
      </ol>
      <p class="label">Ways to run them</p>
      <ul class="steps">
        ${step('Siri', 'Say “Hey Siri,” then the shortcut’s name.')}
        ${step('Back Tap', 'Settings → Accessibility → Touch → Back Tap. Double Tap: Log water. Triple Tap: Done.')}
        ${step('Home screen', 'Long-press the home screen → + (or Edit → Add Widget) → Shortcuts. Pick the shortcuts to show.')}
        ${step('Control Center', 'On iOS 18: open Control Center → + → Add a Control → Shortcut.')}
      </ul>
      <button class="btn block" data-act="siri-check" style="margin-top:12px">Check for messages now</button>`}
      <button class="btn ghost block" data-act="siri-close" style="margin-top:8px">Close</button></div></div>`;
  }

  /* --- events --- */
  $app.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || !/^(q-|siri-)/.test(el.dataset.act)) return;
    // a redraw can reuse the tapped element for another button: stop the generic handlers from acting on it too
    e.stopImmediatePropagation();
    const act = el.dataset.act;
    switch (act) {
      case 'q-close-bg': if (e.target !== el) break;   // falls through
      case 'q-close': V.quick = null; render(); break;
      case 'q-water': { const ml = +el.dataset.ml; V.quick = null; addWater(ml); buzz(); render(); snack(`Logged ${fmtW(ml)}`); break; }
      case 'q-done': { const r = findRoutine(el.dataset.gate, el.dataset.id); V.quick = null; if (r && !isDone(r.id)) completeRoutine(r, true); buzz(); render(); break; }
      case 'q-run': V.quick = null; V.tab = 'today'; V.cal = 'day'; render(); document.querySelector(`[data-act=run][data-id="${el.dataset.id}"]`)?.click(); break;
      case 'q-skip': { const id = el.dataset.id; V.quick = null; undoable('Skipped for today', () => { (S.skip[today()] = S.skip[today()] || {})[id] = true; }); break; }
      case 'q-todo': { const x = S.todos.find(t => t.id === el.dataset.id); V.quick = null; if (x) setTodo(x, true); render(); break; }
      case 'q-again': { const f = lastFood(); if (f) undoable(`Logged ${f.name} again`, () => logFood(mealNow(), { name: f.name, kcal: f.kcal, p: f.p, c: f.c, f: f.f, ...(f.items ? { items: f.items } : {}) }, f.qty, 'again', null, today())); break; }
      case 'q-weigh': V.tab = 'body'; V.btab = 'log'; render(); scrollTo(0, 0); break;
      case 'siri-open': V.data = false; V.siri = true; V.siriFresh = true; render(); V.siriFresh = false; break;
      case 'siri-close-bg': if (e.target !== el) break;   // falls through
      case 'siri-close': V.siri = false; render(); break;
      case 'siri-copy': navigator.clipboard.writeText(el.dataset.v).then(() => snack('Copied'), () => snack('Couldn’t copy. Press and hold to select it instead.')); break;
      case 'siri-check': pullInbox().then(() => snack('Checked')); break;
    }
  });
