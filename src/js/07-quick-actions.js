  /* ----- long-press quick actions ----- */

  function qaSheet() {
    const q = V.qa;
    let title, items;
    if (q.kind === 'routine') {
      const r = findRoutine(q.gate, q.id);
      if (!r) return '';
      title = r.title;
      items = [!isDone(r.id) ? ['run', 'Open timer'] : null, ['qa-edit', 'Edit routine'], !isDone(r.id) ? ['qa-skip', 'Skip today'] : null].filter(Boolean);
    } else {
      const x = S.todos.find(t => t.id === q.id);
      if (!x) return '';
      title = x.text;
      items = [['qa-todo-toggle', x.done ? 'Mark not done' : 'Mark done'], ['qa-todo-edit', 'Edit'], ['qa-todo-tomorrow', 'Move to tomorrow'], ['qa-todo-del', 'Delete']];
    }
    return `<div class="sheet-bg ${q.fresh ? 'enter' : ''}" data-act="qa-cancel-bg"><div class="sheet qa"><div class="grab" aria-hidden="true"></div>
      <h2>${esc(title)}</h2>
      ${items.map(([a, l]) => `<button class="btn block qa-item ${a === 'qa-todo-del' ? 'danger' : ''}" data-act="${a}" ${a === 'run' ? `data-gate="${q.gate}" data-id="${q.id}"` : ''}>${l}</button>`).join('')}
      <button class="btn ghost block" data-act="qa-cancel">Cancel</button></div></div>`;
  }

