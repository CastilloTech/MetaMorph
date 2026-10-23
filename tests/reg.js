// Regression suite: the main flows of the app, end to end.
const { open, sleep } = require('./h');
(async () => {
  const t = await open();
  const { p, ok, tap, has, text, texts, state, seed } = t;
  try {
    // ---------- routines: clock timer, steps, late ----------
    await seed(`(s, { now, hm }) => {
      s.dayStart = undefined; s.prefs.dayStart = '00:00';   // calendar day, so times just before dawn aren't counted as tonight
      const st = (id, title, m) => ({ id, title, minutes: m, work: '' });
      s.gates = { other: [],
        hygiene: [{ id: 'A', title: 'Morning routine', start: hm(now - 3), repeat: { type: 'daily' }, steps: [st('a1', 'Cold water', 2), st('a2', 'Teeth', 8)] }],
        fitness: [{ id: 'B', title: 'Training', start: hm(now - 70), repeat: { type: 'daily' }, steps: [st('b1', 'Lift', 10)] }],
        nutrition: [],
        sleep: [] };
      s.water.schedule = []; s.water.scheduleInit = true; s.todos = [];
    }`);
    ok('hero shows the running routine with a clock bar', (await text('.hero .when')) === 'NOW' && await has('.hero .clockbar'));
    await sleep(1200);
    ok('timer bar fills on the clock', (await p.$eval('.hero .clockbar span:nth-child(2) i', e => parseFloat((e.style.transform.match(/scaleX\(([\d.e-]+)\)/) || [0, 0])[1]))) > 0);
    ok('overdue routine is labelled', (await texts('.tl .st')).some(x => x.includes('overdue')));
    await tap('.stepchip[data-i="0"]');
    ok('step chip checks off', await p.$eval('.stepchip[data-i="0"]', e => e.classList.contains('done')));
    await tap('.hero [data-act=complete]'); await t.clearCele();
    ok('on-time completion shows finish time', (await texts('.tl .st')).some(x => /^✓ \d/.test(x)));
    await tap('.hero [data-act=complete]'); await t.clearCele();
    ok('late completion is flagged', (await texts('.tl .st')).some(x => x.startsWith('late ·')));
    ok('finished routines are locked', (await p.$$eval('.tl .it.locked', l => l.length)) === 2);

    // ---------- full-screen timer: steps chain, Hold ----------
    await seed(`(s, { now, hm }) => {
      const st = (id, title) => ({ id, title, minutes: 1, work: '' });
      s.done = {}; s.fin = {};
      s.gates.hygiene = [{ id: 'A', title: 'Morning routine', start: hm(now), repeat: { type: 'daily' }, steps: [st('a1', 'Cold water'), st('a2', 'Teeth')] }];
      s.gates.fitness = []; s.gates.nutrition = [];
    }`);
    await tap('.hero [data-act=run]');
    ok('timer opens on step 1', (await text('.run .stepname')) === 'Cold water');
    await tap('[data-act=r-done]');
    ok('Done counts down to the next step', (await text('.run .stepname')) === 'Teeth' && await has('#autoleft'));
    await sleep(5600);
    ok('next step starts by itself', (await text('.run .phase')) === 'STEP 2');
    await tap('[data-act=r-done]'); await t.clearCele();
    ok('routine complete screen', (await text('.run')).includes('GATE HELD') || (await text('.run')).includes('DONE'));
    await tap('[data-act=r-close]');

    // ---------- overtime carries over ----------
    await seed(`(s, { now, hm, key }) => {
      const st = (id, title) => ({ id, title, minutes: 1, work: '' });
      s.done = {}; s.fin = {};
      s.gates.hygiene = [{ id: 'A', title: 'Morning routine', start: hm(now), repeat: { type: 'daily' }, steps: [st('a1', 'Cold water'), st('a2', 'Teeth'), st('a3', 'Skincare')] }];
      s.run = { gate: 'hygiene', rid: 'A', idx: 0, key: key(), phase: 'step', total: 60000, end: Date.now() - 40000, paused: false };
    }`);
    await sleep(500);
    ok('time-up moves on and keeps the late step open', (await text('.run .stepname')) === 'Teeth' && (await text('.latebar') || '').includes('late +0:4'));
    await tap('[data-act=r-late-done]');
    ok('late step closes with overtime recorded', !(await has('.latebar')));
    await tap('[data-act=r-exit]'); if (await has('.ask')) await tap('.ask [data-o=yes]');

    // ---------- to-do ----------
    await seed(`(s, { key }) => { s.run = null; s.todos = [{ id: 'od', text: 'Pay rent', date: '2026-01-01', time: null, done: false, doneAt: null, created: 1 }]; }`);
    await tap('nav [data-v=todo]');
    await p.type('#todoadd input[name=text]', 'Call the bank'); await tap('#todoadd button[type=submit]');
    ok('task added to Today group', (await texts('.grouphead h3')).includes('Today'));
    await tap('.grouphead.overdue + .card [data-act=todo-toggle]');
    ok('overdue task completed late', (await texts('.todos li.done .t')).some(x => x.includes('late ·')));
    await tap('.todos li:not(.done) [data-act=todo-del]');
    ok('delete offers Undo', await has('.snack [data-o=undo]'));
    await tap('.snack [data-o=undo]');
    ok('Undo restores the task', (await state()).todos.some(x => x.text === 'Call the bank'));

    // ---------- nutrition ----------
    await tap('nav [data-v=gates]'); await tap('[data-act=gate][data-v=nutrition]');
    await tap('[data-act=n-add][data-meal=Breakfast]'); await tap('[data-act=n-mode][data-v=new]');
    await p.type('#nnew input[name=name]', 'Oats'); await p.type('#nnew input[name=p]', '30'); await p.type('#nnew input[name=c]', '40'); await p.type('#nnew input[name=f]', '10');
    await tap('#nnew button[type=submit]');
    ok('calories worked out from macros (370)', (await text('.mac b')) === '370');

    // ---------- supplies ----------
    await tap('nav [data-v=todo]'); await tap('[data-act=ttab][data-v=supplies]');
    await p.type('#supadd input[name=name]', 'Toothpaste'); await p.type('#supadd input[name=price]', '3.47'); await tap('#supadd button[type=submit]');
    ok('shopping list total', (await text('.sumrow b')) === '$3.47');

    // ---------- sections, gestures ----------
    await tap('[data-act=data]');
    await p.$eval('[data-sec=water]', e => e.click()); await sleep(250);
    ok('hiding Water removes its tab', !(await texts('nav [data-act=tab]')).includes('Water'));
    await p.$eval('[data-sec=water]', e => e.click()); await sleep(250);
    await tap('[data-act=data-close]');
    await seed(`(s, { now, hm }) => { s.done = {}; s.fin = {}; s.gates.fitness = [{ id: 'F', title: 'Training', start: hm(now + 60), repeat: { type: 'daily' }, steps: [{ id: 'f1', title: 'Lift', minutes: 10, work: '' }] }]; }`);
    await p.$eval('.tl .it[data-id="F"]', e => e.scrollIntoView({ block: 'center' })); await sleep(200);
    const bb = await (await p.$('.tl .it[data-id="F"]')).boundingBox();
    await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await sleep(750); await p.mouse.up(); await sleep(400);
    ok('long-press opens quick actions', (await texts('.qa .qa-item')).includes('Skip today'));
    await tap('[data-act=qa-cancel]');
    await tap('[data-act=cal][data-v=week]');
    ok('week view renders gate rows', (await p.$$eval('.wk .g', g => g.length)) >= 4);
    await tap('[data-act=cal][data-v=month]');
    ok('month view renders', await has('.mo .d'));
  } catch (e) { t.ok('CRASH ' + e.message, false); }
  await t.done();
})();
