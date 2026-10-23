// Quick logging: the quick bar, reminder taps that open to the action, the Siri & Shortcuts inbox, and its setup screen.
const { open, sleep, URL: BASE } = require('./h');
(async () => {
  const t = await open();
  const { p, ok, tap, has, text, texts, state, seed } = t;
  try {
    // a fake server for every page load: inbox, chat and reminder sync all answer from sessionStorage
    await p.evaluateOnNewDocument(() => {
      const real = window.fetch, ss = sessionStorage;
      const log = (k, v) => { const a = JSON.parse(ss.getItem(k) || '[]'); a.push(v); ss.setItem(k, JSON.stringify(a)); };
      window.fetch = async (u, o = {}) => {
        const url = String(u), json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
        if (url.endsWith('/inbox/ack')) { log('__acks', JSON.parse(o.body).ids); return json({ ok: true }); }
        if (url.endsWith('/inbox')) { log('__pulls', (o.headers || {})['X-Companion-Code']); return json({ items: JSON.parse(ss.getItem('__inbox') || '[]') }); }
        if (url.endsWith('/chat')) { log('__chats', JSON.parse(o.body)); return json({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'I can log that chicken bowl for you.' }] }); }
        if (url.endsWith('/sync')) { ss.setItem('__sync', o.body); return json({ ok: true }); }
        return real(u, o);
      };
      if (window.PushManager) PushManager.prototype.getSubscription = async () => ({ endpoint: 'https://push.example/x', toJSON() { return { endpoint: 'https://push.example/x', keys: { p256dh: 'a', auth: 'b' } }; } });
    });
    await p.reload(); await sleep(500);
    const ss = k => p.evaluate(k => JSON.parse(sessionStorage.getItem(k) || 'null'), k);

    await seed(`(s, { now, hm, key }) => {
      s.prefs.dayStart = '00:00';
      const st = id => ({ id, title: 'step', minutes: 10, work: '' });
      s.gates = { other: [], nutrition: [], sleep: [],
        hygiene: [{ id: 'H', title: 'Morning routine', start: hm(now - 180), repeat: { type: 'daily' }, steps: [st('h1')] }],
        fitness: [{ id: 'F', title: 'Training', start: hm(now - 90), repeat: { type: 'daily' }, steps: [st('f1')] }] };
      s.done = {}; s.fin = {}; s.body.entries = [];
      s.water.unit = 'ml'; s.water.pour = 250; s.water.log = {}; s.water.hit = {};
      const y = key(new Date(Date.now() - 864e5));
      s.nutri.log = { [y]: [{ id: 'n0', t: Date.now() - 864e5, meal: 'Lunch', name: 'Chicken bowl', qty: 1, kcal: 650, p: 45, c: 60, f: 20, src: 'quick' }] };
      s.todos = [{ id: 'T', text: 'Call the dentist', date: key(), time: hm(now + 30), done: false, doneAt: null, created: 1 }];
      s.servitor = { name: 'Nyx', born: Date.now() - 864e5, avatar: null, goals: [], dismissed: {}, best: 0, code: '', chat: { log: [], props: {} } };
    }`);

    // quick bar
    const chips = await texts('.qbar .qchip');
    ok(`quick bar on Today (${chips.join(' | ')})`, chips.length === 4 && chips[0].includes('+250 ml') && chips[1].includes('Chicken bowl') && chips[2].includes('Weight') && chips[3].includes('Nyx'));
    await tap('[data-act=q-again]', 300);
    let s = await state(), k = Object.keys(s.nutri.log).sort().pop();
    ok('↻ logs the last food again, today', (s.nutri.log[k] || []).some(e => e.name === 'Chicken bowl' && e.src === 'again') && await has('.snack [data-o=undo]'));
    await tap('[data-act=q-weigh]', 300);
    ok('Weight opens the Body log', await p.$eval('[data-act=b-tab][data-v=log]', e => e.classList.contains('on')));
    await tap('nav [data-v=today]');

    // reminder taps open straight to the action
    await p.goto(BASE + '?do=water&ml=300'); await sleep(700);
    ok('water reminder opens “Log 300 ml?”', (await text('.qsheet h2')) === 'Log 300 ml of water?');
    ok('the link is cleaned from the address bar', !(await p.evaluate(() => location.search)));
    await tap('[data-act=q-water]', 300);
    s = await state();
    ok('one tap logs it', Object.values(s.water.log).flat().some(e => e.ml === 300) && !(await has('.qsheet')));
    await p.goto(BASE + '?do=routine&id=F'); await sleep(700);
    ok('routine reminder opens the routine, offering Done (late)', (await text('.qsheet h2')) === 'Training' && (await text('[data-act=q-done]')) === 'Done (late)');
    await tap('[data-act=q-done]', 400); await t.clearCele();
    s = await state(); k = Object.keys(s.done).pop();
    ok('completing records the finish time', !!s.done[k].F && s.fin[k].F > Date.now() - 60000);
    await p.goto(BASE + '?do=todo&id=T'); await sleep(700);
    await tap('[data-act=q-todo]', 300);
    ok('to-do reminder marks it done', (await state()).todos.find(x => x.id === 'T').done === true);
    // with the app already open, the service worker hands the tap over by message
    await p.evaluate(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'quick', url: './?do=water&ml=200' } })));
    await sleep(300);
    ok('tapping a reminder while the app is open shows the action too', (await text('.qsheet h2')) === 'Log 200 ml of water?');
    await tap('[data-act=q-close]');

    // reminders carry those links
    await seed(`(s) => { s.reminders.on = true; s.reminders.deviceId = 'dev1234567890abcdef'; s.reminders.lastHash = ''; s.todos[0].done = false; }`);
    await tap('[data-act=cal][data-v=week]'); await tap('[data-act=cal][data-v=day]');
    await p.evaluate(() => document.querySelector('[data-act=q-again]').click()); await sleep(3200);
    const sync = await ss('__sync'), items = sync ? sync.items : [];
    const byId = id => items.find(x => x.id === id) || {};
    ok(`reminders open to their action (${byId('F').url}, ${byId('t-T').url})`, byId('F').url === './?do=routine&id=F' && byId('t-T').url === './?do=todo&id=T' && items.some(x => /^\.\/\?do=water&ml=\d+$/.test(x.url || '')) && byId('review').url === './?do=review');

    // Siri & Shortcuts: messages waiting on the server are applied with the time they were sent
    const now = Date.now();
    await seed(`(s, { now, hm }) => {
      s.done = {}; s.fin = {}; s.water.log = {}; s.water.hit = {}; s.body.entries = []; s.servitor.code = 'pair-code-123'; s.servitor.chat = { log: [], props: {} };
      s.gates.sleep = [{ id: 'C', title: 'Wind-down', start: hm(now - 20), repeat: { type: 'daily' }, steps: [{ id: 'c1', title: 'x', minutes: 40, work: '' }] }];
    }`);
    const inbox = [
      { id: 'i1', t: now - 30 * 60000, kind: 'water', amount: 500, unit: null, text: 'water 500' },
      { id: 'i2', t: now - 25 * 60000, kind: 'weight', value: 80, unit: 'kg', text: 'weight 80 kg' },
      { id: 'i3', t: now - 10 * 60000, kind: 'done', text: 'done' },
      { id: 'i4', t: now - 5 * 60000, kind: 'note', text: 'had a chicken bowl' },
    ];
    await p.evaluate(v => sessionStorage.setItem('__inbox', v), JSON.stringify(inbox));
    await p.reload(); await sleep(2500);
    s = await state(); k = Object.keys(s.water.log).pop();
    ok('water from Siri logged at the time it was sent', (s.water.log[k] || []).some(e => e.ml === 500 && e.t === inbox[0].t));
    ok('weight in kg converted to lb', s.body.entries.some(e => e.weight === 176.4 && e.t === inbox[1].t));
    const dk = Object.keys(s.done).pop();
    ok('“done” completes the routine that was on then, at that time', !!s.done[dk] && !!s.done[dk].C && s.fin[dk].C === inbox[2].t);
    const chats = await ss('__chats'), sent = chats && chats[0] && chats[0].messages.slice(-1)[0].content.slice(-1)[0].text;
    ok(`notes go to your companion (“${sent}”)`, !!sent && /^\(Sent from my phone at .+\) had a chicken bowl$/.test(sent));
    ok('companion says it read them', (await text('.sv-card')).includes('I read what you sent from your phone'));
    ok('a confirmation lists what went in', /From your phone: 500 ml water · weight 176\.4 lb · Wind-down done at/.test(await text('.snack')));
    const acks = await ss('__acks');
    ok('applied messages are cleared from the server', !!acks && acks[0].join() === 'i1,i2,i3,i4' && (await ss('__pulls'))[0] === 'pair-code-123');
    // if clearing failed and the same messages come back, nothing is applied twice
    await p.reload(); await sleep(2500);
    s = await state();
    ok('nothing is applied twice', Object.values(s.water.log).flat().filter(e => e.ml === 500).length === 1 && s.body.entries.length === 1 && (await ss('__chats')).length === 1);
    await tap('.sv-card [data-act=sv-tab][data-v=chat]', 400);
    ok('opening the chat clears the note', (await state()).servitor.unread === false && (await texts('.sv-msg.them')).some(x => x.includes('chicken bowl')));
    await tap('[data-act=sv-close]');

    // without a companion, notes become to-dos
    await seed(`(s) => { s.servitor.born = null; s.todos = []; }`);
    await p.evaluate(() => sessionStorage.setItem('__inbox', JSON.stringify([{ id: 'i9', t: Date.now(), kind: 'note', text: 'buy eggs' }])));
    await p.reload(); await sleep(2500);
    ok('without a companion, a note becomes a to-do', (await state()).todos.some(x => /^From Siri \(.+\): buy eggs$/.test(x.text)));

    // the setup screen
    await tap('[data-act=data]');
    await tap('[data-act=siri-open]', 400);
    const sheet = await text('.siri');
    ok('Settings opens the Siri & Shortcuts guide', sheet.includes('Siri & Shortcuts') && sheet.includes('/inbox') && sheet.includes('pair-code-123') && sheet.includes('Back Tap') && sheet.includes('Get Contents of URL'));
    ok('copy buttons for address, header and code', (await p.$$('[data-act=siri-copy]')).length === 3);
    await tap('[data-act=siri-close]');
  } catch (e) { ok('CRASH ' + e.stack, false); }
  await t.done();
})();
