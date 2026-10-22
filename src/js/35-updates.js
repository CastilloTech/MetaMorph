  /* ---------- updates ---------- */

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleReminderSync(); });

  let updating = false;
  function showUpdate(worker) {
    V.update = worker;
    V.toastFx = true;
    if (!run && !drillRun) render();
  }
  async function applyUpdate() {
    const w = V.update;
    if (!w) return;
    if (drillRun && !(await ask({ title: 'Update now?', text: 'Updating ends the current drill session.', ok: 'Update' }))) return;
    updating = true;
    try { localStorage.setItem('metamorph.updated', '1'); } catch (e) {}
    save();
    w.postMessage({ type: 'SKIP_WAITING' });
    // fallback in case the controller change event doesn't arrive
    setTimeout(() => location.reload(), 3000);
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(reg => {
      const watch = w => w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w);
      });
      // a new version may already be downloaded and waiting
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
      watch(reg.installing);
      reg.addEventListener('updatefound', () => watch(reg.installing));
      // look for new versions when the app comes back to the front, and hourly while open
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      setInterval(check, 60 * 60 * 1000);
    }).catch(() => {});

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updating) location.reload();
    });
  }
