const { open, sleep } = require('./h');
(async () => {
  const t = await open();
  const { p, ok, tap, has, text, texts, state, seed } = t;
  const typeIn = async (sel, v) => { await p.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v); await sleep(150); };
  try {
    await seed(`(s) => { s.body = undefined; s.gates = { other: [], hygiene: [], fitness: [], nutrition: [], sleep: [] }; }`);
    ok('Body tab in the bar', (await texts('nav [data-act=tab]')).includes('Body'));
    await tap('nav [data-v=body]');
    ok('asks for height first', (await text('.card')).includes('Add your height'));
    await tap('[data-act=b-tab][data-v=log]');
    await typeIn('[data-bprof=ft]', '5'); await typeIn('[data-bprof=in]', '10');
    ok('height saved as 70 in', (await state()).body.profile.heightIn === 70);

    // log an entry with live preview
    await typeIn('#bform input[name=weight]', '180');
    await typeIn('#bform input[name=neck]', '15');
    await typeIn('#bform input[name=waist]', '34');
    ok(`live Navy preview for a man (${await text('.bfprev')})`, (await text('.bfprev')).includes('17.5%') && (await text('.bfprev')).includes('lean 149'));
    ok('no hips field for men', !(await has('#bform input[name=hips]')));
    await tap('#bform button[type=submit]');
    ok('entry saved', (await state()).body.entries.length === 1);

    // women use hips too
    await tap('[data-act=b-sex][data-v=female]');
    ok('hips field appears for women', await has('#bform input[name=hips]'));
    await typeIn('[data-bprof=ft]', '5'); await typeIn('[data-bprof=in]', '5');
    await typeIn('#bform input[name=neck]', '13'); await typeIn('#bform input[name=waist]', '30'); await typeIn('#bform input[name=hips]', '38');
    ok(`Navy formula for women (${await text('.bfprev')})`, (await text('.bfprev')).includes('28.6%'));
    await tap('[data-act=b-sex][data-v=male]'); await typeIn('[data-bprof=ft]', '5'); await typeIn('[data-bprof=in]', '10');

    // a few weeks of entries: a cut in progress
    await seed(`(s, { key }) => {
      const d = n => key(new Date(Date.now() - n * 864e5));
      s.body.entries = [
        { id: 'e1', t: 1, date: d(21), weight: 186, neck: 15, waist: 35.2, armL: 15.0 },
        { id: 'e2', t: 2, date: d(14), weight: 184, neck: 15, waist: 34.8, armL: 15.1 },
        { id: 'e3', t: 3, date: d(7),  weight: 182.2, neck: 15, waist: 34.4, armL: 15.1 },
        { id: 'e4', t: 4, date: d(0),  weight: 180.6, neck: 15, waist: 34.0, armL: 15.2 } ];
      s.body.phase = { mode: 'maintain', since: null, low: 12, high: 16 };
      s.nutri.goals = { kcal: 2000, p: 150, c: 200, f: 70 };
    }`);
    await tap('nav [data-v=body]'); await tap('[data-act=b-tab][data-v=overview]');
    const head = await texts('.bodyhead b');
    ok(`header: weight, body fat, lean (${head.join(' | ')})`, head[0].startsWith('180.6') && head[1].startsWith('17.') && head[2].includes('lb'));
    ok(`advice to cut above the band (${await text('.card p[style*="font-weight:600"]')})`, (await text('.card p[style*="font-weight:600"]')).includes('Time to cut'));
    await tap('[data-act=b-phase][data-v=cut]');
    const card = await text('.bandbar') !== null;
    ok('band bar shows position', card);
    const body = await p.$eval('main', e => e.textContent.replace(/\s+/g, ' '));
    ok('cutting: weeks to the bottom of the band estimated', /About \d+ weeks to 12%/.test(body));
    ok('weekly pace vs target shown', body.includes('Target pace: -1 to -0.5%') && /you: -[\d.]+%/.test(body));
    ok('calorie target for the cut', /Cut target: \d+ kcal/.test(body));
    await tap('[data-act=b-apply]');
    const g = (await state()).nutri.goals;
    ok(`applied to Nutrition goals (${g.kcal} kcal, P ${g.p})`, g.kcal !== 2000 && g.p === Math.round(180.6 * 0.9));
    ok('charts drawn', (await p.$$eval('.lchart polyline', l => l.length)) === 2);
    ok('measurement change since 4 weeks ago', (await texts('.mlist li')).some(x => x.includes('Arm L') && x.includes('+0.2')));
    await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'd-body.png'), fullPage: true });
  } catch (e) { t.ok('CRASH ' + e.message, false); }
  await t.done();
})();
