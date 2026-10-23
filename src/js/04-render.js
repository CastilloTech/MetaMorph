  /* ---------- render ---------- */

  function render() {
    if (V.onboard) return renderOnboard();
    if (drillRun) return renderDrillRun();
    if (run) return renderRun();
    if (featRun) return renderFeatRun();

    const sheetScroll = document.querySelector('.sheet')?.scrollTop || 0;
    const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    let tz = '';
    try { tz = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(new Date()).find(x => x.type === 'timeZoneName').value; } catch (e) {}
    const tabs = visibleTabs();
    if (!tabs.includes(V.tab)) V.tab = 'today';
    if (V.gate === 'other' && !on('other')) V.gate = 'sleep';
    const body = { today: todayView, gates: gatesView, water: waterView, todo: todoTabView, practice: practiceView, body: bodyView }[V.tab]();
    const wd = waterDue();
    view.html = `
      <header><h1>MetaMorph</h1><div class="right"><span class="date">${esc(dateStr)}${tz ? ` · ${esc(tz)}` : ''}</span>
        <button class="iconbtn" data-act="data" aria-label="Backup and data">⋯${backupDue() ? '<span class="badge"></span>' : ''}</button></div></header>
      <main class="${V.update ? 'has-toast' : ''}"><div class="${V.slide ? 'slide-' + V.slide : ''}">${body}</div></main>
      <nav class="tabs"><div class="inner" style="grid-template-columns:repeat(${tabs.length}, 1fr)">
        ${[['today', 'Today'], ['gates', 'Gates'], ['water', 'Water'], ['todo', 'To-do'], ['practice', 'Practice'], ['body', 'Body']].filter(([k]) => tabs.includes(k)).map(([k, l]) =>
          `<button data-act="tab" data-v="${k}" class="${V.tab === k ? 'on' : ''}" aria-label="${l}">${TAB_ICON[k]}<span>${l}</span></button>`).join('')}
        <span class="ind" aria-hidden="true" style="width:calc(${100 / tabs.length}% - ${4 * (tabs.length - 1) / tabs.length}px);transform:translateX(calc(${Math.max(0, tabs.indexOf(V.tab))} * (100% + 4px)))"></span>
      </div></nav>
      ${V.edit ? editSheet() : ''}
      ${V.data ? dataSheet() : ''}
      ${V.whatsNew ? whatsNewSheet() : ''}
      ${V.wedit ? waterSheet() : ''}
      ${V.fcheck ? checkSheet() : ''}
      ${V.tedit ? todoSheet() : ''}
      ${V.qa ? qaSheet() : ''}
      ${V.nadd ? addFoodSheet() : ''}
      ${V.ngoals ? goalsSheet() : ''}
      ${V.nprep ? prepSheet() : ''}
      ${V.nmeal ? mealSheet() : ''}
      ${V.woEx ? exSheet() : ''}
      ${V.mup ? mediaUpSheet() : ''}
      ${V.mview ? mediaViewSheet() : ''}
      ${V.mcmp ? compareSheet() : ''}
      ${V.review ? reviewSheet() : ''}
      ${V.sv ? companionSheet() : ''}
      ${V.quick ? quickSheet() : ''}
      ${V.siri ? siriSheet() : ''}
      ${V.cbr ? cbRestoreSheet() : ''}
      ${V.cam ? camSheet() : ''}
      ${V.sedit ? supSheet() : ''}
      ${V.scan ? `<div class="scanner"><div class="frame"><video id="scanvid" playsinline muted></video></div><p id="scanmsg">Point the camera at a barcode</p><button class="btn" data-act="scan-close">Cancel</button></div>` : ''}
      ${V.update && !anySheet() ? `
        <div class="toast ${V.toastFx ? 'anim' : ''}" role="status">${orb('chaos', 36)}
          <div class="msg"><b>Update ready</b>A new version of MetaMorph</div>
          <button class="btn ghost" data-act="update-later">Later</button>
          <button class="btn primary" data-act="update-now">Update</button>
        </div>` : ''}
    `;
    V.gateFx = false;
    V.slide = null;
    V.toastFx = false;
    applyEvening();
    if (V.data) V.data = 'open';
    if (V.wedit) V.wedit.fresh = false;
    if (V.fcheck) V.fcheck.fresh = false;
    for (const k of ['tedit', 'nadd', 'ngoals', 'nprep', 'sedit', 'qa', 'nmeal', 'mup', 'mcmp']) if (V[k]) V[k].fresh = false;
    V.mviewFresh = false;
    updateClocks();
    // let the water fill rise from where it was
    if (V.wFrom != null) {
      V.wFrom = null;
      requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll('[data-h]').forEach(x => { x.style.height = x.dataset.h + '%'; })));
    }
    if (V.edit) {
      const sh = document.querySelector('.sheet');
      if (sh) sh.scrollTop = sheetScroll;
      V.edit.fresh = false;
    }
  }

