  /* ----- today ----- */

  function chainText(r, current) {
    return r.steps.map((s, i) => {
      const t = esc(s.title);
      if (isDone(s.id)) return `<s>${t}</s>`;
      return i === current ? `<b>${t}</b>` : t;
    }).join(' → ');
  }

  function untilText(r) {
    return `in ${dur(Math.max(1, Math.round((windowOf(r).start - Date.now()) / 60000)))}`;
  }

  function todayView() {
    const seg = `<div class="seg">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([k, l]) =>
      `<button data-act="cal" data-v="${k}" class="${V.cal === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    return seg + (V.cal === 'week' ? weekView() : V.cal === 'month' ? monthView() : dayView());
  }

  // held / scheduled for one gate on one date
  function gateDay(gid, d) {
    const k = keyOf(d), rs = S.gates[gid].filter(r => scheduledOn(r, d) && !skipped(r.id, k));
    return { n: rs.length, held: rs.filter(r => isDone(r.id, k)).length };
  }
  function mark(gd, d) {
    if (!gd.n) return 'none';
    if (gd.held >= gd.n) return 'full';
    if (gd.held) return 'part';
    // today isn't over yet, so unheld routines are still to come
    return keyOf(d) >= today() ? 'future' : 'miss';
  }

  function calNav(title, sub) {
    return `<div class="calnav">
      <button class="arrow" data-act="cal-prev" aria-label="Previous">‹</button>
      <div class="ttl">${title}<small>${sub}</small></div>
      <button class="arrow" data-act="cal-next" aria-label="Next">›</button>
    </div>`;
  }

  function dayDetail() {
    const k = V.sel || today(), d = parseKey(k), items = allRoutines(d), future = k > today();
    const label = k === today() ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    const held = items.filter(x => isDone(x.r.id, k)).length;
    return `<div class="card" style="margin-top:14px">
      <div class="row spread"><p class="label" style="margin:0">${esc(label)}</p><span class="muted num" style="font-size:13px">${items.length ? `${held}/${items.length} held` : ''}</span></div>
      ${items.length ? `<ul class="daylist" style="margin-top:6px">${items.map(({ gate, r }) => `
        <li>${orb(gate, 28)}
          <span><div style="font-weight:600">${esc(r.title)}</div><div class="t num">${clock(startFor(r, d))} · ${dur(total(r))}</div></span>
          <button class="chk ${isDone(r.id, k) ? 'done' : ''}" data-act="toggle-day" data-date="${k}" data-gate="${gate}" data-id="${r.id}" ${future || isDone(r.id, k) ? 'disabled' : ''} aria-label="Mark held">✓</button>
        </li>`).join('')}</ul>` : '<p class="muted" style="margin:8px 0 0">Nothing scheduled.</p>'}
    </div>`;
  }

  function weekView() {
    const a = parseKey(V.anchor || today());
    const mon = addDays(a, -((a.getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
    const sun = days[6];
    const fmt = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    let held = 0, n = 0;
    for (const g of activeGates()) for (const d of days) { const x = gateDay(g.id, d); if (keyOf(d) <= today()) { held += x.held; n += x.n; } }
    const isThis = days.some(d => keyOf(d) === today());
    return `
      ${calNav(`${fmt(mon)} – ${fmt(sun)}`, isThis ? 'This week' : `<button class="linkbtn" data-act="cal-today">Back to this week</button>`)}
      <div class="card">
        <div class="wk">
          <span></span>
          ${days.map(d => { const k = keyOf(d); return `<div class="dh ${k === today() ? 'today' : ''} ${k === (V.sel || today()) ? 'sel' : ''}" data-act="sel" data-v="${k}">${WD[d.getDay()][0]}<b class="num">${d.getDate()}</b></div>`; }).join('')}
          ${activeGates().map(g => `<span class="g" title="${g.name}">${orb(g.id, 24)}</span>` + days.map(d => {
            const m = mark(gateDay(g.id, d), d);
            return `<div class="c" data-act="sel" data-v="${keyOf(d)}">${m === 'none' ? '·' : `<i class="ring ${m}" style="--gcol:${g.color}"></i>`}</div>`;
          }).join('')).join('')}
          ${on('water') ? `<span class="g" title="Water">${DROP}</span>${days.map(d => {
            const m = waterMark(d);
            return `<div class="c" data-act="sel" data-v="${keyOf(d)}">${m === 'none' ? '·' : `<i class="ring ${m}" style="--gcol:var(--water)"></i>`}</div>`;
          }).join('')}` : ''}
        </div>
        <div class="legend"><span><i class="ring full" style="--gcol:var(--muted)"></i>held</span><span><i class="ring part" style="--gcol:var(--muted)"></i>partly</span><span><i class="ring miss" style="--gcol:var(--muted)"></i>missed</span></div>
        ${n ? `<p class="muted num" style="text-align:center;margin:10px 0 0;font-size:13px">${held}/${n} held so far · ${Math.round(100 * held / n)}%</p>` : ''}
        <button class="btn block" data-act="rv-open" data-v="${keyOf(mon)}" style="margin-top:12px">${S.reviews[keyOf(mon)] ? 'Open weekly review ✓' : 'Weekly review'}</button>
      </div>
      ${dayDetail()}`;
  }

  function monthView() {
    const a = parseKey(V.anchor || today());
    const first = new Date(a.getFullYear(), a.getMonth(), 1);
    const daysIn = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    let held = 0, n = 0;
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div class="d blank"></div>');
    for (let day = 1; day <= daysIn; day++) {
      const d = new Date(a.getFullYear(), a.getMonth(), day), k = keyOf(d);
      const bars = activeGates().map(g => {
        const x = gateDay(g.id, d);
        if (k <= today()) { held += x.held; n += x.n; }
        return `<i class="${mark(x, d)}" style="--gcol:${g.color}"></i>`;
      }).join('') + (on('water') ? `<i class="${waterMark(d)}" style="--gcol:var(--water)"></i>` : '');
      cells.push(`<div class="d ${k === today() ? 'today' : ''} ${k === (V.sel || today()) ? 'sel' : ''}" data-act="sel" data-v="${k}"><span class="n num">${day}</span><span class="bars">${bars}</span></div>`);
    }
    const isThis = a.getFullYear() === new Date().getFullYear() && a.getMonth() === new Date().getMonth();
    const title = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return `
      ${calNav(esc(title), isThis ? 'This month' : `<button class="linkbtn" data-act="cal-today">Back to this month</button>`)}
      <div class="card">
        <div class="mo">
          ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<div class="wd">${x}</div>`).join('')}
          ${cells.join('')}
        </div>
        <div class="legend" style="flex-wrap:wrap">${activeGates().map(g => `<span><i class="ring full" style="--gcol:${g.color};width:10px;height:10px"></i>${g.name}</span>`).join('')}${on('water') ? '<span><i class="ring full" style="--gcol:var(--water);width:10px;height:10px"></i>Water</span>' : ''}</div>
        ${n ? `<p class="muted num" style="text-align:center;margin:10px 0 0;font-size:13px">${held}/${n} held so far · ${Math.round(100 * held / n)}%</p>` : ''}
      </div>
      ${dayDetail()}`;
  }

  function dayView() {
    const items = allRoutines(), k = today();
    const timed = S.todos.filter(x => x.date === k && x.time);
    const loose = S.todos.filter(x => !x.done && x.date && (x.date < k || (x.date === k && !x.time)));
    if (!items.length && !timed.length && !loose.length)
      return `<div class="nexus">${orb('chaos', 150, 'spin')}<div class="cap">Nothing scheduled today</div></div>${nowStack()}`;

    const pick = items.find(x => status(x.r) === 'now')
      || items.find(x => status(x.r) === 'upcoming')
      || items.find(x => status(x.r) === 'open');

    let hero;
    if (pick) {
      const { gate, r } = pick, st = status(r), sd = stepsDone(r), g = gateOf(gate);
      const live = st === 'now' || st === 'open', w = windowOf(r);
      const when = st === 'now' ? 'NOW' : st === 'upcoming' ? `UP NEXT · ${untilText(r).toUpperCase()}` : 'OVERDUE';
      const chips = r.steps.map((x, i) => `<button class="stepchip ${isDone(x.id) ? 'done' : ''}" data-act="step-toggle" data-gate="${gate}" data-id="${r.id}" data-i="${i}">${isDone(x.id) ? '✓ ' : ''}${esc(x.title)}</button>`).join('<span class="arrow">→</span>');
      hero = `
        <div class="card hero" style="--gc:${g.color}">
          <div class="top">${orb(gate, 56)}<div>
          <div class="when">${when}</div>
          <div class="ti">${esc(r.title)}</div>
          <div class="meta">${g.name} · <span class="num">${clock(startFor(r))} – ${fromMin(toMin(startFor(r)) + total(r))}</span> · ${dur(total(r))}</div>
          </div></div>
          ${live ? `${clockBar(r)}<div class="row spread"><span class="cleft" data-left="${w.end}"></span><span class="muted num" style="font-size:13px">${sd}/${r.steps.length} steps</span></div>` : ''}
          <div class="chain">${chips}</div>
          ${live
            ? `<div class="acts"><button class="btn" data-act="run" data-gate="${gate}" data-id="${r.id}">Open timer</button><button class="btn primary" data-act="complete" data-gate="${gate}" data-id="${r.id}">Complete</button></div>`
            : `<button class="btn primary block" data-act="run" data-gate="${gate}" data-id="${r.id}">Start early</button>`}
        </div>`;
    } else if (items.length) {
      hero = `<div class="card hero"><div class="when">ALL GATES HELD</div><div class="ti">Every routine is done today.</div></div>`;
    } else hero = '';

    const doneCount = items.filter(x => isDone(x.r.id)).length;
    const entries = [...items.map(x => ({ m: rel(toMin(startFor(x.r))), kind: 'r', ...x })), ...timed.map(t => ({ m: rel(toMin(t.time)), kind: 't', t }))]
      .sort((a, b) => a.m - b.m);
    return `
      <div class="nexus" style="--held:${items.length ? (doneCount / items.length).toFixed(2) : 0}">${orb('chaos', 150, 'spin')}
        <div class="cap"><b class="num">${doneCount}/${items.length}</b> held today</div></div>
      ${nowStack()}
      ${hero}
      <div class="row spread" style="margin-top:18px"><p class="label" style="margin:0">Timeline</p><span class="muted num" style="font-size:13px">${doneCount}/${items.length} done</span></div>
      <ul class="tl">
        ${entries.map(en => en.kind === 't' ? todoTimelineItem(en.t) : (() => {
          const { gate, r } = en, st = status(r), sd = stepsDone(r);
          let right;
          if (st === 'done') { const fi = finText(r); right = `<span class="st ${fi.late ? 'late' : ''}">${fi.txt}</span>`; }
          else if (st === 'now') right = `<span class="st cleft" data-left="${windowOf(r).end}"></span>`;
          else if (st === 'upcoming') right = `<span class="st">${untilText(r)}</span>`;
          else right = `<span class="st late">${sd ? `${sd}/${r.steps.length} · ` : ''}overdue</span>`;
          return `<li style="--gc:${gateOf(gate).color}"><div class="swbg"><span class="l">✓ Held</span><span class="r">Undo</span></div>
            <div class="it ${st}${st === 'done' ? ' locked' : ''}" ${st === 'done' ? '' : `data-act="run" data-gate="${gate}" data-id="${r.id}"`}>
            <span class="t num">${clock(startFor(r))}</span>
            <span class="dot"></span>
            <span><div class="nm">${orb(gate, 22)}${esc(r.title)}</div>
              <div class="sub">${r.steps.length > 1 ? r.steps.map(x => esc(x.title)).join(' → ') + ' · ' : ''}${dur(total(r))}</div>
              ${st === 'now' ? clockBar(r, true) : ''}</span>
            ${right}
          </div></li>`;
        })()).join('')}
      </ul>
      <p class="swhint">Swipe right to mark done · left to undo</p>
      ${loose.length ? `<div class="card" style="margin-top:14px"><div class="row spread"><p class="label" style="margin:0">To-do today</p><button class="linkbtn" data-act="tab" data-v="todo">Open list</button></div>
        <ul class="todos">${loose.map(todoRow).join('')}</ul></div>` : ''}`;
  }

