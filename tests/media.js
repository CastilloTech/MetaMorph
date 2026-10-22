const { open, sleep } = require('./h');
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, 'fixtures'), DL = path.join(require('os').tmpdir(), 'metamorph-test-media');
(async () => {
  const t = await open();
  const { p, ok, tap, has, text, texts, state, seed } = t;
  const upload = async (sel, file) => { const inp = await p.$(sel); await inp.uploadFile(path.join(DIR, file)); await sleep(500); };
  const idbHas = id => p.evaluate(id => new Promise(res => { const q = indexedDB.open('metamorph-media', 1); q.onsuccess = () => { const g = q.result.transaction('files').objectStore('files').get(id); g.onsuccess = () => { res(!!g.result); q.result.close(); }; }; }), id);
  try {
    fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });
    const cdp = await p.target().createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL }).catch(() => cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL }));
    await seed(`(s) => { s.media = []; s.workouts.library = [{ name: 'Squat', kind: 'strength', bar: 45 }]; }`);
    await tap('nav [data-v=body]'); await tap('[data-act=b-tab][data-v=media]');
    ok('Media tab with add buttons', await has('[data-act=m-add][data-kind=image]') && await has('[data-act=m-add][data-kind=video]'));

    // physique photo (dated last month)
    await upload('#mfile', 'front.jpg');
    ok('upload sheet opens on Physique', (await text('#mupf h2')).includes('photo') && (await p.$eval('[data-act=m-tag][data-v=physique]', e => e.classList.contains('on'))));
    await p.$eval('#mupf input[name=date]', e => { e.value = '2026-09-20'; });
    await tap('#mupf button[type=submit]', 2500);
    const m1 = (await state()).media[0];
    ok(`photo stored and resized (${m1 && m1.w}×${m1 && m1.h}, ${m1 && Math.round(m1.size / 1024)} KB)`, m1 && Math.max(m1.w, m1.h) === 1600 && await idbHas('thumb:' + m1.id) && await idbHas(m1.id));
    await upload('#mfile', 'side.jpg');
    await tap('[data-act=m-pose][data-v=Side]');
    await tap('#mupf button[type=submit]', 2000);
    // form video
    await upload('#mfilev', 'lift.mp4');
    ok('video defaults to Form check', await p.$eval('[data-act=m-tag][data-v=form]', e => e.classList.contains('on')));
    await p.type('#mupf input[name=exercise]', 'Squat');
    await tap('#mupf button[type=submit]', 7000);
    const st1 = await state();
    ok(`three items saved (${st1.media.map(x => x.kind + '/' + x.tag + '/' + (x.pose || x.exercise)).join(', ')})`, st1.media.length === 3 && st1.media.some(x => x.kind === 'video' && x.exercise === 'Squat'));
    ok('grid grouped by month', (await texts('.grouphead h3')).length === 2);
    await tap('[data-act=m-filter][data-v=form]');
    ok('Form filter', (await p.$$('.mtile')).length === 1);
    await tap('[data-act=m-filter][data-v=all]');
    await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'e-media.png'), fullPage: true });

    // viewer and compare
    await p.evaluate(() => document.querySelectorAll('.mtile').forEach(t => { if (!t.querySelector('.mbadge') && !window.__opened) { window.__opened = 1; t.click(); } })); await sleep(800);
    ok('viewer shows the photo', await p.$eval('.mstage img', e => e.src.startsWith('blob:') && e.naturalWidth > 0).catch(() => false));
    await tap('[data-act=m-close]');
    await tap('[data-act=m-compare]', 1000);
    ok('compare shows two photos', (await p.$$eval('.cmpgrid img', l => l.filter(i => i.naturalWidth > 0).length)) === 2 && (await text('.sheet')).includes('days apart'));
    await tap('[data-act=m-cmp-close]');

    // backup to ZIP
    await p.evaluate(() => { navigator.canShare = undefined; });
    await tap('[data-act=m-backup]', 2500);
    ok('backup asks before sharing', (await text('.ask h2')) === 'Media backup ready');
    await tap('.ask [data-o=yes]', 1500);
    const zips = fs.readdirSync(DL).filter(f => f.endsWith('.zip'));
    ok(`media ZIP downloaded (${zips.join()})`, zips.length === 1);
    const zipPath = zips.length ? path.join(DL, zips[0]) : null;

    // delete + undo; then delete for real
    const vid = st1.media.find(x => x.kind === 'video');
    await p.evaluate(id => document.querySelector(`.mtile[data-id="${id}"]`).click(), vid.id); await sleep(500);
    await tap('[data-act=m-del]');
    await tap('.snack [data-o=undo]', 400);
    ok('Undo brings the video back', (await state()).media.some(x => x.id === vid.id));
    await p.evaluate(id => document.querySelector(`.mtile[data-id="${id}"]`).click(), vid.id); await sleep(400);
    await tap('[data-act=m-del]'); await sleep(6600);
    ok('file erased after the Undo window', !(await idbHas(vid.id)) && !(await state()).media.some(x => x.id === vid.id));

    // fresh device: wipe media entirely, then restore from the ZIP
    await p.evaluate(() => new Promise(res => { const s = JSON.parse(localStorage.getItem('metamorph.v1')); s.media = []; localStorage.setItem('metamorph.v1', JSON.stringify(s)); const r = indexedDB.deleteDatabase('metamorph-media'); r.onsuccess = r.onerror = r.onblocked = () => res(); }));
    await p.reload(); await sleep(600);
    if (await has('[data-act=whatsnew-close]')) await tap('[data-act=whatsnew-close]');
    await tap('nav [data-v=body]'); await tap('[data-act=b-tab][data-v=media]');
    ok('media gone before restore', (await p.$$('.mtile')).length === 0);
    if (zipPath) { const inp = await p.$('#mzip'); await inp.uploadFile(zipPath); await sleep(2500); }
    const st2 = await state();
    ok(`restore brings back all 3 (${st2.media.length})`, st2.media.length === 3 && await idbHas(st2.media[0].id));
    await p.evaluate(() => document.querySelectorAll('.mtile').forEach(t => { if (!t.querySelector('.mbadge') && !window.__o2) { window.__o2 = 1; t.click(); } })); await sleep(800);
    ok('restored photo opens', await p.$eval('.mstage img', e => e.naturalWidth > 0).catch(() => false));
  } catch (e) { t.ok('CRASH ' + e.message, false); }
  await t.done();
})();
