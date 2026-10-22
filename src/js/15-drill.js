  /* ----- drill ----- */

  const DRILL_OPTS = { focus: [20, 30, 45, 60], release: [20, 30, 45, 60], rounds: [5, 8, 10, 12], jitter: [0, 5, 8, 12] };
  const sessAvg = x => { const ok = x.latencies.filter(v => v != null); return ok.length ? avg(ok) : null; };

  // Phase changes are announced by sound and vibration only, so the screen gives nothing away.
  function cueReturn() {   // rising pair: come back to the orb
    beep(660, 0.12, 0); setTimeout(() => beep(990, 0.2, 0), 130);
    try { navigator.vibrate && navigator.vibrate([40, 60, 40]); } catch (e) {}
  }
  function cueRelease() {  // single low tone: let go
    beep(330, 0.4, 0);
    try { navigator.vibrate && navigator.vibrate(220); } catch (e) {}
  }

  function spark(vals) {
    if (vals.length < 2) return '';
    const Wd = 300, H = 44, mx = Math.max(...vals), mn = Math.min(...vals), rng = mx - mn || 1;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * Wd},${4 + (1 - (v - mn) / rng) * (H - 8)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${Wd} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
  }

  function drillView() {
    const d = S.drill;
    if (V.summary) return drillSummary(V.summary);
    const ss = d.sessions, avgs = ss.map(sessAvg).filter(x => x != null);
    const recent = avgs.slice(-7), prior = avgs.slice(-14, -7);
    const ra = recent.length ? avg(recent) : null, pa = prior.length ? avg(prior) : null;
    const delta = ra != null && pa != null ? ra - pa : null;
    const est = Math.max(1, Math.round((d.rounds * d.focus + (d.rounds - 1) * d.release + 6) / 60));
    const opt = (k, v, label) => `<button data-act="dset" data-k="${k}" data-v="${v}" class="${d[k] === v ? 'on' : ''}">${label}</button>`;
    return `
      <div class="card"><div class="drillhero">${orb('chaos', 96, 'still')}<div>
        <h2>Switch Drill</h2>
        <p class="muted" style="margin:0;font-size:14px">Hold the orb. Let it go. Come back on the chime. The skill is the return.</p>
      </div></div></div>
      <div class="card">
        <p class="label">Recovery latency${recent.length ? ` · last ${recent.length}` : ''}</p>
        <div class="bigstat"><b>${ra == null ? '—' : ra.toFixed(1)}</b><span class="muted">sec</span>
          ${delta == null ? '' : `<span class="delta ${delta <= 0 ? 'good' : 'bad'}">${delta <= 0 ? '↓' : '↑'} ${Math.abs(delta).toFixed(1)}s vs previous ${prior.length}</span>`}</div>
        ${spark(avgs.slice(-20))}
        <p class="muted" style="margin:6px 0 0;font-size:12px">${avgs.length ? 'Lower is better. It should shorten over weeks.' : 'No sessions yet.'}</p>
      </div>
      <div class="card">
        <div class="setrow"><span>Focus</span><div class="opts">${DRILL_OPTS.focus.map(v => opt('focus', v, v + 's')).join('')}</div></div>
        <div class="setrow"><span>Release</span><div class="opts">${DRILL_OPTS.release.map(v => opt('release', v, v + 's')).join('')}</div></div>
        <div class="setrow"><span>Randomize</span><div class="opts">${DRILL_OPTS.jitter.map(v => opt('jitter', v, v ? '±' + v + 's' : 'Off')).join('')}</div></div>
        <div class="setrow" style="margin:0"><span>Rounds</span><div class="opts">${DRILL_OPTS.rounds.map(v => opt('rounds', v, v)).join('')}</div></div>
        <p class="muted" style="margin:12px 0 0;font-size:13px">About ${est} min. ${d.jitter ? 'Release length varies, so the return chime can’t be anticipated.' : 'Fixed timing: you may start anticipating the chime, which flatters your latency.'}</p>
      </div>
      <div class="card">
        <div class="row spread"><span style="font-size:14px">Hear the cues</span>
          <span class="row" style="gap:8px"><button class="btn small" data-act="cue-return">▲ Return</button><button class="btn small" data-act="cue-release">▼ Let go</button></span></div>
        <details class="how" style="margin-top:12px"><summary>How it works ›</summary><ol>
          <li><b>▲ Rising chime:</b> bring attention back to the orb and tap the pad the instant you're on it. That gap is your recovery latency.</li>
          <li>Hold the orb. Whenever you catch yourself drifting, come back and tap again.</li>
          <li><b>▼ Low chime:</b> let go completely. Hold nothing. Taps during release count as false starts.</li>
          <li>The screen never changes between phases, so only the sound tells you where you are.</li>
        </ol></details>
      </div>
      <button class="btn primary block" data-act="drill-start" style="margin-bottom:16px;padding:16px">Begin</button>
      ${ss.length ? `<div class="card"><p class="label">History</p><ul class="hist">${ss.slice(-10).reverse().map(x => {
          const a = sessAvg(x), miss = x.latencies.filter(v => v == null).length;
          const when = new Date(x.t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
          return `<li><span>${esc(when)} <span class="muted">· ${x.rounds}r${miss ? ` · ${miss} missed` : ''}${x.jitter === 0 ? ' · fixed' : ''}</span></span><b class="num">${a == null ? '—' : a.toFixed(1) + ' s'}</b></li>`;
        }).join('')}</ul></div>` : ''}`;
  }

  function drillSummary(x) {
    const lats = x.latencies, ok = lats.filter(v => v != null), a = ok.length ? avg(ok) : null;
    const prev = S.drill.sessions.slice(0, -1).slice(-7).map(sessAvg).filter(v => v != null);
    const pa = prev.length ? avg(prev) : null, delta = a != null && pa != null ? a - pa : null;
    const mx = Math.max(...ok, 1);
    return `
      <div class="card" style="text-align:center">
        <div style="display:flex;justify-content:center">${orb('chaos', 72, 'still')}</div>
        <p class="label" style="margin:10px 0 4px">Session complete</p>
        <div class="bigstat" style="justify-content:center"><b>${a == null ? '—' : a.toFixed(1)}</b><span class="muted">sec average</span></div>
        ${delta == null ? '' : `<div class="delta ${delta <= 0 ? 'good' : 'bad'}" style="margin-top:4px">${delta <= 0 ? '↓ faster' : '↑ slower'} than your last ${prev.length} (${pa.toFixed(1)}s)</div>`}
        <div class="lat">${lats.map(v => v == null ? '<i class="miss" title="missed"></i>' : `<i style="height:${Math.max(4, 100 * v / mx)}%" title="${v.toFixed(1)}s"></i>`).join('')}</div>
        <p class="muted" style="margin:0;font-size:12px">One bar per return. Shorter is better; dashed means no return was tapped.</p>
        <div class="stats4">
          <div><b>${ok.length ? Math.min(...ok).toFixed(1) : '—'}</b><span>Best</span></div>
          <div><b>${x.catches}</b><span>Drifts caught</span></div>
          <div><b>${lats.filter(v => v == null).length}</b><span>Missed</span></div>
          <div><b>${x.falseTaps || 0}</b><span>False starts</span></div>
        </div>
      </div>
      <button class="btn primary block" data-act="summary-ok">Done</button>`;
  }

  // The run screen is identical in every phase: still orb, same text, same tap pad.
  function renderDrillRun() {
    const r = drillRun, d = S.drill;
    view.html = `
      <div class="run drillrun"><div class="inner">
        <div class="top"><span class="num">${r.doneRounds} of ${d.rounds} rounds</span><button class="btn small ghost" data-act="drill-stop">End</button></div>
        <div class="dots" style="margin-top:12px">${Array.from({ length: d.rounds }, (_, i) => `<i class="${i < r.doneRounds ? 'on' : ''}"></i>`).join('')}</div>
        <div class="stage">
          ${orb('chaos', 210, 'still')}
          <div class="legend2">▲ rising chime: return and tap<br>▼ low chime: let go</div>
        </div>
        <button class="tapzone" id="tapzone" aria-label="Tap when you're back on the orb"><span class="rip"></span>Tap when you're back on the orb</button>
      </div></div>`;
  }

  function startDrill() {
    unlockAudio();
    const t = Date.now();
    // a short settle-in before the first return cue
    drillRun = { phase: 'settle', start: t, end: t + 6000, round: 0, doneRounds: 0, latencies: [], catches: 0, falseTaps: 0, locked: false };
    lockScreen(); startTicker(); renderDrillRun();
  }

  function setDrillPhase(phase) {
    const r = drillRun, d = S.drill;
    let sec = phase === 'focus' ? d.focus : d.release;
    if (phase === 'release' && d.jitter) sec = Math.max(5, sec + (Math.random() * 2 - 1) * d.jitter);
    r.phase = phase;
    r.start = Date.now();
    r.end = r.start + sec * 1000;
    if (phase === 'focus') {
      r.round++;
      r.locked = false;
      cueReturn();
    } else {
      closeRound();
      cueRelease();
      renderDrillRun();
    }
  }

  // a focus phase that ends without a tap is a missed return
  function closeRound() {
    const r = drillRun;
    if (!r.locked) r.latencies.push(null);
    r.doneRounds++;
  }

  function advanceDrill() {
    const r = drillRun;
    if (r.phase === 'settle') return setDrillPhase('focus');
    if (r.phase === 'focus') {
      if (r.round >= S.drill.rounds) { closeRound(); return finishDrill(); }
      return setDrillPhase('release');
    }
    setDrillPhase('focus');
  }

  function drillTap() {
    const r = drillRun;
    if (!r) return;
    const z = document.getElementById('tapzone');
    if (z) { z.classList.remove('hit'); void z.offsetWidth; z.classList.add('hit'); }
    buzz();
    if (r.phase === 'focus') {
      if (!r.locked) { r.latencies.push(Math.round((Date.now() - r.start) / 100) / 10); r.locked = true; }
      else r.catches++;
    } else if (r.phase === 'release') r.falseTaps++;
  }

  function finishDrill() {
    const r = drillRun;
    stopTicker(); unlockScreen();
    drillRun = null;
    if (r.latencies.length) {
      const x = { t: Date.now(), rounds: r.latencies.length, latencies: r.latencies, catches: r.catches, falseTaps: r.falseTaps, jitter: S.drill.jitter, object: 'orb' };
      S.drill.sessions.push(x);
      if (S.drill.sessions.length > 500) S.drill.sessions.shift();
      save();
      V.summary = x;
      beep(523, 0.2, 0); setTimeout(() => beep(784, 0.45), 200);
    }
    render();
  }

