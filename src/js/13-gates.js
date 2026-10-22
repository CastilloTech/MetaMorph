  /* ----- gates ----- */

  function gatesView() {
    const g = gateOf(V.gate);
    const list = sorted(S.gates[V.gate]);
    const now0 = pdayDate();
    const todays = list.filter(r => scheduledOn(r, now0) && !skipped(r.id));
    return `
      <div class="gatebar" style="grid-template-columns:repeat(${activeGates().length}, 1fr)">${activeGates().map(x => {
        const rs = S.gates[x.id].filter(r => scheduledOn(r, now0) && !skipped(r.id)), n = rs.filter(r => isDone(r.id)).length;
        return `<button data-act="gate" data-v="${x.id}" class="${x.id === V.gate ? 'on' : ''}" style="--gc:${x.color}">
          ${orb(x.id, 40)}<span class="nm">${x.name}</span><span class="ct num">${n}/${rs.length}</span></button>`;
      }).join('')}</div>
      <div class="gatehead">${orb(g.id, 92, V.gateFx ? 'enter' : 'spin')}<div>
        <div class="nm" style="color:${g.color}">${g.name}</div>
        <div class="sub">${g.other ? 'Everything outside the four Gates<br>' : ''}${list.length} routine${list.length === 1 ? '' : 's'} · ${dur(list.reduce((t, r) => t + total(r), 0))} · ${todays.filter(r => isDone(r.id)).length}/${todays.length} ${g.other ? 'done' : 'held'} today</div>
      </div></div>
      ${list.map(r => {
        const skip = skipped(r.id), on = scheduledOn(r, now0) && !skip, done = isDone(r.id), now = on && isNow(r) && !done, starts = stepStarts(r), sd = stepsDone(r);
        const fi = done ? finText(r) : null;
        return `<div class="card ${now ? 'now' : ''}" style="--gc:${g.color}${on ? '' : ';opacity:.6'}">
          <div class="rhead">
            <button class="chk ${done ? 'done' : ''}" data-act="toggle" data-id="${r.id}" ${done ? 'disabled' : ''} aria-label="${done ? 'Done (reset from Edit)' : 'Mark routine done'}">✓</button>
            <div>
              <div class="t num">${clock(startFor(r))} – ${fromMin(toMin(startFor(r)) + total(r))} · ${dur(total(r))}${now ? '<span class="tag">now</span>' : ''}${fi ? `<span class="tag ${fi.late ? 'late' : ''}" style="${fi.late ? '' : 'color:var(--ok)'}">${fi.txt}</span>` : ''}</div>
              <div class="ti">${esc(r.title)}</div>
              <div class="t rep">${esc(repeatText(r))}${r.vary && Object.keys(r.times || {}).length ? ` · <span class="tag" style="margin-left:0">times vary</span>` : ''}${skip ? ` · <span class="tag">skipped today</span> <button class="linkbtn" data-act="unskip" data-id="${r.id}">Undo</button>` : on ? '' : ' · <span class="tag">not today</span>'}</div>
            </div>
          </div>
          ${now ? `${clockBar(r, true)}<div class="cleft" data-left="${windowOf(r).end}"></div>` : ''}
          <ul class="chainlist">
            ${r.steps.map((x, i) => `<li class="${isDone(x.id) ? 'done' : ''}">
              <span class="t num">${fromMin(starts[i])}</span><span class="d"></span>
              <span>${esc(x.title)}${x.work ? ` <span class="muted">· ${esc(x.work)}</span>` : ''}</span>
              <span class="m num">${dur(x.minutes)}</span></li>`).join('')}
          </ul>
          <div class="acts">
            <button class="btn small" data-act="edit" data-id="${r.id}">Edit</button>
            ${done ? '<button class="btn small" disabled>Done today</button>' : `<button class="btn small primary" data-act="run" data-gate="${V.gate}" data-id="${r.id}">${sd ? 'Continue' : 'Start'}</button>`}
          </div>
        </div>`;
      }).join('') || `<p class="muted">No ${g.other ? 'activities' : 'routines for ' + g.name} yet.</p>`}
      <button class="btn block" data-act="add">+ Add ${g.other ? 'activity' : g.name + ' routine'}</button>
      ${V.gate === 'nutrition' && on('macros') ? nutritionPanel() : ''}
      ${V.gate === 'fitness' && on('workouts') ? fitnessPanel() : ''}`;
  }

  function editSheet() {
    const e = V.edit, r = e.r, n = r.steps.length;
    const t = total(r);
    return `
      <div class="sheet-bg ${e.fresh ? 'enter' : ''}" data-act="edit-cancel-bg">
        <form class="sheet" id="editform" autocomplete="off"><div class="grab" aria-hidden="true"></div>
          <h2>${e.isNew ? 'New' : 'Edit'} ${gateOf(e.gate).name} routine</h2>
          <div class="grid2">
            <div class="field"><label>Name</label><input name="r_title" required value="${esc(r.title)}" placeholder="Morning routine"></div>
            <div class="field"><label>Usual start</label><input name="r_start" type="time" required value="${esc(r.start)}"></div>
          </div>
          <label class="switch" style="margin-bottom:6px"><span>Different times on some days<small>Leave a day blank to use the usual start</small></span><input type="checkbox" name="r_vary" ${r.vary ? 'checked' : ''}></label>
          ${r.vary ? `<div class="daytimes">${[1, 2, 3, 4, 5, 6, 0].map(i => `<label><span>${WD[i]}</span><input type="time" name="rt${i}" value="${esc((r.times || {})[i] || '')}"></label>`).join('')}</div>` : ''}
          <p class="label" style="margin-top:4px">Repeats</p>
          <div class="chips">
            ${[['daily', 'Every day'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([k, l]) =>
              `<label class="chip"><input type="radio" name="rt" value="${k}" ${r.repeat.type === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}
          </div>
          ${r.repeat.type === 'weekly' ? `<div class="chips days">${[1, 2, 3, 4, 5, 6, 0].map(i =>
              `<label class="chip"><input type="checkbox" name="wd" value="${i}" ${(r.repeat.days || []).includes(i) ? 'checked' : ''}><span>${WD[i].slice(0, 2)}</span></label>`).join('')}</div>` : ''}
          ${r.repeat.type === 'monthly' ? `<div class="chips days">${Array.from({ length: 31 }, (_, j) => j + 1).map(i =>
              `<label class="chip"><input type="checkbox" name="md" value="${i}" ${(r.repeat.dates || []).includes(i) ? 'checked' : ''}><span class="num">${i}</span></label>`).join('')}</div>` : ''}
          <p class="label" style="margin-top:4px">Steps · chained in order</p>
          ${r.steps.map((s, i) => `
            <div class="srow">
              <div class="top">
                <span class="n">${i + 1}</span>
                <input name="st${i}" value="${esc(s.title)}" placeholder="Step" required>
              </div>
              <div class="hm">
                <label><input name="sh${i}" type="number" inputmode="numeric" min="0" max="23" value="${Math.floor(s.minutes / 60)}" aria-label="Hours">hr</label>
                <label><input name="sm${i}" type="number" inputmode="numeric" min="0" max="59" value="${s.minutes % 60}" aria-label="Minutes">min</label>
              </div>
              <input name="sw${i}" value="${esc(s.work)}" placeholder="Ritual line (optional)">
              <div class="tools">
                <button type="button" data-act="s-up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
                <button type="button" data-act="s-down" data-i="${i}" ${i === n - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
                <button type="button" data-act="s-del" data-i="${i}" ${n === 1 ? 'disabled' : ''} aria-label="Remove step">✕</button>
              </div>
            </div>`).join('')}
          <button class="btn block" type="button" data-act="s-add" style="margin-bottom:8px">+ Add step</button>
          <div class="total num">${dur(t)} total · ends ${fromMin(toMin(r.start || '00:00') + t)}${r.vary && Object.keys(r.times || {}).length ? ' on usual days' : ''}</div>
          <button class="btn primary block" type="submit" style="margin-bottom:8px">Save</button>
          <div class="grid2">
            <button class="btn" type="button" data-act="edit-cancel">Cancel</button>
            ${e.isNew ? '<span></span>' : '<button class="btn danger" type="button" data-act="delete">Delete</button>'}
          </div>
          ${!e.isNew && isDone(r.id) ? `<button class="btn ghost block" type="button" data-act="reset-done" style="margin-top:8px">Reset today’s completion${finOf(r.id) ? ` (${finText(r).txt})` : ''}</button>` : ''}
        </form>
      </div>`;
  }

  // pull typed values into V.edit before any re-render of the sheet
  function syncEdit() {
    const f = document.getElementById('editform');
    if (!f || !V.edit) return;
    const r = V.edit.r, el = f.elements;
    r.title = el.r_title.value;
    r.start = el.r_start.value || r.start;
    r.vary = !!(el.r_vary && el.r_vary.checked);
    if (r.vary) {
      const times = {};
      for (const i of [0, 1, 2, 3, 4, 5, 6]) { const inp = el['rt' + i]; const v = inp ? inp.value : (r.times || {})[i]; if (v) times[i] = v; }
      r.times = times;
    }
    r.steps.forEach((s, i) => {
      s.title = el['st' + i].value;
      const h = Math.min(23, Math.max(0, Math.floor(Number(el['sh' + i].value) || 0)));
      const m = Math.min(59, Math.max(0, Math.floor(Number(el['sm' + i].value) || 0)));
      s.minutes = Math.max(1, h * 60 + m);
      s.work = el['sw' + i].value;
    });
    const type = (f.querySelector('input[name=rt]:checked') || {}).value || 'daily';
    const picked = name => [...f.querySelectorAll(`input[name=${name}]:checked`)].map(x => Number(x.value));
    const prev = r.repeat || {};
    r.repeat = { type };
    // keep earlier picks when switching between types, so nothing is lost by tapping around
    r.repeat.days = type === 'weekly' ? picked('wd') : (prev.days || []);
    r.repeat.dates = type === 'monthly' ? picked('md') : (prev.dates || []);
  }

