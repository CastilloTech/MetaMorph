  /* ----- undo banner and dialogs ----- */

  let snackTimer = 0;
  function snack(msg, undo) {
    clearTimeout(snackTimer);
    const old = $overlay.querySelector('.snack'); if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'snack'; el.setAttribute('role', 'status');
    el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button class="btn small" data-o="undo">Undo</button>' : ''}`;
    $overlay.appendChild(el);
    if (undo) el.querySelector('[data-o=undo]').addEventListener('click', () => { clearTimeout(snackTimer); el.remove(); undo(); });
    snackTimer = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, undo ? 5000 : 3000);
  }
  // do it now, with a few seconds to take it back
  function undoable(msg, fn) {
    const before = JSON.stringify(S);
    fn(); save(); render();
    snack(msg, () => { replaceState(JSON.parse(before)); save(); render(); snack('Restored'); });
  }
  function ask({ title, text = '', ok = 'OK', cancel = 'Cancel', danger = false }) {
    return new Promise(res => {
      const bg = document.createElement('div');
      bg.className = 'askbg';
      bg.innerHTML = `<div class="ask" role="alertdialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}
        <div class="grid2"><button class="btn" data-o="no">${esc(cancel)}</button><button class="btn ${danger ? 'dangerfill' : 'primary'}" data-o="yes">${esc(ok)}</button></div></div>`;
      const done = v => { bg.classList.add('out'); setTimeout(() => bg.remove(), 180); res(v); };
      bg.addEventListener('click', e => { const o = e.target.closest('[data-o]'); if (o) done(o.dataset.o === 'yes'); else if (e.target === bg) done(false); });
      $overlay.appendChild(bg);
      bg.querySelector('[data-o=yes]').focus();
    });
  }

  const TAB_ICON = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
    gates: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="5.5" r="3"/><circle cx="5.5" cy="12" r="3"/><circle cx="18.5" cy="12" r="3"/><circle cx="12" cy="18.5" r="3"/></svg>',
    water: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.8c-3.4 4.3-6.6 8.2-6.6 11.6a6.6 6.6 0 0 0 13.2 0c0-3.4-3.2-7.3-6.6-11.6z"/></svg>',
    todo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5l1.6 1.6L8.8 5M4 12.5l1.6 1.6 3.2-3.1M4 18.5l1.6 1.6 3.2-3.1M12 7h8M12 13h8M12 19h8"/></svg>',
    practice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/></svg>',
    body: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2.2"/><path d="M6 9.5c2 1 4 1.4 6 1.4s4-.4 6-1.4M12 11v4.5M12 15.5l-3 6M12 15.5l3 6"/></svg>',
  };

  // Evening: from the earliest Sleep routine today (or an hour before bed) until wake-up.
  function isEvening() {
    const n = nowRel(), d = pdayDate();
    const sleeps = S.gates.sleep.filter(r => scheduledOn(r, d)).map(r => rel(toMin(startFor(r, d))));
    const from = sleeps.length ? Math.min(...sleeps) : rel(toMin(S.water.bed || '22:30') - 60);
    const until = rel(toMin(S.water.wake || '07:00'));
    return n >= from || n < until;
  }
  function applyEvening() {
    const ev = S.prefs.evening && isEvening(), root = document.documentElement;
    if (ev) root.dataset.evening = '1'; else delete root.dataset.evening;
    const m = document.querySelector('meta[name=theme-color]');
    if (m) m.content = ev ? '#120e0b' : '#0f1115';
  }

