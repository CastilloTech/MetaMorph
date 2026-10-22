  /* ---------- swipe the week/month calendar ---------- */
  const calSw = { s: null };
  $app.addEventListener('pointerdown', e => {
    const c = e.target.closest('.wk, .mo');
    calSw.s = c ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
  });
  $app.addEventListener('pointerup', e => {
    const c = calSw.s;
    calSw.s = null;
    if (!c || e.pointerId !== c.id) return;
    const dx = e.clientX - c.x, dy = e.clientY - c.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
    swipe.justSwiped = true;
    setTimeout(() => { swipe.justSwiped = false; }, 350);
    const btn = document.querySelector(dx < 0 ? '[data-act=cal-next]' : '[data-act=cal-prev]');
    if (btn) btn.click();
  });

