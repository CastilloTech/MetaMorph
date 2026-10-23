// Companion: meeting it, charge and streak, nudges, goals, picture, its voice in reminders, and chat (against a fake server).
const { open, sleep } = require('./h');
const path = require('path');
(async () => {
  const t = await open();
  const { p, ok, tap, has, text, texts, state, seed } = t;
  try {
    // a day with one routine done, one overdue and one on now; water and macros off so the charge is just the Gates
    await seed(`(s, { now, hm, key }) => {
      s.prefs.dayStart = '00:00';
      s.sections.water = false; s.sections.macros = false;
      const st = id => ({ id, title: 'step', minutes: 10, work: '' });
      s.gates = { other: [], nutrition: [],
        sleep: [{ id: 'C', title: 'Wind-down', start: hm(now - 5), repeat: { type: 'daily' }, steps: [{ id: 'c1', title: 'step', minutes: 30, work: '' }] }],
        hygiene: [{ id: 'H', title: 'Morning routine', start: hm(now - 180), repeat: { type: 'daily' }, steps: [st('h1')] }],
        fitness: [{ id: 'F', title: 'Training', start: hm(now - 90), repeat: { type: 'daily' }, steps: [st('f1')] }] };
      s.done = { [key()]: { H: true, h1: true } }; s.fin = { [key()]: { H: Date.now() - 170 * 60000 } };
      s.workouts.log = []; s.body.entries = []; s.todos = [];
    }`);

    // meeting it
    ok('Today invites you to meet your companion', (await text('.sv-card')).includes('Meet your companion'));
    await tap('.sv-card', 400);
    ok('setup asks for a name', await has('#svname'));
    await p.$eval('#svname', e => { e.value = 'Nyx'; });
    await tap('[data-act=sv-create]', 400);
    let s = await state();
    ok('companion is born with its name', s.servitor.born > 0 && s.servitor.name === 'Nyx');
    ok('home shows charge, streak and the Gate orbs', (await text('.sv-sheet')).includes('33% charged today') && (await p.$$('.sv-gorb')).length === 4);
    await tap('[data-act=sv-close]');

    // the Today card stays on the routine that's on now, like the water schedule
    let card = await text('.sv-card');
    ok(`card shows name and charge (${card.slice(0, 40)})`, card.startsWith('Nyx') && card.includes('33% charged'));
    ok('card follows the current routine (the banner below has the buttons)', card.includes('Wind-down is on now') && !(await has('.sv-card [data-act=complete]')) && await has('.hero [data-act=complete][data-id=C]'));
    ok('card does not dwell on the overdue routine', !card.includes('Training'));
    await tap('.sv-card', 400);
    ok('Home notes the overdue routine and how to finish it late', /Training is overdue on your timeline\. If you did it late, swipe right/.test(await text('.sv-notes')));
    await tap('[data-act=sv-close]');
    await tap('.hero [data-act=complete][data-id=C]', 400);
    s = await state();
    card = await text('.sv-card');
    ok(`Complete marks it held and the card moves on (${card.slice(0, 50)})`, !!s.done[Object.keys(s.done).pop()].C && card.includes('67% charged') && !card.includes('Wind-down is on now'));

    // the overdue routine stays on the timeline; swiping right marks it done late
    await t.clearCele();
    const tl = await p.$eval('.tl .it.open', e => ({ id: e.dataset.id, txt: e.textContent }));
    ok('overdue routine on the timeline says to swipe when done', tl.id === 'F' && /overdue\s*swipe when done/.test(tl.txt));
    await p.$eval('.tl .it.open', e => e.scrollIntoView({ block: 'center' })); await sleep(200);
    const box = await (await p.$('.tl .it.open')).boundingBox();
    await p.mouse.move(box.x + 40, box.y + box.height / 2); await p.mouse.down();
    for (let i = 1; i <= 8; i++) { await p.mouse.move(box.x + 40 + i * 25, box.y + box.height / 2); await sleep(16); }
    await p.mouse.up(); await sleep(500); await t.clearCele();
    s = await state();
    const kk = Object.keys(s.done).pop();
    ok('swipe marks it done with the late finish time', !!s.done[kk].F && s.fin[kk].F > Date.now() - 60000);
    ok('timeline shows it finished late', (await texts('.tl .it')).some(x => x.includes('Training') && /late · /.test(x)));

    // goals
    await tap('.sv-card', 400);
    await p.$eval('#svgoal', e => { e.value = 'Bench 225 by summer'; });
    await p.$eval('#svgoalf', f => f.requestSubmit());
    await sleep(300);
    s = await state();
    ok('goal saved and listed', s.servitor.goals.length === 1 && (await text('.sv-goals')).includes('Bench 225 by summer'));
    ok('goal reminder appears among nudges', (await text('.sv-notes')).includes('Bench 225 by summer'));

    // picture
    const inp = await p.$('#svpic');
    await inp.uploadFile(path.join(__dirname, 'fixtures', 'front.jpg'));
    await sleep(1200);
    s = await state();
    ok(`picture saved small (${s.servitor.avatar ? Math.round(s.servitor.avatar.length / 1024) : 0} KB)`, !!s.servitor.avatar && /^data:image\/(webp|jpeg)/.test(s.servitor.avatar) && s.servitor.avatar.length < 120000);
    ok('picture shown in the ring', await has('.sv-sheet .sv-av img'));

    // rename
    await p.$eval('#svrename', e => { e.value = 'Nyxie'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await sleep(300);
    ok('rename works', (await state()).servitor.name === 'Nyxie');
    await tap('[data-act=sv-close]');

    // its voice in push reminders (fake push subscription; capture what would be sent to the server)
    await seed(`(s) => { s.reminders.on = true; s.reminders.deviceId = 'dev1234567890abcdef'; s.reminders.lastHash = ''; }`);
    await p.evaluate(() => {
      PushManager.prototype.getSubscription = async () => ({ endpoint: 'https://push.example/x', toJSON() { return { endpoint: 'https://push.example/x', keys: { p256dh: 'a', auth: 'b' } }; } });
      window.__sync = null; window.__chatSeen = [];
      const real = window.fetch;
      window.fetch = async (u, o) => {
        if (String(u).endsWith('/sync')) { window.__sync = JSON.parse(o.body); return new Response('{"ok":true}', { status: 200 }); }
        if (String(u).endsWith('/chat')) { window.__chatSeen.push({ headers: o.headers, body: JSON.parse(o.body) }); const r = window.__reply.shift(); return new Response(JSON.stringify(r.body), { status: r.status || 200 }); }
        return real(u, o);
      };
    });
    await tap('.sv-card [data-act=sv-dismiss]');   // any saved change triggers a sync
    await sleep(3200);
    const sync = await p.evaluate(() => window.__sync);
    const rt = sync && sync.items.find(x => x.id === 'F');
    ok(`reminders speak in the companion's voice (${rt && rt.body})`, !!rt && rt.body.startsWith('Nyxie: ') && rt.body.includes('Training'));

    // chat: pairing, then a suggestion accepted
    await tap('.sv-card', 400);
    await tap('[data-act=sv-tab][data-v=chat]', 300);
    ok('chat asks for the pairing code first', await has('#svcode'));
    await p.$eval('#svcode', e => { e.value = 'test-code-1234'; });
    await p.$eval('#svcodef', f => f.requestSubmit()); await sleep(300);
    ok('pairing code saved', (await state()).servitor.code === 'test-code-1234' && await has('#svmsg'));
    await p.evaluate(() => {
      window.__reply = [{ body: { stop_reason: 'tool_use', content: [
        { type: 'thinking', thinking: '', signature: 'sig-1' }, { type: 'text', text: 'Nice, **protein** to start! Here it is:' },
        { type: 'tool_use', id: 'toolu_1', name: 'log_food', input: { name: '3 scrambled eggs', meal: 'Breakfast', kcal: 210, protein_g: 18, carbs_g: 1.5, fat_g: 15 } }] } }];
    });
    await p.$eval('#svmsg', e => { e.value = 'I had 3 eggs'; });
    await p.$eval('#svchatf', f => f.requestSubmit()); await sleep(800);
    let seen = await p.evaluate(() => window.__chatSeen);
    const m0 = seen[0] && seen[0].body.messages[0];
    ok('message sent with the pairing code', !!seen[0] && seen[0].headers['X-Companion-Code'] === 'test-code-1234');
    ok('message carries a snapshot of the day', !!m0 && m0.role === 'user' && /<app_state>[\s\S]*your name: Nyxie[\s\S]*Bench 225 by summer[\s\S]*\[F\][^\n]*Training[^\n]*done at [^\n]*\(late\)/.test(m0.content[0].text) && m0.content[1].text === 'I had 3 eggs');
    ok('reply shown with formatting', (await texts('.sv-msg.them')).some(x => x.includes('Nice, protein to start')) && await has('.sv-msg.them b'));
    ok('suggestion shown as a card', (await text('.sv-prop')).includes('3 scrambled eggs') && (await text('.sv-prop')).includes('210 kcal'));
    await tap('[data-act=sv-accept][data-id=toolu_1]', 300);
    s = await state();
    const k = Object.keys(s.nutri.log).pop(), food = (s.nutri.log[k] || []).find(x => x.name === '3 scrambled eggs');
    ok('accepting logs the food', !!food && food.kcal === 210 && food.p === 18 && food.meal === 'Breakfast');
    ok('card shows it is done', (await text('.sv-prop')).includes('Done') && s.servitor.chat.props.toolu_1 === 'accepted');

    // next turn reports the outcome and keeps only the latest thinking
    await p.evaluate(() => {
      window.__reply = [
        { body: { stop_reason: 'tool_use', content: [{ type: 'thinking', thinking: '', signature: 'sig-2' }, { type: 'text', text: 'Two ideas:' },
          { type: 'tool_use', id: 'toolu_2', name: 'add_todo', input: { text: 'Buy Greek yogurt', date: '', time: '' } },
          { type: 'tool_use', id: 'toolu_3', name: 'move_routine', input: { routine_id: 'F', time: '18:00' } }] } },
        { body: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Got it.' }] } }];
    });
    await p.$eval('#svmsg', e => { e.value = 'What should I do?'; });
    await p.$eval('#svchatf', f => f.requestSubmit()); await sleep(800);
    seen = await p.evaluate(() => window.__chatSeen);
    const ms = seen[1].body.messages, u2 = ms[ms.length - 1];
    ok('accepted suggestion is reported back as a tool result', u2.content[0].type === 'tool_result' && u2.content[0].tool_use_id === 'toolu_1' && /accepted/.test(u2.content[0].content));
    ok('latest reply keeps its thinking', ms[1].role === 'assistant' && ms[1].content[0].type === 'thinking');
    ok('two suggestions shown', (await p.$$('.sv-prop')).length === 3);
    await tap('[data-act=sv-accept][data-id=toolu_2]', 300);
    await tap('[data-act=sv-skip][data-id=toolu_3]', 300);
    s = await state();
    ok('to-do added, routine left alone when skipped', s.todos.some(x => x.text === 'Buy Greek yogurt') && s.gates.fitness[0].start !== '18:00');
    await p.$eval('#svmsg', e => { e.value = 'Thanks'; });
    await p.$eval('#svchatf', f => f.requestSubmit()); await sleep(800);
    seen = await p.evaluate(() => window.__chatSeen);
    const ms3 = seen[2].body.messages;
    ok('older thinking is dropped from the front', !ms3[1].content.some(b => b.type === 'thinking') && ms3[3].content[0].type === 'thinking');
    ok('skip and accept both reported', ms3[4].content.filter(b => b.type === 'tool_result').map(b => /accepted/.test(b.content) ? 'a' : /skipped/.test(b.content) ? 's' : '?').join('') === 'as');

    // errors are explained
    await p.evaluate(() => { window.__reply = [{ status: 401, body: { error: 'bad_code' } }]; });
    await p.$eval('#svmsg', e => { e.value = 'Hello?'; });
    await p.$eval('#svchatf', f => f.requestSubmit()); await sleep(800);
    ok('a wrong pairing code is explained, with retry', (await text('.sv-err')).includes('pairing code') && await has('[data-act=sv-retry]'));
    await p.evaluate(() => { window.__reply = [{ body: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Back again!' }] } }]; });
    await tap('[data-act=sv-retry]', 800);
    s = await state();
    ok('retry sends the same message once', s.servitor.chat.log.filter(m => m.text === 'Hello?').length === 1 && (await texts('.sv-msg.them')).some(x => x.includes('Back again')));
    await tap('[data-act=sv-close]');

    // streak from past days
    await seed(`(s, { now, hm, key }) => {
      const d = i => key(new Date(Date.now() - i * 864e5));
      s.gates.fitness = []; s.gates.sleep = []; s.servitor.born = Date.now() - 5 * 864e5; s.servitor.dismissed = {};
      s.done = { [d(1)]: { H: true }, [d(2)]: { H: true }, [d(3)]: { H: true } }; s.fin = {};
    }`);
    await tap('.sv-card', 400);
    ok('streak counts days at full charge', /3\s*day streak/.test(await text('.sv-stats')));
    ok('streak praise among nudges', (await text('.sv-notes')).includes('3 days in a row'));
    await tap('[data-act=sv-close]');

    // calories are the food focus of the charge
    await seed(`(s, { key }) => {
      s.sections.macros = true; s.servitor.dismissed = {};
      s.nutri.goals = { kcal: 2000, p: 150, c: 200, f: 70 }; s.nutri.goalHist = [{ from: '0000-00-00', goals: { ...s.nutri.goals } }];
      s.nutri.log = { [key()]: [{ id: 'n1', t: Date.now(), meal: 'Lunch', name: 'Meal', qty: 1, kcal: 2000, p: 40, c: 250, f: 70, src: 'quick' }] };
      s.done = { [key()]: { H: true } };
    }`);
    ok('calories on goal give full charge, even with low protein', (await text('.sv-card')).includes('100% charged'));
    await seed(`(s, { key }) => { s.nutri.log[key()][0].kcal = 4000; }`);
    ok('far over the calorie goal takes charge away', (await text('.sv-card')).includes('75% charged'));
    await tap('.sv-card', 400);
    ok('over-goal calories are noticed', /4,000 of 2,000 kcal, 2,000 over/.test(await text('.sv-notes')));
    await tap('[data-act=sv-close]');

    // settings: open from Settings, hide with Sections
    await tap('[data-act=data]');
    ok('Settings has a Companion entry', (await text('[data-act=data] ~ *, .sheet')).includes('Open Nyxie'));
    await p.$eval('[data-sec=companion]', e => { e.click(); }); await sleep(300);
    await tap('[data-act=data-close]');
    ok('turning the section off hides the card', !(await has('.sv-card')));
  } catch (e) { ok('CRASH ' + e.stack, false); }
  await t.done();
})();
