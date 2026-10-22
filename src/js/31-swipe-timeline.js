  /* ---------- swipe a timeline item: right = held, left = undo ---------- */
  const swipe = { s: null, justSwiped: false };
  const TRIGGER = 80;
  $app.addEventListener('pointerdown', e => {
    if (drillRun && e.target.closest('#tapzone')) { e.preventDefault(); drillTap(); return; }
    const it = e.target.closest('.tl .it');
    // finished routines are locked: their finish time and overtime can't be swiped away
    if (!it || e.button > 0 || it.classList.contains('locked')) return;
    swipe.s = { it, li: it.parentElement, id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, on: false };
  });
  $app.addEventListener('pointermove', e => {
    const w = swipe.s;
    if (!w || e.pointerId !== w.id) return;
    const dx = e.clientX - w.x, dy = e.clientY - w.y;
    if (!w.on) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        w.on = true;
        try { w.it.setPointerCapture(e.pointerId); } catch (err) {}
      } else if (Math.abs(dy) > 10) { swipe.s = null; return; }
    }
    if (!w.on) return;
    w.dx = dx;
    w.it.classList.remove('snap');
    w.it.style.transform = `translateX(${dx}px)`;
    w.li.dataset.dir = dx > 0 ? 'r' : 'l';
    const armed = Math.abs(dx) > TRIGGER;
    if (armed !== w.li.classList.contains('armed')) { w.li.classList.toggle('armed', armed); if (armed) buzz(); }
  });
  function endSwipe(e) {
    const w = swipe.s;
    if (!w || e.pointerId !== w.id) return;
    swipe.s = null;
    if (!w.on) return;
    swipe.justSwiped = true;
    setTimeout(() => { swipe.justSwiped = false; }, 350);
    const go = Math.abs(w.dx) > TRIGGER && e.type === 'pointerup';
    w.it.classList.add('snap');
    w.it.style.transform = go ? `translateX(${w.dx > 0 ? '100%' : '-100%'})` : '';
    if (!go) { setTimeout(() => { delete w.li.dataset.dir; w.li.classList.remove('armed'); }, 250); return; }
    const v = w.dx > 0;
    if (w.it.dataset.todo) { const x = S.todos.find(t => t.id === w.it.dataset.id); if (x) setTodo(x, v); }
    else completeRoutine(findRoutine(w.it.dataset.gate, w.it.dataset.id), v);
    setTimeout(render, 220);
  }
  $app.addEventListener('pointerup', endSwipe);

