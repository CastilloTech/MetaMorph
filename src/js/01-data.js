  /* ---------- data ---------- */

  const GATES = [
    { id: 'sleep',     name: 'Sleep',     color: '#a66bff' },
    { id: 'fitness',   name: 'Fitness',   color: '#ff5a3c' },
    { id: 'nutrition', name: 'Nutrition', color: '#63d84a' },
    { id: 'hygiene',   name: 'Hygiene',   color: '#3d8bff' },
    // not a Gate: everything that doesn't fit the four, still on the timeline
    { id: 'other',     name: 'Other',     color: '#aab4c3', other: true },
  ];
  const orb = (id, size, cls = '') =>
    `<img class="orb ${cls}" src="img/orb-${id}.webp" width="${size}" height="${size}" alt="" decoding="async" draggable="false" style="--glow:${id === 'chaos' ? '#8a6bff' : gateOf(id).color}">`;
  const gateOf = id => GATES.find(g => g.id === id);

  const KEY = 'metamorph.v1';

  // Keep in step with CACHE in sw.js. Add a CHANGELOG entry for each release.
  const APP_VERSION = 17;
  const CHANGELOG = {
    17: [
      'A calmer Today: one header with your progress and your companion’s line, the routine that’s on now right below, and one “Needs you” list',
      'Water lives on Today now (tap its bar for the full view), so the tab bar has more room',
      'Settings is a short menu: General, Reminders, your companion, Siri & Shortcuts, Backup & data',
      'Every sheet has a title bar with a close button that stays at the top',
      'Completing something lights it up, with an optional soft chime (Settings → General → Sounds)',
      'Swipe hints show until you’ve used the gesture, then get out of the way',
      'One set of icons throughout, and bigger tap areas for small links',
    ],
    16: [
      'Meet your companion (on Today): a friendly servitor whose one purpose is keeping you consistent',
      'It charges up as you hold your Gates, drink water and hit your calorie goal, glows brighter on good streaks, and dims when days slip',
      'Like the water schedule, its card stays on the routine that’s on now, with a Complete button; missed routines stay on the timeline as overdue, and a right swipe marks them done late',
      'It notices things (calories off target, falling behind on water, a routine that keeps running late, a missed weigh-in) and offers a one-tap fix',
      'Set goals and it reminds you of them; it also speaks in your reminders and celebrations',
      'Chat with it: tell it what you ate, ask how you’re doing, or ask it to move a routine. It suggests changes as cards you accept or skip',
      'Give it your own picture (Companion → Look & name)',
      'Log without opening the app: Siri, Back Tap, home-screen and Control Center buttons through the Shortcuts app (Settings → Siri & Shortcuts has step-by-step setup)',
      'Tapping a reminder opens straight to the action: log the sip, complete the routine (or mark it done late), finish the to-do',
      'Quick bar on Today: +water, log your last food again, weight, and your companion',
      'Cloud backup (Settings): your data is encrypted on your phone with a passphrase only you know and saved to your server every day; restore it on a new phone',
      'A morning message with the day’s plan and an evening check-in with what’s left, from your companion (Settings → Reminders)',
      'Your companion can draft your weekly review for you to edit',
      'Faster and easier on your battery: the timer bars and glows no longer keep the phone busy while you’re just looking, and Body opens quicker with lots of history',
    ],
    15: [
      'Safer storage: your data lives in IndexedDB with no practical size limit, and the newest copy always wins at launch',
      'Real reminders (Settings → Reminders): routine starts, water sips, timed to-dos and a Sunday review prompt, even with the app closed',
      'Weekly review: Gates held, workouts, food, water, body and drill for the week, plus “keep doing / change” notes',
      'Export your workouts, body log, nutrition, routines and water as spreadsheets (Settings → Export)',
      'Pose-guide camera for progress photos: a faint outline of your last photo helps you line up',
    ],
    14: [
      'Your day now rolls over at a time you set (default: 2 hours before you wake), so late snacks and late workouts count for the day before you sleep',
      'Routines can start at different times on different days of the week',
      'Water: missed sips are skipped and the schedule moves on; no more water pop-ups',
      'Nutrition: save meals made of foods you eat together and log them in one tap; browse and log any past day; history against your goals',
      'Workouts: Log · History · Exercises, named workouts, repeat a past workout, weekly grouping and exercise progress',
      'Barbell lifts: enter plates per side and the 45 lb bar is added for you, with the plates to load',
      'Reusing an exercise keeps the weights and clears the reps, with last time’s reps as hints',
      'New Body tab: weight and measurements, US Navy body fat, lean vs fat mass, and a 12–16% bulk/cut cycle with calorie targets',
      'Physique and form photos/videos, side-by-side compare, and a separate media ZIP backup',
    ],
    13: [
      'Smoother everywhere: screens update in place, so scrolling and typing are never interrupted',
      'Undo instead of “Are you sure?” for deletes, and proper in-app dialogs',
      'Today shows everything that needs you in one place: water, to-dos, check-ins, an open workout',
      'A new look: carved headings, tab icons, and an orb that glows brighter as you hold your Gates',
      'Evening mode: warmer, dimmer colors from your Sleep wind-down until morning',
      'Gestures: drag sheets down to close, swipe the calendar, long-press a routine or task for quick actions (including Skip today)',
      'Holding a Gate, all four Gates, or a new PR now gets its moment',
      'Settings → Sections: hide the parts of the app you don’t use',
    ],
    12: [
      'Built for phones: bigger tap targets, no zoom-in when you tap a field, instant taps, and press feedback',
      'Sheets fit above the keyboard and keep the field you’re typing in visible',
      'No accidental pull-to-refresh; the screen won’t refresh while you’re scrolling',
    ],
    11: [
      'Fitness: log workouts with sets, reps and weight (or minutes and distance), see last time’s numbers, and get PRs flagged',
      'Food calories and macros fill in automatically: search Open Food Facts or scan a barcode',
      'Finished routines are locked: their finish time and overtime can’t be swiped or unticked (Edit → Reset today’s completion fixes mistakes)',
      'Supplies (in the To-do tab): groceries and hygiene items with prices, price history, a shopping list total and a Walmart link',
    ],
    10: [
      'When a step’s time is up, the next step starts and the unfinished one stays open in orange, counting overtime until you tap its Done',
      'If the last step runs over, its timer keeps going in orange (LATE) until you tap Done',
      'After you tap Done, the next step starts by itself after a 5-second countdown',
      'When a routine ends, the next routine on today’s timeline starts the same way if it’s due within 15 minutes',
      'Hold stops a countdown; Start now skips it',
    ],
    9: [
      'Routine timers run on the clock: a timer bar fills from the start time, steps check off as you go, and finishing late is marked with the time you finished',
      'Nutrition: calorie and macro tracking by meal, saved foods, and meal prep you cook once and log by the portion',
      'To-do list, with timed tasks shown on the timeline',
      'Other: a fifth section for activities that don’t fit the four Gates',
      'Feature Law and Switch Drill now share the Practice tab',
    ],
    8: [
      'Water: a fill vessel with a pace marker, an editable spaced schedule, reminders when a sip is due, and calendar alerts',
      'Feature: the Feature Law, with a phrasing check, a 30-second hold, check-ins and control trials',
      'Switch Drill redesign: the still chaos orb as the focus object, cues by sound and vibration only, and randomized release so the chime can’t be anticipated',
      'Water shows up in the Week and Month views',
    ],
    7: [
      'Element orbs for each Gate, and the chaos orb on the timeline and as the app icon',
      'Routines repeat daily, on chosen weekdays, or on dates of the month',
      'Day, Week and Month views, and you can check off past days',
      'Steps take hours and minutes; times show as 12-hour',
      'Swipe a timeline item right to mark it held, left to undo',
      'Backup & data (the ⋯ button): share, download and restore backups',
      'A routine in progress survives closing the app',
      'Routines that run past midnight count for the day they started',
      'This update prompt',
    ],
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const step = (title, minutes, work = '') => ({ id: uid(), title, minutes, work });
  const routine = (title, start, steps, repeat = { type: 'daily' }) => ({ id: uid(), title, start, steps, repeat });

  function seed() {
    return {
      v: 2,
      gates: {
        sleep: [
          routine('Night routine', '22:00', [step('Tidy the room', 10), step('Wind-down', 20, 'No screens. Let the day go.')]),
        ],
        fitness: [
          routine('Training', '07:00', [step('Warm-up', 10), step('Train', 30), step('Cool-down', 5)]),
        ],
        nutrition: [
          routine('Breakfast', '08:00', [step('Eat', 20, 'Water and protein.')]),
          routine('Lunch',     '12:30', [step('Eat', 30, 'Water and protein.')]),
          routine('Dinner',    '18:30', [step('Eat', 30, 'Water and protein.')]),
        ],
        hygiene: [
          routine('Morning routine', '06:30', [step('Cold water', 2), step('Teeth', 3), step('Skincare', 5)]),
          routine('Evening routine', '21:30', [step('Teeth', 3), step('Shower', 12)]),
        ],
      },
      done: {},
      drill: { focus: 30, release: 30, rounds: 8, sessions: [] },
    };
  }

  // v1 stored single blocks; each becomes a one-step routine (ids kept so today's done marks survive)
  function migrate(s) {
    if (s.v === 1) {
      for (const g of Object.keys(s.gates)) {
        s.gates[g] = s.gates[g].map(b => ({
          id: b.id, title: b.title, start: b.start,
          steps: [step(b.title, Math.max(1, Number(b.minutes) || 1), b.work || '')],
        }));
      }
      s.v = 2;
    }
    return s;
  }

  const valid = s => s && (s.v === 1 || s.v === 2) && s.gates && s.done && s.drill;
  function normalize(s) {
    migrate(s);
    // routines saved before schedules existed repeat every day
    for (const g of Object.keys(s.gates)) for (const r of s.gates[g]) if (!r.repeat) r.repeat = { type: 'daily' };
    if (!s.created) s.created = Date.now();
    if (!('run' in s)) s.run = null;
    if (!('jitter' in s.drill)) s.drill.jitter = 8;
    if (!s.water) {
      const d = new Date();
      s.water = { unit: 'ml', target: 2500, pour: 250, wake: '07:00', bed: '22:00', schedule: [], scheduleInit: false, log: {}, snooze: {},
                  since: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };
    }
    if (!s.features) s.features = { items: [], experiment: true };
    if (!s.gates.other) s.gates.other = [];
    if (!s.fin) s.fin = {};
    if (!s.todos) s.todos = [];
    if (!s.nutri) s.nutri = { goals: { kcal: 2200, p: 150, c: 220, f: 70 }, foods: [], preps: [], log: {} };
    if (s.nutri && !s.nutri.meals) s.nutri.meals = [];
    // goals are kept with the date they took effect, so past days are judged by the goals of that day
    if (s.nutri && !s.nutri.goalHist) s.nutri.goalHist = [{ from: '0000-00-00', goals: { ...s.nutri.goals } }];
    if (!s.workouts) s.workouts = { unit: 'lb', library: [], log: [], draft: null };
    if (!s.supplies) s.supplies = { items: [] };
    if (!s.sections) s.sections = { water: true, todo: true, supplies: true, practice: true, other: true, workouts: true, macros: true };
    if (s.sections.body === undefined) s.sections.body = true;
    if (!s.media) s.media = [];   // photo/video details; the files themselves live in their own IndexedDB store
    if (!s.body) s.body = { profile: { sex: 'male', heightIn: null, activity: 1.55 }, entries: [], phase: { mode: 'maintain', since: null, low: 12, high: 16 } };
    if (!s.prefs) s.prefs = { evening: true };
    if (!s.skip) s.skip = {};
    if (!s.reviews) s.reviews = {};
    if (!s.reminders) s.reminders = { on: false, routines: true, water: true, todos: true, review: true, deviceId: null, lastHash: '' };
    if (s.water && !s.water.hit) s.water.hit = {};
    if (s.sections.companion === undefined) s.sections.companion = true;
    if (!s.tips) s.tips = {};
    if (s.prefs && s.prefs.sound === undefined) s.prefs.sound = true;
    if (!s.cloud) s.cloud = { on: false, salt: null, last: null, size: 0, err: null };
    if (s.reminders && s.reminders.brief === undefined) Object.assign(s.reminders, { brief: true, wrap: true, briefAt: null, wrapAt: null });
    if (!s.servitor) s.servitor = { name: '', born: null, avatar: null, goals: [], dismissed: {}, best: 0, code: '', chat: { log: [], props: {} } };
    return s;
  }

  // A second copy in IndexedDB: if localStorage is lost, the app restores from it on the next open.
  const idb = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const q = indexedDB.open('metamorph', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('kv');
      q.onsuccess = () => {
        const db = q.result;
        // let another tab or a newer version take over instead of blocking it
        db.onversionchange = () => { db.close(); dbp = null; };
        res(db);
      };
      q.onerror = () => rej(q.error);
    }));
    const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
      const t = db.transaction('kv', mode), out = fn(t.objectStore('kv'));
      t.oncomplete = () => res(out && out.result);
      t.onerror = () => rej(t.error);
    }));
    return {
      get: k => tx('readonly', st => st.get(k)),
      set: (k, v) => tx('readwrite', st => { st.put(v, k); }),
    };
  })();

  // IndexedDB is the main store (no practical size limit). localStorage keeps a quick copy for an
  // instant start while the data fits; every save carries a revision, so the newer copy wins at launch.
  const LS_IDB = 'metamorph.idb';   // set once the data no longer fits in localStorage
  let fromLocal = false, lsOff = false;
  function load() {
    try { lsOff = localStorage.getItem(LS_IDB) === '1'; } catch (e) {}
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (valid(s)) { fromLocal = true; return normalize(s); }
    } catch (e) {}
    return normalize(seed());
  }
  let mirrorTimer = null;
  // IndexedDB is only written once the launch check has decided which copy is newest
  let mirrorReady = false;
  function save() {
    S.rev = (S.rev || 0) + 1;
    if (!lsOff) {
      try { localStorage.setItem(KEY, JSON.stringify(S)); }
      catch (e) {
        // out of room: stop keeping the quick copy (it would go stale) and remember that for next launch
        lsOff = true;
        try { localStorage.removeItem(KEY); localStorage.setItem(LS_IDB, '1'); } catch (e2) {}
      }
    }
    // keep push reminders in step with the schedule (the reminder code isn't ready during the very first save)
    try { scheduleReminderSync(); } catch (e) {}
    if (!mirrorReady) return;
    clearTimeout(mirrorTimer);
    mirrorTimer = setTimeout(flushIdb, 300);
  }
  function flushIdb() {
    clearTimeout(mirrorTimer);
    if (mirrorReady) return idb.set('state', JSON.stringify(S)).catch(() => {});
  }
  // never leave a pending write behind when the app is backgrounded or closed
  addEventListener('pagehide', () => flushIdb());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushIdb(); });

  const S = load();
  function replaceState(next) {
    for (const k of Object.keys(S)) delete S[k];
    Object.assign(S, normalize(next));
  }

  // all dates are the device's local time (follows the phone's timezone)
  const keyOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  // The personal day rolls over at "day starts at" (default: two hours before wake), not at midnight,
  // so a late snack or a 1 AM gym session still counts for the day before you sleep.
  const hmToMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const dayStart = () => (S.prefs && S.prefs.dayStart ? hmToMin(S.prefs.dayStart) : Math.max(0, hmToMin((S.water && S.water.wake) || '07:00') - 120));
  const pdayOf = ts => keyOf(new Date(ts - dayStart() * 60000));
  const today = () => pdayOf(Date.now());
  const pdayDate = () => parseKey(today());
  // minutes since the personal day began; clock times after midnight sort after the evening
  const rel = m => ((m - dayStart()) % 1440 + 1440) % 1440;
  // the moment a clock time happens within personal day k
  const atOf = (k, hhmm) => { const d = parseKey(k); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, dayStart() + rel(hmToMin(hhmm))).getTime(); };

  // keep a bit over a year of history for the week/month views
  (() => {
    const cutoff = addDays(new Date(), -400);
    for (const k of Object.keys(S.done)) if (parseKey(k) < cutoff) delete S.done[k];
    for (const k of Object.keys(S.fin)) if (parseKey(k) < cutoff) delete S.fin[k];
    for (const k of Object.keys(S.skip)) if (parseKey(k) < cutoff) delete S.skip[k];
    for (const k of Object.keys(S.nutri.log)) if (parseKey(k) < cutoff) delete S.nutri.log[k];
    save();
  })();

  // ask the browser not to clear this app's storage under pressure
  const storageInfo = { persisted: null };
  (async () => {
    try {
      if (!navigator.storage || !navigator.storage.persist) return;
      storageInfo.persisted = await navigator.storage.persisted() || await navigator.storage.persist();
    } catch (e) {}
  })();

  // Launch check: if the IndexedDB copy is newer than the quick copy (or there is no quick copy), use it.
  let idbHadState = false;
  const booted = idb.get('state').then(json => {
    const s = json && JSON.parse(json);
    idbHadState = valid(s);
    if (valid(s) && (!fromLocal || (s.rev || 0) > (S.rev || 0))) {
      replaceState(s);
      S.onboarded = true;
      V.onboard = null;
      save();   // refresh the quick copy too
      if (V.tab) { resumeRun(); render(); }
    }
  }).catch(() => {}).finally(() => { mirrorReady = true; flushIdb(); });

