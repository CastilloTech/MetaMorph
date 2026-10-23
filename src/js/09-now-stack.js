  /* ----- Now: everything waiting on you, in one place ----- */

  const ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  };
  function nowStack() {
    const rows = nowRows();
    return rows.length ? `<div class="card nowstack"><p class="label" style="margin:10px 0 2px">Needs you</p>${rows.join('')}</div>` : '';
  }
  // the rows of the Today list: water due, to-dos, check-ins, the weekly review, an open workout
  function nowRows() {
    const rows = [], k = today();
    const wd = waterDue();
    if (wd) rows.push(`<div class="nowrow"><span class="ic">${DROP}</span><span><div class="tt">Water</div><div class="ss num">${fmtW(wd.next.amount)} due since ${clock(wd.next.time)}</div></span>
      <button class="btn small water" data-act="w-add" data-ml="${wd.next.amount}">Log</button></div>`);
    if (on('todo')) {
      const due = S.todos.filter(x => !x.done && x.date === k).length, over = S.todos.filter(x => !x.done && x.date && x.date < k).length;
      if (due || over) rows.push(`<div class="nowrow"><span class="ic" style="color:var(--text)">${ICON.check}</span><span><div class="tt">To-do</div><div class="ss">${[due ? `${due} due today` : '', over ? `<span class="late">${over} overdue</span>` : ''].filter(Boolean).join(' · ')}</div></span>
        <button class="btn small" data-act="now-todo">Open</button></div>`);
    }
    if (on('practice')) {
      const open = F().items.filter(x => !x.check);
      if (open.length) rows.push(`<div class="nowrow"><span class="ic" style="color:var(--accent)">${ICON.eye}</span><span><div class="tt">Feature Law</div><div class="ss">${open.length} check-in${open.length === 1 ? '' : 's'} waiting</div></span>
        <button class="btn small" data-act="f-check" data-id="${open[0].id}">Check in</button></div>`);
    }
    {
      const d = pdayDate(), dow = d.getDay(), mon = keyOf(addDays(d, -((dow + 6) % 7)));
      const target = dow === 0 ? mon : dow === 1 ? keyOf(addDays(parseKey(mon), -7)) : null;
      if (target && !S.reviews[target]) rows.push(`<div class="nowrow"><span class="ic">${orb('chaos', 26)}</span><span><div class="tt">Weekly review</div><div class="ss">${dow === 0 ? 'This week' : 'Last week'} is ready to look back on</div></span>
        <button class="btn small" data-act="rv-open" data-v="${target}">Open</button></div>`);
    }
    if (on('workouts') && WK().draft) rows.push(`<div class="nowrow"><span class="ic">${orb('fitness', 26)}</span><span><div class="tt">Workout in progress</div><div class="ss">${WK().draft.items.length} exercise${WK().draft.items.length === 1 ? '' : 's'} · started ${hm(WK().draft.t)}</div></span>
      <button class="btn small" data-act="now-workout">Resume</button></div>`);
    return rows;
  }

