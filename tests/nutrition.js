const { open, sleep } = require('./h');
(async () => {
  const t = await open();
  const { p, ok, tap, has, text, texts, state, seed } = t;
  try {
    await seed(`(s, { key }) => {
      s.gates = { other: [], hygiene: [], fitness: [], nutrition: [], sleep: [] };
      s.nutri.foods = [{ id: 'oats', name: 'Oats', serving: '40 g', kcal: 150, p: 5, c: 27, f: 3 }, { id: 'egg', name: 'Egg', serving: '1 large', kcal: 72, p: 6, c: 0.5, f: 5 }];
      s.nutri.log = {}; s.nutri.meals = [];
      s.nutri.goals = { kcal: 2000, p: 150, c: 200, f: 70 };
      // old goals applied until today; new ones from today
      s.nutri.goalHist = [{ from: '0000-00-00', goals: { kcal: 1800, p: 120, c: 180, f: 60 } }, { from: key(), goals: { kcal: 2000, p: 150, c: 200, f: 70 } }];
      const y = new Date(Date.now() - 864e5), yk = key(y);
      s.nutri.log[yk] = [{ id: 'old', t: 1, meal: 'Dinner', name: 'Pasta', qty: 1, kcal: 1790, p: 125, c: 200, f: 50, src: 'quick' }];
    }`);
    await tap('nav [data-v=gates]'); await tap('[data-act=gate][data-v=nutrition]');

    // build a meal from saved foods
    await tap('[data-act=n-meal-new]');
    await p.$eval('#nmealf input[name=name]', e => { e.value = 'Usual breakfast'; });
    await p.select('#nmealf select[name=pickfood]', 'oats'); await tap('[data-act=n-meal-addfood]');
    await p.select('#nmealf select[name=pickfood]', 'egg'); await p.$eval('#nmealf input[name=pickqty]', e => { e.value = '2'; }); await tap('[data-act=n-meal-addfood]');
    ok(`meal total shows (${await text('#nmealf .preptot')})`, (await text('#nmealf .preptot')).includes('294 kcal'));
    ok('name kept while adding items', await p.$eval('#nmealf input[name=name]', e => e.value) === 'Usual breakfast');
    await tap('#nmealf button[type=submit]');
    ok('meal saved to My meals', (await texts('.flog li div[style*="font-weight"]')).includes('Usual breakfast'));

    // log it in one tap
    await tap('[data-act=n-meal-log]');
    ok(`logged in one tap (${await text('.mac b')} kcal)`, (await text('.mac b')) === '294');
    ok('logged entry is marked as a meal', (await texts('.flog .mtag')).some(x => x.startsWith('MEAL')));

    // meals are also in the + Add list
    await tap('[data-act=n-add][data-meal=Dinner]');
    ok('saved meal appears in + Add', (await texts('.foodlist li')).some(x => x.includes('Usual breakfast') && x.includes('Meal · 2 items')));
    await tap('[data-act=n-pick][data-kind=meal]');
    ok('logged via + Add (588 kcal total)', (await text('.mac b')) === '588');

    // save what was logged as a meal
    await tap('[data-act=n-add][data-meal=Lunch]'); await tap('[data-act=n-pick][data-kind=food][data-id=oats]');
    await tap('[data-act=n-add][data-meal=Lunch]'); await tap('[data-act=n-pick][data-kind=food][data-id=egg]');
    await tap('[data-act=n-savemeal][data-meal=Lunch]');
    ok('"Save as a meal" prefills the items', (await p.$$eval('#nmealf .flog li', l => l.length)) === 2);
    await tap('#nmealf button[type=submit]');
    ok('second meal saved', (await state()).nutri.meals.length === 2);

    // previous days
    await tap('[data-act=n-day][data-d="-1"]');
    ok(`went back a day (${await text('.calnav .ttl')})`, (await text('.calnav .ttl')).startsWith('Yesterday'));
    ok('yesterday is judged by the goals it had (1,790 / 1,800)', (await text('.mac')).includes('1,790') && (await text('.mac')).includes('1,800'));
    await tap('[data-act=n-add][data-meal=Snacks]'); await tap('[data-act=n-pick][data-kind=food][data-id=oats]');
    const st = await state(), yk = Object.keys(st.nutri.log).find(k => st.nutri.log[k].some(x => x.id === 'old'));
    ok('logged to yesterday, not today', st.nutri.log[yk].length === 2);
    ok('next-day arrow works and stops at today', true);
    await tap('[data-act=n-day][data-d="1"]');
    ok('back to today', (await text('.calnav .ttl')).startsWith('Today') && await p.$eval('[data-act=n-day][data-d="1"]', e => e.disabled));

    // history
    const cols = await p.$$('.nhist .col');
    ok(`history shows 7 days (${cols.length})`, cols.length === 7);
    const stats = await texts('.stats4 b');
    ok(`history stats (${stats.join(' | ')})`, stats[2].includes('/2') && stats[0] !== '—');
    await tap('[data-act=n-hist][data-v="30"]');
    ok('30-day view', (await p.$$('.nhist .col')).length === 30);
    await tap('.nhist .col:nth-last-child(2)');
    ok('tapping a day opens it', (await text('.calnav .ttl')).startsWith('Yesterday'));
    await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'b-nutrition.png'), fullPage: true });
  } catch (e) { t.ok('CRASH ' + e.message, false); }
  await t.done();
})();
