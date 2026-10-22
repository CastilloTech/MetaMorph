  /* ---------- drag a sheet down by its handle to close it ---------- */
  const drag = { s: null };
  $app.addEventListener('pointerdown', e => {
    const g = e.target.closest('.sheet .grab');
    if (!g) return;
    const sh = g.closest('.sheet');
    drag.s = { sh, y: e.clientY, id: e.pointerId, dy: 0, t: Date.now() };
    try { g.setPointerCapture(e.pointerId); } catch (err) {}
    sh.style.transition = 'none';
  });
  $app.addEventListener('pointermove', e => {
    const d = drag.s;
    if (!d || e.pointerId !== d.id) return;
    d.dy = Math.max(0, e.clientY - d.y);
    d.sh.style.transform = `translateY(${d.dy}px)`;
  });
  function endDrag(e) {
    const d = drag.s;
    if (!d || e.pointerId !== d.id) return;
    drag.s = null;
    d.sh.style.transition = '';
    const fast = d.dy > 40 && d.dy / Math.max(1, Date.now() - d.t) > 0.6;
    if (d.dy > 110 || fast) {
      d.sh.style.transform = 'translateY(110%)';
      setTimeout(() => { const bg = d.sh.closest('.sheet-bg'); if (bg) bg.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, 170);
    } else d.sh.style.transform = '';
  }
  $app.addEventListener('pointerup', endDrag);
  $app.addEventListener('pointercancel', endDrag);

