  /* ----- routine clock ----- */

  // A routine's timer runs on the clock from its start time; no tap needed.
  function windowOf(r, k = today()) {
    const s0 = atOf(k, startFor(r, parseKey(k)));
    return { start: s0, end: s0 + total(r) * 60000 };
  }
  function clockBar(r, thin = false) {
    const w = windowOf(r);
    let t = w.start;
    const segs = r.steps.map(x => {
      const a = t; t += x.minutes * 60000;
      return `<span class="${isDone(x.id) ? 'done' : ''}" style="flex:${x.minutes}"><i data-s="${a}" data-e="${t}"></i></span>`;
    }).join('');
    return `<div class="clockbar ${thin ? 'thin' : ''}" data-end="${w.end}">${segs}</div>`;
  }
  // moves the bars and "left / over" labels every second without a full re-render
  function updateClocks() {
    const now = Date.now();
    document.querySelectorAll('.clockbar i[data-s]').forEach(i => {
      const a = +i.dataset.s, b = +i.dataset.e;
      i.style.width = Math.max(0, Math.min(100, 100 * (now - a) / (b - a))) + '%';
    });
    document.querySelectorAll('.clockbar[data-end]').forEach(b => b.classList.toggle('over', now > +b.dataset.end));
    document.querySelectorAll('[data-left]').forEach(x => {
      const d = (+x.dataset.left - now) / 1000;
      x.textContent = d >= 0 ? `${mmss(d)} left` : `+${mmss(-d)} over`;
      x.classList.toggle('over', d < 0);
    });
  }
  setInterval(() => { if (!drillRun && !run && !featRun) updateClocks(); }, 1000);

  // when a routine was finished, and whether that was after its scheduled end
  const finOf = (id, k = today()) => (S.fin[k] || {})[id] || null;
  function setFin(id, ts, k = today()) {
    S.fin[k] = S.fin[k] || {};
    if (ts) S.fin[k][id] = ts; else delete S.fin[k][id];
  }
  function completeRoutine(r, v, k = today(), stamp = true) {
    setDone(r.id, v, k);
    r.steps.forEach(x => setDone(x.id, v, k));
    setFin(r.id, v && stamp ? Date.now() : null, k);
    save();
    if (v && stamp) checkHeld(r, k);
  }
  const hm = ts => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  function finText(r, k = today()) {
    const ts = finOf(r.id, k);
    if (!ts) return { txt: '✓ done', late: false };
    const end = windowOf(r, k).end;
    return ts > end + 60000 ? { txt: `late · ${hm(ts)}`, late: true } : { txt: `✓ ${hm(ts)}`, late: false };
  }

