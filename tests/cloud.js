// Cloud backup (encrypted on the phone), the morning message and evening check-in, and the companion's weekly review draft.
const { open, sleep } = require('./h');
(async () => {
  const t = await open();
  const { p, ok, tap, has, text, texts, state, seed } = t;
  try {
    // a fake server for every page load, keeping its data in sessionStorage
    await p.evaluateOnNewDocument(() => {
      const real = window.fetch, ss = sessionStorage;
      const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); };
      window.fetch = async (u, o = {}) => {
        const url = String(u), json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
        const m = url.match(/\/backup(s)?(?:\?date=([\d-]+))?$/);
        if (m && o.method === 'PUT') {
          const bytes = new Uint8Array(await new Response(o.body).arrayBuffer()), list = JSON.parse(ss.getItem('__bklist') || '[]').filter(x => x.date !== m[2]);
          ss.setItem('__bk:' + m[2], b64(bytes)); list.unshift({ date: m[2], t: Date.now(), size: bytes.length }); ss.setItem('__bklist', JSON.stringify(list));
          ss.setItem('__puts', String(+(ss.getItem('__puts') || 0) + 1));
          return json({ ok: true });
        }
        if (m && m[1]) return json({ backups: JSON.parse(ss.getItem('__bklist') || '[]') });
        if (m) { const b = ss.getItem('__bk:' + m[2]); return b ? new Response(Uint8Array.from(atob(b), c => c.charCodeAt(0))) : json({ error: 'none' }, 404); }
        if (url.endsWith('/chat')) { ss.setItem('__chat', o.body); return json({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'KEEP: You held Morning routine 3 of 4 days. Keep that rhythm.\nCHANGE: Lay out tomorrow’s clothes the night before.' }] }); }
        if (url.endsWith('/sync')) { ss.setItem('__sync', o.body); return json({ ok: true }); }
        if (url.endsWith('/inbox')) return json({ items: [] });
        return real(u, o);
      };
      if (window.PushManager) PushManager.prototype.getSubscription = async () => ({ endpoint: 'https://push.example/x', toJSON() { return { endpoint: 'https://push.example/x', keys: { p256dh: 'a', auth: 'b' } }; } });
    });
    await p.reload(); await sleep(500);
    const ss = k => p.evaluate(k => sessionStorage.getItem(k), k);

    await seed(`(s, { now, hm, key }) => {
      s.prefs.dayStart = '00:00';
      const st = id => ({ id, title: 'step', minutes: 10, work: '' });
      s.gates = { other: [], nutrition: [], sleep: [], fitness: [],
        hygiene: [{ id: 'H', title: 'Morning routine', start: hm(now - 60), repeat: { type: 'daily' }, steps: [st('h1')] },
                  { id: 'E', title: 'Evening routine', start: hm(now + 60), repeat: { type: 'daily' }, steps: [st('e1')] }] };
      s.done = {}; s.fin = {}; s.reviews = {};
      s.todos = [{ id: 'T1', text: 'Secret dentist appointment', date: null, time: null, done: false, doneAt: null, created: 1 }];
      s.nutri.goals = { kcal: 2200, p: 150, c: 220, f: 70 }; s.nutri.goalHist = [{ from: '0000-00-00', goals: { ...s.nutri.goals } }];
      s.servitor = { name: 'Nyx', born: Date.now() - 3 * 864e5, avatar: null, goals: [{ id: 'g', text: 'Bench 225 by summer', t: 1 }], dismissed: {}, best: 0, code: 'pair-code-123', chat: { log: [], props: {} } };
      s.reminders.on = true; s.reminders.deviceId = 'dev1234567890abcdef'; s.reminders.lastHash = '';
    }`);

    // ---------- cloud backup ----------
    await tap('[data-act=data]');
    ok('Settings offers cloud backup with a passphrase', (await text('.sheet')).includes('Cloud backup') && await has('#cbpass'));
    await p.$eval('#cbpass', e => { e.value = 'correct horse battery'; });
    await p.$eval('#cbpass2', e => { e.value = 'correct horse batterx'; });
    await p.$eval('#cbonf', f => f.requestSubmit()); await sleep(300);
    ok('mismatched passphrases are caught', (await text('.snack')).includes('don’t match') && !(await state()).cloud.on);
    await p.$eval('#cbpass2', e => { e.value = 'correct horse battery'; });
    await p.$eval('#cbonf', f => f.requestSubmit());
    for (let i = 0; i < 20 && !(await ss('__puts')); i++) await sleep(300);
    let s = await state();
    const list = JSON.parse(await ss('__bklist') || '[]'), raw = list[0] && Buffer.from(await ss('__bk:' + list[0].date), 'base64');
    ok(`turning it on backs up right away (${raw ? Math.round(raw.length / 1024) : 0} KB)`, s.cloud.on && s.cloud.last > 0 && !!raw);
    ok('the backup is encrypted: starts with MMB1, no readable data inside', !!raw && raw.slice(0, 4).toString() === 'MMB1' && !raw.includes('Secret dentist') && !raw.includes('Nyx'));
    ok('neither the passphrase nor the key is in your data', !JSON.stringify(s).includes('correct horse') && !('key' in s.cloud) && typeof s.cloud.salt === 'string');
    ok('Settings shows the last cloud backup', /Last cloud backup\s*today/.test(await text('.sheet')));

    // lose some data, then restore it
    await tap('[data-act=data-close]');
    await seed(`(s) => { s.todos = []; }`);
    await tap('[data-act=data]');
    await tap('[data-act=cb-restore]', 300);
    await p.$eval('#cbrpass', e => { e.value = 'wrong passphrase'; });
    await p.$eval('#cbrf', f => f.requestSubmit()); await sleep(600);
    await tap('[data-act=cb-pick]', 3000);
    ok('a wrong passphrase can’t open it', (await text('.sheet')).includes('doesn’t open this backup') && (await state()).todos.length === 0);
    await tap('[data-act=cb-close]');
    await tap('[data-act=data]');
    await tap('[data-act=cb-restore]', 300);
    await p.$eval('#cbrpass', e => { e.value = 'correct horse battery'; });
    await p.$eval('#cbrf', f => f.requestSubmit()); await sleep(600);
    ok('backups are listed by day', (await text('.cblist')).includes('latest'));
    await tap('[data-act=cb-pick]', 3000);
    ok('restore asks before replacing', (await text('.ask h2')) === 'Replace this phone’s data?');
    await tap('.ask [data-o=yes]', 1500);
    s = await state();
    ok('restore brings the data back and keeps backing up', s.todos.some(x => x.text === 'Secret dentist appointment') && s.cloud.on && s.servitor.code === 'pair-code-123');

    // automatic daily backup when it's due
    const before = +(await ss('__puts'));
    await seed(`(s) => { s.cloud.last = Date.now() - 25 * 3600000; }`);
    for (let i = 0; i < 25 && +(await ss('__puts')) === before; i++) await sleep(400);
    ok('a day later it backs up again on its own', +(await ss('__puts')) > before);

    // ---------- morning message and evening check-in ----------
    await seed(`(s) => { s.reminders.lastHash = ''; s.reminders.briefAt = '06:45'; }`);
    await tap('[data-act=data]'); await p.$eval('[data-rm=water]', e => e.click()); await sleep(3500);
    const items = JSON.parse(await ss('__sync') || '{"items":[]}').items, todayKey = items.find(x => x.id.startsWith('brief-')).id.slice(6);
    const brief = items.find(x => x.id === 'brief-' + todayKey), wrap = items.find(x => x.id === 'wrap-' + todayKey);
    ok(`morning message with the plan (${brief && brief.body})`, !!brief && brief.title === 'Nyx' && brief.at === '06:45' && /^Good morning! 2 routines today, starting with Morning routine at .+ Calorie goal: 2,200\..*Remember: “Bench 225 by summer”/.test(brief.body));
    ok(`evening check-in with what's left (${wrap && wrap.body})`, !!wrap && /Still open: Morning routine \(.+\) and Evening routine \(.+\)\..*Calories: 0 of 2,200\..*Charge \d+%/.test(wrap.body));
    ok('three days of morning messages, two of evening', items.filter(x => x.id.startsWith('brief-')).length === 3 && items.filter(x => x.id.startsWith('wrap-')).length === 2);
    ok('Settings has both, with their times', (await text('.sheet')).includes('Morning message') && (await text('.sheet')).includes('Evening check-in') && await has('[data-rmtime=briefAt]') && await has('[data-rmtime=wrapAt]'));
    await tap('[data-act=data-close]');

    // ---------- weekly review draft ----------
    await tap('[data-act=cal][data-v=week]');
    await tap('[data-act=rv-open]', 400);
    ok('review offers a draft from the companion', (await text('[data-act=rv-draft]')).includes('Ask Nyx for a draft'));
    await tap('[data-act=rv-draft]', 1200);
    const vals = await p.$$eval('[data-rv]', l => l.map(e => e.value));
    ok(`draft fills Keep doing and Change (${vals.join(' | ').slice(0, 60)}…)`, vals[0].startsWith('You held Morning routine') && vals[1].startsWith('Lay out tomorrow'));
    s = await state();
    const mon = Object.keys(s.reviews)[0], sent = JSON.parse(await ss('__chat')).messages[0].content[1].text;
    ok('draft is saved with the review', !!mon && s.reviews[mon].change.startsWith('Lay out'));
    ok('the companion is given the week’s numbers', /Please draft my weekly review/.test(sent) && /Hygiene: \d+\/\d+ routines held/.test(sent) && /daily charge:/.test(sent));
    await tap('[data-act=rv-close]');

    // ---------- long chats stay small: old messages keep only what the chat shows ----------
    await seed(`(s) => {
      const log = [];
      for (let i = 0; i < 40; i++) log.push(i % 2 === 0
        ? { role: 'user', t: i, text: 'question ' + i, content: [{ type: 'text', text: '<app_state> ' + 'x'.repeat(2000) + ' </app_state>' }, { type: 'text', text: 'question ' + i }] }
        : { role: 'assistant', t: i, content: [{ type: 'thinking', thinking: '', signature: 's'.repeat(1500) }, { type: 'text', text: 'answer ' + i }] });
      s.servitor.chat = { log, props: {} };
    }`);
    await tap('.sv-card', 400); await tap('[data-act=sv-tab][data-v=chat]', 300);
    const sizeBefore = JSON.stringify((await state()).servitor.chat).length;
    await p.$eval('#svmsg', e => { e.value = 'how am I doing?'; });
    await p.$eval('#svchatf', f => f.requestSubmit()); await sleep(1200);
    s = await state();
    const log = s.servitor.chat.log, sentNow = JSON.parse(await ss('__chat')).messages;
    ok(`old messages are trimmed (${Math.round(sizeBefore / 1024)} KB → ${Math.round(JSON.stringify(s.servitor.chat).length / 1024)} KB)`, log[0].compact && !JSON.stringify(log.slice(0, 8)).includes('<app_state>') && !log.slice(0, 8).some(m => m.content.some(b => b.type === 'thinking')));
    ok('the chat still shows every message', log.length === 42 && log[0].text === 'question 0' && log[1].content.some(b => b.text === 'answer 1') && (await texts('.sv-msg')).length >= 42);
    ok('what is sent next is untouched (recent turns, newest snapshot)', sentNow.length <= 30 && sentNow[0].role === 'user' && sentNow[sentNow.length - 1].content.some(b => b.type === 'text' && b.text.startsWith('<app_state>')));
    await tap('[data-act=sv-close]');
  } catch (e) { ok('CRASH ' + e.stack, false); }
  await t.done();
})();
