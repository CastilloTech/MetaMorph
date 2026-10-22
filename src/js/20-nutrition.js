  /* ----- nutrition: calories & macros ----- */

  const N = () => S.nutri;
  const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
  const MAC = [['kcal', 'Calories', ' kcal'], ['p', 'Protein', 'g'], ['c', 'Carbs', 'g'], ['f', 'Fat', 'g']];
  const MCOL = { kcal: 'var(--gc)', p: '#ff7a59', c: '#f2c14e', f: '#6fb7ff' };
  const r1 = n => Math.round(n * 10) / 10;
  const kcalOf = (p, c, f) => Math.round(4 * p + 4 * c + 9 * f);
  const nLog = (k = today()) => N().log[k] || [];
  const nTotals = (k = today()) => nLog(k).reduce((t, e) => { for (const [m] of MAC) t[m] += e[m] * e.qty; return t; }, { kcal: 0, p: 0, c: 0, f: 0 });
  const macLine = (x, q = 1) => `${Math.round(x.kcal * q)} kcal · P ${r1(x.p * q)} · C ${r1(x.c * q)} · F ${r1(x.f * q)}`;
  function mealNow() { const h = new Date().getHours(); return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 21 ? 'Dinner' : 'Snacks'; }
  const nk = () => V.nday || today();       // the day being viewed in Fuel
  function goalsFor(k) {
    const h = N().goalHist.filter(x => x.from <= k);
    return h.length ? h[h.length - 1].goals : N().goals;
  }
  function logFood(meal, item, qty, src, ref, k = nk()) {
    (N().log[k] = N().log[k] || []).push({ id: uid(), t: Date.now(), meal, name: item.name, qty,
      kcal: +item.kcal || 0, p: +item.p || 0, c: +item.c || 0, f: +item.f || 0, src, ref: ref || null, ...(item.items ? { items: item.items } : {}) });
    if (src === 'prep') { const pr = N().preps.find(x => x.id === ref); if (pr) pr.left = Math.max(0, r1(pr.left - qty)); }
    save();
  }

  const mealTotals = items => items.reduce((t, x) => { for (const [m] of MAC) t[m] += (+x[m] || 0) * (+x.qty || 1); return t; }, { kcal: 0, p: 0, c: 0, f: 0 });

  function nutritionPanel() {
    const n = N(), k = nk(), isToday = k === today(), tot = nTotals(k), g = goalsFor(k), log = nLog(k);
    const bars = MAC.map(([m, label, u]) => {
      const pct = g[m] ? Math.min(100, 100 * tot[m] / g[m]) : 0, over = g[m] && tot[m] > g[m] * 1.02;
      return `<div class="mac"><div class="row spread"><span>${label}</span><span class="num muted"><b class="${over ? 'late' : ''}" style="color:var(--text)">${Math.round(tot[m]).toLocaleString()}</b> / ${g[m].toLocaleString()}${u}</span></div>
        <div class="mbar"><i class="${over ? 'over' : ''}" style="width:${pct}%;background:${MCOL[m]}"></i></div></div>`;
    }).join('');
    const meals = MEALS.map(meal => {
      const es = log.filter(e => e.meal === meal), mk = es.reduce((t, e) => t + e.kcal * e.qty, 0);
      return `<div class="meal"><div class="row spread"><b>${meal}</b><span class="row" style="gap:10px"><span class="muted num" style="font-size:13px">${Math.round(mk)} kcal</span><button class="btn small" data-act="n-add" data-meal="${meal}">+ Add</button></span></div>
        ${es.length ? `<ul class="flog">${es.map(e => `<li><span><div>${esc(e.name)}${e.qty !== 1 ? ` <span class="muted">× ${r1(e.qty)}</span>` : ''}${e.items ? ` <span class="mtag">MEAL · ${e.items.length}</span>` : ''}</div><div class="t num">${macLine(e, e.qty)}</div></span><button data-act="n-del" data-id="${e.id}" aria-label="Remove">✕</button></li>`).join('')}</ul>` : ''}
        ${es.length > 1 ? `<button class="linkbtn" data-act="n-savemeal" data-meal="${meal}" style="margin-top:4px">Save as a meal</button>` : ''}</div>`;
    }).join('');
    const preps = n.preps.filter(x => x.left > 0 || Date.now() - x.created < 7 * DAY);
    return `
      <div class="sechead"><h3>Fuel</h3><button class="linkbtn" data-act="n-goals">Daily goals</button></div>
      <div class="calnav"><button class="arrow" data-act="n-day" data-d="-1" aria-label="Previous day">‹</button>
        <div class="ttl">${isToday ? 'Today' : esc(dayLabel(k))}<small>${isToday ? esc(parseKey(k).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })) : '<button class="linkbtn" data-act="n-day-today">Back to today</button>'}</small></div>
        <button class="arrow" data-act="n-day" data-d="1" aria-label="Next day" ${isToday ? 'disabled' : ''}>›</button></div>
      <div class="card" style="--gc:${gateOf('nutrition').color}">${bars}</div>
      <div class="card">${meals}</div>
      ${myMealsPanel()}
      ${nutriHistory()}
      <div class="sechead"><h3>Meal prep</h3><button class="linkbtn" data-act="n-prep-new">+ New prep</button></div>
      ${preps.length ? preps.map(x => `<div class="card" style="--gc:${gateOf('nutrition').color}"><div class="row spread" style="align-items:flex-start"><div>
          <b>${esc(x.name)}</b>
          <div class="muted num" style="font-size:13px">${r1(x.left)}/${x.portions} portions left · made ${dayLabel(x.made)}</div>
          <div class="muted num" style="font-size:13px">Per portion: ${macLine(x.per)}</div></div>
          <div class="row" style="gap:6px"><button class="btn small ghost" data-act="n-prep-del" data-id="${x.id}" aria-label="Delete prep">✕</button><button class="btn small primary" data-act="n-prep-log" data-id="${x.id}" ${x.left > 0 ? '' : 'disabled'}>Eat 1</button></div></div>
          <div class="mbar" style="margin-top:10px"><i style="width:${100 * x.left / x.portions}%"></i></div></div>`).join('')
        : '<p class="muted" style="margin:0 0 12px">Cook once, log portions all week. Add a prep to start.</p>'}`;
  }

  function myMealsPanel() {
    const ms = N().meals;
    return `<div class="sechead"><h3>My meals</h3><button class="linkbtn" data-act="n-meal-new">+ New meal</button></div>
      ${ms.length ? `<div class="card"><ul class="flog">${ms.map(m => { const t = mealTotals(m.items); return `<li><span>
          <div style="font-weight:600">${esc(m.name)}</div>
          <div class="t num">${macLine(t)}</div>
          <div class="t">${m.items.map(x => esc(x.name)).join(' · ')}</div></span>
          <span class="row" style="gap:6px"><button class="btn small ghost" data-act="n-meal-del" data-id="${m.id}" aria-label="Delete meal">✕</button><button class="btn small primary" data-act="n-meal-log" data-id="${m.id}">Log</button></span></li>`; }).join('')}</ul></div>`
        : '<p class="muted" style="margin:0 0 12px">Combine foods you eat together (like a usual breakfast) and log them in one tap. Build one here, or tap “Save as a meal” under any meal you’ve logged.</p>'}`;
  }

  function nutriHistory() {
    const n = V.nhist, end = parseKey(today());
    const days = Array.from({ length: n }, (_, i) => keyOf(addDays(end, i - n + 1)));
    const rows = days.map(k => ({ k, t: nTotals(k), g: goalsFor(k), logged: nLog(k).length > 0 }));
    const logged = rows.filter(r => r.logged);
    const mx = Math.max(...rows.map(r => Math.max(r.t.kcal, r.g.kcal || 0)), 1) * 1.1;
    const avgOf = m => logged.length ? Math.round(logged.reduce((a, r) => a + r.t[m], 0) / logged.length) : null;
    const onTarget = logged.filter(r => r.g.kcal && Math.abs(r.t.kcal - r.g.kcal) <= r.g.kcal * 0.1).length;
    const proteinHit = logged.filter(r => r.g.p && r.t.p >= r.g.p * 0.95).length;
    return `<div class="sechead"><h3>History</h3><div class="opts">${[7, 30].map(d => `<button data-act="n-hist" data-v="${d}" class="${n === d ? 'on' : ''}">${d}d</button>`).join('')}</div></div>
      <div class="card" style="--gc:${gateOf('nutrition').color}">
        <div class="nhist" style="--n:${n}">${rows.map(r => `<button class="col ${r.k === nk() ? 'sel' : ''}" data-act="n-goto" data-v="${r.k}" aria-label="${esc(dayLabel(r.k))}: ${Math.round(r.t.kcal)} kcal">
          <span class="bw"><span class="gl" style="bottom:${100 * (r.g.kcal || 0) / mx}%"></span><span class="b ${r.g.kcal && r.t.kcal > r.g.kcal * 1.1 ? 'over' : ''}" style="height:${100 * r.t.kcal / mx}%"></span></span>
          ${n <= 7 ? `<span class="lbl">${WD[parseKey(r.k).getDay()][0]}</span>` : ''}</button>`).join('')}</div>
        <p class="muted" style="font-size:12px;margin:6px 0 10px">Bars are calories; the dashed mark is that day’s goal. Tap a day to open it.</p>
        <div class="stats4">
          <div><b>${avgOf('kcal') ?? '—'}</b><span>Avg kcal</span></div>
          <div><b>${avgOf('p') ?? '—'}${avgOf('p') != null ? 'g' : ''}</b><span>Avg protein</span></div>
          <div><b>${logged.length ? `${onTarget}/${logged.length}` : '—'}</b><span>Calories ±10%</span></div>
          <div><b>${logged.length ? `${proteinHit}/${logged.length}` : '—'}</b><span>Protein hit</span></div>
        </div>
      </div>`;
  }

  function mealSheet() {
    const e = V.nmeal, n = N(), t = mealTotals(e.items);
    return `<div class="sheet-bg ${e.fresh ? 'enter' : ''}" data-act="n-meal-cancel-bg">
      <form class="sheet" id="nmealf" autocomplete="off"><div class="grab" aria-hidden="true"></div>
        <h2>${e.id ? 'Save meal' : 'New meal'}</h2>
        <div class="field"><label>Name</label><input name="name" required value="${esc(e.name)}" placeholder="Usual breakfast" autocapitalize="sentences"></div>
        <p class="label">In this meal</p>
        ${e.items.length ? `<ul class="flog" style="margin:0 0 10px">${e.items.map((x, i) => `<li><span><div>${esc(x.name)}${(+x.qty || 1) !== 1 ? ` <span class="muted">× ${r1(+x.qty)}</span>` : ''}</div><div class="t num">${macLine(x, +x.qty || 1)}</div></span><button type="button" data-act="n-meal-rm" data-i="${i}" aria-label="Remove">✕</button></li>`).join('')}</ul>` : '<p class="muted" style="margin:0 0 10px">Nothing yet. Add saved foods below.</p>'}
        ${n.foods.length ? `<div class="custom" style="margin:0 0 8px"><select name="pickfood" aria-label="Saved food">${n.foods.map(x => `<option value="${x.id}">${esc(x.name)}${x.serving ? ` (${esc(x.serving)})` : ''}</option>`).join('')}</select><input name="pickqty" type="number" inputmode="decimal" min="0.25" step="any" value="1" style="width:80px" aria-label="Servings"></div>
          <button class="btn block" type="button" data-act="n-meal-addfood" style="margin-bottom:8px">+ Add from my foods</button>` : '<p class="note" style="margin:0 0 8px">Save some foods first (Add → New food or Look up), then combine them here.</p>'}
        <div class="preptot num"><b>Meal total:</b> ${macLine(t)}</div>
        <button class="btn primary block" type="submit" style="margin-bottom:8px">Save meal</button>
        <button class="btn block" type="button" data-act="n-meal-cancel">Cancel</button>
      </form></div>`;
  }

  function addFoodSheet() {
    const a = V.nadd, n = N(), q = a.q.toLowerCase();
    const rows = [
      ...n.meals.map(x => ({ kind: 'meal', id: x.id, name: x.name, sub: `Meal · ${x.items.length} item${x.items.length === 1 ? '' : 's'}`, ...mealTotals(x.items) })),
      ...n.preps.filter(x => x.left > 0).map(x => ({ kind: 'prep', id: x.id, name: x.name, sub: `Meal prep · ${r1(x.left)} left`, ...x.per })),
      ...n.foods.map(x => ({ kind: 'food', id: x.id, name: x.name, sub: x.serving || '1 serving', kcal: x.kcal, p: x.p, c: x.c, f: x.f })),
    ];
    const pf = a.prefill || {};
    const fld = (name, label, extra = '') => `<div class="field"><label>${label}</label><input name="${name}" type="number" inputmode="decimal" min="0" step="any" value="${pf[name] ?? ''}" ${extra}></div>`;
    return `<div class="sheet-bg ${a.fresh ? 'enter' : ''}" data-act="n-cancel-bg"><div class="sheet"><div class="grab" aria-hidden="true"></div>
      <h2>Add to ${a.meal}</h2>
      <div class="seg">${[['saved', 'Saved'], ['search', 'Look up'], ['new', 'New food']].map(([k, l]) => `<button data-act="n-mode" data-v="${k}" class="${a.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${a.mode === 'search' ? lookupPane(a) : a.mode === 'saved' ? `
        <div class="row spread" style="margin-bottom:10px"><span class="muted" style="font-size:14px">Servings</span>
          <span class="qty"><button data-act="n-qty" data-d="-0.5" aria-label="Fewer">−</button><b class="num">${r1(a.qty)}</b><button data-act="n-qty" data-d="0.5" aria-label="More">+</button></span></div>
        <input id="nsearch" class="search" type="search" enterkeyhint="search" placeholder="Search saved foods and preps" value="${esc(a.q)}" autocomplete="off">
        <ul class="foodlist">${rows.map(x => `<li data-name="${esc(x.name.toLowerCase())}" ${q && !x.name.toLowerCase().includes(q) ? 'hidden' : ''}>
            <span><div>${esc(x.name)}</div><div class="t num">${esc(x.sub)} · ${macLine(x)}</div></span>
            <span class="row" style="gap:6px">${x.kind === 'food' ? `<button class="btn small ghost" data-act="n-food-del" data-id="${x.id}" aria-label="Forget this food">✕</button>` : ''}<button class="btn small primary" data-act="n-pick" data-kind="${x.kind}" data-id="${x.id}">Add</button></span></li>`).join('')
          || '<li><span class="muted">Nothing saved yet. Use “New food”.</span></li>'}</ul>` : `
        <form id="nnew" autocomplete="off">
          ${pf.name ? '<p class="note" style="margin:0 0 10px">Filled in from Open Food Facts. Check it against the label and adjust if needed.</p>' : ''}
          <div class="grid2"><div class="field"><label>Name</label><input name="name" required value="${esc(pf.name || '')}"></div><div class="field"><label>Serving</label><input name="serving" placeholder="1 cup, 100 g…" value="${esc(pf.serving || '')}"></div></div>
          <div class="grid4">${fld('kcal', 'kcal', 'placeholder="auto"')}${fld('p', 'Protein g')}${fld('c', 'Carbs g')}${fld('f', 'Fat g')}</div>
          <p class="note" style="margin:0 0 12px">Leave calories blank to work them out from the macros (4 / 4 / 9 per gram).</p>
          <div class="field"><label>Servings eaten</label><input name="qty" type="number" inputmode="decimal" min="0.25" step="any" value="1"></div>
          <label class="checkrow"><input type="checkbox" name="keep" checked> Save to my foods</label>
          <button class="btn primary block" type="submit">Add to ${a.meal}</button>
        </form>`}
      <button class="btn ghost block" data-act="n-cancel" style="margin-top:8px">Close</button>
    </div></div>`;
  }

  function goalsSheet() {
    const e = V.ngoals;
    return `<div class="sheet-bg ${e.fresh ? 'enter' : ''}" data-act="n-goals-cancel-bg">
      <form class="sheet" id="ngoalf" autocomplete="off"><div class="grab" aria-hidden="true"></div>
        <h2>Daily goals</h2>
        <div class="grid2">${MAC.map(([m, label, u]) => `<div class="field"><label>${label} (${u.trim()})</label><input name="${m}" type="number" inputmode="numeric" min="0" step="1" value="${e[m]}"></div>`).join('')}</div>
        <button class="btn block" type="button" data-act="n-goals-calc" style="margin-bottom:8px">Set calories from macros</button>
        <button class="btn primary block" type="submit" style="margin-bottom:8px">Save</button>
        <button class="btn block" type="button" data-act="n-goals-cancel">Cancel</button>
      </form></div>`;
  }

  function prepTotals(items) {
    return items.reduce((t, x) => {
      const kc = x.kcal === '' || x.kcal == null ? kcalOf(+x.p || 0, +x.c || 0, +x.f || 0) : +x.kcal;
      t.kcal += kc; t.p += +x.p || 0; t.c += +x.c || 0; t.f += +x.f || 0; return t;
    }, { kcal: 0, p: 0, c: 0, f: 0 });
  }
  function prepTotalsText(e) {
    const t = prepTotals(e.items), n = Math.max(1, +e.portions || 1);
    return `<b>Batch:</b> ${macLine(t)}<br><b>Per portion (${n}):</b> ${macLine({ kcal: t.kcal / n, p: t.p / n, c: t.c / n, f: t.f / n })}`;
  }
  function prepSheet() {
    const e = V.nprep, n = N();
    const v = x => x === '' || x == null ? '' : x;
    return `<div class="sheet-bg ${e.fresh ? 'enter' : ''}" data-act="n-prep-cancel-bg">
      <form class="sheet" id="nprepf" autocomplete="off"><div class="grab" aria-hidden="true"></div>
        <h2>New meal prep</h2>
        <div class="grid2">
          <div class="field"><label>Name</label><input name="name" required value="${esc(e.name)}" placeholder="Chicken &amp; rice"></div>
          <div class="field"><label>Portions</label><input name="portions" type="number" inputmode="numeric" min="1" step="1" value="${e.portions}"></div>
        </div>
        <p class="label">Ingredients · amounts used in the whole batch</p>
        ${e.items.map((x, i) => `<div class="ing">
          <div class="top"><input name="in${i}" value="${esc(x.name)}" placeholder="Ingredient"><button type="button" data-act="n-ing-rm" data-i="${i}" aria-label="Remove ingredient">✕</button></div>
          <div class="lbls"><span>kcal</span><span>Protein g</span><span>Carbs g</span><span>Fat g</span></div>
          <div class="grid4"><input name="ik${i}" type="number" inputmode="decimal" min="0" step="any" value="${v(x.kcal)}" placeholder="auto"><input name="ip${i}" type="number" inputmode="decimal" min="0" step="any" value="${v(x.p)}"><input name="ic${i}" type="number" inputmode="decimal" min="0" step="any" value="${v(x.c)}"><input name="if${i}" type="number" inputmode="decimal" min="0" step="any" value="${v(x.f)}"></div>
        </div>`).join('')}
        <button class="btn block" type="button" data-act="n-ing-add" style="margin-bottom:8px">+ Add ingredient</button>
        ${n.foods.length ? `<div class="custom" style="margin:0 0 8px"><select name="pickfood" aria-label="Saved food">${n.foods.map(x => `<option value="${x.id}">${esc(x.name)}${x.serving ? ` (${esc(x.serving)})` : ''}</option>`).join('')}</select><input name="pickqty" type="number" inputmode="decimal" min="0.25" step="any" value="1" style="width:80px" aria-label="Servings"></div>
          <button class="btn block" type="button" data-act="n-ing-food" style="margin-bottom:8px">+ Add from my foods</button>` : ''}
        <div class="preptot num" id="preptot">${prepTotalsText(e)}</div>
        <button class="btn primary block" type="submit" style="margin-bottom:8px">Save meal prep</button>
        <button class="btn block" type="button" data-act="n-prep-cancel">Cancel</button>
      </form></div>`;
  }
  function syncPrep() {
    const f = document.getElementById('nprepf');
    if (!f || !V.nprep) return;
    const e = V.nprep, el = f.elements;
    e.name = el.name.value;
    e.portions = Math.max(1, Math.round(+el.portions.value || 1));
    e.items.forEach((x, i) => {
      x.name = el['in' + i].value;
      x.kcal = el['ik' + i].value === '' ? '' : +el['ik' + i].value;
      for (const [m, n] of [['p', 'ip'], ['c', 'ic'], ['f', 'if']]) x[m] = el[n + i].value === '' ? '' : +el[n + i].value;
    });
  }

