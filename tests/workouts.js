const { open, sleep } = require('./h');
(async () => {
  const t = await open();
  const { p, ok, tap, has, text, texts, state, seed } = t;
  const typeIn = async (sel, v) => { await p.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v); await sleep(120); };
  try {
    await seed(`(s, { key }) => {
      s.gates = { other: [], hygiene: [], fitness: [], nutrition: [], sleep: [] };
      s.workouts = { unit: 'lb', draft: null,
        library: [{ name: 'Bench press', kind: 'strength', bar: 45 }, { name: 'Curl', kind: 'strength', bar: null }],
        log: [{ id: 'w1', t: Date.now() - 3 * 864e5, date: key(new Date(Date.now() - 3 * 864e5)), title: 'Push', note: '', prs: [],
          items: [{ name: 'Bench press', kind: 'strength', bar: 45, sets: [{ r: 8, bar: 45, ps: 90, w: 225 }, { r: 7, bar: 45, ps: 90, w: 225 }] },
                  { name: 'Curl', kind: 'strength', bar: null, sets: [{ r: 12, w: 30 }] }] }] };
    }`);
    await tap('nav [data-v=gates]'); await tap('[data-act=gate][data-v=fitness]');
    ok('Log · History · Exercises tabs', (await texts('[data-act=wo-tab]')).join('|') === 'Log|History|Exercises');
    ok('past workout offered to repeat', (await texts('.flog li')).some(x => x.includes('Push') && x.includes('Bench press')));

    // repeat: weights kept, reps cleared with hints
    await tap('[data-act=wo-repeat]');
    const repsVals = await p.$$eval('.wo-in[data-i="0"][data-f=r]', i => i.map(x => x.value + '/' + x.placeholder));
    ok(`reps cleared, last reps as hints (${repsVals.join(', ')})`, repsVals.join(',') === '/8,/7');
    ok('barbell weights kept as plates per side', (await p.$$eval('.wo-in[data-i="0"][data-f=ps]', i => i.map(x => x.value))).join(',') === '90,90');
    ok(`total and plates shown (${await text('#tot-0-0')})`, (await text('#tot-0-0')).startsWith('225') && (await text('#tot-0-0')).includes('45 + 45'));
    ok('plain exercise keeps its weight', (await p.$eval('.wo-in[data-i="1"][data-f=w]', e => e.value)) === '30');
    ok('workout name carried over', (await p.$eval('#wo-title', e => e.value)) === 'Push');

    // type plates per side: total and plates follow
    await typeIn('.wo-in[data-i="0"][data-j="0"][data-f=r]', '8');
    await typeIn('.wo-in[data-i="0"][data-j="0"][data-f=ps]', '95');
    ok(`live total: 45 + 2×95 = 235 (${await text('#tot-0-0')})`, (await text('#tot-0-0')).startsWith('235') && (await text('#tot-0-0')).includes('45 + 45 + 5'));
    await typeIn('.wo-in[data-i="0"][data-j="1"][data-f=r]', '6');
    await typeIn('.wo-in[data-i="1"][data-j="0"][data-f=r]', '12');

    // + Set keeps weight, empty reps
    await tap('[data-act=wo-addset][data-i="0"]');
    const s3 = await p.$eval('.wo-in[data-i="0"][data-j="2"][data-f=r]', e => e.value + '|' + e.placeholder);
    ok(`+ Set: weight kept, reps empty with hint (${s3})`, s3 === '|6' && (await p.$eval('.wo-in[data-i="0"][data-j="2"][data-f=ps]', e => e.value)) === '90');
    await tap('[data-act=wo-rmset][data-i="0"][data-j="2"]');

    // a new barbell lift is recognised; bar weight cycles
    await p.type('#wo-new', 'Squat'); await tap('[data-act=wo-add]');
    ok('Squat recognised as a barbell lift', (await text('[data-act=wo-bb][data-i="2"]')) === 'Barbell');
    await tap('[data-act=wo-bar][data-i="2"]');
    ok('bar weight cycles (45 → 35)', (await text('[data-act=wo-bar][data-i="2"]')).includes('35'));
    await typeIn('.wo-in[data-i="2"][data-f=r]', '5'); await typeIn('.wo-in[data-i="2"][data-f=ps]', '100');
    ok('total uses the chosen bar (35 + 200 = 235)', (await text('#tot-2-0')).startsWith('235'));
    await tap('[data-act=wo-bb][data-i="2"]');
    ok('switching to plain weight keeps the total', (await p.$eval('.wo-in[data-i="2"][data-f=w]', e => e.value)) === '235');
    await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'c-log.png'), fullPage: true });

    // finish: organised history, PR
    await tap('[data-act=wo-finish]'); await t.clearCele();
    ok('finish opens History grouped by week', (await texts('.grouphead h3'))[0] === 'This week');
    const s1 = await state(), last = s1.workouts.log[s1.workouts.log.length - 1];
    ok('bench PR flagged (235×8 beats 225×8)', last.prs.includes('Bench press'));
    ok('sets stored with bar and plates kept separate', last.items[0].sets[0].bar === 45 && last.items[0].sets[0].ps === 95 && last.items[0].sets[0].w === 235);
    await tap('.wohist [data-act=wo-open]');
    ok('card expands to show sets', (await texts('.wohist .line')).some(x => x.includes('8×235')));

    // exercises
    await tap('[data-act=wo-tab][data-v=exercises]');
    ok('Exercises list with barbell tag', (await texts('.flog li')).some(x => x.includes('Bench press') && x.includes('BARBELL') && x.includes('e1RM')));
    await tap('.flog li[data-act=wo-ex]');
    ok('exercise history sheet', (await p.$$eval('.sheet .flog li', l => l.length)) === 2);
  } catch (e) { t.ok('CRASH ' + e.message, false); }
  await t.done();
})();
