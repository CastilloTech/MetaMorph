  /* ---------- long-press a timeline item or task for quick actions ---------- */
  const press = { t: 0, x: 0, y: 0 };
  $app.addEventListener('pointerdown', e => {
    clearTimeout(press.t);
    const el = e.target.closest('.tl .it[data-id], .todos .tx[data-id]');
    if (!el || e.button > 0) return;
    press.x = e.clientX; press.y = e.clientY;
    press.t = setTimeout(() => {
      swipe.s = null;
      swipe.justSwiped = true;
      setTimeout(() => { swipe.justSwiped = false; }, 600);
      buzz();
      if (el.matches('.tl .it') && !el.dataset.todo) V.qa = { kind: 'routine', gate: el.dataset.gate, id: el.dataset.id, fresh: true };
      else V.qa = { kind: 'todo', id: el.dataset.id, fresh: true };
      render();
    }, 520);
  });
  $app.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) clearTimeout(press.t); });
  ['pointerup', 'pointercancel'].forEach(t => $app.addEventListener(t, () => clearTimeout(press.t)));
  $app.addEventListener('contextmenu', e => { if (e.target.closest('.tl .it, .todos .tx')) e.preventDefault(); });
  $app.addEventListener('pointercancel', endSwipe);

  // live phrasing check for the Feature Law, without re-rendering while typing
  $app.addEventListener('input', e => {
    if (e.target.classList && e.target.classList.contains('wo-in') && WK().draft) {
      const t = e.target, it = WK().draft.items[Number(t.dataset.i)], x = it && it.sets[Number(t.dataset.j)];
      if (x) {
        x[t.dataset.f] = t.value === '' ? '' : +t.value; save();
        // keep the barbell total and plate list in step as you type
        const tot = document.getElementById(`tot-${t.dataset.i}-${t.dataset.j}`);
        if (tot && isBB(x)) tot.innerHTML = `${fmtWt(setW(x))}<small>${platesFor(x.ps)}</small>`;
      }
    }
    if (e.target.id === 'wo-title' && WK().draft) { WK().draft.title = e.target.value; save(); }
    if (e.target.dataset && e.target.dataset.rv && V.review) { const r = S.reviews[V.review] = S.reviews[V.review] || {}; r[e.target.dataset.rv] = e.target.value; save(); }
    // body form: keep a draft and update the body-fat preview as you type
    const bf0 = e.target.closest && e.target.closest('#bform');
    if (bf0) {
      const el = bf0.elements, d = { date: el.date.value };
      for (const k of ['weight', ...PARTS.map(p => p[0])]) if (el[k] && el[k].value !== '') d[k] = +el[k].value;
      V.bform = d;
      const pv = navyBF(d), box = bf0.querySelector('.bfprev');
      if (box) box.innerHTML = pv != null ? `Body fat: <b>${pv}%</b>${d.weight ? ` · lean ${Math.round(d.weight * (1 - pv / 100))} lb` : ''}` : '<span class="muted">Body fat appears once height, neck and waist are filled in.</span>';
    }
    if (e.target.id === 'wo-new') V.woName = e.target.value;
    if (e.target.id === 'wo-note' && WK().draft) { WK().draft.note = e.target.value; save(); }
    const ta = e.target.closest && e.target.closest('#todoadd');
    if (ta) V.todoDraft = { text: ta.elements.text.value, date: ta.elements.date.value, time: ta.elements.time.value };
    if (e.target.id === 'nsearch') {
      const q = e.target.value.toLowerCase();
      V.nadd.q = e.target.value;
      document.querySelectorAll('.foodlist li[data-name]').forEach(li => { li.hidden = !!q && !li.dataset.name.includes(q); });
    }
    if (e.target.closest && e.target.closest('#nprepf')) {
      syncPrep();
      const t = document.getElementById('preptot');
      if (t) t.innerHTML = prepTotalsText(V.nprep);
    }
    if (e.target.id === 'fctx') V.fDraft.ctx = e.target.value;
    if (e.target.id === 'ftext') {
      V.fDraft.text = e.target.value;
      const h = document.getElementById('fhint'), l = lintFeature(e.target.value);
      if (h) { h.className = 'hint ' + (l ? l.lvl : ''); h.textContent = l ? l.msg : ''; }
    }
  });

  $app.addEventListener('submit', e => {
    const f = e.target;
    if (f.id === 'mupf') {
      e.preventDefault();
      const u = V.mup, el = f.elements;
      const meta = { tag: u.tag, pose: u.pose, exercise: el.exercise ? el.exercise.value.trim() : '', date: el.date.value || today(), note: el.note.value.trim() };
      V.mup = null; render();
      importMedia(u.files, meta);
      return;
    }
    if (f.id === 'bform') {
      e.preventDefault();
      const el = f.elements, x = { id: uid(), t: Date.now(), date: el.date.value || today() };
      for (const k of ['weight', ...PARTS.map(p => p[0])]) if (el[k] && el[k].value !== '') x[k] = +el[k].value;
      if (Object.keys(x).length <= 3) return snack('Enter a weight or at least one measurement.');
      B().entries.push(x); V.bform = null; save(); render();
      const bf = navyBF(x);
      snack(bf != null ? `Saved · ${bf}% body fat` : 'Saved');
      return;
    }
    if (f.id === 'offform') { e.preventDefault(); const q = f.elements.q.value.trim(); if (q) runLookup(q); return; }
    if (f.id === 'supadd') {
      e.preventDefault();
      const name = f.elements.name.value.trim();
      if (!name) return;
      const x = { id: uid(), name, cat: V.supCat, price: null, priceAt: null, history: [], need: f.elements.need.checked, qty: 1, url: '' };
      if (f.elements.price.value !== '') setPrice(x, +f.elements.price.value);
      SUP().items.push(x); save(); render();
      const inp = document.querySelector('#supadd input[name=name]'); if (inp) inp.focus();
      return;
    }
    if (f.id === 'supform') {
      e.preventDefault();
      const x = SUP().items.find(y => y.id === V.sedit.id), el = f.elements;
      if (x) {
        x.name = el.name.value.trim() || x.name;
        x.cat = (f.querySelector('input[name=cat]:checked') || {}).value || x.cat;
        x.qty = Math.max(1, Math.round(+el.qty.value || 1));
        x.url = el.url.value.trim();
        if (el.price.value !== '') setPrice(x, +el.price.value);
      }
      save(); V.sedit = null; render();
      return;
    }
    if (f.id === 'todoadd') {
      e.preventDefault();
      const text = f.elements.text.value.trim();
      if (!text) return;
      const date = f.elements.date.value || (V.todoWhen === 'today' ? today() : V.todoWhen === 'tomorrow' ? keyOf(addDays(new Date(), 1)) : null);
      S.todos.push({ id: uid(), text, date, time: f.elements.time.value || null, done: false, doneAt: null, created: Date.now() });
      V.todoDraft = { text: '', date: '', time: '' };
      save(); render();
      const inp = document.querySelector('#todoadd input[name=text]'); if (inp) inp.focus();
      return;
    }
    if (f.id === 'todoform') {
      e.preventDefault();
      const x = S.todos.find(t => t.id === V.tedit.id);
      if (x) Object.assign(x, { text: f.elements.text.value.trim() || x.text, date: f.elements.date.value || null, time: f.elements.time.value || null });
      save(); V.tedit = null; render();
      return;
    }
    if (f.id === 'nnew') {
      e.preventDefault();
      const el = f.elements, p = +el.p.value || 0, c = +el.c.value || 0, fat = +el.f.value || 0;
      const item = { id: uid(), name: el.name.value.trim(), serving: el.serving.value.trim(), p, c, f: fat, kcal: el.kcal.value === '' ? kcalOf(p, c, fat) : +el.kcal.value };
      if (!item.name) return;
      if (el.keep.checked) N().foods.push(item);
      logFood(V.nadd.meal, item, Math.max(0.25, +el.qty.value || 1), el.keep.checked ? 'food' : 'quick', el.keep.checked ? item.id : null);
      V.nadd = null; buzz(); render();
      return;
    }
    if (f.id === 'nmealf') {
      e.preventDefault();
      if (!V.nmeal.items.length) return snack('Add at least one food to the meal.');
      N().meals.push({ id: uid(), name: f.elements.name.value.trim() || 'Meal', items: V.nmeal.items.map(x => ({ ...x })) });
      save(); V.nmeal = null; render(); snack('Meal saved. Log it from My meals or + Add.');
      return;
    }
    if (f.id === 'ngoalf') {
      e.preventDefault();
      for (const [m] of MAC) N().goals[m] = Math.max(0, Math.round(+f.elements[m].value || 0));
      // record from when these goals apply; earlier days keep theirs
      const gh = N().goalHist, k0 = today();
      if (gh.length && gh[gh.length - 1].from === k0) gh[gh.length - 1].goals = { ...N().goals }; else gh.push({ from: k0, goals: { ...N().goals } });
      save(); V.ngoals = null; render();
      return;
    }
    if (f.id === 'nprepf') {
      e.preventDefault();
      syncPrep();
      const ed = V.nprep, items = ed.items.filter(x => x.name.trim() || x.kcal !== '' || +x.p || +x.c || +x.f)
        .map(x => { const p = +x.p || 0, c = +x.c || 0, fat = +x.f || 0; return { name: x.name.trim() || 'Ingredient', kcal: x.kcal === '' ? kcalOf(p, c, fat) : x.kcal, p, c, f: fat }; });
      if (!items.length) return snack('Add at least one ingredient.');
      const t = prepTotals(items), n = ed.portions;
      N().preps.unshift({ id: uid(), name: ed.name.trim() || 'Meal prep', portions: n, left: n, made: today(), created: Date.now(), items,
        per: { kcal: t.kcal / n, p: t.p / n, c: t.c / n, f: t.f / n } });
      save(); V.nprep = null; render();
      return;
    }
    if (e.target.id === 'wcustom') {
      e.preventDefault();
      const v = Number(e.target.elements.amt.value);
      if (v > 0) {
        const st = wState();
        V.wFrom = Math.min(100, 100 * st.got / st.target);
        addWater(W().unit === 'oz' ? v * ML_OZ : v); buzz(); render();
      }
      return;
    }
    if (e.target.id === 'wform') {
      e.preventDefault();
      syncWEdit();
      const ed = V.wedit;
      Object.assign(W(), { unit: ed.unit, target: ed.target, pour: ed.pour, wake: ed.wake, bed: ed.bed, schedule: ed.schedule, scheduleInit: true });
      save(); V.wedit = null; render();
      return;
    }
    if (e.target.id !== 'editform') return;
    e.preventDefault();
    syncEdit();
    const r = V.edit.r;
    if (r.repeat.type === 'weekly' && !r.repeat.days.length) return snack('Pick at least one day of the week.');
    if (r.repeat.type === 'monthly' && !r.repeat.dates.length) return snack('Pick at least one date of the month.');
    r.title = r.title.trim() || 'Untitled';
    r.steps.forEach(s => { s.title = s.title.trim() || 'Step'; s.work = s.work.trim(); });
    const list = S.gates[V.edit.gate];
    const i = list.findIndex(x => x.id === r.id);
    if (i >= 0) list[i] = r; else list.push(r);
    save(); V.edit = null; render();
  });

  // keep "now" / "in Xm" fresh while idle
  const typing = () => $app.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  let lastTouch = 0;
  ['touchstart', 'scroll', 'wheel'].forEach(t => addEventListener(t, () => { lastTouch = Date.now(); }, { passive: true }));
  setInterval(() => { if (!drillRun && !run && !featRun && !anySheet() && !swipe.s && !typing() && Date.now() - lastTouch > 4000) render(); }, 30000);

  // keep the focused field visible above the on-screen keyboard
  $app.addEventListener('focusin', e => {
    if (!e.target.matches || !e.target.matches('input, textarea, select') || !matchMedia('(pointer: coarse)').matches) return;
    setTimeout(() => { try { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (err) {} }, 320);
  });

  // after an update (or the first open of a new version), show what changed
  try {
    if (localStorage.getItem('metamorph.updated')) { V.whatsNew = true; localStorage.removeItem('metamorph.updated'); }
  } catch (e) {}
  if (S.seenVersion !== APP_VERSION) {
    if (fromLocal || lsOff) V.whatsNew = true;      // existing user on a new version
    else S.seenVersion = APP_VERSION;      // fresh install: nothing to announce
  }
  // first run gets a short setup; people who already use the app never see it
  if (!S.onboarded) {
    if (fromLocal || lsOff) S.onboarded = true;
    else V.onboard = { step: 0, wake: '07:00', bed: '22:30', sections: { ...S.sections }, starters: { hygiene: true, fitness: true, nutrition: true, sleep: true } };
  }

  if (lsOff && !fromLocal) {
    $app.innerHTML = `<div class="nexus" style="margin-top:30vh">${orb('chaos', 120, 'spin')}</div>`;
    booted.then(() => { resumeRun(); render(); loadThumbs(); });
  } else {
    resumeRun();
    render();
    booted.then(loadThumbs);
  }

