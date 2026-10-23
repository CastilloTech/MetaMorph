// Weekly review, CSV export, pose-guide camera.
const { open, sleep } = require('./h');
const fs = require('fs'), path = require('path');
const DL = path.join(require('os').tmpdir(), 'metamorph-test-csv');
(async () => {
  const t = await open({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const { p, ok, tap, has, text, texts, state, seed } = t;
  try {
    fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });
    const cdp = await p.target().createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL }).catch(() => cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL }));
    // a week of data
    await seed(`(s, { key, hm }) => {
      s.prefs.dayStart = '04:00';
      const d = new Date(), mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)), k = i => key(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
      const st = id => ({ id, title: 'x', minutes: 10, work: '' });
      s.gates = { other: [], fitness: [], nutrition: [], sleep: [], hygiene: [{ id: 'H', title: 'Morning routine', start: '07:00', repeat: { type: 'daily' }, steps: [st('h1')] }] };
      s.done = {}; s.fin = {};
      s.done[k(0)] = { H: true }; s.fin[k(0)] = { H: new Date(mon.getFullYear(), mon.getMonth(), mon.getDate(), 8, 0).getTime() };   // late
      s.workouts.log = [{ id: 'w', t: mon.getTime() + 36e6, date: k(0), title: 'Push', note: '', prs: ['Bench press'], items: [{ name: 'Bench press', kind: 'strength', bar: 45, sets: [{ r: 5, bar: 45, ps: 90, w: 225 }] }] }];
      s.nutri.log = { [k(0)]: [{ id: 'n', t: 1, meal: 'Lunch', name: 'Chicken, rice', qty: 1, kcal: 2200, p: 150, c: 250, f: 60, src: 'quick' }] };
      s.nutri.goalHist = [{ from: '0000-00-00', goals: { kcal: 2200, p: 150, c: 220, f: 70 } }]; s.nutri.goals = { kcal: 2200, p: 150, c: 220, f: 70 };
      s.body.profile.heightIn = 70; s.body.entries = [{ id: 'b1', t: 1, date: key(new Date(mon.getTime() - 3 * 864e5)), weight: 182, neck: 15, waist: 34.5 }, { id: 'b2', t: 2, date: k(0), weight: 181, neck: 15, waist: 34.2 }];
      s.todos = [{ id: 'td', text: 'Pay bill', date: k(0), time: null, done: true, doneAt: mon.getTime() + 40e6, created: 1 }];
      s.reviews = {}; s.media = [];
    }`);

    // weekly review from the week view
    await tap('[data-act=cal][data-v=week]');
    ok('week view has a Weekly review button', (await text('[data-act=rv-open]')) === 'Weekly review');
    await tap('[data-act=rv-open]');
    const body = await text('.review');
    ok('review shows Gates held with lates', body.includes('Hygiene') && body.includes('late'));
    ok(`review numbers (workouts, food, body, tasks)`, body.includes('1,125 lb volume') && body.includes('PRs: Bench press') && /calories on target 1\/1/.test(body) && /-1 lb/.test(body) && /Tasks finished1/.test(body));
    await p.$eval('[data-rv=keep]', e => { e.value = 'Morning routine every day'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await tap('[data-act=rv-done]');
    const st1 = await state(), mk = Object.keys(st1.reviews)[0];
    ok('review saved with notes', st1.reviews[mk] && st1.reviews[mk].keep === 'Morning routine every day' && st1.reviews[mk].t > 0);
    ok('button shows it is reviewed', (await text('[data-act=rv-open]')).includes('✓'));

    // CSV export
    await tap('[data-act=data]');
    await p.evaluate(() => { navigator.canShare = undefined; });
    await tap('[data-act=csv-export]', 1500);
    ok('export asks before saving', (await text('.ask h2')) === 'Spreadsheets ready');
    await tap('.ask [data-o=yes]', 1500);
    // downloads can take a few seconds to finish writing
    for (let i = 0; i < 30 && !fs.readdirSync(DL).some(f => f.endsWith('.zip')); i++) await sleep(500);
    const zips = fs.readdirSync(DL).filter(f => f.endsWith('.zip'));
    ok(`CSV ZIP downloaded (${zips.join()})`, zips.length === 1);
    if (zips.length) {
      // read the export with the app's own bundled JSZip
      const JSZip = require('../app/vendor/jszip.min.js'), z = await JSZip.loadAsync(fs.readFileSync(path.join(DL, zips[0])));
      const line = async (f, n) => (await z.file(f).async('string')).replace(/^﻿/, '').split(/\r?\n/)[n];
      const out = [Object.keys(z.files).sort().join('|'), await line('workouts.csv', 1), await line('routines.csv', 1), await line('body.csv', 2)];
      ok(`six spreadsheets (${out[0]})`, out[0] === 'body.csv|nutrition_daily.csv|nutrition_entries.csv|routines.csv|water.csv|workouts.csv');
      ok(`workout rows keep bar and plates (${out[1]})`, out[1].includes('Bench press') && out[1].includes(',225,45,90,'));
      ok(`routine rows flag late (${out[2]})`, out[2].includes('Morning routine') && out[2].endsWith(',yes'));
      ok(`body rows include body fat (${out[3]})`, /,181,1\d\.\d,/.test(out[3]));
    }
    await tap('[data-act=data-close]');

    // pose-guide camera (fake camera)
    await tap('nav [data-v=body]'); await tap('[data-act=b-tab][data-v=media]');
    await tap('[data-act=cam-open]', 300);
    const live = () => p.$eval('#camvid', v => v.videoWidth > 0).catch(() => false);
    for (let i = 0; i < 20 && !(await live()); i++) await sleep(400);   // the camera can take a couple of seconds to start
    ok('camera opens with a live feed', await live());
    ok('no ghost before the first photo', !(await has('.camstage .ghost')));
    await tap('[data-act=cam-timer][data-v="0"]');
    await tap('[data-act=cam-shoot]', 300);
    for (let i = 0; i < 20 && !(await state()).media.length; i++) await sleep(400);
    await sleep(600);
    const st2 = await state();
    ok('shot saved as a Front physique photo', st2.media.length === 1 && st2.media[0].tag === 'physique' && st2.media[0].pose === 'Front');
    ok('ghost of the last Front photo appears', await p.$eval('.camstage .ghost', g => g.src.startsWith('blob:')).catch(() => false));
    await tap('[data-act=cam-pose][data-v=Side]', 600);
    ok('switching pose finds no Side ghost yet', !(await has('.camstage .ghost')));
    await tap('[data-act=cam-timer][data-v="3"]');
    await tap('[data-act=cam-shoot]', 600);
    ok('timer counts down on screen', (await text('.camcount')) !== null);
    for (let i = 0; i < 25 && !(await state()).media.some(x => x.pose === 'Side'); i++) await sleep(400);
    ok('timed shot saved as Side', (await state()).media.some(x => x.pose === 'Side'));
    await tap('[data-act=cam-close]');
    ok('camera closes and stops', !(await has('.camera')));
  } catch (e) { t.ok('CRASH ' + e.message, false); }
  await t.done();
})();
