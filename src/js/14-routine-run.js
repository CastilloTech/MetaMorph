  /* ----- routine run ----- */

  function findRoutine(gate, id) { return S.gates[gate].find(r => r.id === id); }

  // A run belongs to the day it started, so a routine finished after midnight still counts for that night.
  function startRoutine(gate, id) {
    const r = findRoutine(gate, id);
    if (!r) return;
    const key = today();
    let idx = r.steps.findIndex(s => !isDone(s.id, key));
    if (idx < 0 || isDone(r.id, key)) idx = 0;
    unlockAudio(); lockScreen(); startTicker();
    run = { gate, rid: id, idx, key };
    beginStep(idx);
  }

  // keep the run in saved state so closing the app doesn't lose it
  function saveRun() { S.run = run ? { ...run } : null; save(); }
  function resumeRun() {
    const r0 = S.run;
    if (!r0 || !findRoutine(r0.gate, r0.rid)) { S.run = null; return; }
    // abandon runs left open for more than a day
    if (Date.now() - (r0.paused ? Date.now() : r0.end) > DAY) { S.run = null; save(); return; }
    run = { ...r0, entered: true };
    startTicker();
    if (run.autoAt && run.autoAt < Date.now()) run.autoAt = Date.now() + 1500;
    lockScreen();
  }

  function beginStep(i) {
    const r = findRoutine(run.gate, run.rid);
    run.idx = i;
    run.phase = 'step';
    run.autoAt = null;
    run.over = false;
    run.total = Math.max(1, Number(r.steps[i].minutes)) * 60000;
    run.end = Date.now() + run.total;
    run.paused = false;
    beep(880, 0.3);
    saveRun();
    renderRun();
  }

  function finishStep() {
    const r = findRoutine(run.gate, run.rid);
    if (run.over) {
      run.late = run.late || {};
      run.late[r.steps[run.idx].id] = Math.round((Date.now() - run.end) / 1000);
      run.over = false;
    }
    setDone(r.steps[run.idx].id, true, run.key);
    if (run.idx >= r.steps.length - 1) {
      for (const o of [...(run.open || [])]) closeLate(o);
      setDone(r.id, true, run.key);
      setFin(r.id, Date.now(), run.key); save();
      checkHeld(r, run.key);
      run.phase = 'complete';
      run.next = nextRoutine();
      run.autoAt = run.next && run.next.auto ? Date.now() + AUTO_MS : null;
      beep(660, 0.6);
    } else {
      run.phase = 'between';
      run.autoAt = Date.now() + AUTO_MS;
      beep(660, 0.3);
    }
    saveRun();
    renderRun();
  }

  // A step's time ran out. If another step follows, it starts now and the unfinished one stays open,
  // counting overtime until it's marked done. The last step has nowhere to go, so it runs over in place.
  function timeUp() {
    const r = findRoutine(run.gate, run.rid);
    if (run.idx < r.steps.length - 1) {
      run.open = run.open || [];
      run.open.push({ id: r.steps[run.idx].id, end: run.end });
      beep(440, 0.4, 0);
      beginStep(run.idx + 1);
    } else {
      run.over = true;
      beep(440, 0.5);
      saveRun();
      renderRun();
    }
  }
  // close a late step, recording how far past its time it ran
  function closeLate(o) {
    run.late = run.late || {};
    run.late[o.id] = Math.round((Date.now() - o.end) / 1000);
    setDone(o.id, true, run.key);
    run.open = (run.open || []).filter(x => x.id !== o.id);
  }

  const AUTO_MS = 5000;              // countdown before the next step or routine starts by itself
  const CHAIN_WINDOW = 15 * 60000;   // only auto-start a routine due within this long

  // the next undone routine on today's timeline after the one just finished
  function nextRoutine() {
    const cur = findRoutine(run.gate, run.rid);
    const items = allRoutines().filter(x => x.r.id !== run.rid && !isDone(x.r.id) && rel(toMin(startFor(x.r))) >= rel(toMin(startFor(cur))));
    if (!items.length) return null;
    const x = items[0], startAt = windowOf(x.r).start;
    return { gate: x.gate, id: x.r.id, title: x.r.title, start: startFor(x.r), auto: startAt - Date.now() <= CHAIN_WINDOW };
  }

  function autoRing() {
    const C = 2 * Math.PI * 28;
    return `<svg class="autoring" viewBox="0 0 64 64" aria-hidden="true"><circle class="bg" cx="32" cy="32" r="28"/><circle class="fg" id="autofg" cx="32" cy="32" r="28" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>`;
  }

  function endRun() {
    run = null;
    saveRun();
    stopTicker(); unlockScreen();
    render();
  }

  // finish this run and start the next routine on the timeline
  function chainNext() {
    const nx = run && run.next;
    if (!nx || !findRoutine(nx.gate, nx.id)) return endRun();
    run = null;
    startRoutine(nx.gate, nx.id);
  }

  const runLeft = () => run.paused ? run.remaining : run.end - Date.now();

  function renderRun() {
    const r = findRoutine(run.gate, run.rid);
    if (!r) return endRun();
    const g = gateOf(run.gate), s = r.steps[run.idx], next = r.steps[run.idx + 1];

    const segs = `<div class="segs">${r.steps.map((x, i) =>
      `<span class="${(run.phase === 'step' && i === run.idx && run.over) || (run.open || []).some(o => o.id === x.id) ? 'over' : isDone(x.id, run.key) && !(run.phase === 'step' && i === run.idx) ? 'done' : ''}" style="flex:${x.minutes}"><i ${i === run.idx && run.phase === 'step' ? 'id="seg"' : ''}></i></span>`).join('')}</div>
      <div class="seglabels"><span>${esc(r.title)}</span><span class="num">${run.phase === 'complete' ? r.steps.length : run.idx + 1}/${r.steps.length}</span></div>`;

    let center, controls;
    if (run.phase === 'step') {
      center = `
        ${(run.open || []).length ? `<div class="latebars">${run.open.map(o => {
          const st = r.steps.find(x => x.id === o.id);
          return `<div class="latebar"><span>${esc(st ? st.title : 'Step')}</span><b data-late-from="${o.end}">late +${mmss((Date.now() - o.end) / 1000)}</b><button class="btn" data-act="r-late-done" data-id="${o.id}">Done</button></div>`;
        }).join('')}</div>` : ''}
        ${orb(run.gate, (run.open || []).length ? 110 : 150, run.entered ? 'spin' : 'enter')}
        <div class="phase" style="color:${run.over ? 'var(--late)' : g.color}">STEP ${run.idx + 1}${run.over ? ' · LATE' : ''}</div>
        <div class="stepname">${esc(s.title)}</div>
        ${s.work ? `<div class="instr">${esc(s.work)}</div>` : ''}
        <div class="clock ${run.over ? 'late' : ''}" id="clock" style="font-size:72px;margin-top:10px">${run.over ? '+' + mmss(-runLeft() / 1000) : mmss(runLeft() / 1000)}</div>
        ${next ? `<div class="muted" style="font-size:14px">then ${esc(next.title)} · ${dur(next.minutes)}</div>` : ''}`;
      // in overtime the only way forward is Done
      controls = run.over
        ? `<div class="controls one"><button class="btn primary" data-act="r-done">Done</button></div>`
        : `<div class="controls">
          <button class="btn" data-act="r-pause">${run.paused ? 'Resume' : 'Pause'}</button>
          <button class="btn primary" data-act="r-done">Done</button>
        </div>`;
    } else if (run.phase === 'between') {
      const nx = r.steps[run.idx + 1];
      center = `
        ${run.autoAt ? autoRing() : '<div class="check">✓</div>'}
        <div class="muted">${esc(s.title)} done</div>
        <div class="upnext">UP NEXT</div>
        <div class="stepname">${esc(nx.title)}</div>
        <div class="muted num">${dur(nx.minutes)}${nx.work ? ` · ${esc(nx.work)}` : ''}</div>
        ${run.autoAt ? `<div class="autonext">Starts in <b id="autoleft">${Math.ceil((run.autoAt - Date.now()) / 1000)}</b>s</div>` : ''}`;
      controls = run.autoAt
        ? `<div class="controls"><button class="btn" data-act="r-hold">Hold</button><button class="btn primary" data-act="r-next">Start now</button></div>`
        : `<div class="controls"><button class="btn" data-act="r-end">End here</button><button class="btn primary" data-act="r-next">Start</button></div>`;
    } else {
      const nx = run.next;
      center = `
        ${orb(run.gate, 150, 'spin')}
        <div class="phase" style="color:${g.color}">${g.other ? 'DONE' : 'GATE HELD'}</div>
        <div class="stepname">${esc(r.title)}</div>
        <ul class="recap">${r.steps.map(x => `<li>${esc(x.title)}${run.late && run.late[x.id] ? ` <span class="ot">· late +${mmss(run.late[x.id])}</span>` : ''}</li>`).join('')}</ul>
        ${nx ? `<div class="upnext">NEXT ROUTINE</div>
          <div style="font-size:20px;font-weight:600">${esc(nx.title)} <span class="muted" style="font-weight:400;font-size:15px">· ${gateOf(nx.gate).name} · ${clock(nx.start)}</span></div>
          ${run.autoAt ? `<div class="autonext">Starts in <b id="autoleft">${Math.ceil((run.autoAt - Date.now()) / 1000)}</b>s</div>` : ''}` : ''}`;
      if (nx && run.autoAt) controls = `<div class="controls"><button class="btn" data-act="r-close">Stop here</button><button class="btn primary" data-act="r-chain">Start now</button></div>`;
      else if (nx) controls = `<div class="controls"><button class="btn" data-act="r-close">Close</button><button class="btn primary" data-act="r-chain">Start early</button></div>`;
      else controls = `<div class="controls one"><button class="btn primary" data-act="r-close">Close</button></div>`;
    }

    view.html = `
      <div class="run" style="--gc:${g.color}"><div class="inner">
        <div class="top"><span style="color:${g.color}">${g.name}</span>
          ${run.phase === 'complete' ? '<span></span>' : '<button class="btn small ghost" data-act="r-exit">Exit</button>'}</div>
        ${segs}
        <div class="center">${center}</div>
        ${controls}
      </div></div>`;
    run.entered = true;
    tick();
  }

