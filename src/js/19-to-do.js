  /* ----- to-do ----- */

  // due moment: the set time, or the end of the day for untimed tasks
  // due moment within its personal day: the set time, or the end of that day
  const todoDue = x => x.date ? (x.time ? atOf(x.date, x.time) : atOf(x.date, fromMinHM(dayStart())) + DAY - 1) : null;
  const todoLate = x => x.done && x.doneAt && x.date && x.doneAt > todoDue(x) + 60000;
  function dayLabel(k) {
    if (k === today()) return 'Today';
    if (k === keyOf(addDays(new Date(), 1))) return 'Tomorrow';
    if (k === keyOf(addDays(new Date(), -1))) return 'Yesterday';
    return parseKey(k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function todoMeta(x) {
    const parts = [];
    if (x.date) parts.push(dayLabel(x.date));
    if (x.time) parts.push(clock(x.time));
    if (x.done && x.doneAt) parts.push(todoLate(x) ? `<span class="late">late · ${hm(x.doneAt)}</span>` : `done ${hm(x.doneAt)}`);
    return parts.join(' · ');
  }
  function todoRow(x) {
    const overdue = !x.done && x.date && todoDue(x) < Date.now();
    return `<li class="${x.done ? 'done' : ''}">
      <button class="chk ${x.done ? 'done' : ''}" data-act="todo-toggle" data-id="${x.id}" aria-label="${x.done ? 'Mark not done' : 'Mark done'}">✓</button>
      <span class="tx" data-act="todo-edit" data-id="${x.id}"><div>${esc(x.text)}</div>${x.date || x.done ? `<div class="t ${overdue ? 'overdue' : ''}">${todoMeta(x)}${overdue ? ' · overdue' : ''}</div>` : ''}</span>
      <button class="x" data-act="todo-del" data-id="${x.id}" aria-label="Delete">✕</button>
    </li>`;
  }
  function todoTimelineItem(x) {
    const due = todoDue(x), late = todoLate(x);
    const st = x.done ? 'done' : due < Date.now() ? 'open' : 'upcoming';
    const right = x.done ? `<span class="st ${late ? 'late' : ''}">${late ? 'late · ' : '✓ '}${hm(x.doneAt)}</span>`
      : st === 'open' ? '<span class="st late">overdue</span>' : `<span class="st">in ${dur(Math.max(1, Math.round((due - Date.now()) / 60000)))}</span>`;
    return `<li><div class="swbg"><span class="l">✓ Done</span><span class="r">Undo</span></div>
      <div class="it todo ${st}" data-act="todo-toggle" data-id="${x.id}" data-todo="1">
        <span class="t num">${clock(x.time)}</span><span class="dot sq"></span>
        <span><div class="nm">${esc(x.text)}</div><div class="sub">To-do</div></span>
        ${right}
      </div></li>`;
  }
  function setTodo(x, v) { x.done = v; x.doneAt = v ? Date.now() : null; save(); if (v) chime(); }

  function todoView() {
    const k = today(), open = S.todos.filter(x => !x.done);
    const by = (a, b) => (a.date || '~').localeCompare(b.date || '~') || (a.time || '~').localeCompare(b.time || '~') || a.created - b.created;
    const groups = [
      ['Overdue', open.filter(x => x.date && x.date < k).sort(by), 'overdue'],
      ['Today', open.filter(x => x.date === k).sort(by), ''],
      ['Upcoming', open.filter(x => x.date && x.date > k).sort(by), ''],
      ['Someday', open.filter(x => !x.date).sort(by), ''],
    ];
    const done = S.todos.filter(x => x.done).sort((a, b) => b.doneAt - a.doneAt).slice(0, 20);
    const when = V.todoWhen;
    return `
      <form class="card" id="todoadd" autocomplete="off">
        <div class="custom" style="margin:0"><input name="text" placeholder="Add a task…" aria-label="New task" autocapitalize="sentences" enterkeyhint="done" value="${esc(V.todoDraft.text)}"><button class="btn primary" type="submit">Add</button></div>
        <div class="opts" style="margin-top:10px">${[['today', 'Today'], ['tomorrow', 'Tomorrow'], ['someday', 'Someday']].map(([v, l]) =>
          `<button type="button" data-act="todo-when" data-v="${v}" class="${when === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="grid2" style="margin-top:10px">
          <div class="field" style="margin:0"><label>Or a date</label><input name="date" type="date" value="${V.todoDraft.date}"></div>
          <div class="field" style="margin:0"><label>Time (puts it on the timeline)</label><input name="time" type="time" value="${V.todoDraft.time}"></div>
        </div>
      </form>
      ${groups.map(([name, list, cls]) => list.length ? `
        <div class="grouphead ${cls}"><h3>${name}</h3><span class="muted num" style="font-size:13px">${list.length}</span></div>
        <div class="card" style="padding-top:6px;padding-bottom:6px"><ul class="todos">${list.map(todoRow).join('')}</ul></div>` : '').join('')}
      ${!open.length ? `<p class="muted" style="text-align:center;margin:24px 0">Nothing to do. Add a task above.</p>` : ''}
      ${done.length ? `
        <div class="grouphead"><h3>Done</h3><button class="linkbtn" data-act="todo-clear">Clear done</button></div>
        <div class="card" style="padding-top:6px;padding-bottom:6px"><ul class="todos">${done.map(todoRow).join('')}</ul></div>` : ''}`;
  }

  function todoSheet() {
    const e = V.tedit;
    return `<div class="sheet-bg ${e.fresh ? 'enter' : ''}" data-act="todo-cancel-bg">
      <form class="sheet" id="todoform" autocomplete="off"><div class="grab" aria-hidden="true"></div>
        <h2>Edit task</h2>
        <div class="field"><label>Task</label><input name="text" required value="${esc(e.text)}"></div>
        <div class="grid2">
          <div class="field"><label>Date</label><input name="date" type="date" value="${e.date || ''}"></div>
          <div class="field"><label>Time</label><input name="time" type="time" value="${e.time || ''}"></div>
        </div>
        <button class="btn primary block" type="submit" style="margin-bottom:8px">Save</button>
        <div class="grid2"><button class="btn" type="button" data-act="todo-cancel">Cancel</button><button class="btn danger" type="button" data-act="todo-del" data-id="${e.id}">Delete</button></div>
      </form></div>`;
  }

