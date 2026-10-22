  /* ----- weekly review ----- */

  function weekStats(mon) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(parseKey(mon), i)).filter(d => keyOf(d) <= today());
    const keys = days.map(keyOf), inWeek = k => k >= mon && k <= keyOf(addDays(parseKey(mon), 6));
    const gates = activeGates().map(g => {
      let n = 0, held = 0, late = 0;
      for (const d of days) {
        const k = keyOf(d);
        for (const r of S.gates[g.id].filter(r => scheduledOn(r, d) && !skipped(r.id, k))) {
          n++;
          if (isDone(r.id, k)) { held++; if (finOf(r.id, k) && finText(r, k).late) late++; }
        }
      }
      return { g, n, held, late };
    }).filter(x => x.n);
    const wo = WK().log.filter(x => inWeek(x.date));
    const fed = keys.map(k => ({ k, t: nTotals(k), g: goalsFor(k) })).filter(x => nLog(x.k).length);
    const water = on('water') ? keys.filter(k => k >= W().since).map(k => wTotal(k) >= W().target) : [];
    const ents = entriesSorted();
    const before = ents.filter(e => e.date < mon), during = ents.filter(e => inWeek(e.date));
    const wFrom = [...before].reverse().find(e => +e.weight > 0) || during.find(e => +e.weight > 0), wTo = [...during].reverse().find(e => +e.weight > 0);
    const bfOf = list => { for (const e of [...list].reverse()) { const v = navyBF(e); if (v != null) return v; } return null; };
    const bfFrom = bfOf(before) ?? (during.length ? navyBF(during[0]) : null), bfTo = bfOf(during);
    const drillWeek = S.drill.sessions.filter(x => inWeek(pdayOf(x.t))).map(sessAvg).filter(v => v != null);
    const prevMon = keyOf(addDays(parseKey(mon), -7));
    const drillPrev = S.drill.sessions.filter(x => { const k = pdayOf(x.t); return k >= prevMon && k < mon; }).map(sessAvg).filter(v => v != null);
    const todosDone = S.todos.filter(x => x.done && x.doneAt && inWeek(pdayOf(x.doneAt))).length;
    return { days, gates, wo, fed, water, wFrom, wTo, bfFrom, bfTo, drillWeek, drillPrev, todosDone };
  }

  function reviewSheet() {
    const mon = V.review, st = weekStats(mon), rv = S.reviews[mon] || {}, sun = addDays(parseKey(mon), 6);
    const f = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const pct = (a, b) => (b ? Math.round(100 * a / b) : 0);
    const tot = st.gates.reduce((a, x) => ({ n: a.n + x.n, held: a.held + x.held }), { n: 0, held: 0 });
    const vol = st.wo.reduce((t, x) => t + volume(x), 0), prs = st.wo.flatMap(x => x.prs || []);
    const kcalOk = st.fed.filter(x => x.g.kcal && Math.abs(x.t.kcal - x.g.kcal) <= x.g.kcal * 0.1).length;
    const protOk = st.fed.filter(x => x.g.p && x.t.p >= x.g.p * 0.95).length;
    const avgK = st.fed.length ? Math.round(avg(st.fed.map(x => x.t.kcal))) : null, avgP = st.fed.length ? Math.round(avg(st.fed.map(x => x.t.p))) : null;
    const dW = st.wFrom && st.wTo && st.wFrom !== st.wTo ? +st.wTo.weight - +st.wFrom.weight : null;
    const dBF = st.bfFrom != null && st.bfTo != null ? Math.round((st.bfTo - st.bfFrom) * 10) / 10 : null;
    const dLat = st.drillWeek.length && st.drillPrev.length ? avg(st.drillWeek) - avg(st.drillPrev) : null;
    const row = (label, value, sub = '') => `<li><span>${label}${sub ? `<div class="t">${sub}</div>` : ''}</span><b class="num">${value}</b></li>`;
    const isPast = keyOf(sun) < today();
    return `<div class="sheet-bg ${V.reviewFresh ? 'enter' : ''}" data-act="rv-close-bg"><div class="sheet review"><div class="grab" aria-hidden="true"></div>
      <div class="whatsnew-head">${orb('chaos', 48)}<div><h2>Weekly review</h2><span class="muted num">${f(parseKey(mon))} – ${f(sun)}${isPast ? '' : ' · so far'}</span></div></div>
      <div class="calnav" style="margin:6px 0 12px"><button class="arrow" data-act="rv-week" data-d="-7" aria-label="Previous week">‹</button>
        <div class="ttl" style="font-size:14px">${tot.n ? `${pct(tot.held, tot.n)}% of routines held` : 'No routines this week'}</div>
        <button class="arrow" data-act="rv-week" data-d="7" aria-label="Next week" ${keyOf(addDays(parseKey(mon), 7)) > today() ? 'disabled' : ''}>›</button></div>
      ${st.gates.length ? `<p class="label">Gates</p><div class="card rvgates">${st.gates.map(x => `<div class="rvg">${orb(x.g.id, 30)}<div style="flex:1;min-width:0">
          <div class="row spread"><b>${x.g.name}</b><span class="num">${x.held}/${x.n}</span></div>
          <div class="mbar"><i style="width:${pct(x.held, x.n)}%;background:${x.g.color}"></i></div>
          <div class="t">${x.n - x.held ? `${x.n - x.held} missed` : 'none missed'}${x.late ? ` · <span class="late">${x.late} late</span>` : ''}</div></div></div>`).join('')}</div>` : ''}
      <p class="label">The week in numbers</p>
      <div class="card"><ul class="flog rvlist">
        ${on('workouts') ? row('Workouts', st.wo.length, st.wo.length ? `${Math.round(vol).toLocaleString()} ${WK().unit} volume${prs.length ? ` · PRs: ${esc([...new Set(prs)].join(', '))}` : ''}` : '') : ''}
        ${on('macros') ? row('Food logged', `${st.fed.length}/${st.days.length} days`, st.fed.length ? `avg ${avgK} kcal · ${avgP}g protein · calories on target ${kcalOk}/${st.fed.length} · protein hit ${protOk}/${st.fed.length}` : '') : ''}
        ${on('water') && st.water.length ? row('Water target hit', `${st.water.filter(Boolean).length}/${st.water.length} days`) : ''}
        ${on('body') && (dW != null || dBF != null) ? row('Body', [dW != null ? `${dW > 0 ? '+' : ''}${Math.round(dW * 10) / 10} lb` : '', dBF != null ? `${dBF > 0 ? '+' : ''}${dBF}% fat` : ''].filter(Boolean).join(' · '), B().phase.mode !== 'maintain' ? `phase: ${B().phase.mode}` : '') : ''}
        ${on('practice') && st.drillWeek.length ? row('Drill recovery', `${avg(st.drillWeek).toFixed(1)} s`, dLat != null ? `${dLat <= 0 ? '↓' : '↑'} ${Math.abs(dLat).toFixed(1)} s vs the week before` : `${st.drillWeek.length} session${st.drillWeek.length === 1 ? '' : 's'}`) : ''}
        ${on('todo') ? row('Tasks finished', st.todosDone) : ''}
      </ul></div>
      <p class="label">Looking back</p>
      <div class="field"><label>Keep doing</label><textarea data-rv="keep" placeholder="What worked this week?">${esc(rv.keep || '')}</textarea></div>
      <div class="field"><label>Change</label><textarea data-rv="change" placeholder="One thing to do differently next week">${esc(rv.change || '')}</textarea></div>
      <button class="btn primary block" data-act="rv-done">${rv.t ? 'Save' : 'Mark week reviewed'}</button>
      <button class="btn ghost block" data-act="rv-close" style="margin-top:8px">Close</button></div></div>`;
  }

