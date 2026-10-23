  /* ----- companion: a friendly servitor whose one purpose is keeping you consistent ----- */

  // Bundled picture used until you choose your own (set to e.g. 'img/companion.webp' once there is one)
  const SV_DEFAULT_IMG = null;
  const SV = () => S.servitor;
  const svBorn = () => !!(S.servitor && S.servitor.born);
  const svName = () => (SV().name || 'Companion').trim();
  const FULL = 70;   // a day at 70%+ charge counts toward the streak

  // How close a day's calories are to the goal (0-1): full credit within 10% either side, less the further off
  function kcalScore(k) {
    const goal = goalsFor(k).kcal, got = nTotals(k).kcal;
    if (!goal) return null;
    const r = got / goal;
    return r <= 0.9 ? r / 0.9 : r <= 1.1 ? 1 : Math.max(0, 1 - (r - 1.1) * 2);
  }
  // How charged the companion is for a day (0-100): Gates held, water and calories, each against its target.
  // It starts low each morning and builds as you keep the day.
  function chargeOf(k = today()) {
    const d = parseKey(k);
    let w = 0, got = 0;
    const g = activeGates().filter(x => !x.other).map(x => gateDay(x.id, d)).reduce((a, x) => ({ n: a.n + x.n, held: a.held + x.held }), { n: 0, held: 0 });
    if (g.n) { w += 3; got += 3 * g.held / g.n; }
    if (on('water') && k >= W().since && W().target) { w += 1; got += Math.min(1, wTotal(k) / W().target); }
    if (on('macros')) { const ks = kcalScore(k); if (ks != null) { w += 1; got += ks; } }
    return w ? Math.round(100 * got / w) : 0;
  }

  let svCache = { key: '', v: null };
  function svStats() {
    const k0 = today(), key = `${S.rev}|${k0}|${Math.floor(Date.now() / 60000)}`;
    if (svCache.key === key) return svCache.v;
    const born = pdayOf(SV().born || Date.now()), charge = chargeOf(k0);
    const days = [];
    for (let i = 6; i >= 0; i--) { const k = keyOf(addDays(parseKey(k0), -i)); days.push({ k, c: k < born ? null : i === 0 ? charge : chargeOf(k) }); }
    let streak = 0;
    for (let i = 1; i <= 120; i++) { const k = keyOf(addDays(parseKey(k0), -i)); if (k < born || chargeOf(k) < FULL) break; streak++; }
    if (charge >= FULL) streak++;
    const past = days.slice(0, 6).filter(x => x.c != null).map(x => x.c);
    const mean = past.length >= 2 ? avg(past) : null;
    const form = mean == null ? 'awake' : mean < 35 ? 'resting' : mean < FULL ? 'awake' : 'radiant';
    const gates = activeGates().filter(x => !x.other).map(x => { const gd = gateDay(x.id, pdayDate()); return { id: x.id, f: gd.n ? gd.held / gd.n : 0, n: gd.n }; });
    if (svBorn() && streak > (SV().best || 0)) { SV().best = streak; save(); }
    const v = { charge, days, streak, best: Math.max(SV().best || 0, streak), form, gates };
    svCache = { key, v };
    return v;
  }
  const svList = a => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
  const svChargeParts = () => svList(['Gates held', on('water') ? 'water' : '', on('macros') ? 'calories' : ''].filter(Boolean));
  const FORM_NAME = { resting: 'Resting', awake: 'Awake', radiant: 'Radiant' };

  /* --- what the companion notices: small, specific nudges with a one-tap fix --- */
  let nzCache = { key: '', v: [] };
  function svNudges() {
    const key = `${S.rev}|${Math.floor(Date.now() / 60000)}|${run ? run.rid : ''}`;
    if (nzCache.key === key) return nzCache.v;
    nzCache = { key, v: svNudgesNow() };
    return nzCache.v;
  }
  function svNudgesNow() {
    const out = [], k = today(), d = pdayDate(), hour = new Date().getHours(), dis = SV().dismissed[k] || {};
    const add = (id, text, btn = '', card = true) => { if (!dis[id]) out.push({ id, text, btn, card }); };
    // what you sent from your phone comes first: it answers something you just did
    if (SV().unread) add('unread', 'I read what you sent from your phone. Check my suggestions.', '<button class="btn small primary" data-act="sv-tab" data-v="chat">Review</button>');
    // like the water schedule: the routine on right now comes first; missed ones stay on the timeline as overdue
    const cur = allRoutines().find(x => status(x.r) === 'now');
    if (cur) {
      const w = windowOf(cur.r);
      // on Today the routine banner right below has Complete and the timer; the buttons only show in the companion's Home
      add('now:' + cur.r.id, `${cur.r.title} is on now, until ${hm(w.end)}. I’m with you. Tap Complete when you’re done.`,
        `<button class="btn small primary" data-act="complete" data-gate="${cur.gate}" data-id="${cur.r.id}">Complete</button><button class="btn small" data-act="run" data-gate="${cur.gate}" data-id="${cur.r.id}">Open timer</button>`);
      out[out.length - 1].now = true;
    }
    const over = allRoutines().filter(x => status(x.r) === 'open');
    if (over.length && !dis.overdue)
      add('overdue', `${over.length === 1 ? `${over[0].r.title} is` : `${over.length} routines are`} overdue on your timeline. If you did ${over.length === 1 ? 'it' : 'them'} late, swipe right to mark ${over.length === 1 ? 'it' : 'them'} done.`,
        '<button class="btn small" data-act="sv-timeline">Show timeline</button>', false);   // Home only: the Today card stays on what's current
    if (on('water')) {
      const st = wState(), behind = st.expected - st.got;
      if (st.got < st.target && behind >= W().pour)
        add('water', `You’re ${fmtW(behind)} behind on water. ${behind <= W().pour * 1.5 ? 'One glass now gets you back on pace.' : 'Start with a glass now and keep sipping.'}`, `<button class="btn small water" data-act="w-add" data-ml="${W().pour}">Log ${fmtW(W().pour)}</button>`);
    }
    if (on('macros') && nLog(k).length) {
      const goal = goalsFor(k).kcal, got = Math.round(nTotals(k).kcal), wake = toMin(W().wake || '07:00'), bed = toMin(W().bed || '22:00');
      // by now you'd usually have eaten this share of the day's calories (waking hours, finishing two hours before bed)
      const span = Math.max(240, bed - 120 - wake), share = Math.min(1, Math.max(0, (nowMin() - wake) / span));
      if (goal && got > goal * 1.1) add('kcal-over', `You’re at ${got.toLocaleString()} of ${goal.toLocaleString()} kcal, ${(got - goal).toLocaleString()} over today. Keep the rest of the day light.`);
      else if (goal && share > 0.5 && got < goal * (share - 0.3)) add('kcal-under', `You’re at ${got.toLocaleString()} of ${goal.toLocaleString()} kcal, behind for this time of day. Plan a real meal so you hit your number.`,
        '<button class="btn small" data-act="sv-go" data-v="nutrition">Log food</button>');
    }
    if (on('macros') && hour >= 13 && !nLog(k).length)
      add('food', 'No food logged yet today. Tell me what you’ve eaten and I’ll log it for you.', svChatReady()
        ? '<button class="btn small" data-act="sv-tab" data-v="chat">Tell me</button>' : '<button class="btn small" data-act="sv-go" data-v="nutrition">Log food</button>');
    if (on('macros')) {
      const off = [];
      for (let i = 1; i <= 7 && off.length < 3; i++) { const kk = keyOf(addDays(d, -i)); if (nLog(kk).length) off.push({ got: nTotals(kk).kcal, goal: goalsFor(kk).kcal }); }
      if (off.length === 3 && off.every(x => x.goal && Math.abs(x.got - x.goal) > x.goal * 0.1)) {
        const mean = Math.round(avg(off.map(x => x.got))), goal = off[0].goal;
        add('kcal-off', `Calories have been off target your last 3 logged days (about ${mean.toLocaleString()} vs ${goal.toLocaleString()} kcal). ${mean > goal ? 'Smaller portions or fewer snacks would bring it back.' : 'You’re under-eating; add a meal or a bigger portion.'}`);
      }
    }
    if (on('macros')) {
      const g = goalsFor(k), fed = [];
      for (let i = 1; i <= 7 && fed.length < 3; i++) { const kk = keyOf(addDays(d, -i)); if (nLog(kk).length) fed.push(nTotals(kk).p); }
      if (g.p && fed.length === 3 && fed.every(p => p < g.p * 0.85))
        add('protein', `Protein has come up short your last 3 logged days (about ${Math.round(avg(fed))}g of ${g.p}g). Eggs, Greek yogurt, chicken or a shake would close the gap.`);
    }
    for (const g of activeGates()) for (const r of S.gates[g.id]) {
      if (r.vary) continue;
      const runs = [];
      for (let i = 1; i <= 10 && runs.length < 5; i++) {
        const dd = addDays(d, -i), kk = keyOf(dd);
        if (!scheduledOn(r, dd) || skipped(r.id, kk) || !finOf(r.id, kk)) continue;
        runs.push(finText(r, kk).late);
      }
      const late = runs.filter(Boolean).length;
      if (runs.length >= 3 && late >= 3) {
        const to = fromMinHM(toMin(r.start) + 15);
        add('late:' + r.id, `${r.title} has run late ${late} of the last ${runs.length} times. Want to give it more room?`,
          `<button class="btn small" data-act="sv-shift" data-gate="${g.id}" data-id="${r.id}" data-v="${to}">Move to ${clock(to)}</button>`);
      }
    }
    if (on('workouts') && WK().log.length) {
      const last = WK().log.map(x => x.date).sort().pop(), gap = daysBetween(last, k);
      if (gap >= 4) add('workout', `It’s been ${gap} days since your last workout. Even a short one keeps the habit alive.`, '<button class="btn small" data-act="sv-go" data-v="fitness">Log a workout</button>');
    }
    if (on('body')) {
      const lw = latestWith('weight');
      if (lw && daysBetween(lw.date, k) >= 7) add('weigh', `No weigh-in for ${daysBetween(lw.date, k)} days. A quick one keeps your trend honest.`, '<button class="btn small" data-act="sv-go" data-v="body">Weigh in</button>');
    }
    const y = addDays(d, -1), slipped = activeGates().filter(g => !g.other).filter(g => { const gd = gateDay(g.id, y); return gd.n && !gd.held && keyOf(y) >= pdayOf(SV().born || 0); });
    const all4 = slipped.length > 1 && slipped.length === activeGates().filter(g => !g.other && gateDay(g.id, y).n).length;
    if (slipped.length) add('slip', `Yesterday ${all4 ? 'every Gate' : `the ${svList(slipped.map(g => g.name))} Gate${slipped.length > 1 ? 's' : ''}`} slipped. Today’s a fresh start.`);
    const st = svStats();
    if (st.streak >= 3) add('streak', `${st.streak} days in a row at full charge. That’s what consistency looks like. Keep it going!`);
    const goals = SV().goals;
    if (goals.length) { const g = goals[Math.floor(parseKey(k) / DAY) % goals.length]; add('goal:' + g.id, `Remember what you’re working toward: “${g.text}”`); }
    return out;
  }

  // something to say when there's nothing to nudge about
  function svGreeting() {
    const h = new Date().getHours(), hi = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const items = allRoutines(), next = items.find(x => ['now', 'upcoming'].includes(status(x.r)));
    if (items.length && items.every(x => isDone(x.r.id))) return 'Every Gate held today. I’m proud of you.';
    if (next) return status(next.r) === 'now' ? `${next.r.title} is happening now. I’m with you.` : `${hi}! ${next.r.title} is next, at ${clock(startFor(next.r))}.`;
    return `${hi}! I’m here whenever you need me.`;
  }

  /* --- the companion's voice in reminders and celebrations --- */
  const SV_LINES = {
    routine: ['Time for {t}. I’ll be right here when you’re done.', '{t} starts now. Let’s keep the streak going.', 'It’s {t} time. Small steps, every day.', '{t} is up. You’ve got this.'],
    water: ['Sip time: {a}. Your future self says thanks.', 'Water check: {a} now keeps you on pace.', 'Time for {a} of water.'],
    todo: ['“{t}” is due now.', 'Quick one: “{t}” is due.'],
    review: ['Let’s look back on your week together.'],
    gate: ['That’s one Gate held. Nice work!', 'Held. I knew you would.', 'One more Gate kept. Proud of you.'],
    all: ['Every Gate held today. That’s the whole point. Amazing.', 'All four Gates held. You’re unstoppable today.'],
  };
  function svLine(kind, seed, vars = {}) {
    if (!svBorn()) return null;
    const list = SV_LINES[kind];
    let h = 0;
    for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `${svName()}: ` + list[h % list.length].replace('{t}', vars.t || '').replace('{a}', vars.a || '');
  }

  /* --- morning message and evening check-in (sent by the reminder server) --- */
  const svVoiced = () => svBorn() && on('companion');
  // isToday: today's numbers (streak, charge) are known; later days only have the plan
  function morningText(k, isToday) {
    const d = parseKey(k), items = allRoutines(d), parts = [], g = goalsFor(k);
    parts.push(items.length ? `${items.length} routine${items.length === 1 ? '' : 's'} today, starting with ${items[0].r.title} at ${clock(startFor(items[0].r, d))}.` : 'Nothing scheduled today. A good day to rest or catch up.');
    if (on('macros') && g.kcal) parts.push(`Calorie goal: ${g.kcal.toLocaleString()}.`);
    if (on('water')) parts.push(`Water: ${fmtW(W().target)}.`);
    if (svVoiced()) {
      const st = isToday ? svStats() : null;
      if (st && st.streak >= 2) parts.push(`${st.streak} days in a row. Let’s keep it going.`);
      const goals = SV().goals;
      if (goals.length) parts.push(`Remember: “${goals[Math.floor(d / DAY) % goals.length].text}”`);
    }
    return { title: svVoiced() ? svName() : 'Good morning', body: (svVoiced() ? 'Good morning! ' : '') + parts.join(' ') };
  }
  function eveningText(k, isToday) {
    const title = svVoiced() ? svName() : 'Evening check-in';
    if (!isToday) return { title, body: `${svVoiced() ? 'Evening check-in. ' : ''}Open MetaMorph to see what’s left today and close it out strong.` };
    const items = allRoutines(), left = items.filter(x => !isDone(x.r.id)), parts = [];
    if (items.length && !left.length) parts.push(svVoiced() ? 'Every Gate held today. I’m proud of you. Rest well.' : 'Every routine done today.');
    else if (left.length) parts.push(`Still open: ${svList(left.slice(0, 3).map(x => `${x.r.title} (${clock(startFor(x.r))})`))}${left.length > 3 ? ` and ${left.length - 3} more` : ''}.`);
    if (on('water')) { const got = wTotal(); if (got < W().target) parts.push(`Water: ${fmtW(got)} of ${fmtW(W().target)}.`); }
    if (on('macros')) { const g = goalsFor(today()), t = Math.round(nTotals().kcal); if (g.kcal) parts.push(`Calories: ${t.toLocaleString()} of ${g.kcal.toLocaleString()}.`); }
    if (svVoiced() && left.length) parts.push(`Charge ${svStats().charge}%. You can still finish strong.`);
    return { title, body: (svVoiced() ? 'Evening check-in. ' : '') + parts.join(' ') };
  }

  /* --- weekly review draft --- */
  function weekSummary(mon) {
    const st = weekStats(mon), L = [];
    for (const x of st.gates) L.push(`${x.g.name}: ${x.held}/${x.n} routines held${x.late ? `, ${x.late} late` : ''}`);
    if (on('workouts')) L.push(`workouts: ${st.wo.length}${st.wo.length ? ` (${st.wo.map(w => w.title || 'Workout').join(', ')})` : ''}`);
    if (on('macros') && st.fed.length) {
      const onT = st.fed.filter(x => x.g.kcal && Math.abs(x.t.kcal - x.g.kcal) <= x.g.kcal * 0.1).length;
      L.push(`food logged ${st.fed.length}/${st.days.length} days; average ${Math.round(avg(st.fed.map(x => x.t.kcal)))} kcal vs goal ${st.fed[0].g.kcal}; calories on target ${onT}/${st.fed.length} days; average protein ${Math.round(avg(st.fed.map(x => x.t.p)))}g`);
    } else if (on('macros')) L.push('food: nothing logged');
    if (on('water') && st.water.length) L.push(`water target hit ${st.water.filter(Boolean).length}/${st.water.length} days`);
    if (on('body') && st.wFrom && st.wTo && st.wFrom !== st.wTo) L.push(`weight ${st.wFrom.weight} → ${st.wTo.weight} lb`);
    if (on('todo')) L.push(`tasks finished: ${st.todosDone}`);
    const days = st.days.map(d => chargeOf(keyOf(d)));
    L.push(`daily charge: ${days.map(c => c + '%').join(', ')}`);
    return L.join('\n');
  }
  async function svDraftReview(mon) {
    V.rvDraft = true; V.rvDraftErr = null; render();
    const range = `${parseKey(mon).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${addDays(parseKey(mon), 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    const ask = `Please draft my weekly review for ${range}. The week's numbers:\n${weekSummary(mon)}\n\nDon't use any tools. Reply with exactly two lines and nothing else:\nKEEP: one or two warm sentences on what worked and should continue, citing a number.\nCHANGE: one concrete, small thing to do differently next week, tied to my goals if possible.`;
    try {
      const res = await fetch(PUSH_URL + '/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Companion-Code': SV().code },
        body: JSON.stringify({ messages: [{ role: 'user', content: [{ type: 'text', text: `<app_state>\n${svSnapshot()}\n</app_state>` }, { type: 'text', text: ask }] }] }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(SV_ERR[out.error] || `Couldn’t get a draft (${res.status}).`);
      const text = (out.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      const keep = (text.match(/KEEP:\s*([\s\S]*?)(?=\n\s*CHANGE:|$)/i) || [])[1], change = (text.match(/CHANGE:\s*([\s\S]*)$/i) || [])[1];
      if (!keep && !change) throw new Error('The draft came back in an odd shape. Try again.');
      const r = S.reviews[mon] = S.reviews[mon] || {};
      if (keep) r.keep = keep.trim();
      if (change) r.change = change.trim();
      save();
    } catch (e) { V.rvDraftErr = /fetch|network|load failed/i.test(e.message) ? 'Couldn’t reach your companion.' : e.message; }
    V.rvDraft = false; render();
  }

  /* --- picture --- */
  function svAvatar(size, st, cls = '') {
    const src = SV().avatar || SV_DEFAULT_IMG;
    return `<span class="sv-av ${st.form} ${cls}" style="--s:${size}px;--p:${st.charge}" aria-hidden="true">
      <span class="sv-face">${src ? `<img src="${esc(src)}" alt="" draggable="false">` : orb('chaos', Math.round(size * 0.86))}</span></span>`;
  }
  async function svSetPicture(file) {
    try {
      const url = URL.createObjectURL(file), img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const n = 384, c = document.createElement('canvas'), side = Math.min(img.naturalWidth, img.naturalHeight);
      c.width = c.height = n;
      c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, n, n);
      URL.revokeObjectURL(url);
      let data = c.toDataURL('image/webp', 0.86);
      if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/jpeg', 0.86);
      SV().avatar = data; save(); render(); snack('New look saved');
    } catch (e) { snack('Couldn’t read that picture.'); }
  }

  /* --- Today card --- */
  function companionCard() {
    if (!on('companion')) return '';
    if (!svBorn()) return `<div class="card sv-card" data-act="sv-open">${svAvatar(52, { form: 'resting', charge: 0 })}
      <div class="sv-say"><div class="sv-name"><b>Meet your companion</b></div><p>A friendly guide who keeps you consistent and reminds you of your goals.</p></div></div>`;
    const st = svStats(), nz = svNudges().find(x => x.card);
    return `<div class="card sv-card" data-act="sv-open">${svAvatar(52, st)}
      <div class="sv-say"><div class="sv-name"><b>${esc(svName())}</b><span class="num">${st.charge}% charged</span></div>
        <p>${esc(nz ? nz.text : svGreeting())}</p>
        ${nz && !nz.now ? `<div class="sv-acts">${nz.btn}<button class="linkbtn" data-act="sv-dismiss" data-id="${esc(nz.id)}">Not now</button></div>` : ''}</div></div>`;
  }

  /* --- the companion's sheet: home and chat --- */
  function companionSheet() {
    const fresh = V.svFresh ? 'enter' : '';
    if (!svBorn()) return `<div class="sheet-bg ${fresh}" data-act="sv-close-bg"><div class="sheet sv-sheet"><div class="grab" aria-hidden="true"></div>
      <div class="sv-hero">${svAvatar(120, { form: 'awake', charge: 0 })}</div>
      <h2 style="text-align:center">Meet your companion</h2>
      <p class="note" style="text-align:center">Its one purpose is keeping you consistent with your Gates and reminding you of your goals. It grows brighter as you keep your days, nudges you when something slips, and speaks in your reminders.</p>
      <div class="field"><label>Give it a name</label><input id="svname" maxlength="24" placeholder="e.g. Nyx" autocomplete="off"></div>
      <button class="btn primary block" data-act="sv-create">Bring it to life</button>
      <button class="btn ghost block" data-act="sv-close" style="margin-top:8px">Later</button></div></div>`;
    const st = svStats();
    const ring = st.gates.map((g, i) => `<span class="sv-gorb" style="--i:${i};--n:${st.gates.length};opacity:${g.n ? (0.25 + 0.75 * g.f).toFixed(2) : 0.12}">${orb(g.id, 26)}</span>`).join('');
    const head = (V.sv === 'chat'
      ? `<div class="sv-mini">${svAvatar(48, st)}<div><h2>${esc(svName())}</h2><span class="muted num">${FORM_NAME[st.form]} · ${st.charge}% charged today</span></div></div>`
      : `<div class="sv-hero">${svAvatar(120, st, 'big')}${ring}</div>
      <h2 style="text-align:center;margin-bottom:2px">${esc(svName())}</h2>
      <p class="muted num" style="text-align:center;margin:0 0 12px">${FORM_NAME[st.form]} · ${st.charge}% charged today</p>`) + `
      <div class="seg" style="grid-template-columns:1fr 1fr"><button data-act="sv-tab" data-v="home" class="${V.sv === 'home' ? 'on' : ''}">Home</button><button data-act="sv-tab" data-v="chat" class="${V.sv === 'chat' ? 'on' : ''}">Chat</button></div>`;
    return `<div class="sheet-bg ${fresh}" data-act="sv-close-bg"><div class="sheet sv-sheet"><div class="grab" aria-hidden="true"></div>
      ${head}${V.sv === 'chat' ? svChatView() : svHomeView(st)}
      <button class="btn ghost block" data-act="sv-close" style="margin-top:12px">Close</button></div></div>`;
  }

  function svHomeView(st) {
    const nz = svNudges(), sv = SV();
    const bars = st.days.map(x => `<div class="sv-bar ${x.c != null && x.c >= FULL ? 'full' : ''}" title="${esc(x.k)}"><i style="height:${x.c == null ? 0 : Math.max(4, x.c)}%"></i><span>${WD[parseKey(x.k).getDay()][0]}</span></div>`).join('');
    return `<div class="sv-stats"><div><b class="num">${st.charge}%</b><span>today</span></div><div><b class="num">${st.streak}</b><span>day streak</span></div><div><b class="num">${st.best}</b><span>best</span></div></div>
      <div class="card sv-week">${bars}</div>
      <p class="note" style="margin:6px 0 0">Charge comes from your ${svChargeParts()} each day. ${FULL}% or more keeps the streak.</p>
      <p class="label">What I’ve noticed</p>
      ${nz.length ? `<div class="card sv-notes">${nz.map(x => `<div class="sv-note"><p>${esc(x.text)}</p><div class="sv-acts">${x.btn}<button class="linkbtn" data-act="sv-dismiss" data-id="${esc(x.id)}">Not now</button></div></div>`).join('')}</div>`
        : `<p class="muted" style="margin:4px 0 0">${esc(svGreeting())}</p>`}
      <p class="label">Your goals</p>
      <p class="note" style="margin:0 0 6px">I’ll remind you of these and keep you accountable to them.</p>
      ${sv.goals.length ? `<ul class="sv-goals">${sv.goals.map(g => `<li><span>${esc(g.text)}</span><button class="iconbtn" data-act="sv-goal-del" data-id="${g.id}" aria-label="Remove goal">×</button></li>`).join('')}</ul>` : ''}
      <form id="svgoalf" class="row" style="gap:8px;margin-top:6px"><input id="svgoal" maxlength="120" placeholder="e.g. Reach 12% body fat by spring" autocomplete="off" style="flex:1"><button class="btn" type="submit">Add</button></form>
      <p class="label">Look &amp; name</p>
      <div class="field"><label>Name</label><input id="svrename" maxlength="24" value="${esc(sv.name)}" autocomplete="off"></div>
      <div class="grid2"><label class="btn" for="svpic">${sv.avatar ? 'Change picture' : 'Choose a picture'}</label>${sv.avatar ? '<button class="btn" data-act="sv-pic-del">Use the orb</button>' : '<span></span>'}</div>
      <input type="file" id="svpic" accept="image/*" hidden>`;
  }

  /* --- chat (through your own push server, which holds the API key) --- */
  const svChatReady = () => !!(PUSH_URL && SV().code);
  const r1sv = n => Math.round((+n || 0) * 10) / 10;
  function svFindRoutine(id) {
    for (const g of GATES) { const r = S.gates[g.id].find(x => x.id === id); if (r) return { gate: g.id, r }; }
    return null;
  }
  const svDate = k => (k === today() ? 'today' : parseKey(k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
  function svToolLine(b) {
    const x = b.input || {};
    switch (b.name) {
      case 'log_food': return ['Log food', `${x.meal} · ${x.name}`, `${Math.round(+x.kcal || 0)} kcal · P ${r1sv(x.protein_g)} · C ${r1sv(x.carbs_g)} · F ${r1sv(x.fat_g)}`];
      case 'log_water': return ['Log water', fmtW(+x.amount_ml || 0), ''];
      case 'add_todo': return ['Add to-do', x.text, [/^\d{4}-\d{2}-\d{2}$/.test(x.date) ? svDate(x.date) : '', /^\d{2}:\d{2}$/.test(x.time) ? clock(x.time) : ''].filter(Boolean).join(' · ')];
      case 'move_routine': { const f = svFindRoutine(x.routine_id); return ['Move routine', f ? f.r.title : 'A routine that no longer exists', f && /^\d{2}:\d{2}$/.test(x.time) ? `${clock(f.r.start)} → ${clock(x.time)}` : '']; }
      case 'log_weight': return ['Log weight', `${r1sv(x.weight)} lb`, 'today'];
      case 'add_goal': return ['Save goal', x.text, ''];
      default: return ['Suggestion', b.name, ''];
    }
  }
  // apply an accepted suggestion; returns what to say, or null if it can't be applied
  function svApply(b) {
    const x = b.input || {}, num = (v, lo, hi) => Math.min(hi, Math.max(lo, +v || 0));
    switch (b.name) {
      case 'log_food':
        logFood(MEALS.includes(x.meal) ? x.meal : mealNow(), { name: String(x.name || 'Food').slice(0, 80), kcal: num(x.kcal, 0, 5000), p: num(x.protein_g, 0, 500), c: num(x.carbs_g, 0, 800), f: num(x.fat_g, 0, 400) }, 1, 'chat', null, today());
        return `Logged ${String(x.name || 'food').slice(0, 40)}`;
      case 'log_water': { const ml = num(x.amount_ml, 0, 3000); if (!ml) return null; addWater(ml); return `Logged ${fmtW(ml)} of water`; }
      case 'add_todo': {
        const text = String(x.text || '').trim().slice(0, 200); if (!text) return null;
        const date = /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : null, time = date && /^\d{2}:\d{2}$/.test(x.time) ? x.time : null;
        S.todos.push({ id: uid(), text, date, time, done: false, doneAt: null, created: Date.now() }); save();
        return 'Added to your to-do list';
      }
      case 'move_routine': {
        const f = svFindRoutine(x.routine_id); if (!f || !/^\d{2}:\d{2}$/.test(x.time)) return null;
        f.r.start = x.time; save();
        return `${f.r.title} now starts at ${clock(x.time)}`;
      }
      case 'log_weight': { const w = num(x.weight, 0, 1500); if (!w) return null; B().entries.push({ id: uid(), t: Date.now(), date: today(), weight: r1sv(w) }); save(); return `Logged ${r1sv(w)} lb`; }
      case 'add_goal': { const text = String(x.text || '').trim().slice(0, 120); if (!text) return null; SV().goals.push({ id: uid(), text, t: Date.now() }); save(); return 'Goal saved'; }
    }
    return null;
  }

  // what the companion knows about your day, sent with each message
  function svSnapshot() {
    const k = today(), d = pdayDate(), now = new Date(), st = svStats(), L = [];
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
    L.push(`now: ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}, ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}${tz ? ` (${tz})` : ''}`);
    L.push(`app day: ${k} (a new day starts at ${clock(fromMinHM(dayStart()))})`);
    L.push(`your name: ${svName()}`);
    L.push(`your charge today: ${st.charge}% (from ${svChargeParts()}); days in a row at ${FULL}%+: ${st.streak}; best: ${st.best}`);
    L.push(`charge, last 7 days (oldest first): ${st.days.map(x => (x.c == null ? '-' : x.c + '%')).join(', ')}`);
    L.push(SV().goals.length ? 'their goals:\n' + SV().goals.map(g => `- ${g.text}`).join('\n') : 'their goals: none set yet');
    const items = allRoutines();
    L.push('routines today:' + (items.length ? '' : ' none'));
    for (const { gate, r } of items) {
      const s = status(r), fin = finOf(r.id);
      const x = s === 'done' ? (fin ? `done at ${hm(fin)}${finText(r).late ? ' (late)' : ''}` : 'done') : s === 'now' ? 'in progress now' : s === 'upcoming' ? 'upcoming' : 'overdue, not done yet';
      L.push(`- [${r.id}] ${clock(startFor(r))} ${r.title} (${gateOf(gate).name}, ${dur(total(r))}): ${x}`);
    }
    const sk = activeGates().flatMap(g => S.gates[g.id].filter(r => scheduledOn(r, d) && skipped(r.id)).map(r => r.title));
    if (sk.length) L.push('skipped today on purpose: ' + sk.join(', '));
    const others = activeGates().flatMap(g => S.gates[g.id].filter(r => !scheduledOn(r, d)).map(r => `[${r.id}] ${r.title} (${g.name}, ${repeatText(r)} at ${clock(r.start)})`));
    if (others.length) L.push('routines not on today: ' + others.join('; '));
    if (on('water')) { const w = wState(); L.push(`water: ${fmtW(w.got)} of ${fmtW(w.target)} so far; on pace would be ${fmtW(w.expected)}; usual glass ${fmtW(W().pour)}`); }
    if (on('macros')) {
      const t = nTotals(k), g = goalsFor(k), log = nLog(k);
      L.push(`food today (calories are the main focus; protein matters too): ${Math.round(t.kcal)} kcal, protein ${Math.round(t.p)}g, carbs ${Math.round(t.c)}g, fat ${Math.round(t.f)}g. Goals: ${g.kcal} kcal, protein ${g.p}g, carbs ${g.c}g, fat ${g.f}g`);
      if (log.length) L.push('eaten today: ' + log.map(e => `${e.meal}: ${e.name}${e.qty !== 1 ? ` ×${e.qty}` : ''} (${Math.round(e.kcal * e.qty)} kcal)`).join('; '));
      const foods = N().foods.slice(0, 25);
      if (foods.length) L.push('saved foods (per serving): ' + foods.map(f => `${f.name}: ${Math.round(+f.kcal || 0)} kcal, P ${r1sv(f.p)}, C ${r1sv(f.c)}, F ${r1sv(f.f)}`).join('; '));
    }
    if (on('workouts')) {
      const wl = [...WK().log].sort((a, b) => b.t - a.t).slice(0, 4);
      L.push(wl.length ? 'recent workouts: ' + wl.map(w => `${w.date} ${w.title || 'Workout'} (${(w.items || []).map(i => i.name).slice(0, 6).join(', ')})`).join('; ') : 'recent workouts: none logged');
    }
    if (on('body')) {
      const lw = latestWith('weight'), bf = latestBF();
      L.push(`body: ${lw ? `latest weight ${lw.weight} lb on ${lw.date}` : 'no weight logged'}${bf ? `; body fat ${bf.bf}% on ${bf.e.date}` : ''}; phase: ${B().phase.mode}`);
    }
    if (on('todo')) {
      const td = S.todos.filter(x => !x.done && x.date && x.date <= k);
      L.push(td.length ? 'to-dos due or overdue: ' + td.slice(0, 10).map(x => `${x.text} (${x.date === k ? 'today' : 'overdue since ' + x.date}${x.time ? ' ' + clock(x.time) : ''})`).join('; ') : 'to-dos due: none');
    }
    const nz = svNudges().filter(x => !x.id.startsWith('goal:')).map(x => x.text);
    if (nz.length) L.push('things the app noticed: ' + nz.join(' | '));
    L.push(`units: water ${W().unit}, weight lb`);
    return L.join('\n');
  }

  const HISTORY = 30;
  // Only the last HISTORY messages are ever sent again, so older ones keep just what the chat shows.
  function svCompact(log) {
    for (let i = 0; i < log.length - HISTORY - 2; i++) {
      const m = log[i];
      if (m.compact) continue;
      m.content = m.content.filter(b => !(b.type === 'thinking' || b.type === 'redacted_thinking' || (b.type === 'text' && b.text.startsWith('<app_state>'))));
      m.compact = true;
    }
  }
  // the conversation as sent: recent turns only, starting on a user turn; earlier thinking is dropped from the front
  function svHistory() {
    let log = SV().chat.log.slice(-HISTORY);
    while (log.length && log[0].role !== 'user') log = log.slice(1);
    const lastA = log.map(m => m.role).lastIndexOf('assistant');
    return log.map((m, i) => {
      let content = m.content;
      if (i === 0) content = content.filter(b => b.type !== 'tool_result');   // its suggestion was trimmed away
      if (m.role === 'assistant' && i !== lastA) content = content.filter(b => b.type !== 'thinking' && b.type !== 'redacted_thinking');
      return { role: m.role, content };
    });
  }
  const SV_ERR = { not_configured: 'Chat isn’t switched on on your server yet.', bad_code: 'That pairing code didn’t work. Check it in the Chat tab.', daily_limit: 'We’ve hit today’s chat limit. Talk tomorrow!',
                   busy: 'I’m a bit overloaded. Try again in a minute.', bad_api_key: 'The server’s API key isn’t working.', too_large: 'This chat got too long. Clear it and start fresh.' };
  async function svRequest() {
    const c = SV().chat;
    V.svBusy = true; V.svErr = null; render(); svScroll();
    try {
      const res = await fetch(PUSH_URL + '/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Companion-Code': SV().code }, body: JSON.stringify({ messages: svHistory() }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(SV_ERR[out.error] || `Couldn’t get an answer (${res.status}).`);
      const content = (out.content || []).filter(b => ['text', 'tool_use', 'thinking', 'redacted_thinking'].includes(b.type));
      if (!content.some(b => (b.type === 'text' && b.text.trim()) || b.type === 'tool_use'))
        content.push({ type: 'text', text: out.stop_reason === 'refusal' ? 'I can’t help with that one, but I’m here for anything else.' : '…' });
      c.log.push({ role: 'assistant', t: Date.now(), content });
      svCompact(c.log);
      if (c.log.length > 200) { c.log.splice(0, c.log.length - 200); while (c.log.length && c.log[0].role !== 'user') c.log.shift(); }
      save();
    } catch (e) { V.svErr = e.message && !/fetch|network/i.test(e.message) ? e.message : 'Couldn’t reach your companion. Check your connection.'; }
    V.svBusy = false; render(); svScroll();
  }
  async function svSend(text) {
    const c = SV().chat;
    // an unanswered message (it failed) is replaced by this one
    if (c.log.length && c.log[c.log.length - 1].role === 'user') c.log.pop();
    const last = c.log[c.log.length - 1], results = [];
    if (last && last.role === 'assistant') for (const b of last.content) if (b.type === 'tool_use') {
      if (!c.props[b.id]) c.props[b.id] = 'ignored';
      const s = c.props[b.id];
      results.push({ type: 'tool_result', tool_use_id: b.id, content: s === 'accepted' ? 'The user accepted; it is now saved in the app.' : s === 'skipped' ? 'The user skipped this suggestion; nothing was changed.' : 'The user moved on without accepting; nothing was changed.' });
    }
    c.log.push({ role: 'user', t: Date.now(), text, content: [...results, { type: 'text', text: `<app_state>\n${svSnapshot()}\n</app_state>` }, { type: 'text', text }] });
    save();
    await svRequest();
  }
  function svScroll() { requestAnimationFrame(() => { const el = document.querySelector('.sv-msgs'); if (el) el.scrollTop = el.scrollHeight; }); }
  // light formatting for replies: paragraphs, line breaks, **bold**, simple lists
  const svFormat = t => esc(t.trim()).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

  function svChatView() {
    if (!PUSH_URL) return '<p class="note">Chat needs the reminder server, which isn’t set up in this copy of the app.</p>';
    if (!SV().code) return `<p class="note">Chat lets you talk to ${esc(svName())}: ask how you’re doing, tell it what you ate, or ask it to move a routine. It suggests changes as cards you accept or skip.</p>
      <p class="note">It runs through your own server, which keeps the API key. Enter the pairing code from your server setup once on this device.</p>
      <form id="svcodef"><div class="field"><label>Pairing code</label><input id="svcode" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="xxxx-xxxx-xxxx-xxxx"></div>
      <button class="btn primary block" type="submit">Connect</button></form>`;
    const c = SV().chat, lastA = c.log.map(m => m.role).lastIndexOf('assistant');
    const msgs = c.log.map((m, i) => {
      if (m.role === 'user') return m.text ? `<div class="sv-msg me">${svFormat(m.text)}</div>` : '';
      return m.content.map(b => {
        if (b.type === 'text' && b.text.trim()) return `<div class="sv-msg them">${svFormat(b.text)}</div>`;
        if (b.type !== 'tool_use') return '';
        const [kind, main, sub] = svToolLine(b), s = c.props[b.id] || (i === lastA ? '' : 'ignored');
        return `<div class="sv-prop ${s}"><div class="k">${esc(kind)}</div><div class="m">${esc(main)}</div>${sub ? `<div class="s num">${esc(sub)}</div>` : ''}
          ${s === 'accepted' ? '<div class="st">✓ Done</div>' : s === 'skipped' ? '<div class="st">Skipped</div>' : s === 'ignored' ? '<div class="st">Not applied</div>'
            : `<div class="grid2"><button class="btn small" data-act="sv-skip" data-id="${esc(b.id)}">Skip</button><button class="btn small primary" data-act="sv-accept" data-id="${esc(b.id)}">Accept</button></div>`}</div>`;
      }).join('');
    }).join('');
    return `<div class="sv-msgs">${msgs || `<div class="sv-msg them"><p>Hi, I’m ${esc(svName())}. How’s your day going? You can tell me what you ate, ask how you’re doing on your goals, or ask me to adjust a routine.</p></div>`}
        ${V.svBusy ? '<div class="sv-msg them typing"><i></i><i></i><i></i></div>' : ''}
        ${V.svErr ? `<div class="sv-err">${esc(V.svErr)} <button class="linkbtn" data-act="sv-retry">Try again</button></div>` : ''}</div>
      <form id="svchatf" class="sv-input"><input id="svmsg" maxlength="2000" placeholder="Message ${esc(svName())}" autocomplete="off" enterkeyhint="send" ${V.svBusy ? 'disabled' : ''}><button class="btn primary" type="submit" ${V.svBusy ? 'disabled' : ''} aria-label="Send">Send</button></form>
      <div class="row spread" style="margin-top:8px"><button class="linkbtn" data-act="sv-clear">Clear chat</button><button class="linkbtn" data-act="sv-code-forget">Disconnect</button></div>`;
  }

  /* --- companion events --- */
  $app.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || !el.dataset.act.startsWith('sv-')) return;
    const act = el.dataset.act, sv = SV();
    switch (act) {
      case 'sv-open': V.data = false; V.sv = V.sv || 'home'; V.svFresh = true; render(); V.svFresh = false; break;
      case 'sv-close-bg': if (e.target !== el) break;   // falls through
      case 'sv-close': V.sv = null; V.svErr = null; render(); break;
      case 'sv-tab': if (!svBorn()) break; V.sv = el.dataset.v; if (V.sv === 'chat' && sv.unread) { sv.unread = false; save(); } if (!document.querySelector('.sv-sheet')) { V.svFresh = true; render(); V.svFresh = false; } else render(); if (V.sv === 'chat') svScroll(); break;
      case 'sv-create': {
        const name = (document.getElementById('svname').value || '').trim();
        if (!name) { snack('Give your companion a name first.'); break; }
        sv.name = name.slice(0, 24); sv.born = Date.now(); save(); render();
        snack(`${sv.name} is here.`);
        break;
      }
      case 'sv-dismiss': {
        const k = today();
        for (const kk of Object.keys(sv.dismissed)) if (kk < keyOf(addDays(pdayDate(), -3))) delete sv.dismissed[kk];
        const dk = (sv.dismissed[k] = sv.dismissed[k] || {});
        dk[el.dataset.id] = true;
        save(); render(); break;
      }
      case 'sv-go': {
        const v = el.dataset.v;
        V.sv = null;
        if (v === 'body') V.tab = 'body'; else { V.tab = 'gates'; V.gate = v; V.gateFx = true; }
        render(); scrollTo(0, 0); break;
      }
      case 'sv-timeline': V.sv = null; V.tab = 'today'; V.cal = 'day'; render(); setTimeout(() => { const t = document.querySelector('.tl .it.open'); if (t) t.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60); break;
      case 'sv-shift': {
        const r = findRoutine(el.dataset.gate, el.dataset.id), to = el.dataset.v;
        if (r) undoable(`${r.title} now starts at ${clock(to)}`, () => { r.start = to; });
        break;
      }
      case 'sv-goal-del': undoable('Goal removed', () => { sv.goals = sv.goals.filter(g => g.id !== el.dataset.id); }); break;
      case 'sv-pic-del': sv.avatar = null; save(); render(); break;
      case 'sv-code-forget': sv.code = ''; save(); render(); break;
      case 'sv-retry': if (!V.svBusy) svRequest(); break;
      case 'sv-clear':
        ask({ title: 'Clear the chat?', text: `${svName()} forgets this conversation. Your goals and data stay.`, ok: 'Clear', danger: true })
          .then(y => { if (y) { sv.chat = { log: [], props: {} }; V.svErr = null; save(); render(); } });
        break;
      case 'sv-accept': case 'sv-skip': {
        const id = el.dataset.id, b = sv.chat.log.flatMap(m => (m.role === 'assistant' ? m.content : [])).find(x => x.type === 'tool_use' && x.id === id);
        if (!b || sv.chat.props[id]) break;
        if (act === 'sv-skip') { sv.chat.props[id] = 'skipped'; save(); render(); break; }
        const said = svApply(b);
        sv.chat.props[id] = said ? 'accepted' : 'skipped'; save(); render();
        snack(said || 'That suggestion couldn’t be applied.');
        buzz();
        break;
      }
    }
  });
  $app.addEventListener('submit', e => {
    const f = e.target;
    if (f.id === 'svgoalf') {
      e.preventDefault();
      const inp = document.getElementById('svgoal'), text = inp.value.trim();
      if (!text) return;
      SV().goals.push({ id: uid(), text: text.slice(0, 120), t: Date.now() }); inp.value = ''; save(); render();
    }
    if (f.id === 'svcodef') {
      e.preventDefault();
      const code = document.getElementById('svcode').value.trim();
      if (code.length < 8) return snack('That code looks too short.');
      SV().code = code; save(); render();
      setTimeout(pullInbox, 300);
    }
    if (f.id === 'svchatf') {
      e.preventDefault();
      const inp = document.getElementById('svmsg'), text = inp.value.trim();
      if (!text || V.svBusy) return;
      inp.value = '';
      svSend(text.slice(0, 2000));
    }
  });
  $app.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'svpic' && t.files && t.files[0]) { svSetPicture(t.files[0]); t.value = ''; }
    if (t.id === 'svrename' && t.value.trim()) { SV().name = t.value.trim().slice(0, 24); save(); render(); }
  });
