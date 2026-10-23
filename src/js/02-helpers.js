  /* ---------- helpers ---------- */

  const $app = document.getElementById('app');
  const $overlay = document.getElementById('overlay');

  // Update only what changed, so scroll position, focus and running animations survive a re-render.
  function paint(html) {
    if (!window.morphdom) { $app.innerHTML = html; return; }
    morphdom($app, `<div id="app">${html}</div>`, {
      childrenOnly: true,
      onBeforeElUpdated(from, to) {
        // never overwrite what's being typed
        if (from === document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(from.tagName) && from.type !== 'checkbox' && from.type !== 'radio') {
          to.value = from.value;
          if (to.hasAttribute('value')) to.setAttribute('value', from.value);
        }
        return true;
      },
    });
  }
  const view = { set html(h) { paint(h); } };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mmss = sec => {
    sec = Math.max(0, Math.ceil(sec));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = String(sec % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  };
  const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  // minutes since midnight -> "6:30 AM"
  const fromMin = m => {
    m = ((m % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60);
    return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };
  const clock = hhmm => fromMin(toMin(hhmm));
  const fromMinHM = m => { m = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const dur = m => m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') + 'm' : ''}`;
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const nowRel = () => rel(nowMin());
  // a routine's start time on a given day: a weekday override wins over the usual time
  const startFor = (r, d = pdayDate()) => (r.vary && r.times && r.times[d.getDay()]) || r.start;

  const total = r => r.steps.reduce((t, s) => t + Number(s.minutes), 0);
  const stepStarts = r => { let t = toMin(startFor(r)); return r.steps.map(s => { const a = t; t += Number(s.minutes); return a; }); };
  const sorted = list => [...list].sort((a, b) => rel(toMin(startFor(a))) - rel(toMin(startFor(b))));
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function scheduledOn(r, d) {
    const rp = r.repeat || { type: 'daily' };
    if (rp.type === 'weekly') return rp.days.includes(d.getDay());
    if (rp.type === 'monthly') {
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(), n = d.getDate();
      // a 29th-31st date runs on the last day of shorter months
      return rp.dates.includes(n) || (n === last && rp.dates.some(x => x > last));
    }
    return true;
  }
  function repeatText(r) {
    const rp = r.repeat || { type: 'daily' };
    if (rp.type === 'weekly') {
      const d = [...rp.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      if (d.length === 7) return 'Every day';
      if (d.length === 5 && !d.includes(0) && !d.includes(6)) return 'Weekdays';
      if (d.length === 2 && d.includes(0) && d.includes(6)) return 'Weekends';
      return d.map(x => WD[x]).join(', ');
    }
    if (rp.type === 'monthly') {
      const ord = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
      return 'Monthly on the ' + [...rp.dates].sort((a, b) => a - b).map(ord).join(', ');
    }
    return 'Every day';
  }
  // sections the user has switched off are hidden (their data stays)
  const on = k => S.sections[k] !== false;
  const activeGates = () => GATES.filter(g => !g.other || on('other'));
  // Water opens from Today rather than having its own tab
  const visibleTabs = () => ['today', 'gates', ...(on('todo') || on('supplies') ? ['todo'] : []), ...(on('practice') ? ['practice'] : []), ...(on('body') ? ['body'] : [])];
  // a routine skipped for a day leaves that day's timeline and counts (it isn't a miss)
  const skipped = (id, k = today()) => !!(S.skip[k] && S.skip[k][id]);
  const allRoutines = (d = pdayDate()) => activeGates().flatMap(g => S.gates[g.id].filter(r => scheduledOn(r, d) && !skipped(r.id, keyOf(d))).map(r => ({ gate: g.id, r })))
    .sort((a, b) => rel(toMin(startFor(a.r, d))) - rel(toMin(startFor(b.r, d))));

  const isDone = (id, k = today()) => !!(S.done[k] && S.done[k][id]);
  function setDone(id, v, k = today()) {
    S.done[k] = S.done[k] || {};
    if (v) S.done[k][id] = true; else delete S.done[k][id];
    save();
  }
  const stepsDone = (r, k = today()) => r.steps.filter(s => isDone(s.id, k)).length;

  function isNow(r) {
    const w = windowOf(r), t = Date.now();
    return t >= w.start && t < w.end;
  }
  // done | now | upcoming | open (time passed, not done)
  function status(r) {
    if (isDone(r.id)) return 'done';
    if (isNow(r)) return 'now';
    return windowOf(r).start > Date.now() ? 'upcoming' : 'open';
  }

  let ac = null;
  function unlockAudio() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
    } catch (e) {}
  }
  function beep(freq = 660, d = 0.2, vib = 150) {
    try {
      unlockAudio();
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(ac.destination);
      o.start(t); o.stop(t + d + 0.05);
    } catch (e) {}
    try { vib && navigator.vibrate && navigator.vibrate(vib); } catch (e) {}
  }
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(30); } catch (e) {} };

  let wake = null;
  async function lockScreen() { try { wake = await navigator.wakeLock.request('screen'); } catch (e) {} }
  function unlockScreen() { try { wake && wake.release(); } catch (e) {} wake = null; }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (drillRun || run)) lockScreen();
  });

