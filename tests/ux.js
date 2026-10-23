// Look & feel: the Today layout, sheet title bars, the Settings menu, water on Today, one-time tips, the tour and feedback.
const { open, sleep } = require('./h');
(async () => {
  const t = await open();
  const { p, ok, tap, has, text, texts, state, seed } = t;
  try {
    await seed(`(s, { now, hm, key }) => {
      s.prefs.dayStart = '00:00';
      const st = (id, m = 10) => ({ id, title: 'step', minutes: m, work: '' });
      s.gates = { other: [], nutrition: [],
        hygiene: [{ id: 'H', title: 'Morning routine', start: hm(now - 180), repeat: { type: 'daily' }, steps: [st('h1')] }],
        fitness: [{ id: 'F', title: 'Training', start: hm(now - 90), repeat: { type: 'daily' }, steps: [st('f1')] },
                  { id: 'F2', title: 'Stretch', start: hm(now + 120), repeat: { type: 'daily' }, steps: [st('f21')] }],
        sleep: [{ id: 'C', title: 'Wind-down', start: hm(now - 5), repeat: { type: 'daily' }, steps: [st('c1', 30)] }] };
      s.done = {}; s.fin = {}; s.tips = {};
      s.todos = [{ id: 'T', text: 'Call the dentist', date: key(), time: null, done: false, doneAt: null, created: 1 }];
      const y = key(new Date(Date.now() - 864e5));
      s.nutri.log = { [y]: [{ id: 'n0', t: Date.now() - 864e5, meal: 'Lunch', name: 'Chicken bowl', qty: 1, kcal: 650, p: 45, c: 60, f: 20, src: 'quick' }] };
      s.servitor = { name: 'Nyx', born: Date.now() - 2 * 864e5, avatar: null, goals: [], dismissed: {}, best: 0, code: '', chat: { log: [], props: {} } };
    }`);

    // ---------- Today ----------
    const order = await p.evaluate(() => ['.thead', '.hero', '.needs', '.qbar', '.wstrip', '.tl'].map(sel => { const e = document.querySelector('main ' + sel); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : -1; }));
    ok(`Today reads top to bottom: header, now, needs you, quick bar, water, timeline (${order.join(', ')})`, order.every(x => x >= 0) && order.every((x, i) => i === 0 || x > order[i - 1]));
    ok('one header with progress and the companion’s line', /Nyx\s*0\/4 held · \d+% charged/.test(await text('.thead')) && (await text('.thead')).includes('Wind-down is on now'));
    ok('no repeated progress elsewhere', !(await has('.nexus')) && !(await has('.sv-card')) && (await p.$$('main .card.nowstack')).length === 1);
    ok('the companion’s nudges are in the Needs-you list', /2 routines are overdue on your timeline/.test(await text('.needs')) && (await text('.needs')).includes('To-do'));
    ok('quick bar uses the shared icons', (await p.$$eval('.qbar .qchip', l => l.every(c => c.querySelector('svg.ic')))) && !(await text('.qbar')).includes('${'));

    // ---------- water on Today ----------
    ok('Water is no longer a tab', !(await texts('nav [data-act=tab]')).some(x => x.includes('Water')) && (await p.$$('nav [data-act=tab]')).length === 5);
    ok('water bar shows progress', /Water\s*0 ml \/ 2,500 ml/.test(await text('.wstrip')));
    await tap('[data-act=open-water]', 400);
    ok('tapping it opens the full water view, with a way back', await has('.backbar') && await has('.sched') && await p.$eval('nav [data-v=today]', e => e.classList.contains('on')));
    await tap('.backbar', 400);
    ok('back returns to Today', await has('.thead') && !(await has('.backbar')));

    // ---------- sheets: title bar with a close button ----------
    await tap('[data-act=data]', 400);
    ok('Settings is a short menu', (await texts('.menu .srow2 b')).join('|') === 'General|Reminders|Nyx|Siri & Shortcuts|Backup & data');
    ok('sheet has a title bar with a close button', (await text('.shead h2')) === 'Settings' && await has('.shead .sclose'));
    await tap('[data-act=dpage][data-v=general]', 400);
    ok('a row opens its page, with a back button', (await text('.shead h2')).includes('General') && await has('.shead .sback') && await has('[data-sec=water]') && await has('[data-pref=sound]'));
    await p.$eval('.sheet', e => { e.scrollTop = 600; }); await sleep(200);
    const pin = await p.evaluate(() => { const sh = document.querySelector('.sheet').getBoundingClientRect(), hd = document.querySelector('.shead').getBoundingClientRect(); return Math.round(hd.top - sh.top); });
    ok(`the title bar stays at the top while scrolling (${pin}px)`, Math.abs(pin) <= 2);
    await tap('.sback', 300);
    ok('back returns to the menu', await has('.menu'));
    await tap('.sclose', 400);
    ok('the close button closes the sheet', !(await has('.sheet')));
    await tap('.thead', 400);
    ok('every sheet gets it (companion)', await has('.sv-sheet .shead .sclose'));
    await tap('.sv-sheet .sclose', 400);
    ok('…and it closes that one too', !(await has('.sv-sheet')));

    // ---------- feedback: a visible flash and an optional chime ----------
    await p.evaluate(() => { window.__osc = 0; const o = AudioContext.prototype.createOscillator; AudioContext.prototype.createOscillator = function () { window.__osc++; return o.call(this); }; });
    await tap('.hero [data-act=complete]', 120);
    const flashed = await p.evaluate(() => !!document.querySelector('.tl .it.justdone, [data-rid="C"].justdone'));
    await sleep(400); await t.clearCele();
    ok('completing lights the item up', flashed);
    ok('…with a soft chime', (await p.evaluate(() => window.__osc)) >= 2);
    await seed(`(s) => { s.prefs.sound = false; }`);
    await p.evaluate(() => { window.__osc = 0; const o = AudioContext.prototype.createOscillator; AudioContext.prototype.createOscillator = function () { window.__osc++; return o.call(this); }; });
    await tap('.qbar [data-act=w-add]', 300);
    ok('no chime when Sounds is off', (await p.evaluate(() => window.__osc)) === 0);

    // ---------- tips show until you've used the gesture ----------
    ok('swipe hints show at first', await has('.swhint') && (await text('.tl .it.open')).includes('swipe when done'));
    await p.$eval('.tl .it.open', e => e.scrollIntoView({ block: 'center' })); await sleep(300);
    const box = await (await p.$('.tl .it.open')).boundingBox();
    await p.mouse.move(box.x + 40, box.y + box.height / 2); await p.mouse.down();
    for (let i = 1; i <= 8; i++) { await p.mouse.move(box.x + 40 + i * 25, box.y + box.height / 2); await sleep(16); }
    await p.mouse.up(); await sleep(500); await t.clearCele();
    ok('after one swipe the hints are gone for good', !(await has('.swhint')) && (await state()).tips.swiped === true && !(await texts('.tl .st')).some(x => x.includes('swipe when done')));

    // ---------- small links are easy to hit ----------
    const pad = await p.evaluate(() => { const b = document.createElement('button'); b.className = 'linkbtn'; document.body.appendChild(b); const v = parseFloat(getComputedStyle(b).paddingTop); b.remove(); return v; });
    ok(`small links have a comfortable tap area (${pad}px padding)`, pad >= 8);

    // ---------- the tour after updating ----------
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('metamorph.v1')); s.seenVersion = 16; s.cloud.on = false; localStorage.setItem('metamorph.v1', JSON.stringify(s)); localStorage.setItem('metamorph.updated', '1'); });
    await p.reload(); await sleep(800);
    ok('after the update a short tour appears', (await p.$$('.tour .tcard')).length === 4 && (await text('.tcard h3')) === 'A calmer Today');
    ok('cards have buttons to try things', await has('.tcard [data-act=tour-siri]') && await has('.tcard [data-act=tour-backup]') && await has('.tcard [data-act=sv-open]'));
    for (let i = 0; i < 3; i++) { await tap('[data-act=tour-next]', 700); }
    ok('Next moves through the cards', (await text('[data-act=tour-next]')) === 'Done' && (await p.$$eval('.tdots i', l => l.findIndex(x => x.classList.contains('on')))) === 3);
    await tap('[data-act=tour-next]', 400);
    ok('Done closes it and it won’t show again', !(await has('.tour')) && (await state()).seenVersion === 17);
  } catch (e) { ok('CRASH ' + e.stack, false); }
  await t.done();
})();
