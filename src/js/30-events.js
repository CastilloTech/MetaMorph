  /* ---------- events ---------- */

  $app.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;

    switch (act) {
      case 'tab': V.slide = slideTo(visibleTabs(), V.tab, el.dataset.v); V.tab = el.dataset.v; V.summary = null; V.gateFx = V.tab === 'gates'; render(); break;
      case 'gate': V.gate = el.dataset.v; V.gateFx = true; render(); break;

      /* calendar */
      case 'cal': V.slide = slideTo(CALS, V.cal, el.dataset.v); V.cal = el.dataset.v; V.anchor = null; V.sel = null; render(); break;
      case 'cal-prev': case 'cal-next': {
        const a = parseKey(V.anchor || today()), dir = act === 'cal-next' ? 1 : -1;
        const nd = V.cal === 'month' ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : addDays(a, 7 * dir);
        V.anchor = keyOf(nd);
        V.sel = V.cal === 'month' ? keyOf(nd) : keyOf(addDays(nd, -((nd.getDay() + 6) % 7)));
        if (keyOf(nd).slice(0, 7) === today().slice(0, 7) && V.cal === 'month') V.sel = today();
        V.slide = dir > 0 ? 'r' : 'l';
        render(); break;
      }
      case 'cal-today': V.slide = parseKey(V.anchor || today()) > new Date() ? 'l' : 'r'; V.anchor = null; V.sel = null; render(); break;
      case 'sel': if (swipe.justSwiped) break; V.sel = el.dataset.v; render(); break;
      case 'toggle-day': {
        // a finish time only means something when it's logged on the day itself
        const k = el.dataset.date, r = findRoutine(el.dataset.gate, el.dataset.id);
        if (isDone(r.id, k)) break;
        completeRoutine(r, true, k, k === today());
        render(); break;
      }

      /* now stack */
      case 'now-todo': V.tab = 'todo'; V.ttab = 'todo'; render(); scrollTo(0, 0); break;
      case 'now-workout': V.tab = 'gates'; V.gate = 'fitness'; V.wotab = 'log'; V.gateFx = true; render(); setTimeout(() => { const w = document.querySelector('.wo'); if (w) w.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60); break;

      /* first-run setup */
      case 'onb-next': V.onboard.step++; render(); scrollTo(0, 0); break;
      case 'onb-back': V.onboard.step = Math.max(0, V.onboard.step - 1); render(); break;
      case 'onb-skip': V.onboard = null; S.onboarded = true; save(); render(); break;
      case 'onb-finish': finishOnboard(); break;

      /* updates */
      case 'update-later': V.update = null; render(); break;
      case 'update-now': applyUpdate(); break;
      case 'whatsnew-close-bg': if (e.target !== el) break;
      // fallthrough
      case 'whatsnew-close': V.whatsNew = false; S.seenVersion = APP_VERSION; save(); render(); break;

      /* backup */
      case 'data': V.data = true; render(); break;
      case 'data-close-bg': if (e.target !== el) break;
      // fallthrough
      case 'data-close': V.data = false; render(); break;
      case 'backup-save': {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(backupBlob());
        a.download = backupName();
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        markBackedUp(); break;
      }
      case 'backup-share': {
        const file = new File([backupBlob()], backupName(), { type: 'application/json' });
        navigator.share({ files: [file], title: 'MetaMorph backup' }).then(markBackedUp).catch(() => {});
        break;
      }
      case 'backup-restore': document.getElementById('restorefile').click(); break;
      case 'persist':
        (async () => {
          try { storageInfo.persisted = await navigator.storage.persist(); } catch (e) {}
          if (!storageInfo.persisted) snack('The browser declined. Installing the app to your home screen usually lets it protect storage.');
          render();
        })();
        break;

      /* routines */
      case 'run': if (swipe.justSwiped || isDone(el.dataset.id)) break; V.qa = null; startRoutine(el.dataset.gate, el.dataset.id); break;
      case 'qa-cancel-bg': if (e.target !== el) break;
      // fallthrough
      case 'qa-cancel': V.qa = null; render(); break;
      case 'qa-edit': {
        const q = V.qa, r = findRoutine(q.gate, q.id);
        V.qa = null; V.gate = q.gate;
        V.edit = { gate: q.gate, isNew: false, fresh: true, r: JSON.parse(JSON.stringify(r)) };
        render(); break;
      }
      case 'qa-skip': { const id = V.qa.id; undoable('Skipped for today', () => { (S.skip[today()] = S.skip[today()] || {})[id] = true; V.qa = null; }); break; }
      case 'unskip': if (S.skip[today()]) delete S.skip[today()][el.dataset.id]; save(); render(); break;
      case 'qa-todo-toggle': { const x = S.todos.find(t => t.id === V.qa.id); V.qa = null; if (x) setTodo(x, !x.done); render(); break; }
      case 'qa-todo-edit': { const x = S.todos.find(t => t.id === V.qa.id); V.qa = null; if (x) V.tedit = { ...x, fresh: true }; render(); break; }
      case 'qa-todo-tomorrow': { const x = S.todos.find(t => t.id === V.qa.id); V.qa = null; if (x) { x.date = keyOf(addDays(new Date(), 1)); save(); snack('Moved to tomorrow'); } render(); break; }
      case 'qa-todo-del': { const id = V.qa.id; undoable('Task deleted', () => { S.todos = S.todos.filter(t => t.id !== id); V.qa = null; }); break; }
      case 'reset-done': {
        const r = findRoutine(V.edit.gate, V.edit.r.id);
        if (r) ask({ title: 'Reset today’s completion?', text: 'Its finish time and overtime will be cleared.', ok: 'Reset', danger: true })
          .then(y => { if (y) { completeRoutine(r, false); render(); snack('Completion reset'); } });
        break;
      }
      case 'toggle': {
        const r = findRoutine(V.gate, el.dataset.id);
        if (isDone(r.id)) break;
        completeRoutine(r, true);
        render(); break;
      }
      case 'complete': completeRoutine(findRoutine(el.dataset.gate, el.dataset.id), true); buzz(); render(); break;
      case 'step-toggle': {
        const r = findRoutine(el.dataset.gate, el.dataset.id), x = r.steps[Number(el.dataset.i)], v = !isDone(x.id);
        if (isDone(r.id)) break;
        setDone(x.id, v);
        if (v && r.steps.every(y => isDone(y.id))) completeRoutine(r, true);
        buzz(); render(); break;
      }

      /* workouts */
      case 'wo-unit': WK().unit = el.dataset.v; save(); render(); break;
      case 'wo-tab': V.slide = slideTo(['log', 'history', 'exercises'], V.wotab || 'log', el.dataset.v); V.wotab = el.dataset.v; render(); break;
      case 'wo-start': WK().draft = { t: Date.now(), title: '', items: [], note: '' }; V.wotab = 'log'; save(); render(); break;
      case 'wo-repeat': {
        const x = WK().log.find(y => y.id === el.dataset.id);
        if (!x || WK().draft) break;
        WK().draft = { t: Date.now(), title: x.title || '', note: '',
          items: x.items.map(it => ({ name: it.name, kind: it.kind, bar: it.bar ?? null, sets: freshSets(it, it.kind) })) };
        V.wotab = 'log'; save(); render(); scrollTo(0, 0); break;
      }
      case 'wo-tchip': WK().draft.title = WK().draft.title === el.dataset.v ? '' : el.dataset.v; save(); render(); break;
      case 'wo-kind': V.woKind = el.dataset.v; render(); break;
      case 'wo-add': {
        const inp = document.getElementById('wo-new'), name = inp ? inp.value.trim() : '';
        if (!name) break;
        let lib = libFor(name);
        const kind = lib ? lib.kind : V.woKind;
        if (!lib) { lib = { name, kind, bar: kind === 'strength' && BAR_GUESS.test(name) ? barDefault() : null }; WK().library.push(lib); }
        const last = lastFor(name);
        const bar = kind === 'strength' ? (lib.bar ?? null) : null;
        let sets = last ? freshSets(last.it, kind) : [kind === 'strength' ? (bar != null ? { r: '', ps: '', bar } : { r: '', w: '' }) : { min: '', dist: '' }];
        // last time may have been logged without the bar; bring it in line
        if (bar != null) sets = sets.map(x => isBB(x) ? x : { r: x.r, hint: x.hint, bar, ps: x.w ? Math.max(0, (+x.w - bar) / 2) : '' });
        WK().draft.items.push({ name: lib.name, kind, bar, sets });
        V.woName = '';
        save(); render(); break;
      }
      case 'wo-bb': {
        const it = WK().draft.items[Number(el.dataset.i)], lib = libFor(it.name);
        if (it.bar != null) { it.sets = it.sets.map(x => ({ r: x.r, hint: x.hint, w: setW(x) || '' })); it.bar = null; }
        else { const bar = barDefault(); it.sets = it.sets.map(x => ({ r: x.r, hint: x.hint, bar, ps: x.w ? Math.max(0, (+x.w - bar) / 2) : '' })); it.bar = bar; }
        if (lib) lib.bar = it.bar;
        save(); render(); break;
      }
      case 'wo-bar': {
        const it = WK().draft.items[Number(el.dataset.i)], opts = BAR_OPTIONS(), nx = opts[(opts.indexOf(+it.bar) + 1) % opts.length];
        it.bar = nx; it.sets.forEach(x => { x.bar = nx; });
        const lib = libFor(it.name); if (lib) lib.bar = nx;
        save(); render(); break;
      }
      case 'wo-addset': {
        const it = WK().draft.items[Number(el.dataset.i)], l = it.sets[it.sets.length - 1];
        // same weight as the set before, reps left for you to fill in
        it.sets.push(l ? (it.kind === 'strength' ? { ...l, r: '', hint: l.r || l.hint } : { ...l, min: '', hint: l.min || l.hint }) : {});
        save(); render(); break;
      }
      case 'wo-rmset': WK().draft.items[Number(el.dataset.i)].sets.splice(Number(el.dataset.j), 1); save(); render(); break;
      case 'wo-rmex': WK().draft.items.splice(Number(el.dataset.i), 1); save(); render(); break;
      case 'wo-discard': undoable('Workout discarded', () => { WK().draft = null; }); break;
      case 'wo-finish': {
        const d = WK().draft;
        const items = d.items.map(it => ({ name: it.name, kind: it.kind, bar: it.bar ?? null,
          sets: it.sets.filter(x => it.kind === 'strength' ? +x.r > 0 : (+x.min > 0 || +x.dist > 0))
            .map(({ hint, ...x }) => (it.kind === 'strength' ? { ...x, r: +x.r, w: setW(x) } : x)) })).filter(it => it.sets.length);
        if (!items.length) { undoable('Nothing was logged, so the workout was discarded', () => { WK().draft = null; }); break; }
        const prs = items.filter(it => it.kind === 'strength' && bestFor(it.name) > 0 && Math.max(...it.sets.map(x => e1rm(setW(x), +x.r))) > bestFor(it.name)).map(it => it.name);
        WK().log.push({ id: uid(), t: d.t, date: pdayOf(d.t), title: (d.title || '').trim(), items, note: (d.note || '').trim(), prs });
        WK().draft = null; V.wotab = 'history'; save(); buzz(); render();
        if (prs.length) setTimeout(() => celebrate('pr', 'fitness', prs.join(', ')), 260);
        break;
      }
      case 'wo-open': V.woOpen = V.woOpen === el.dataset.id ? null : el.dataset.id; render(); break;
      case 'wo-del': { const id = el.dataset.id; undoable('Workout deleted', () => { WK().log = WK().log.filter(x => x.id !== id); }); break; }
      case 'wo-ex': V.woEx = el.dataset.v; V.woExFresh = true; render(); V.woExFresh = false; break;
      case 'wo-ex-close-bg': if (e.target !== el) break;
      // fallthrough
      case 'wo-ex-close': V.woEx = null; render(); break;

      /* body */
      case 'b-tab': V.slide = slideTo(['overview', 'log', 'media'], V.btab, el.dataset.v); V.btab = el.dataset.v; render(); scrollTo(0, 0); break;
      case 'b-sex': B().profile.sex = el.dataset.v; save(); render(); break;
      case 'b-phase': {
        const ph = B().phase;
        if (ph.mode !== el.dataset.v) { ph.mode = el.dataset.v; ph.since = today(); save(); render(); snack(`${el.dataset.v[0].toUpperCase() + el.dataset.v.slice(1)} started`); }
        break;
      }
      case 'b-band': {
        const ph = B().phase;
        ask({ title: 'Body-fat band', text: `Currently ${ph.low}%–${ph.high}%. Bulk up to the top, cut down to the bottom. Switch between 12–16% and 10–15%?`, ok: ph.low === 12 ? 'Use 10–15%' : 'Use 12–16%' })
          .then(y => { if (y) { if (ph.low === 12) { ph.low = 10; ph.high = 15; } else { ph.low = 12; ph.high = 16; } save(); render(); } });
        break;
      }
      case 'b-apply': {
        const tg = phaseTargets();
        if (!tg) break;
        Object.assign(N().goals, { kcal: tg.kcal, p: tg.p, c: tg.c, f: tg.f });
        const gh = N().goalHist, k0 = today();
        if (gh.length && gh[gh.length - 1].from === k0) gh[gh.length - 1].goals = { ...N().goals }; else gh.push({ from: k0, goals: { ...N().goals } });
        save(); render(); snack('Nutrition goals updated from today'); break;
      }
      case 'b-del': { const id = el.dataset.id; undoable('Entry deleted', () => { B().entries = B().entries.filter(x => x.id !== id); }); break; }

      /* camera */
      case 'cam-open': V.cam = { facing: 'user', pose: 'Front', timer: 3, ghost: null, count: 0 }; render(); camStart().then(camGhost); break;
      case 'cam-close': camStop(); if (V.cam && V.cam.ghost) URL.revokeObjectURL(V.cam.ghost); V.cam = null; render(); break;
      case 'cam-flip': V.cam.facing = V.cam.facing === 'user' ? 'environment' : 'user'; render(); camStart(); break;
      case 'cam-pose': V.cam.pose = el.dataset.v; camGhost(); break;
      case 'cam-timer': V.cam.timer = Number(el.dataset.v); render(); attachCam(); break;
      case 'cam-shoot': {
        const c = V.cam;
        if (!c.timer) { camShoot(); break; }
        clearInterval(camTimer); c.count = c.timer; render(); attachCam();
        camTimer = setInterval(() => {
          if (V.cam !== c) return clearInterval(camTimer);
          c.count--; beep(c.count ? 520 : 880, 0.06, 0);
          if (c.count <= 0) { clearInterval(camTimer); render(); attachCam(); camShoot(); } else { render(); attachCam(); }
        }, 1000);
        break;
      }
      case 'csv-export': exportCSV(); break;

      /* reminders */
      case 'rm-on': enableReminders(); break;
      case 'rm-off': disableReminders(); break;
      case 'rm-test': testReminder(); break;

      /* weekly review */
      case 'rv-open': V.review = el.dataset.v; V.reviewFresh = true; render(); V.reviewFresh = false; break;
      case 'rv-week': { const k = keyOf(addDays(parseKey(V.review), Number(el.dataset.d))); if (k <= today()) { V.review = k; render(); } break; }
      case 'rv-done': {
        const r = S.reviews[V.review] = S.reviews[V.review] || {};
        document.querySelectorAll('[data-rv]').forEach(t => { r[t.dataset.rv] = t.value.trim(); });
        r.t = Date.now(); save(); V.review = null; render(); snack('Week reviewed'); break;
      }
      case 'rv-close-bg': if (e.target !== el) break;
      // fallthrough
      case 'rv-close': V.review = null; render(); break;

      /* media */
      case 'm-add': document.getElementById(el.dataset.kind === 'video' ? 'mfilev' : 'mfile').click(); break;
      case 'm-filter': V.mfilter = el.dataset.v; render(); break;
      case 'm-tag': V.mup.tag = el.dataset.v; render(); break;
      case 'm-pose': V.mup.pose = el.dataset.v; render(); break;
      case 'm-up-cancel-bg': if (e.target !== el) break;
      // fallthrough
      case 'm-up-cancel': V.mup = null; render(); break;
      case 'm-open': {
        const id = el.dataset.id;
        V.mview = id; V.mviewFresh = true; V.murl = null; render();
        mdb.get(id).then(blob => { if (V.mview !== id) return; V.mblob = blob || null; V.murl = blob ? URL.createObjectURL(blob) : null; render(); if (!blob) snack('That file is missing on this device. Restore your media backup.'); });
        break;
      }
      case 'm-close-bg': if (e.target !== el) break;
      // fallthrough
      case 'm-close': if (V.murl) URL.revokeObjectURL(V.murl); V.mview = null; V.murl = null; V.mblob = null; render(); break;
      case 'm-save': {
        // the viewer already holds the file, so sharing happens right on this tap
        const x = S.media.find(m => m.id === el.dataset.id);
        if (V.mblob) deliver(V.mblob, `metamorph-${x.tag}-${x.date}.${extOf(x.type)}`, 'MetaMorph');
        break;
      }
      case 'm-del': {
        const id = el.dataset.id, item = S.media.find(m => m.id === id);
        if (V.murl) URL.revokeObjectURL(V.murl);
        V.mview = null; V.murl = null;
        S.media = S.media.filter(m => m.id !== id); save(); render();
        // the file is only erased once the Undo window has passed
        const timer = setTimeout(() => { if (!S.media.some(m => m.id === id)) { mdb.del(id).catch(() => {}); mdb.del('thumb:' + id).catch(() => {}); } }, 6000);
        snack('Deleted', () => { clearTimeout(timer); S.media.push(item); save(); render(); });
        break;
      }
      case 'm-compare': {
        const ph = S.media.filter(x => x.tag === 'physique' && x.kind === 'photo').sort((a, b) => a.date.localeCompare(b.date));
        V.mcmp = { fresh: true, a: ph[0].id, b: ph[ph.length - 1].id }; render(); loadCompare(); break;
      }
      case 'm-cmp-close-bg': if (e.target !== el) break;
      // fallthrough
      case 'm-cmp-close': if (V.mcmp) { if (V.mcmp.urlA) URL.revokeObjectURL(V.mcmp.urlA); if (V.mcmp.urlB) URL.revokeObjectURL(V.mcmp.urlB); } V.mcmp = null; render(); break;
      case 'm-backup': backupMedia(); break;
      case 'm-restore': document.getElementById('mzip').click(); break;

      /* supplies */
      case 'ttab': V.slide = slideTo(['todo', 'supplies'], V.ttab, el.dataset.v); V.ttab = el.dataset.v; render(); break;
      case 'sup-cat': V.supCat = el.dataset.v; render(); break;
      case 'sup-list': { const x = SUP().items.find(y => y.id === el.dataset.id); x.need = !x.need; if (x.need) x.qty = x.qty || 1; save(); render(); break; }
      case 'sup-qty': { const x = SUP().items.find(y => y.id === el.dataset.id); x.qty = Math.max(1, (x.qty || 1) + Number(el.dataset.d)); save(); render(); break; }
      case 'sup-bought': { const x = SUP().items.find(y => y.id === el.dataset.id); x.need = false; x.lastBought = Date.now(); x.qty = 1; save(); buzz(); render(); break; }
      case 'sup-edit': { const x = SUP().items.find(y => y.id === el.dataset.id); V.sedit = { ...x, history: [...(x.history || [])], fresh: true }; render(); break; }
      case 'sup-del': { const id = el.dataset.id; undoable('Item deleted', () => { SUP().items = SUP().items.filter(y => y.id !== id); V.sedit = null; }); break; }
      case 'sup-cancel-bg': if (e.target !== el) break;
      // fallthrough
      case 'sup-cancel': V.sedit = null; render(); break;

      /* practice */
      case 'ptab': V.slide = slideTo(['feature', 'drill'], V.ptab, el.dataset.v); V.ptab = el.dataset.v; render(); break;

      /* to-do */
      case 'todo-when': V.todoWhen = el.dataset.v; render(); break;
      case 'todo-toggle': {
        if (swipe.justSwiped) break;
        const x = S.todos.find(t => t.id === el.dataset.id);
        if (x) { setTodo(x, !x.done); if (x.done) buzz(); }
        render(); break;
      }
      case 'todo-edit': { if (swipe.justSwiped) break; const x = S.todos.find(t => t.id === el.dataset.id); V.tedit = { ...x, fresh: true }; render(); break; }
      case 'todo-del':
        { const id = el.dataset.id; undoable('Task deleted', () => { S.todos = S.todos.filter(t => t.id !== id); V.tedit = null; }); }
        break;
      case 'todo-clear': undoable('Done tasks cleared', () => { S.todos = S.todos.filter(t => !t.done); }); break;
      case 'todo-cancel-bg': if (e.target !== el) break;
      // fallthrough
      case 'todo-cancel': V.tedit = null; render(); break;

      /* nutrition */
      case 'n-add': V.nadd = { meal: el.dataset.meal, mode: N().foods.length || N().preps.some(x => x.left > 0) ? 'saved' : 'search', q: '', qty: 1, fresh: true, oq: '', results: null, busy: false, err: '' }; render(); break;
      case 'n-mode': V.nadd.mode = el.dataset.v; if (el.dataset.v === 'new') V.nadd.prefill = null; render(); break;
      case 'off-pick': V.nadd.prefill = V.nadd.results[Number(el.dataset.i)]; V.nadd.mode = 'new'; render(); break;
      case 'scan-open': startScan(); break;
      case 'scan-close': stopScan(); V.scan = false; render(); break;
      case 'n-qty': V.nadd.qty = Math.max(0.5, r1(V.nadd.qty + Number(el.dataset.d))); render(); break;
      case 'n-pick': {
        const a = V.nadd;
        if (el.dataset.kind === 'meal') { const m = N().meals.find(y => y.id === el.dataset.id); logFood(a.meal, { name: m.name, ...mealTotals(m.items), items: m.items }, a.qty, 'meal', m.id); }
        else if (el.dataset.kind === 'prep') { const x = N().preps.find(y => y.id === el.dataset.id); logFood(a.meal, { name: x.name, ...x.per }, Math.min(a.qty, x.left), 'prep', x.id); }
        else { const x = N().foods.find(y => y.id === el.dataset.id); logFood(a.meal, x, a.qty, 'food', x.id); }
        V.nadd = null; buzz(); render(); break;
      }
      case 'n-food-del':
        { const id = el.dataset.id; undoable('Food forgotten (past entries stay)', () => { N().foods = N().foods.filter(x => x.id !== id); }); }
        break;
      case 'n-del': {
        // snapshot first, so Undo also takes back the portion returned to a meal prep
        const before = JSON.stringify(S), k = nk(), x = nLog(k).find(y => y.id === el.dataset.id);
        if (x && x.src === 'prep') { const pr = N().preps.find(y => y.id === x.ref); if (pr) pr.left = Math.min(pr.portions, r1(pr.left + x.qty)); }
        N().log[k] = nLog(k).filter(y => y.id !== el.dataset.id); save(); render();
        snack('Entry removed', () => { replaceState(JSON.parse(before)); save(); render(); });
        break;
      }
      case 'n-cancel-bg': if (e.target !== el) break;
      // fallthrough
      case 'n-cancel': V.nadd = null; render(); break;
      case 'n-goals': V.ngoals = { ...N().goals, fresh: true }; render(); break;
      case 'n-goals-calc': {
        const f = document.getElementById('ngoalf'); const el2 = f.elements;
        el2.kcal.value = kcalOf(+el2.p.value || 0, +el2.c.value || 0, +el2.f.value || 0); break;
      }
      case 'n-goals-cancel-bg': if (e.target !== el) break;
      // fallthrough
      case 'n-goals-cancel': V.ngoals = null; render(); break;
      case 'n-prep-new': V.nprep = { fresh: true, name: '', portions: 4, items: [{ name: '', kcal: '', p: '', c: '', f: '' }] }; render(); break;
      case 'n-ing-add': syncPrep(); V.nprep.items.push({ name: '', kcal: '', p: '', c: '', f: '' }); render(); break;
      case 'n-ing-rm': syncPrep(); V.nprep.items.splice(Number(el.dataset.i), 1); render(); break;
      case 'n-ing-food': {
        syncPrep();
        const f = document.getElementById('nprepf'), x = N().foods.find(y => y.id === f.elements.pickfood.value), q = +f.elements.pickqty.value || 1;
        if (x) V.nprep.items.push({ name: `${x.name}${q !== 1 ? ' × ' + r1(q) : ''}`, kcal: r1(x.kcal * q), p: r1(x.p * q), c: r1(x.c * q), f: r1(x.f * q) });
        render(); break;
      }
      case 'n-prep-cancel-bg': if (e.target !== el) break;
      // fallthrough
      case 'n-prep-cancel': V.nprep = null; render(); break;
      case 'n-prep-log': { const x = N().preps.find(y => y.id === el.dataset.id); logFood(nk() === today() ? mealNow() : 'Snacks', { name: x.name, ...x.per }, 1, 'prep', x.id); buzz(); render(); break; }
      case 'n-day': {
        const d = addDays(parseKey(nk()), Number(el.dataset.d)), k = keyOf(d);
        if (k > today()) break;
        V.slide = Number(el.dataset.d) > 0 ? 'r' : 'l';
        V.nday = k === today() ? null : k; render(); break;
      }
      case 'n-day-today': V.nday = null; render(); break;
      case 'n-goto': V.nday = el.dataset.v === today() ? null : el.dataset.v; render(); setTimeout(() => { const c = document.querySelector('.calnav'); if (c) c.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 50); break;
      case 'n-hist': V.nhist = Number(el.dataset.v); render(); break;
      case 'n-meal-new': V.nmeal = { fresh: true, name: '', items: [] }; render(); break;
      case 'n-savemeal': {
        const meal = el.dataset.meal, es = nLog(nk()).filter(x => x.meal === meal);
        V.nmeal = { fresh: true, id: 'from-log', name: meal === 'Snacks' ? 'Snack' : `Usual ${meal.toLowerCase()}`,
          items: es.flatMap(x => x.items ? x.items : [{ name: x.name, qty: x.qty, kcal: x.kcal, p: x.p, c: x.c, f: x.f }]) };
        render(); break;
      }
      case 'n-meal-addfood': {
        const f = document.getElementById('nmealf'), x = N().foods.find(y => y.id === f.elements.pickfood.value), q = +f.elements.pickqty.value || 1;
        V.nmeal.name = f.elements.name.value;
        if (x) V.nmeal.items.push({ name: x.name, qty: q, kcal: x.kcal, p: x.p, c: x.c, f: x.f });
        render(); break;
      }
      case 'n-meal-rm': { const f = document.getElementById('nmealf'); if (f) V.nmeal.name = f.elements.name.value; V.nmeal.items.splice(Number(el.dataset.i), 1); render(); break; }
      case 'n-meal-cancel-bg': if (e.target !== el) break;
      // fallthrough
      case 'n-meal-cancel': V.nmeal = null; render(); break;
      case 'n-meal-log': {
        const m = N().meals.find(y => y.id === el.dataset.id), bucket = nk() === today() ? mealNow() : 'Snacks';
        logFood(bucket, { name: m.name, ...mealTotals(m.items), items: m.items }, 1, 'meal', m.id);
        buzz(); render(); snack(`${m.name} logged to ${bucket}`); break;
      }
      case 'n-meal-del': { const id = el.dataset.id; undoable('Meal deleted', () => { N().meals = N().meals.filter(x => x.id !== id); }); break; }
      case 'n-prep-del':
        { const id = el.dataset.id; undoable('Meal prep deleted', () => { N().preps = N().preps.filter(x => x.id !== id); }); }
        break;
      case 'r-pause':
        if (run.over) break;
        if (run.paused) { run.end = Date.now() + run.remaining; run.paused = false; }
        else { run.remaining = run.end - Date.now(); run.paused = true; }
        saveRun(); renderRun(); break;
      case 'r-done': finishStep(); break;
      case 'r-next': beginStep(run.idx + 1); break;
      case 'r-late-done': {
        const o = (run.open || []).find(x => x.id === el.dataset.id);
        if (o) { closeLate(o); buzz(); saveRun(); renderRun(); }
        break;
      }
      case 'r-hold': run.autoAt = null; saveRun(); renderRun(); break;
      case 'r-chain': chainNext(); break;
      case 'r-end':
      case 'r-close': endRun(); break;
      case 'r-exit':
        if (run.phase !== 'step') endRun();
        else ask({ title: 'End the routine here?', text: 'Finished steps stay done.', ok: 'End it', danger: true }).then(y => { if (y && run) endRun(); });
        break;

      /* editing */
      case 'add':
        V.edit = { gate: V.gate, isNew: true, fresh: true, r: routine('', '12:00', [step('', 10)]) };
        render(); break;
      case 'edit': {
        const r = findRoutine(V.gate, el.dataset.id);
        V.edit = { gate: V.gate, isNew: false, fresh: true, r: JSON.parse(JSON.stringify(r)) };
        render(); break;
      }
      case 's-add': syncEdit(); V.edit.r.steps.push(step('', 5)); render();
        setTimeout(() => { const f = document.getElementById('editform'); f && f.elements['st' + (V.edit.r.steps.length - 1)].focus(); }, 0);
        break;
      case 's-up': case 's-down': {
        syncEdit();
        const i = Number(el.dataset.i), j = act === 's-up' ? i - 1 : i + 1, st = V.edit.r.steps;
        [st[i], st[j]] = [st[j], st[i]];
        render(); break;
      }
      case 's-del': syncEdit(); V.edit.r.steps.splice(Number(el.dataset.i), 1); render(); break;
      case 'edit-cancel-bg': if (e.target !== el) break; // only when tapping the backdrop
      // fallthrough
      case 'edit-cancel': V.edit = null; render(); break;
      case 'delete':
        { const g = V.edit.gate, id = V.edit.r.id; undoable('Routine deleted', () => { S.gates[g] = S.gates[g].filter(r => r.id !== id); V.edit = null; }); }
        break;

      /* drill */
      case 'dset': S.drill[el.dataset.k] = Number(el.dataset.v); save(); render(); break;
      case 'cue-return': unlockAudio(); cueReturn(); break;
      case 'cue-release': unlockAudio(); cueRelease(); break;
      case 'drill-start': startDrill(); break;
      case 'drill-stop': finishDrill(); break;
      case 'summary-ok': V.summary = null; render(); break;

      /* water */
      case 'w-add': {
        const st = wState();
        V.wFrom = Math.min(100, 100 * st.got / st.target);
        addWater(Number(el.dataset.ml)); buzz(); render(); break;
      }
      case 'w-undo': {
        const k = today(), st = wState();
        V.wFrom = Math.min(100, 100 * st.got / st.target);
        if (W().log[k] && W().log[k].length) { W().log[k].pop(); save(); }
        render(); break;
      }
      case 'w-del': {
        const k = today(), t = Number(el.dataset.t), st = wState();
        V.wFrom = Math.min(100, 100 * st.got / st.target);
        undoable('Water entry removed', () => { W().log[k] = wLog(k).filter(e => e.t !== t); }); break;
      }
      case 'w-snooze': W().snooze = { [today()]: el.dataset.id }; save(); render(); break;
      case 'w-ics': deliver(waterICS(), 'metamorph-water.ics', 'Water reminders'); break;
      case 'w-edit': {
        const w = W();
        V.wedit = { fresh: true, unit: w.unit, target: w.target, pour: w.pour, wake: w.wake, bed: w.bed, schedule: w.schedule.map(x => ({ ...x })) };
        render(); break;
      }
      case 'w-auto': syncWEdit(); V.wedit.schedule = autoSchedule(V.wedit.target, V.wedit.pour, V.wedit.wake, V.wedit.bed); render(); break;
      case 'w-addrow': {
        syncWEdit();
        const sc = V.wedit.schedule, last = sc.length ? sc[sc.length - 1].time : '11:00';
        sc.push({ id: uid(), time: fromMinHM(toMin(last) + 60), amount: V.wedit.pour });
        render(); break;
      }
      case 'w-rm': syncWEdit(); V.wedit.schedule.splice(Number(el.dataset.i), 1); render(); break;
      case 'w-cancel-bg': if (e.target !== el) break;
      // fallthrough
      case 'w-cancel': V.wedit = null; render(); break;

      /* feature law */
      case 'f-ctx': V.fDraft.ctx = el.dataset.v; render(); break;
      case 'f-load': {
        const text = V.fDraft.text.trim();
        if (!text) { snack('Write the one feature you’ll notice.'); break; }
        const mode = F().experiment && Math.random() < 1 / 3 ? 'control' : 'loaded';
        const item = { id: uid(), ctx: V.fDraft.ctx.trim(), text, t: Date.now(), mode, check: null };
        F().items.push(item);
        if (F().items.length > 1000) F().items.shift();
        save();
        V.fDraft.text = '';
        unlockAudio();
        featRun = { id: item.id, mode, end: mode === 'loaded' ? Date.now() + 30000 : null, held: false };
        if (mode === 'loaded') { lockScreen(); startTicker(); beep(660, 0.2); }
        render(); break;
      }
      case 'f-discard':
        { const id = el.dataset.id; undoable('Trial discarded', () => { F().items = F().items.filter(i => i.id !== id); }); }
        break;
      case 'f-done': featRun = null; stopTicker(); unlockScreen(); render(); break;
      case 'f-check': V.fcheck = { id: el.dataset.id, fresh: true, rating: null, unbidden: null, stopped: null }; render(); break;
      case 'fc-set': {
        const k = el.dataset.k, v = el.dataset.v;
        V.fcheck[k] = k === 'stopped' ? (V.fcheck.stopped === v ? null : v) : Number(v);
        render(); break;
      }
      case 'fc-save': {
        const c = V.fcheck, x = F().items.find(i => i.id === c.id);
        x.check = { rating: c.rating, unbidden: !!c.unbidden, stopped: c.stopped, t: Date.now() };
        save(); V.fcheck = null; render(); break;
      }
      case 'fc-cancel-bg': if (e.target !== el) break;
      // fallthrough
      case 'fc-cancel': V.fcheck = null; render(); break;
    }
  });

  // switching the repeat type shows its day/date pickers; restore reads the chosen backup file
  $app.addEventListener('change', e => {
    const t = e.target;
    if ((t.id === 'mfile' || t.id === 'mfilev') && t.files.length) {
      V.mup = { fresh: true, files: [...t.files], video: t.id === 'mfilev', tag: t.id === 'mfilev' ? 'form' : 'physique', pose: 'Front', exercise: '', date: today(), note: '' };
      t.value = ''; render(); return;
    }
    if (t.id === 'mzip' && t.files[0]) { restoreMedia(t.files[0]); t.value = ''; return; }
    if (t.dataset && t.dataset.mcmp && V.mcmp) { V.mcmp[t.dataset.mcmp] = t.value; loadCompare(); return; }
    if (t.dataset && t.dataset.sec) { S.sections[t.dataset.sec] = t.checked; save(); render(); }
    if (t.dataset && t.dataset.pref) { S.prefs[t.dataset.pref] = t.checked; save(); render(); }
    if (t.dataset && t.dataset.rm) { RM()[t.dataset.rm] = t.checked; save(); render(); }
    if (t.dataset && t.dataset.bprof) {
      const pr = B().profile, k = t.dataset.bprof;
      if (k === 'activity') pr.activity = +t.value;
      else {
        const ftEl = document.querySelector('[data-bprof=ft]'), inEl = document.querySelector('[data-bprof=in]');
        const total = (+ftEl.value || 0) * 12 + (+inEl.value || 0);
        pr.heightIn = total > 36 ? total : null;
      }
      save(); render();
    }
    if (t.dataset && t.dataset.prefTime && t.value) { S.prefs[t.dataset.prefTime] = t.value; save(); render(); snack(`New day now starts at ${clock(t.value)}`); }
    if (t.dataset && t.dataset.onbsec) V.onboard.sections[t.dataset.onbsec] = t.checked;
    if (t.dataset && t.dataset.onbstart) V.onboard.starters[t.dataset.onbstart] = t.checked;
    if (t.id === 'onb-wake' && t.value) V.onboard.wake = t.value;
    if (t.id === 'onb-bed' && t.value) V.onboard.bed = t.value;
    if (e.target.name === 'rt' || e.target.name === 'r_vary') { syncEdit(); render(); }
    if (e.target.name === 'w_unit') { syncWEdit(); render(); }
    if (e.target.id === 'fexp') { F().experiment = e.target.checked; save(); }
    if (e.target.id === 'restorefile' && e.target.files[0]) {
      e.target.files[0].text().then(txt => {
        let payload;
        try { payload = JSON.parse(txt); } catch (err) { return snack('That file is not a MetaMorph backup.'); }
        const data = payload && payload.app === 'metamorph' ? payload.data : payload;
        if (!valid(data)) return snack('That file is not a MetaMorph backup.');
        const when = payload.exported ? new Date(payload.exported).toLocaleString() : 'an unknown date';
        ask({ title: 'Restore this backup?', text: `From ${when}. Everything on this device will be replaced.`, ok: 'Restore', danger: true }).then(y => {
          if (!y) return;
          stopTicker(); run = null; drillRun = null;
          replaceState(data);
          S.run = null;
          save();
          V.data = false;
          render();
          snack('Backup restored');
        });
      });
    }
  });

