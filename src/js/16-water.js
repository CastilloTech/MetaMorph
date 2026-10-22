  /* ----- water ----- */

  const ML_OZ = 29.5735;
  const DROP = '<svg class="drop" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c-3.6 4.6-7 8.7-7 12.3a7 7 0 0 0 14 0c0-3.6-3.4-7.7-7-12.3z" fill="var(--water)"/></svg>';
  const W = () => S.water;
  const fmtIn = (ml, unit) => unit === 'oz' ? Math.round(ml / ML_OZ * 10) / 10 : Math.round(ml);
  const fmtW = (ml, unit = W().unit) => `${fmtIn(ml, unit).toLocaleString()} ${unit}`;

  // spread the target across the waking window, ending two hours before bed
  function autoSchedule(target, pour, wake, bed) {
    // small tolerance so unit rounding (64 oz / 16 oz) doesn't add a 1 ml sip
    const n = Math.max(1, Math.ceil(target / pour - 0.02));
    const a = toMin(wake), b0 = toMin(bed) - 120;
    const b = b0 > a + 60 ? b0 : a + 8 * 60;
    const out = [];
    for (let i = 0; i < n; i++) {
      const m = Math.round((n === 1 ? a : a + i * (b - a) / (n - 1)) / 5) * 5;
      out.push({ id: uid(), time: `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
                 amount: i === n - 1 ? target - pour * (n - 1) : pour });
    }
    return out;
  }
  function ensureWater() {
    const w = W();
    if (!w.scheduleInit) { w.schedule = autoSchedule(w.target, w.pour, w.wake, w.bed); w.scheduleInit = true; save(); }
  }

  const wLog = (k = today()) => W().log[k] || [];
  const wTotal = (k = today()) => wLog(k).reduce((t, e) => t + e.ml, 0);
  const wSched = () => [...W().schedule].sort((a, b) => rel(toMin(a.time)) - rel(toMin(b.time)));
  const SIP_GRACE = 45 * 60000;   // a sip counts as missed this long after its time

  // Each sip is done when you log during its window; one that passes unlogged is missed and the
  // schedule moves on to the next. The fill and pace still come from what you actually drank.
  function wState() {
    ensureWater();
    const k = today(), got = wTotal(k), t = Date.now(), hit = (W().hit || {})[k] || {}, rows = [];
    let expected = 0, next = null;
    for (const e of wSched()) {
      const at = atOf(k, e.time);
      const done = !!hit[e.id], missed = !done && at + SIP_GRACE < t;
      const row = { ...e, at, done, missed };
      rows.push(row);
      if (at <= t) expected += e.amount;
      if (!done && !missed && !next) next = row;
    }
    return { rows, next, got, target: W().target, expected: Math.min(expected, W().target), due: !!(next && next.at <= t),
             missed: rows.filter(x => x.missed).length };
  }
  function waterDue() {
    if (drillRun || run || featRun || !on('water')) return null;
    const st = wState();
    if (!st.due || st.got >= st.target) return null;
    return st;
  }
  function addWater(ml) {
    const k = today(), st = wState();
    // logging during a sip's window (or a little before it) checks that sip off
    if (st.next && st.next.at <= Date.now() + 20 * 60000) { W().hit[k] = W().hit[k] || {}; W().hit[k][st.next.id] = true; }
    (W().log[k] = W().log[k] || []).push({ t: Date.now(), ml: Math.max(1, Math.round(ml)) });
    save();
  }
  function waterMark(d) {
    const k = keyOf(d);
    if (k < W().since) return 'none';
    const t = wTotal(k);
    if (t >= W().target) return 'full';
    if (k > today()) return 'future';
    if (t > 0) return 'part';
    return k === today() ? 'future' : 'miss';
  }

  function waterView() {
    const w = W(), st = wState();
    const pct = Math.min(100, 100 * st.got / st.target), pacePct = Math.min(100, 100 * st.expected / st.target);
    const diff = st.got - st.expected;
    let pill;
    if (st.got >= st.target) pill = '<span class="pill ok">Target reached ✓</span>';
    else if (Math.abs(diff) < w.pour / 2) pill = '<span class="pill ok">On pace</span>';
    else pill = diff < 0 ? `<span class="pill behind">Behind by ${fmtW(-diff)}</span>` : `<span class="pill ahead">Ahead by ${fmtW(diff)}</span>`;
    const nx = st.next, log = wLog().slice().reverse();
    const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6));
    const totals = days.map(d => wTotal(keyOf(d))), mx = Math.max(w.target, ...totals) * 1.08;
    const from = V.wFrom != null ? V.wFrom : pct;
    return `
      <div class="card">
        <div class="vessel-wrap">
          <div class="vessel" role="img" aria-label="${Math.round(pct)}% of today's water">
            <div class="fill" style="height:${from}%" data-h="${pct}"></div>
            ${st.got < st.target && st.expected > 0 ? `<div class="pace" style="bottom:${pacePct}%"><span>PACE</span></div>` : ''}
          </div>
          <div>
            <p class="label" style="margin:0">Water today</p>
            <div class="wbig">${fmtIn(st.got, w.unit).toLocaleString()}<small> / ${fmtW(st.target)}</small></div>
            <div class="muted num" style="font-size:14px">${Math.round(pct)}%</div>
            ${pill}
          </div>
        </div>
        <div class="quick" style="margin-top:16px">
          <button class="btn water" data-act="w-add" data-ml="${w.pour}">+ ${fmtW(w.pour)}</button>
          <button class="btn" data-act="w-add" data-ml="${w.pour / 2}">+ ${fmtW(w.pour / 2)}</button>
          <button class="btn" data-act="w-undo" ${log.length ? '' : 'disabled'}>Undo</button>
        </div>
        <form class="custom" id="wcustom" autocomplete="off"><input name="amt" type="number" inputmode="decimal" min="0.1" step="any" placeholder="Custom amount (${w.unit})"><button class="btn" type="submit">Add</button></form>
      </div>
      ${nx ? `<div class="card"><div class="row spread"><div>
          <p class="label" style="margin:0 0 4px">${st.due ? 'Due now' : 'Next sip'}</p>
          <div style="font-size:18px;font-weight:600" class="num">${fmtW(nx.amount)} <span class="muted" style="font-weight:400">${st.due ? 'since' : 'at'} ${clock(nx.time)}</span></div></div>
          <button class="btn water" data-act="w-add" data-ml="${nx.amount}">Log it</button></div></div>` : ''}
      <div class="card">
        <div class="row spread"><p class="label" style="margin:0">Schedule</p><button class="linkbtn" data-act="w-edit">Edit</button></div>
        <ul class="sched" style="margin-top:6px">${st.rows.map(e => `<li class="${e.done ? 'done' : e.missed ? 'missed' : nx && e.id === nx.id ? 'next' : ''}"><span class="d"></span><span class="num">${clock(e.time)}</span><span class="num">${fmtW(e.amount)}</span></li>`).join('') || '<li><span></span><span>No sips scheduled</span><span></span></li>'}</ul>
        <button class="btn block" data-act="w-ics" style="margin-top:12px">Add reminders to my calendar</button>
        <p class="note">Phones only give reliable alerts through their own calendar, so this adds each sip as a daily event with an alert. While MetaMorph is open it also nudges you when a sip is due.</p>
      </div>
      <div class="card">
        <p class="label">Last 7 days</p>
        <div class="week7">${days.map((d, i) => `<div class="col"><div class="bw"><div class="tl2" style="bottom:${100 * w.target / mx}%"></div><div class="b ${totals[i] >= w.target ? 'hit' : ''}" style="height:${100 * totals[i] / mx}%" title="${fmtW(totals[i])}"></div></div><span class="lbl ${i === 6 ? 'today' : ''}">${WD[d.getDay()][0]}</span></div>`).join('')}</div>
      </div>
      ${log.length ? `<div class="card"><p class="label">Today's log</p><ul class="wlog">${log.map(e => `<li><span class="num">${new Date(e.t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span><span class="num">${fmtW(e.ml)}<button data-act="w-del" data-t="${e.t}" aria-label="Remove">✕</button></span></li>`).join('')}</ul></div>` : ''}`;
  }

  function waterSheet() {
    const e = V.wedit, u = e.unit, tot = e.schedule.reduce((t, x) => t + x.amount, 0);
    return `
      <div class="sheet-bg ${e.fresh ? 'enter' : ''}" data-act="w-cancel-bg">
        <form class="sheet" id="wform" autocomplete="off"><div class="grab" aria-hidden="true"></div>
          <h2>Water schedule</h2>
          <p class="label">Units</p>
          <div class="chips">${['ml', 'oz'].map(x => `<label class="chip"><input type="radio" name="w_unit" value="${x}" ${u === x ? 'checked' : ''}><span>${x}</span></label>`).join('')}</div>
          <div class="grid2">
            <div class="field"><label>Daily target (${u})</label><input name="w_target" type="number" inputmode="decimal" min="0.1" step="any" value="${fmtIn(e.target, u)}"></div>
            <div class="field"><label>Pour size (${u})</label><input name="w_pour" type="number" inputmode="decimal" min="0.1" step="any" value="${fmtIn(e.pour, u)}"></div>
            <div class="field"><label>Wake</label><input name="w_wake" type="time" value="${e.wake}"></div>
            <div class="field"><label>Bed</label><input name="w_bed" type="time" value="${e.bed}"></div>
          </div>
          <button class="btn block" type="button" data-act="w-auto">Auto-space from wake to 2h before bed</button>
          <p class="label" style="margin-top:16px">Sips</p>
          ${e.schedule.map((x, i) => `<div class="wrow"><input name="wt${i}" type="time" value="${x.time}" aria-label="Time"><input name="wa${i}" type="number" inputmode="decimal" min="0.1" step="any" value="${fmtIn(x.amount, u)}" aria-label="Amount (${u})"><button type="button" data-act="w-rm" data-i="${i}" aria-label="Remove sip">✕</button></div>`).join('')}
          <button class="btn block" type="button" data-act="w-addrow" style="margin-bottom:8px">+ Add sip</button>
          <div class="total num">${e.schedule.length} sips · ${fmtW(tot, u)} scheduled${Math.abs(tot - e.target) > 1 ? ` · target is ${fmtW(e.target, u)}` : ''}</div>
          <button class="btn primary block" type="submit" style="margin-bottom:8px">Save</button>
          <button class="btn block" type="button" data-act="w-cancel">Cancel</button>
        </form>
      </div>`;
  }

  // read typed values (in the unit they were typed in) before any re-render of the sheet
  function syncWEdit() {
    const f = document.getElementById('wform');
    if (!f || !V.wedit) return;
    const e = V.wedit, el = f.elements, k = e.unit === 'oz' ? ML_OZ : 1;
    const num = (v, d) => { const n = Number(v); return n > 0 ? Math.round(n * k) : d; };
    e.target = num(el.w_target.value, e.target);
    e.pour = num(el.w_pour.value, e.pour);
    e.wake = el.w_wake.value || e.wake;
    e.bed = el.w_bed.value || e.bed;
    e.schedule.forEach((x, i) => { x.time = el['wt' + i].value || x.time; x.amount = num(el['wa' + i].value, x.amount); });
    e.unit = (f.querySelector('input[name=w_unit]:checked') || {}).value || e.unit;
  }

  function waterICS() {
    const pad = n => String(n).padStart(2, '0'), d = new Date();
    const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MetaMorph//Water//EN', 'CALSCALE:GREGORIAN'];
    for (const e of wSched()) {
      const [h, m] = e.time.split(':');
      // floating local time, so alerts follow the phone's timezone
      lines.push('BEGIN:VEVENT', `UID:water-${e.id}@metamorph`, `DTSTAMP:${stamp}`, `DTSTART:${ymd}T${h}${m}00`, 'DURATION:PT5M', 'RRULE:FREQ=DAILY',
        `SUMMARY:Water · ${fmtW(e.amount)}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:Water · ${fmtW(e.amount)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar' });
  }

  function deliver(blob, name, title) {
    const file = new File([blob], name, { type: blob.type });
    const download = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    };
    // sharing needs a fresh tap; if the browser refuses (not a user cancel), save the file instead
    if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title }).catch(err => { if (err && err.name !== 'AbortError') download(); });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

