// Storage safety: newest copy wins, quota exhaustion falls back to IndexedDB, previews moved out of the main save.
const { open, sleep, launch, URL } = require('./h');
const readIdb = p => p.evaluate(() => new Promise(res => { const q = indexedDB.open('metamorph', 1); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('state'); g.onsuccess = () => { res(g.result ? JSON.parse(g.result) : null); q.result.close(); }; }; }));
const writeIdb = (p, s) => p.evaluate(s => new Promise(res => { const q = indexedDB.open('metamorph', 1); q.onsuccess = () => { const t = q.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(JSON.stringify(s), 'state'); t.oncomplete = () => { q.result.close(); res(); }; }; }), s);
(async () => {
  const t = await open();
  const { p, ok, tap, has, text, texts, state, seed } = t;
  try {
    await seed(`(s) => { s.todos = [{ id: 'a', text: 'Original', date: null, time: null, done: false, doneAt: null, created: 1 }]; }`);
    await sleep(800);
    const ls1 = await state(), idb1 = await readIdb(p);
    ok(`both copies in step after a save (rev ${ls1.rev} / ${idb1 && idb1.rev})`, idb1 && idb1.rev === ls1.rev && idb1.todos[0].text === 'Original');

    // 1) the quick copy is stale, IndexedDB is newer: the newer one must win
    const newer = { ...idb1, rev: ls1.rev + 50, todos: [{ id: 'b', text: 'Newer in IndexedDB', date: null, time: null, done: false, doneAt: null, created: 2 }] };
    await writeIdb(p, newer);
    await p.reload(); await sleep(900);
    await tap('nav [data-v=todo]');
    ok('newer IndexedDB copy wins over a stale quick copy', (await texts('.todos .tx div:first-child')).includes('Newer in IndexedDB'));
    ok('quick copy updated to match', (await state()).todos[0].text === 'Newer in IndexedDB');
    await t.browser.close();

    // 2) localStorage runs out of room
    const b = await launch();
    const q = await b.newPage(); await q.setViewport({ width: 390, height: 844 });
    const errs = []; q.on('pageerror', e => errs.push(e.message));
    await q.goto(URL); await sleep(500);
    await q.evaluate(() => { const s = JSON.parse(localStorage.getItem('metamorph.v1')); s.onboarded = true; s.seenVersion = 999; s.todos = [{ id: 'k', text: 'Keep me', date: null, time: null, done: false, doneAt: null, created: 1 }]; localStorage.setItem('metamorph.v1', JSON.stringify(s)); });
    // from now on, the state no longer fits in localStorage
    await q.evaluateOnNewDocument(() => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (k === 'metamorph.v1') { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } return orig.call(this, k, v); };
    });
    await q.reload(); await sleep(900);
    if (await q.$('[data-act=whatsnew-close]')) { await q.$eval('[data-act=whatsnew-close]', e => e.click()); await sleep(250); }
    await q.$eval('nav [data-v=todo]', e => e.click()); await sleep(300);
    await q.type('#todoadd input[name=text]', 'Added while full'); await q.$eval('#todoadd button[type=submit]', e => e.click()); await sleep(900);
    const flag = await q.evaluate(() => localStorage.getItem('metamorph.idb')), lsGone = await q.evaluate(() => localStorage.getItem('metamorph.v1') === null);
    ok(`switches to IndexedDB-only and drops the stale quick copy (flag ${flag}, removed ${lsGone})`, flag === '1' && lsGone);
    const idb2 = await readIdb(q);
    ok('new task saved in IndexedDB', idb2 && idb2.todos.some(x => x.text === 'Added while full') && idb2.todos.some(x => x.text === 'Keep me'));
    await q.reload(); await sleep(1200);
    ok('no setup screen after reload', !(await q.$('.onb')));
    if (await q.$('[data-act=whatsnew-close]')) { await q.$eval('[data-act=whatsnew-close]', e => e.click()); await sleep(250); }
    await q.$eval('nav [data-v=todo]', e => e.click()); await sleep(300);
    const items = await q.$$eval('.todos .tx div:first-child', l => l.map(x => x.textContent));
    ok(`everything still there after reload (${items.join(', ')})`, items.includes('Added while full') && items.includes('Keep me'));
    await q.$eval('[data-act=data]', e => e.click()); await sleep(300);
    ok('Settings shows the quick copy is off', (await q.$eval('.sheet', e => e.textContent)).includes('Off (data outgrew it)'));
    ok('no page errors (full storage run)' + (errs.length ? ': ' + errs.join(' | ') : ''), !errs.length);
    await b.close();

    // 3) previews move out of the main save
    const t3 = await open();
    await t3.seed(`(s) => { s.media = [{ id: 'img1', kind: 'photo', type: 'image/jpeg', size: 1000, date: '2026-10-01', t: 1, tag: 'physique', pose: 'Front', thumb: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==' }]; }`);
    await sleep(800);
    const s3 = await t3.state();
    t3.ok('preview removed from the main save', s3.media[0].thumb === undefined);
    await t3.tap('nav [data-v=body]'); await t3.tap('[data-act=b-tab][data-v=media]');
    t3.ok('preview still shows in the grid', await t3.p.$eval('.mtile img', e => e.src.startsWith('data:image/gif')).catch(() => false));
    await t3.p.reload(); await sleep(900);
    if (await t3.p.$('[data-act=whatsnew-close]')) await t3.tap('[data-act=whatsnew-close]');
    await t3.tap('nav [data-v=body]'); await t3.tap('[data-act=b-tab][data-v=media]');
    t3.ok('preview loads from the media database after reload', await t3.p.$eval('.mtile img', e => e.src.startsWith('data:image/gif')).catch(() => false));
    for (const line of t3.out) t.out.push(line);
    await t3.browser.close();
  } catch (e) { t.ok('CRASH ' + e.message, false); }
  console.log(t.out.join('\n'));
})();
