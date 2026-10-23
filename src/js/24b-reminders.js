  /* ----- reminders: real push notifications ----- */

  // The push server (push/ in the repo, a Cloudflare Worker).
  const PUSH_URL = 'https://metamorph-push.specimen-card-game.workers.dev';
  const VAPID_PUBLIC = 'BLstPkxs99TdEmIzWipe9NqLXNKDJVa9PEr2Q7PUnHaRI-Zn6O5UlbQ3bVrzLB46nJg_AUSjlgBUrgwCk1zANo0';
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const RM = () => S.reminders;
  const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));

  // Everything the server should remind about. Times before the day rolls over belong to the previous
  // personal day, so on the calendar they fall on the next weekday/date.
  function reminderItems() {
    const r = RM(), items = [], ds = dayStart(), k0 = today();
    const late = hhmm => hmToMin(hhmm) < ds;
    // your companion speaks in the reminders once it exists
    const voice = (kind, seed, vars) => (on('companion') ? svLine(kind, seed, vars) : null);
    const shiftDays = (days, hhmm) => (late(hhmm) ? days.map(d => (d + 1) % 7) : days);
    const calDate = (k, hhmm) => (late(hhmm) ? keyOf(addDays(parseKey(k), 1)) : k);
    if (r.routines) for (const g of activeGates()) for (const rt of S.gates[g.id]) {
      const rp = rt.repeat || { type: 'daily' }, base = { title: rt.title, body: voice('routine', rt.id, { t: rt.title }) || `${g.name} · starts now`, tag: 'r-' + rt.id, url: `./?do=routine&id=${rt.id}` };
      // already done or skipped today: no ping for today's run
      const skipToday = isDone(rt.id) || skipped(rt.id) ? [calDate(k0, startFor(rt))] : [];
      if (rp.type === 'monthly') {
        for (let i = 0; i < 35; i++) {
          const d = addDays(pdayDate(), i), k = keyOf(d);
          if (!scheduledOn(rt, d) || (i === 0 && skipToday.length)) continue;
          const t = startFor(rt, d);
          items.push({ ...base, id: `${rt.id}-${k}`, at: t, date: calDate(k, t) });
        }
        continue;
      }
      const days = rp.type === 'weekly' ? rp.days : [0, 1, 2, 3, 4, 5, 6];
      if (rt.vary && rt.times && Object.keys(rt.times).length) {
        for (const d of days) { const t = rt.times[d] || rt.start; items.push({ ...base, id: `${rt.id}-${d}`, at: t, days: shiftDays([d], t), skip: skipToday }); }
      } else items.push({ ...base, id: rt.id, at: rt.start, days: shiftDays(days, rt.start), skip: skipToday });
    }
    if (r.water && on('water')) {
      const st = wState();
      for (const e of st.rows) items.push({ id: 'w-' + e.id, at: e.time, title: 'Water', body: voice('water', e.id, { a: fmtW(e.amount) }) || `${fmtW(e.amount)} sip`, tag: 'water', url: `./?do=water&ml=${e.amount}`, skip: e.done ? [calDate(k0, e.time)] : [] });
    }
    if (r.todos && on('todo')) for (const t of S.todos) if (!t.done && t.date && t.time && t.date >= k0) items.push({ id: 't-' + t.id, at: t.time, date: calDate(t.date, t.time), title: t.text, body: voice('todo', t.id, { t: t.text }) || 'To-do · due now', tag: 't-' + t.id, url: `./?do=todo&id=${t.id}` });
    // a morning message with the day's plan and an evening check-in (written now; refreshed whenever your data changes)
    if (r.brief) for (let i = 0; i < 3; i++) {
      const k = keyOf(addDays(pdayDate(), i)), at = briefAt(), m = morningText(k, i === 0);
      items.push({ id: 'brief-' + k, at, date: calDate(k, at), title: m.title, body: m.body, tag: 'brief', url: './' });
    }
    if (r.wrap) for (let i = 0; i < 2; i++) {
      const k = keyOf(addDays(pdayDate(), i)), at = wrapAt(), m = eveningText(k, i === 0);
      items.push({ id: 'wrap-' + k, at, date: calDate(k, at), title: m.title, body: m.body, tag: 'wrap', url: './' });
    }
    if (r.review) items.push({ id: 'review', at: '18:00', days: [0], title: 'Weekly review', body: voice('review', 'review') || 'Take a minute to look back on your week', tag: 'review', url: './?do=review' });
    return items;
  }

  // keep the server's copy of the schedule current (only sends when something actually changed)
  let reminderTimer = 0;
  function scheduleReminderSync() {
    if (!RM() || !RM().on || !PUSH_URL || !pushSupported()) return;
    clearTimeout(reminderTimer);
    reminderTimer = setTimeout(() => syncReminders(), 2500);
  }
  async function syncReminders(force = false) {
    const r = RM();
    if (!r.on || !PUSH_URL || !pushSupported()) return false;
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (!sub) return false;
    const items = reminderItems(), tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const body = { id: r.deviceId, sub: sub.toJSON(), tz, items }, hash = JSON.stringify([body.sub.endpoint, tz, items]);
    if (!force && hash === r.lastHash) return true;
    try {
      const res = await fetch(PUSH_URL + '/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) return false;
      r.lastHash = hash; r.synced = Date.now(); r.count = items.length; save();
      if (V.data) render();   // Settings shows the fresh status
      return true;
    } catch (e) { return false; }
  }
  async function enableReminders() {
    if (!PUSH_URL) return snack('The reminder server isn’t set up yet.');
    if (!pushSupported()) return snack('This browser can’t receive notifications. On iPhone, add MetaMorph to your Home Screen first (iOS 16.4 or later).');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return snack('Notifications are blocked. Allow them for MetaMorph in your phone’s settings.');
    try {
      const reg = await navigator.serviceWorker.ready;
      if (!(await reg.pushManager.getSubscription())) await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(VAPID_PUBLIC) });
    } catch (e) { return snack('Couldn’t turn on notifications on this device.'); }
    const r = RM();
    if (!r.deviceId) r.deviceId = (uid() + uid() + uid()).slice(0, 32);
    r.on = true; r.lastHash = ''; save(); render();
    snack((await syncReminders(true)) ? 'Reminders on' : 'Reminders on, but the server couldn’t be reached. It’ll retry.');
  }
  async function disableReminders() {
    const r = RM();
    r.on = false; r.lastHash = ''; save(); render();
    try {
      await fetch(PUSH_URL + '/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.deviceId }) });
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch (e) {}
    snack('Reminders off');
  }
  async function testReminder() {
    await syncReminders(true);
    try {
      const res = await fetch(PUSH_URL + '/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: RM().deviceId }) });
      snack(res.ok ? 'Test sent. It should arrive in a few seconds.' : 'The server couldn’t send a test.');
    } catch (e) { snack('Couldn’t reach the reminder server.'); }
  }

  const briefAt = () => RM().briefAt || (S.water && S.water.wake) || '07:00';
  const wrapAt = () => RM().wrapAt || fromMinHM(toMin((S.water && S.water.bed) || '22:00') - 60);

  function remindersSettings() {
    const r = RM();
    if (!PUSH_URL) return '<p class="note" style="margin:0 0 6px">Push reminders are being set up.</p>';
    if (!pushSupported()) return '<p class="note" style="margin:0 0 6px">This browser can’t receive notifications. On iPhone, add MetaMorph to your Home Screen first (iOS 16.4 or later).</p>';
    if (!r.on) return `<button class="btn primary block" data-act="rm-on">Turn on reminders</button>
      <p class="note" style="margin:6px 0">Routine start times, water sips, timed to-dos and a Sunday review prompt, even when the app is closed. Your reminder times and titles are kept on your own small server; nothing else is sent.</p>`;
    return `${[['brief', 'Morning message', `Today’s plan at ${clock(briefAt())}`], ['wrap', 'Evening check-in', `What’s left today, at ${clock(wrapAt())}`],
               ['routines', 'Routines', 'When each routine starts'], ['water', 'Water', 'Each scheduled sip'], ['todos', 'Timed to-dos', 'When a task is due'], ['review', 'Weekly review', 'Sundays at 6:00 PM']].map(([k, l, d]) =>
        `<label class="switch"><span>${l}<small>${d}</small></span><input type="checkbox" data-rm="${k}" ${r[k] ? 'checked' : ''}></label>`).join('')}
      ${r.brief || r.wrap ? `<div class="grid2">${r.brief ? `<div class="field"><label>Morning at</label><input type="time" data-rmtime="briefAt" value="${briefAt()}"></div>` : '<span></span>'}${r.wrap ? `<div class="field"><label>Evening at</label><input type="time" data-rmtime="wrapAt" value="${wrapAt()}"></div>` : ''}</div>` : ''}
      <p class="note" style="margin:6px 0">${r.synced ? `Up to date · ${r.count || 0} reminders · synced ${ago(r.synced)}` : 'Not synced yet'}</p>
      <div class="grid2"><button class="btn" data-act="rm-test">Send a test</button><button class="btn" data-act="rm-off">Turn off</button></div>`;
  }

