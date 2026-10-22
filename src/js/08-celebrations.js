  /* ----- celebrations ----- */

  const celebrated = new Set();
  function celebrate(kind, id, sub) {
    if (document.visibilityState !== 'visible') return;
    const title = kind === 'all' ? 'All Gates held' : kind === 'pr' ? 'New PR' : `${gateOf(id).name} held`;
    const el = document.createElement('div');
    el.className = 'cele ' + kind;
    el.style.setProperty('--glow', id === 'chaos' ? '#a58bff' : gateOf(id).color);
    el.innerHTML = `<div class="burst"><i></i><i></i><i></i>${orb(id, kind === 'all' ? 200 : 150)}</div><div class="ct">${esc(title)}</div>${sub ? `<div class="cs">${esc(sub)}</div>` : ''}`;
    el.addEventListener('click', () => el.remove());
    $overlay.appendChild(el);
    try { navigator.vibrate && navigator.vibrate(kind === 'all' ? [30, 50, 30, 50, 30, 50, 140] : [25, 40, 25, 40, 70]); } catch (e) {}
    beep(kind === 'all' ? 523 : 660, 0.18, 0); setTimeout(() => beep(kind === 'all' ? 659 : 880, 0.2, 0), 140);
    if (kind === 'all') setTimeout(() => beep(784, 0.45, 0), 280);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 420); }, kind === 'all' ? 2900 : 2100);
  }
  // after a routine is finished today: was that the last one for its Gate, or for every Gate?
  function checkHeld(r, k = today()) {
    if (k !== today()) return;
    const g = GATES.find(x => S.gates[x.id].some(y => y.id === r.id));
    if (!g || g.other) return;
    const d = pdayDate(), gd = gateDay(g.id, d);
    if (!gd.n || gd.held < gd.n) return;
    const gates = activeGates().filter(x => !x.other).map(x => gateDay(x.id, d)).filter(x => x.n);
    const all = gates.length > 1 && gates.every(x => x.held >= x.n);
    const key = k + (all ? ':all' : ':' + g.id);
    if (celebrated.has(key)) return;
    celebrated.add(key);
    setTimeout(() => celebrate(all ? 'all' : 'gate', all ? 'chaos' : g.id), 260);
  }

