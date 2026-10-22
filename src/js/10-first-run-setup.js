  /* ----- first-run setup ----- */

  function starterPlan(o) {
    const wake = toMin(o.wake), bed = toMin(o.bed), hhmm = fromMinHM;
    return [
      ['hygiene', 'Morning routine', hhmm(wake), [['Cold water', 2], ['Teeth', 3], ['Skincare', 5]]],
      ['fitness', 'Training', hhmm(wake + 45), [['Warm-up', 10], ['Train', 30], ['Cool-down', 5]]],
      ['nutrition', 'Breakfast', hhmm(wake + 90), [['Eat', 20]]],
      ['nutrition', 'Lunch', '12:30', [['Eat', 30]]],
      ['nutrition', 'Dinner', '18:30', [['Eat', 30]]],
      ['sleep', 'Night routine', hhmm(bed - 40), [['Tidy the room', 10], ['Wind-down', 30]]],
    ];
  }
  function renderOnboard() {
    const o = V.onboard, n = 4;
    const pips = `<div class="pips">${Array.from({ length: n }, (_, i) => `<i class="${i <= o.step ? 'on' : ''}"></i>`).join('')}</div>`;
    let body, foot;
    if (o.step === 0) {
      body = `${orb('chaos', 160, 'enter hero-orb')}<h1 style="text-align:center">MetaMorph</h1>
        <p class="lead" style="text-align:center">Hold your four Gates: sleep, fitness, nutrition and hygiene. Train your attention. A few minutes a day.</p>`;
      foot = `<button class="btn primary block" data-act="onb-next">Set it up · 1 minute</button><button class="btn ghost block" data-act="onb-skip">Skip and use the examples</button>`;
    } else if (o.step === 1) {
      body = `<h1>Your day</h1><p class="lead">Routines and water reminders are timed around these.</p>
        <div class="grid2"><div class="field"><label>Wake up</label><input type="time" id="onb-wake" value="${o.wake}"></div><div class="field"><label>Bed</label><input type="time" id="onb-bed" value="${o.bed}"></div></div>`;
      foot = `<button class="btn primary block" data-act="onb-next">Next</button><button class="btn ghost block" data-act="onb-back">Back</button>`;
    } else if (o.step === 2) {
      body = `<h1>What you’ll use</h1><p class="lead">Turn off anything you don’t need. You can change this later in ⋯.</p><div class="card" style="padding:4px 16px">
        ${[['water', 'Water', 'Sip schedule and reminders'], ['todo', 'To-do', 'Tasks'], ['supplies', 'Supplies', 'Groceries and hygiene products'], ['practice', 'Practice', 'Feature Law and Switch Drill'],
           ['other', 'Other', 'Activities outside the Gates'], ['workouts', 'Workout log', 'Sets, reps, PRs'], ['macros', 'Calories & macros', 'Food lookup and meal prep'], ['body', 'Body', 'Weight, body fat, bulk/cut, photos']].map(([k, l, d]) =>
          `<label class="switch"><span>${l}<small>${d}</small></span><input type="checkbox" data-onbsec="${k}" ${o.sections[k] ? 'checked' : ''}></label>`).join('')}</div>`;
      foot = `<button class="btn primary block" data-act="onb-next">Next</button><button class="btn ghost block" data-act="onb-back">Back</button>`;
    } else {
      const plan = starterPlan(o);
      body = `<h1>Starter routines</h1><p class="lead">A simple routine for each Gate. Edit or replace them anytime.</p><div class="card" style="padding:4px 16px">
        ${['hygiene', 'fitness', 'nutrition', 'sleep'].map(g => {
          const items = plan.filter(x => x[0] === g);
          return `<label class="starter">${orb(g, 34)}<span><div style="font-weight:600">${items.map(x => esc(x[1])).join(', ')}</div><div class="muted num" style="font-size:13px">${items.map(x => clock(x[2])).join(' · ')}</div></span><input type="checkbox" data-onbstart="${g}" ${o.starters[g] ? 'checked' : ''}></label>`;
        }).join('')}</div>`;
      foot = `<button class="btn primary block" data-act="onb-finish">Finish</button><button class="btn ghost block" data-act="onb-back">Back</button>`;
    }
    view.html = `<div class="onb"><div class="inner">${pips}<div class="body" data-step="${o.step}">${body}</div><div class="foot">${foot}</div></div></div>`;
  }
  function finishOnboard() {
    const o = V.onboard;
    for (const g of ['sleep', 'fitness', 'nutrition', 'hygiene']) S.gates[g] = [];
    for (const [g, title, start, steps] of starterPlan(o)) if (o.starters[g]) S.gates[g].push(routine(title, start, steps.map(([t, m]) => step(t, m))));
    Object.assign(S.water, { wake: o.wake, bed: o.bed, scheduleInit: false });
    S.sections = { ...o.sections };
    S.onboarded = true;
    V.onboard = null;
    save(); render();
    snack('You’re set. Edit anything in Gates.');
  }

