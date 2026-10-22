  /* ----- fitness: workout log ----- */

  const WK = () => S.workouts;
  const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + r / 30) : 0);   // Epley estimate
  const barDefault = () => (WK().unit === 'kg' ? 20 : 45);
  const BAR_OPTIONS = () => (WK().unit === 'kg' ? [20, 15, 10, 0] : [45, 35, 25, 15, 0]);
  const PLATES = () => (WK().unit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]);
  const BAR_GUESS = /\b(bench|squat|deadlift|overhead press|ohp|military press|barbell|row|rdl|romanian|hip thrust|clean|snatch|good ?morning|incline press|close.grip|floor press|pause)/i;
  const libFor = name => WK().library.find(x => same(x.name, name));
  // a barbell set keeps the bar and the plates (per side) separate; its total is bar + both sides
  const isBB = x => x.bar != null && x.bar !== '';
  const setW = x => (isBB(x) ? (+x.bar || 0) + 2 * (+x.ps || 0) : +x.w || 0);
  const fmtWt = n => String(Math.round(n * 100) / 100);
  function platesFor(perSide) {
    let left = +perSide || 0;
    const out = [];
    for (const pl of PLATES()) while (left >= pl - 1e-9) { out.push(pl); left = Math.round((left - pl) * 100) / 100; }
    return out.length ? out.map(fmtWt).join(' + ') + (left > 0 ? ` (+${fmtWt(left)})` : '') : 'empty bar';
  }
  function lastFor(name) {
    for (let k = WK().log.length - 1; k >= 0; k--) {
      const it = WK().log[k].items.find(x => same(x.name, name));
      if (it) return { w: WK().log[k], it };
    }
    return null;
  }
  function bestFor(name, before = Infinity) {
    let best = 0;
    for (const w of WK().log) if (w.t < before) for (const it of w.items) if (it.kind === 'strength' && same(it.name, name))
      for (const x of it.sets) best = Math.max(best, e1rm(setW(x), +x.r));
    return best;
  }
  const distUnit = () => (WK().unit === 'lb' ? 'mi' : 'km');
  const setsText = it => it.kind === 'cardio'
    ? it.sets.filter(x => x.min || x.dist).map(x => `${x.min || 0} min${x.dist ? ` · ${x.dist} ${distUnit()}` : ''}`).join(', ')
    : it.sets.filter(x => x.r).map(x => `${x.r}×${fmtWt(setW(x))}`).join(', ');
  const volume = w => w.items.reduce((t, it) => t + (it.kind === 'strength' ? it.sets.reduce((a, x) => a + (+x.r || 0) * setW(x), 0) : 0), 0);
  const setCount = w => w.items.reduce((t, it) => t + it.sets.length, 0);
  // reuse last time's sets: same weights, reps cleared for fresh entry (last reps shown as hints)
  const freshSets = (it, kind) => it.sets.map(x => kind === 'strength' ? { ...x, r: '', hint: x.r } : { ...x, min: '', hint: x.min });

  function woItem(it, i) {
    const last = lastFor(it.name), str = it.kind === 'strength', bb = str && it.bar != null;
    const head = bb ? `<span>Set</span><span>Reps</span><span>Per side</span><span>Total</span><span></span>`
      : `<span>Set</span><span>${str ? 'Reps' : 'Min'}</span><span>${str ? WK().unit : distUnit()}</span><span></span>`;
    const row = (x, j) => {
      const reps = `<input class="wo-in" data-i="${i}" data-j="${j}" data-f="${str ? 'r' : 'min'}" type="number" inputmode="decimal" min="0" step="any" value="${(str ? x.r : x.min) ?? ''}" placeholder="${x.hint ?? ''}" aria-label="${str ? 'Reps' : 'Minutes'}">`;
      if (bb) return `<span class="n num">${j + 1}</span>${reps}
        <input class="wo-in" data-i="${i}" data-j="${j}" data-f="ps" type="number" inputmode="decimal" min="0" step="any" value="${x.ps ?? ''}" aria-label="Plates per side">
        <span class="tot num" id="tot-${i}-${j}">${fmtWt(setW(x))}<small>${platesFor(x.ps)}</small></span>
        <button class="x" data-act="wo-rmset" data-i="${i}" data-j="${j}" aria-label="Remove set">✕</button>`;
      const f2 = str ? 'w' : 'dist';
      return `<span class="n num">${j + 1}</span>${reps}
        <input class="wo-in" data-i="${i}" data-j="${j}" data-f="${f2}" type="number" inputmode="decimal" min="0" step="any" value="${x[f2] ?? ''}" aria-label="${str ? 'Weight' : 'Distance'}">
        <button class="x" data-act="wo-rmset" data-i="${i}" data-j="${j}" aria-label="Remove set">✕</button>`;
    };
    return `<div class="woex">
      <div class="row spread"><b>${esc(it.name)}</b><span class="row" style="gap:6px">
        ${str ? `<button class="chipbtn ${bb ? 'on' : ''}" data-act="wo-bb" data-i="${i}">${bb ? 'Barbell' : 'Plain weight'}</button>` : ''}
        ${bb ? `<button class="chipbtn" data-act="wo-bar" data-i="${i}" aria-label="Bar weight">Bar ${fmtWt(it.bar)} ${WK().unit}</button>` : ''}
        <button class="x" data-act="wo-rmex" data-i="${i}" aria-label="Remove exercise">✕</button></span></div>
      ${last ? `<div class="t">Last time (${dayLabel(last.w.date)}): ${esc(setsText(last.it)) || '—'}</div>` : '<div class="t">First time logging this</div>'}
      <div class="sets ${bb ? 'bb' : ''}">${head}${it.sets.map(row).join('')}</div>
      <button class="btn small" data-act="wo-addset" data-i="${i}">+ Set</button>
    </div>`;
  }

  function weekLabel(monKey) {
    const thisMon = keyOf(addDays(pdayDate(), -((pdayDate().getDay() + 6) % 7)));
    if (monKey === thisMon) return 'This week';
    if (monKey === keyOf(addDays(parseKey(thisMon), -7))) return 'Last week';
    const a = parseKey(monKey), b = addDays(a, 6), f = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${f(a)} – ${f(b)}`;
  }
  const monOf = k => { const d = parseKey(k); return keyOf(addDays(d, -((d.getDay() + 6) % 7))); };

  function woCard(x, open) {
    const u = WK().unit;
    return `<div class="card wohist">
      <button class="wohead" data-act="wo-open" data-id="${x.id}" aria-expanded="${open}">
        <span><b>${esc(x.title || 'Workout')}</b><span class="muted"> · ${esc(dayLabel(x.date))}</span></span>
        <span class="muted num" style="font-size:13px">${x.items.length} ex · ${setCount(x)} sets${volume(x) ? ` · ${Math.round(volume(x)).toLocaleString()} ${u}` : ''} ${open ? '▴' : '▾'}</span></button>
      ${open ? `${x.items.map(it => `<div class="line"><b>${esc(it.name)}</b>${(x.prs || []).includes(it.name) ? '<span class="pr">PR</span>' : ''} · ${esc(setsText(it))}</div>`).join('')}
        ${x.note ? `<div class="line">${esc(x.note)}</div>` : ''}
        <div class="acts"><button class="btn small danger" data-act="wo-del" data-id="${x.id}">Delete</button><button class="btn small primary" data-act="wo-repeat" data-id="${x.id}" ${WK().draft ? 'disabled' : ''}>Repeat</button></div>` : ''}
    </div>`;
  }

  function fitnessPanel() {
    const w = WK(), d = w.draft, tab = V.wotab || 'log';
    const seg = `<div class="seg">${[['log', 'Log'], ['history', 'History'], ['exercises', 'Exercises']].map(([k, l]) => `<button data-act="wo-tab" data-v="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    let body = '';
    if (tab === 'log') {
      const titles = [...new Set(['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full body', ...w.log.slice().reverse().map(x => x.title).filter(Boolean)])].slice(0, 9);
      if (d) {
        body = `<div class="card wo" style="--gc:${gateOf('fitness').color}">
          <div class="row spread"><b>Today’s workout</b><span class="muted num" style="font-size:13px">started ${hm(d.t)}</span></div>
          <div class="field" style="margin:10px 0 6px"><input id="wo-title" value="${esc(d.title || '')}" placeholder="Name it (optional): Push, Legs…" autocapitalize="words" aria-label="Workout name"></div>
          <div class="opts" style="margin-bottom:4px">${titles.map(x => `<button data-act="wo-tchip" data-v="${esc(x)}" class="${d.title === x ? 'on' : ''}">${esc(x)}</button>`).join('')}</div>
          ${d.items.map(woItem).join('') || '<p class="muted" style="margin:10px 0 0">Add your first exercise below.</p>'}
          <div class="custom" style="margin-top:14px"><input id="wo-new" list="wo-lib" placeholder="Add exercise…" autocomplete="off" aria-label="Exercise name" autocapitalize="words" enterkeyhint="done" value="${esc(V.woName)}"><button class="btn" data-act="wo-add">Add</button></div>
          <datalist id="wo-lib">${w.library.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist>
          <div class="opts" style="margin-top:8px">${[['strength', 'Strength'], ['cardio', 'Cardio']].map(([k, l]) => `<button data-act="wo-kind" data-v="${k}" class="${V.woKind === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          <textarea id="wo-note" placeholder="Notes (optional)">${esc(d.note || '')}</textarea>
          <div class="acts"><button class="btn danger" data-act="wo-discard">Discard</button><button class="btn primary" data-act="wo-finish">Finish workout</button></div>
        </div>`;
      } else {
        const recent = [];
        for (const x of w.log.slice().reverse()) { const key = (x.title || '') + '|' + x.items.map(i => i.name).join(','); if (!recent.some(r => r.key === key)) recent.push({ key, x }); if (recent.length >= 5) break; }
        body = `<button class="btn primary block" data-act="wo-start" style="margin-bottom:12px">Start an empty workout</button>
          ${recent.length ? `<p class="label">Or repeat one</p><div class="card"><ul class="flog">${recent.map(({ x }) => `<li><span><div style="font-weight:600">${esc(x.title || 'Workout')}</div><div class="t">${esc(dayLabel(x.date))} · ${x.items.map(i => esc(i.name)).join(', ')}</div></span><button class="btn small primary" data-act="wo-repeat" data-id="${x.id}">Repeat</button></li>`).join('')}</ul>
            <p class="note" style="margin:8px 0 0">Repeating keeps the exercises and weights and clears the reps, with last time’s reps shown as hints.</p></div>` : ''}`;
      }
      // this week at a glance
      const mon = monOf(today()), wk = w.log.filter(x => monOf(x.date) === mon), prev = w.log.filter(x => monOf(x.date) === keyOf(addDays(parseKey(mon), -7)));
      const vol = a => a.reduce((t, x) => t + volume(x), 0);
      body += `<div class="card"><p class="label" style="margin:0 0 8px">This week</p><div class="stats4" style="margin:0;grid-template-columns:repeat(3,1fr)">
        <div><b>${wk.length}</b><span>Workouts</span></div><div><b>${wk.reduce((t, x) => t + setCount(x), 0)}</b><span>Sets</span></div>
        <div><b>${Math.round(vol(wk)).toLocaleString()}</b><span>Volume ${w.unit}</span></div></div>
        ${prev.length ? `<p class="muted num" style="font-size:12px;margin:8px 0 0;text-align:center">Last week: ${prev.length} workouts · ${Math.round(vol(prev)).toLocaleString()} ${w.unit}</p>` : ''}</div>`;
    } else if (tab === 'history') {
      const groups = [];
      for (const x of w.log.slice().reverse()) { const m = monOf(x.date); let g = groups.find(y => y.m === m); if (!g) groups.push(g = { m, xs: [] }); g.xs.push(x); }
      body = groups.length ? groups.map(g => `<div class="grouphead"><h3>${esc(weekLabel(g.m))}</h3><span class="muted num" style="font-size:13px">${g.xs.length} workout${g.xs.length === 1 ? '' : 's'}</span></div>
        ${g.xs.map(x => woCard(x, V.woOpen === x.id)).join('')}`).join('') : '<p class="muted">Finished workouts will show here, grouped by week.</p>';
    } else {
      const lib = w.library.map(l => {
        const sessions = w.log.filter(x => x.items.some(it => same(it.name, l.name)));
        const pts = sessions.map(x => Math.max(0, ...x.items.filter(it => same(it.name, l.name)).flatMap(it => it.sets.map(s2 => e1rm(setW(s2), +s2.r)))));
        return { l, sessions, pts, last: sessions.length ? sessions[sessions.length - 1].date : '' };
      }).filter(x => x.sessions.length).sort((a, b) => b.last.localeCompare(a.last));
      body = lib.length ? `<div class="card"><ul class="flog">${lib.map(({ l, sessions, pts, last }) => `<li data-act="wo-ex" data-v="${esc(l.name)}" style="cursor:pointer"><span style="min-width:0">
          <div style="font-weight:600">${esc(l.name)}${l.bar != null ? ' <span class="mtag">BARBELL</span>' : ''}</div>
          <div class="t">${sessions.length} session${sessions.length === 1 ? '' : 's'} · last ${esc(dayLabel(last))}${l.kind === 'strength' && Math.max(...pts) ? ` · best e1RM ${Math.round(Math.max(...pts))} ${w.unit}` : ''}</div>
          ${pts.filter(Boolean).length > 1 ? spark(pts.filter(Boolean).slice(-12)) : ''}</span><span class="muted">›</span></li>`).join('')}</ul></div>`
        : '<p class="muted">Exercises you log will show here with their progress.</p>';
    }
    return `<div class="sechead"><h3>Workouts</h3><div class="opts">${['lb', 'kg'].map(u => `<button data-act="wo-unit" data-v="${u}" class="${w.unit === u ? 'on' : ''}">${u}</button>`).join('')}</div></div>${seg}${body}`;
  }

  function exSheet() {
    const name = V.woEx, w = WK(), u = w.unit;
    const rows = w.log.filter(x => x.items.some(it => same(it.name, name))).reverse().map(x => {
      const it = x.items.find(y => same(y.name, name));
      const top = Math.max(0, ...it.sets.map(setW)), best = Math.max(0, ...it.sets.map(s2 => e1rm(setW(s2), +s2.r)));
      return { x, it, top, best };
    });
    const pr = Math.max(0, ...rows.map(r => r.best));
    return `<div class="sheet-bg ${V.woExFresh ? 'enter' : ''}" data-act="wo-ex-close-bg"><div class="sheet"><div class="grab" aria-hidden="true"></div>
      <h2>${esc(name)}</h2>
      ${pr ? `<p class="muted" style="margin:-6px 0 10px">Best estimated 1-rep max: <b style="color:var(--text)">${Math.round(pr)} ${u}</b></p>${spark(rows.map(r => r.best).reverse().filter(Boolean))}` : ''}
      <ul class="flog" style="margin-top:10px">${rows.map(r => `<li><span><div style="font-weight:600">${esc(dayLabel(r.x.date))}${r.x.title ? ` · ${esc(r.x.title)}` : ''}${(r.x.prs || []).includes(r.it.name) ? '<span class="pr">PR</span>' : ''}</div>
        <div class="t num">${esc(setsText(r.it))}</div></span><span class="muted num" style="font-size:13px">${r.best ? `${Math.round(r.best)} e1RM` : ''}</span></li>`).join('')}</ul>
      <button class="btn ghost block" data-act="wo-ex-close" style="margin-top:8px">Close</button></div></div>`;
  }

