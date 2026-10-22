  /* ----- body: weight, measurements, Navy body fat, bulk/cut ----- */

  const B = () => S.body;
  const PARTS = [['neck', 'Neck'], ['waist', 'Waist (at navel)'], ['hips', 'Hips'], ['chest', 'Chest'], ['shoulders', 'Shoulders'],
                 ['armL', 'Arm L'], ['armR', 'Arm R'], ['thighL', 'Thigh L'], ['thighR', 'Thigh R'], ['calfL', 'Calf L'], ['calfR', 'Calf R']];
  // US Navy body fat (inches). Men: waist & neck; women: waist, hips & neck.
  function navyBF(e, prof = B().profile) {
    const h = +prof.heightIn, n = +e.neck, w = +e.waist, hip = +e.hips;
    if (!h || !n || !w) return null;
    let bf;
    if (prof.sex === 'female') { if (!hip || w + hip - n <= 0) return null; bf = 163.205 * Math.log10(w + hip - n) - 97.684 * Math.log10(h) - 78.387; }
    else { if (w - n <= 0) return null; bf = 86.010 * Math.log10(w - n) - 70.041 * Math.log10(h) + 36.76; }
    return bf > 2 && bf < 70 ? Math.round(bf * 10) / 10 : null;
  }
  const entriesSorted = () => [...B().entries].sort((a, b) => a.date.localeCompare(b.date) || a.t - b.t);
  const latestWith = f => { const es = entriesSorted().filter(e => e[f] != null && e[f] !== ''); return es.length ? es[es.length - 1] : null; };
  function latestBF() {
    const es = entriesSorted().map(e => ({ e, bf: navyBF(e) })).filter(x => x.bf != null);
    return es.length ? es[es.length - 1] : null;
  }
  const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / DAY);
  // least-squares slope of y per day over recent points
  function slopePerDay(pts) {
    if (pts.length < 2) return null;
    const n = pts.length, mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
    const num = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0), den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
    return den ? num / den : null;
  }
  function weightTrend(days = 21) {
    const end = today(), es = entriesSorted().filter(e => +e.weight > 0 && daysBetween(e.date, end) <= days);
    return slopePerDay(es.map(e => ({ x: -daysBetween(e.date, end), y: +e.weight })));
  }
  // maintenance calories: from your own intake and weight change when there's enough data, otherwise Katch-McArdle
  function tdeeEstimate() {
    const end = today(), es = entriesSorted().filter(e => +e.weight > 0 && daysBetween(e.date, end) <= 21);
    const fed = Array.from({ length: 21 }, (_, i) => keyOf(addDays(parseKey(end), -i))).map(k => nTotals(k).kcal).filter(x => x > 0);
    const slope = weightTrend(21);
    if (es.length >= 4 && fed.length >= 10 && slope != null && daysBetween(es[0].date, end) >= 10) {
      return { kcal: Math.round(avg(fed) - slope * 3500), how: `from your last ${fed.length} days of food logs and weight trend` };
    }
    const w = latestWith('weight'), bf = latestBF();
    if (!w) return null;
    const lbm = +w.weight * (1 - (bf ? bf.bf : 20) / 100) * 0.4536;
    return { kcal: Math.round((370 + 21.6 * lbm) * (+B().profile.activity || 1.55)), how: `estimated (Katch-McArdle${bf ? '' : ', assuming 20% body fat'} × activity)` };
  }
  function phaseTargets() {
    const t = tdeeEstimate(), w = latestWith('weight'), mode = B().phase.mode;
    if (!t || !w) return null;
    const kcal = t.kcal + (mode === 'bulk' ? 250 : mode === 'cut' ? -500 : 0);
    const bw = +w.weight, p = Math.round(bw * 0.9), f = Math.round(bw * 0.3), c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
    return { tdee: t, kcal, p, c, f };
  }
  function phaseAdvice(bf) {
    const ph = B().phase;
    if (bf == null) return 'Log neck and waist (and hips for women) with your height in Profile to get body fat.';
    if (bf >= ph.high) return ph.mode === 'cut' ? `Cutting toward ${ph.low}%. Keep going.` : `At ${bf}% you’ve reached the top of your band. Time to cut.`;
    if (bf <= ph.low) return ph.mode === 'bulk' ? `Bulking toward ${ph.high}%. Keep going.` : `At ${bf}% you’re at the bottom of your band. Time to bulk.`;
    return ph.mode === 'bulk' ? `Bulking: ${Math.round((ph.high - bf) * 10) / 10}% to go before cutting.` : ph.mode === 'cut' ? `Cutting: ${Math.round((bf - ph.low) * 10) / 10}% to go before bulking.` : 'Pick a phase to start the cycle.';
  }

  function lineChart(pts, { band, unit = '', height = 130 } = {}) {
    if (pts.length < 2) return '<p class="muted" style="margin:6px 0">Two or more entries draw a trend.</p>';
    const W2 = 320, H = height, pad = 6;
    const ys = pts.map(p => p.y).concat(band || []);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
    const span = hi - lo; lo -= span * 0.12; hi += span * 0.12;
    const x0 = pts[0].x, x1 = pts[pts.length - 1].x || 1;
    const X = x => pad + (W2 - 2 * pad) * ((x - x0) / Math.max(1, x1 - x0)), Y = y => pad + (H - 2 * pad) * (1 - (y - lo) / (hi - lo));
    const bandRect = band ? `<rect x="0" y="${Y(band[1])}" width="${W2}" height="${Math.max(0, Y(band[0]) - Y(band[1]))}" fill="color-mix(in srgb, var(--ok) 14%, transparent)"/>
      <line x1="0" x2="${W2}" y1="${Y(band[1])}" y2="${Y(band[1])}" stroke="var(--late)" stroke-dasharray="4 4" stroke-width="1"/>
      <line x1="0" x2="${W2}" y1="${Y(band[0])}" y2="${Y(band[0])}" stroke="var(--ok)" stroke-dasharray="4 4" stroke-width="1"/>` : '';
    return `<svg class="lchart" viewBox="0 0 ${W2} ${H}" preserveAspectRatio="none" role="img" aria-label="Trend">
      ${bandRect}<polyline points="${pts.map(p => `${X(p.x)},${Y(p.y)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
      ${pts.map(p => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="2.6" fill="var(--accent)"/>`).join('')}</svg>
      <div class="lchart-ax num"><span>${esc(dayLabel(pts[0].k))}</span><span>${Math.round(pts[pts.length - 1].y * 10) / 10}${unit}</span><span>${esc(dayLabel(pts[pts.length - 1].k))}</span></div>`;
  }

  function bodyView() {
    const tab = V.btab;
    const seg = `<div class="seg">${[['overview', 'Overview'], ['log', 'Log'], ['media', 'Media']].map(([k, l]) => `<button data-act="b-tab" data-v="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    return seg + (tab === 'log' ? bodyLog() : tab === 'media' ? mediaView() : bodyOverview());
  }

  function bodyOverview() {
    const b = B(), ph = b.phase, prof = b.profile, w = latestWith('weight'), lb = latestBF(), bf = lb ? lb.bf : null;
    const slope = weightTrend(21), wk = slope != null ? slope * 7 : null;
    const fat = w && bf != null ? +w.weight * bf / 100 : null;
    const tgt = phaseTargets();
    const rateGoal = ph.mode === 'bulk' ? [0.25, 0.5] : ph.mode === 'cut' ? [-1, -0.5] : null;
    const wkPct = wk != null && w ? 100 * wk / +w.weight : null;
    const onPace = rateGoal && wkPct != null ? (wkPct >= rateGoal[0] && wkPct <= rateGoal[1]) : null;
    const bfPts = entriesSorted().map(e => ({ k: e.date, x: daysBetween(entriesSorted()[0].date, e.date), y: navyBF(e) })).filter(p => p.y != null);
    const wPts = entriesSorted().filter(e => +e.weight > 0).map(e => ({ k: e.date, x: daysBetween(entriesSorted()[0].date, e.date), y: +e.weight }));
    // when will the band edge be reached at the current body-fat trend?
    const bfSlope = slopePerDay(bfPts.slice(-6).map(p => ({ x: p.x, y: p.y })));
    let eta = '';
    if (bf != null && bfSlope) {
      const goal = ph.mode === 'bulk' ? ph.high : ph.mode === 'cut' ? ph.low : null;
      if (goal != null && Math.sign(goal - bf) === Math.sign(bfSlope)) eta = `About ${Math.max(1, Math.round((goal - bf) / bfSlope / 7))} weeks to ${goal}% at this pace.`;
    }
    const pos = bf != null ? Math.max(0, Math.min(100, 100 * (bf - ph.low) / (ph.high - ph.low))) : null;
    const missing = !prof.heightIn;
    return `
      ${missing ? `<div class="card" style="border-color:var(--accent)"><b>Add your height</b><p class="muted" style="margin:4px 0 10px;font-size:14px">The Navy body-fat formula needs it.</p><button class="btn primary block" data-act="b-tab" data-v="log">Set up profile</button></div>` : ''}
      <div class="card bodyhead">
        <div><span class="label">Weight</span><b class="num">${w ? fmtWt(+w.weight) : '—'}<small> lb</small></b><span class="muted num">${wk != null ? `${wk >= 0 ? '+' : ''}${Math.round(wk * 10) / 10} lb/week` : '—'}</span></div>
        <div><span class="label">Body fat</span><b class="num">${bf != null ? bf : '—'}<small>%</small></b><span class="muted">US Navy</span></div>
        <div><span class="label">Lean</span><b class="num">${fat != null ? Math.round(+w.weight - fat) : '—'}<small> lb</small></b><span class="muted num">${fat != null ? `${Math.round(fat)} lb fat` : '—'}</span></div>
      </div>
      <div class="sechead"><h3>Bulk / cut</h3><button class="linkbtn" data-act="b-band">Band ${ph.low}–${ph.high}%</button></div>
      <div class="card">
        <div class="opts" style="margin-bottom:12px">${[['bulk', 'Bulk'], ['maintain', 'Maintain'], ['cut', 'Cut']].map(([k, l]) => `<button data-act="b-phase" data-v="${k}" class="${ph.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${pos != null ? `<div class="bandbar"><span class="lo">${ph.low}%</span><div class="track"><i style="left:${pos}%"></i></div><span class="hi">${ph.high}%</span></div>` : ''}
        <p style="margin:10px 0 4px;font-weight:600">${esc(phaseAdvice(bf))}</p>
        ${eta ? `<p class="muted" style="margin:0 0 4px;font-size:14px">${eta}</p>` : ''}
        ${ph.since ? `<p class="muted" style="margin:0 0 8px;font-size:13px">${ph.mode[0].toUpperCase() + ph.mode.slice(1)} since ${esc(dayLabel(ph.since))} (${Math.max(0, Math.round(daysBetween(ph.since, today()) / 7))} weeks)</p>` : ''}
        ${rateGoal ? `<p class="muted" style="margin:0 0 10px;font-size:13px">Target pace: ${rateGoal[0] > 0 ? '+' : ''}${rateGoal[0]} to ${rateGoal[1] > 0 ? '+' : ''}${rateGoal[1]}% of body weight a week${wkPct != null ? ` · you: <b class="${onPace ? '' : 'late'}" style="${onPace ? 'color:var(--ok)' : ''}">${wkPct >= 0 ? '+' : ''}${Math.round(wkPct * 100) / 100}%</b>` : ''}</p>` : ''}
        ${tgt ? `<div class="preptot num"><b>${ph.mode === 'bulk' ? 'Bulk' : ph.mode === 'cut' ? 'Cut' : 'Maintenance'} target:</b> ${tgt.kcal} kcal · P ${tgt.p}g · C ${tgt.c}g · F ${tgt.f}g<br><span class="muted" style="font-size:12px">Maintenance ≈ ${tgt.tdee.kcal} kcal, ${esc(tgt.tdee.how)}</span></div>
          <button class="btn block" data-act="b-apply">Use as my Nutrition goals</button>` : '<p class="muted" style="font-size:14px;margin:0">Log your weight to get calorie targets.</p>'}
      </div>
      <div class="sechead"><h3>Body fat</h3></div>
      <div class="card">${lineChart(bfPts, { band: [ph.low, ph.high], unit: '%' })}</div>
      <div class="sechead"><h3>Weight</h3></div>
      <div class="card">${lineChart(wPts, { unit: ' lb' })}</div>
      ${measureChanges()}
      <p class="note">The Navy method is an estimate (typically within a few percent). Measure the same way, same time of day, and trust the trend over any single reading.</p>`;
  }

  function measureChanges() {
    const es = entriesSorted(), parts = PARTS.filter(([k]) => es.some(e => +e[k] > 0));
    if (!parts.length) return '';
    const rows = parts.map(([k, l]) => {
      const withK = es.filter(e => +e[k] > 0), last = withK[withK.length - 1];
      const ref = withK.filter(e => daysBetween(e.date, last.date) >= 28).pop() || withK[0];
      const d = +last[k] - +ref[k];
      return `<li><span>${esc(l.replace(' (at navel)', ''))}</span><span class="num">${fmtWt(+last[k])}″ ${ref !== last ? `<span class="${d > 0 ? 'up2' : d < 0 ? 'down2' : 'muted'}">${d > 0 ? '+' : ''}${Math.round(d * 100) / 100}″</span> <span class="muted" style="font-size:11px">since ${esc(dayLabel(ref.date))}</span>` : ''}</span></li>`;
    }).join('');
    return `<div class="sechead"><h3>Measurements</h3></div><div class="card"><ul class="flog mlist">${rows}</ul></div>`;
  }

  function bodyLog() {
    const b = B(), prof = b.profile, f = V.bform || { date: today() };
    const ft = prof.heightIn ? Math.floor(prof.heightIn / 12) : '', inch = prof.heightIn ? Math.round((prof.heightIn % 12) * 10) / 10 : '';
    const preview = navyBF(f);
    const es = entriesSorted().reverse();
    return `
      <div class="sechead"><h3>Profile</h3></div>
      <div class="card">
        <div class="opts" style="margin-bottom:10px">${[['male', 'Male'], ['female', 'Female']].map(([k, l]) => `<button data-act="b-sex" data-v="${k}" class="${prof.sex === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="grid2">
          <div class="field"><label>Height (ft)</label><input type="number" inputmode="numeric" min="3" max="8" step="1" data-bprof="ft" value="${ft}"></div>
          <div class="field"><label>(in)</label><input type="number" inputmode="decimal" min="0" max="11.9" step="any" data-bprof="in" value="${inch}"></div>
        </div>
        <div class="field" style="margin:0"><label>Activity</label><select data-bprof="activity">${[[1.375, 'Light (1–3 days/week)'], [1.55, 'Moderate (3–5 days/week)'], [1.725, 'Hard (6–7 days/week)'], [1.9, 'Very hard (2× a day / physical job)']].map(([v, l]) => `<option value="${v}" ${+prof.activity === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      </div>
      <div class="sechead"><h3>Weigh-in &amp; measure</h3></div>
      <form class="card" id="bform" autocomplete="off">
        <div class="grid2">
          <div class="field"><label>Date</label><input name="date" type="date" value="${f.date || today()}" max="${today()}"></div>
          <div class="field"><label>Weight (lb)</label><input name="weight" type="number" inputmode="decimal" min="0" step="any" value="${f.weight ?? ''}"></div>
        </div>
        <p class="label">For body fat (inches)</p>
        <div class="grid3">${PARTS.slice(0, 3).filter(([k]) => k !== 'hips' || prof.sex === 'female').map(([k, l]) => `<div class="field"><label>${l}</label><input name="${k}" type="number" inputmode="decimal" min="0" step="any" value="${f[k] ?? ''}"></div>`).join('')}</div>
        <div class="bfprev">${preview != null ? `Body fat: <b>${preview}%</b>${+f.weight ? ` · lean ${Math.round(+f.weight * (1 - preview / 100))} lb` : ''}` : '<span class="muted">Body fat appears once height, neck and waist are filled in.</span>'}</div>
        <details class="how"${PARTS.slice(3).some(([k]) => f[k]) ? ' open' : ''}><summary>Muscle measurements (optional) ›</summary>
          <div class="grid3" style="margin-top:10px">${PARTS.slice(3).map(([k, l]) => `<div class="field"><label>${l}</label><input name="${k}" type="number" inputmode="decimal" min="0" step="any" value="${f[k] ?? ''}"></div>`).join('')}</div></details>
        <button class="btn primary block" type="submit" style="margin-top:12px">Save entry</button>
      </form>
      ${es.length ? `<div class="sechead"><h3>History</h3></div><div class="card"><ul class="flog">${es.map(e => { const bfe = navyBF(e); return `<li><span><div style="font-weight:600">${esc(dayLabel(e.date))}</div>
          <div class="t num">${[+e.weight ? `${fmtWt(+e.weight)} lb` : '', bfe != null ? `${bfe}% fat` : '', ...PARTS.filter(([k]) => +e[k] > 0).map(([k, l]) => `${l.split(' (')[0]} ${fmtWt(+e[k])}″`)].filter(Boolean).join(' · ')}</div></span>
          <button data-act="b-del" data-id="${e.id}" aria-label="Delete entry">✕</button></li>`; }).join('')}</ul></div>` : ''}`;
  }

