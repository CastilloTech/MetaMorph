const { open, sleep } = require('./h');
(async () => {
  const t = await open();
  const { p, ok, tap, has, text, texts, state, seed } = t;
  try {
    // ---------- personal day: the new day hasn't started yet, so "today" is still yesterday ----------
    await seed(`(s, { now, hm }) => {
      s.prefs.dayStart = hm(now + 90);
      const st = (id) => ({ id, title: 'Do it', minutes: 5, work: '' });
      s.gates = { other: [], fitness: [], nutrition: [], sleep: [],
        hygiene: [{ id: 'A', title: 'Late session', start: hm(now - 1), repeat: { type: 'daily' }, steps: [st('a1')] }] };
      s.done = {}; s.fin = {}; s.water.schedule = []; s.water.scheduleInit = true;
    }`);
    await tap('.hero [data-act=complete]'); await t.clearCele();
    const y = await p.evaluate(() => { const d = new Date(Date.now() - 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
    const st1 = await state();
    ok(`before the new day starts, it counts for yesterday (${Object.keys(st1.done).join()})`, !!(st1.done[y] && st1.done[y].A));
    ok('header-day logic: the item shows as done today', (await texts('.tl .st')).some(x => x.startsWith('✓')));

    // late-night items sort after the evening
    await seed(`(s) => {
      s.prefs.dayStart = '05:00';
      const st = (id) => ({ id, title: 'x', minutes: 10, work: '' });
      s.gates.hygiene = [{ id: 'N', title: 'After midnight', start: '00:30', repeat: { type: 'daily' }, steps: [st('n1')] },
                         { id: 'E', title: 'Evening', start: '23:30', repeat: { type: 'daily' }, steps: [st('e1')] },
                         { id: 'M', title: 'Morning', start: '07:00', repeat: { type: 'daily' }, steps: [st('m1')] }];
      s.done = {}; s.fin = {};
    }`);
    const order = (await texts('.tl .nm')).map(x => x.trim());
    ok(`timeline order follows the personal day (${order.join(' → ')})`, order.join('|') === 'Morning|Evening|After midnight');

    // ---------- different times on different weekdays ----------
    await seed(`(s, { now, hm }) => {
      s.prefs.dayStart = undefined;
      const dow = new Date(Date.now() - (Math.max(0, 300 - 120)) * 60000).getDay();
      s.gates.hygiene = [{ id: 'V', title: 'Varies', start: hm(now + 300), vary: true, times: { [new Date().getDay()]: hm(now - 2) }, repeat: { type: 'daily' }, steps: [{ id: 'v1', title: 'x', minutes: 20, work: '' }] }];
      s.done = {}; s.fin = {};
    }`);
    ok('today uses its weekday time (routine is running now)', (await text('.hero .when')) === 'NOW');
    await tap('nav [data-v=gates]'); await tap('[data-act=gate][data-v=hygiene]');
    ok('Gate card shows "times vary"', (await text('.card .rep')).includes('times vary'));
    await tap('[data-act=edit]');
    ok('editor shows the weekday times', (await p.$$eval('.daytimes input', i => i.length)) === 7);
    await p.$eval('input[name=rt6]', e => { e.value = '10:15'; });
    await tap('#editform button[type=submit]');
    ok('weekday time saved', (await state()).gates.hygiene[0].times[6] === '10:15');
    await tap('[data-act=edit]');
    await p.$eval('input[name=r_vary]', e => e.click()); await sleep(250);
    ok('turning it off hides the day fields', !(await has('.daytimes')));
    await tap('[data-act=edit-cancel]');

    // ---------- water: move past missed sips, no pop-ups ----------
    await seed(`(s, { now, hm }) => {
      s.gates.hygiene = [];
      s.water.schedule = [{ id: 'w1', time: hm(now - 120), amount: 250 }, { id: 'w2', time: hm(now - 10), amount: 300 }, { id: 'w3', time: hm(now + 60), amount: 350 }];
      s.water.scheduleInit = true; s.water.target = 2000; s.water.log = {}; s.water.hit = {};
    }`);
    ok(`Now stack shows the current sip at its own amount (${await text('.nowrow .ss')})`, (await text('.nowrow .ss')).startsWith('300 ml'));
    await tap('nav [data-v=gates]');
    ok('no water pop-up on other tabs', !(await has('.toast.watert')));
    await tap('nav [data-v=water]');
    const cls = await p.$$eval('.sched li', l => l.map(x => x.className));
    ok(`missed sip marked, current sip next (${cls.join(',')})`, cls[0] === 'missed' && cls[1] === 'next');
    await tap('.quick [data-act=w-add]');
    const cls2 = await p.$$eval('.sched li', l => l.map(x => x.className));
    ok(`logging checks off the current sip and moves on (${cls2.join(',')})`, cls2[1] === 'done' && cls2[2] === 'next');
    ok('next sip shows its own amount', (await text('.card .num')).includes('350') || (await texts('.card')).some(x => x.includes('Next sip') && x.includes('350 ml')));

    // ---------- settings ----------
    await tap('[data-act=data]');
    ok('Settings has "New day starts at"', await has('[data-pref-time=dayStart]'));
  } catch (e) { t.ok('CRASH ' + e.message, false); }
  await t.done();
})();
