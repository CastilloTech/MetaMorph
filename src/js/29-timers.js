  /* ---------- timers ---------- */

  function tick() {
    const clock = document.getElementById('clock');
    if (drillRun) {
      // no countdown on screen: the drill only advances on its own clock
      if (Date.now() >= drillRun.end) advanceDrill();
    } else if (featRun && !featRun.held && featRun.end) {
      const left = featRun.end - Date.now(), bar = document.getElementById('bar');
      if (left <= 0) { featRun.held = true; stopTicker(); beep(784, 0.35); return renderFeatRun(); }
      if (clock) clock.textContent = mmss(left / 1000);
      if (bar) bar.style.width = (100 * (1 - left / 30000)) + '%';
    } else if (run && run.autoAt && run.phase !== 'step') {
      const left = run.autoAt - Date.now();
      if (left <= 0) return run.phase === 'between' ? beginStep(run.idx + 1) : chainNext();
      const a = document.getElementById('autoleft'), fg = document.getElementById('autofg');
      if (a) a.textContent = Math.ceil(left / 1000);
      if (fg) fg.style.strokeDashoffset = String(2 * Math.PI * 28 * (1 - left / AUTO_MS));
    } else if (run && run.phase === 'step') {
      const left = runLeft(), seg = document.getElementById('seg');
      if (!run.paused && left <= 0 && !run.over) return timeUp();
      if (clock) clock.textContent = run.over ? `+${mmss(-left / 1000)}` : mmss(left / 1000);
      document.querySelectorAll('[data-late-from]').forEach(x => { x.textContent = `late +${mmss((Date.now() - +x.dataset.lateFrom) / 1000)}`; });
      if (seg && !run.over) seg.style.width = (100 * (1 - left / run.total)) + '%';
    }
  }

