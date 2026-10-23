  /* ----- look & feel: icons, sheet header, Settings menu, the Today header and lists, tips, tour, feedback ----- */

  // one set of line icons, used everywhere
  const IC = d => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    drop: IC('<path d="M12 2.8c-3.4 4.3-6.6 8.2-6.6 11.6a6.6 6.6 0 0 0 13.2 0c0-3.4-3.2-7.3-6.6-11.6z"/>'),
    again: IC('<path d="M4.5 11a7.5 7.5 0 0 1 13-4.6L19.5 8.5M19.5 4v4.5H15M19.5 13a7.5 7.5 0 0 1-13 4.6L4.5 15.5M4.5 20v-4.5H9"/>'),
    scale: IC('<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M8.3 10a4.6 4.6 0 0 1 7.4 0M12 10.5l1.6-2"/>'),
    spark: IC('<path d="M12 3.5l1.7 5 5 1.7-5 1.7-1.7 5-1.7-5-5-1.7 5-1.7z"/><path d="M18.5 15.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/>'),
    close: IC('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
    chevron: IC('<path d="M9.5 5.5l6.5 6.5-6.5 6.5"/>'),
    back: IC('<path d="M14.5 5.5L8 12l6.5 6.5"/>'),
    sliders: IC('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
    bell: IC('<path d="M6.5 16v-5a5.5 5.5 0 0 1 11 0v5l1.5 2H5z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
    companion: IC('<circle cx="12" cy="12" r="8.5"/><path d="M12 7l1.2 3.3 3.5.2-2.7 2.2.9 3.4L12 14.2l-2.9 1.9.9-3.4-2.7-2.2 3.5-.2z"/>'),
    mic: IC('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
    cloud: IC('<path d="M7.2 18.5h9.6a4 4 0 0 0 .7-7.9 6 6 0 0 0-11.4 1.7 3.2 3.2 0 0 0 1.1 6.2z"/>'),
    check: IC('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    chat: IC('<path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3.5v-3.5h0a2 2 0 0 1-1.5-2z"/>'),
  };

  /* --- every sheet gets a sticky title bar with a close button --- */
  // wraps a sheet's drag handle (and the title right after it) in a bar that stays put while the sheet scrolls
  function sheetChrome(html) {
    return html.replace(/<div class="grab" aria-hidden="true"><\/div>(\s*<h2(?: [^>]*)?>[\s\S]*?<\/h2>)?/g, (m, h2) =>
      `<div class="shead"><div class="grab" aria-hidden="true"></div>${h2 ? h2.trim() : '<span></span>'}<button class="sclose" data-act="sheet-x" aria-label="Close">${ICONS.close}</button></div>`);
  }

  /* --- Settings: a short menu; each row opens its own page --- */
  function settingsMenu() {
    const c = S.cloud, rm = RM();
    const row = (act, v, icon, title, sub) => `<button class="srow2" data-act="${act}" ${v ? `data-v="${v}"` : ''}><span class="si">${icon}</span><span class="st2"><b>${title}</b><small>${sub}</small></span>${ICONS.chevron}</button>`;
    return `<h2>Settings</h2>
      <div class="menu">
        ${row('dpage', 'general', ICONS.sliders, 'General', 'Sections, evening mode, sounds, when your day starts')}
        ${row('dpage', 'reminders', ICONS.bell, 'Reminders', !PUSH_URL ? 'Not available' : rm.on ? 'On' + (rm.brief || rm.wrap ? ' · morning & evening messages' : '') : 'Off')}
        ${on('companion') ? row('sv-open', '', ICONS.companion, svBorn() ? esc(svName()) : 'Companion', svBorn() ? 'Home, goals, chat, look & name' : 'Meet your companion') : ''}
        ${row('siri-open', '', ICONS.mic, 'Siri & Shortcuts', 'Log without opening the app')}
        ${row('dpage', 'backup', ICONS.cloud, 'Backup & data', c.on ? `Cloud backup ${c.last ? ago(c.last) : 'on'}` : backupDue() ? '<span class="warn">No recent backup</span>' : 'Cloud backup off')}
      </div>
      <p class="note" style="text-align:center;margin-top:14px">MetaMorph · version ${APP_VERSION}</p>`;
  }
  function settingsPage(title, body) {
    return `<h2><button class="sback" data-act="dpage" data-v="" aria-label="Back to Settings">${ICONS.back}</button>${title}</h2><div class="pgin">${body}</div>`;
  }

  /* --- Today: one header with progress and your companion's line --- */
  function svHeadline() {
    const nz = svNudges().find(x => x.id.startsWith('now:') || x.id === 'streak' || x.id.startsWith('goal:'));
    return nz ? nz.text.replace(' Tap Complete when you’re done.', '') : svGreeting();
  }
  function todayHead(n, held) {
    const comp = on('companion') && svBorn(), st = comp ? svStats() : null, frac = n ? held / n : 0;
    const pct = comp ? st.charge : Math.round(100 * frac), src = comp && (SV().avatar || SV_DEFAULT_IMG);
    const line = comp ? svHeadline() : on('companion') ? 'Tap to meet your companion: a friendly guide who keeps you consistent.'
      : !n ? 'Nothing scheduled today.' : held >= n ? 'Every routine held today.' : `${n - held} to go today.`;
    return `<div class="thead ${comp ? st.form : ''}" ${on('companion') ? 'data-act="sv-open"' : ''} style="--held:${frac.toFixed(2)};--p:${pct}">
      <div class="thring"><div class="thface">${src ? `<img src="${esc(src)}" alt="" draggable="false">` : orb('chaos', 64, 'spin')}</div></div>
      <div class="thtext"><div class="thtop"><b>${comp ? esc(svName()) : 'Today'}</b><span class="num">${n ? `${held}/${n} held` : ''}${comp ? `${n ? ' · ' : ''}${st.charge}% charged` : ''}</span></div>
        <p>${esc(line)}</p></div></div>`;
  }

  /* --- Today: everything that needs you, in one list (your companion's nudges included) --- */
  function needsYou() {
    const rows = nowRows(), hasWater = rows.some(r => r.includes('data-act="w-add"'));
    if (on('companion') && svBorn()) for (const x of svNudges()) {
      if (x.id.startsWith('now:') || x.id === 'streak' || x.id.startsWith('goal:') || (hasWater && x.id === 'water')) continue;
      rows.push(`<div class="nowrow nz"><span class="ic sv">${ICONS.spark}</span><span><div class="nzt">${esc(x.text)}</div>${x.btn ? `<div class="nzacts">${x.btn}</div>` : ''}</span>
        <button class="nzx" data-act="sv-dismiss" data-id="${esc(x.id)}" aria-label="Not now">${ICONS.close}</button></div>`);
    }
    return rows.length ? `<div class="card nowstack needs"><p class="label" style="margin:10px 0 2px">Needs you</p>${rows.join('')}</div>` : '';
  }

  /* --- Today: water as one line; tap for the full view --- */
  function waterStrip() {
    if (!on('water')) return '';
    const st = wState(), pct = Math.min(100, Math.round(100 * st.got / st.target));
    return `<button class="wstrip" data-act="open-water"><span class="wi">${ICONS.drop}</span><span class="wt"><b>Water</b><span class="wbar"><i style="width:${pct}%"></i><em style="left:${Math.min(100, 100 * st.expected / st.target)}%"></em></span></span>
      <span class="num wn">${fmtW(st.got)} / ${fmtW(st.target)}</span>${ICONS.chevron}</button>`;
  }

  /* --- one tour after this update instead of a list --- */
  const tourDue = () => (typeof S.seenVersion === 'number' ? S.seenVersion : 6) < 17;
  const TOUR = [
    { icon: ICONS.sliders, title: 'A calmer Today', text: 'Your progress and your companion’s line sit at the top. The routine that’s on now is right below, and everything that needs you is in one list. Water lives on Today now; tap its bar for the full view.' },
    { icon: ICONS.companion, title: 'Your companion', text: 'It keeps you consistent: it charges up as you keep your day, nudges you when something slips, and you can chat with it about food, routines and goals.', act: () => (svBorn() ? ['sv-open', 'Say hi'] : ['sv-open', 'Meet your companion']) },
    { icon: ICONS.mic, title: 'Log without opening the app', text: '“Hey Siri, log water”, a double-tap on the back of your phone, or a home-screen button. Tapping a reminder now takes you straight to the action too.', act: () => ['tour-siri', 'Set up Siri'] },
    { icon: ICONS.cloud, title: 'Never lose your data', text: 'Turn on cloud backup: your data is encrypted on your phone with a passphrase only you know, and saved every day.', act: () => (S.cloud.on ? null : ['tour-backup', 'Turn on cloud backup']) },
  ];
  function tourSheet() {
    const from = typeof S.seenVersion === 'number' ? S.seenVersion : 6;
    const notes = Object.keys(CHANGELOG).map(Number).filter(v => v > from && v <= APP_VERSION).sort((a, b) => b - a).flatMap(v => CHANGELOG[v]);
    return `<div class="sheet-bg enter" data-act="whatsnew-close-bg"><div class="sheet tour-sheet"><div class="grab" aria-hidden="true"></div>
      <div class="tour" id="tour">${TOUR.map((c, i) => { const a = c.act && c.act(); return `<section class="tcard"><div class="tic">${c.icon}</div><h3>${c.title}</h3><p>${c.text}</p>
        ${a ? `<button class="btn primary" data-act="${a[0]}">${a[1]}</button>` : ''}<span class="tnum">${i + 1} / ${TOUR.length}</span></section>`; }).join('')}</div>
      <div class="tdots">${TOUR.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
      <div class="grid2"><button class="btn" data-act="whatsnew-close">Skip</button><button class="btn primary" data-act="tour-next">Next</button></div>
      ${notes.length ? `<details class="tmore"><summary>Everything new in version ${APP_VERSION}</summary><ul class="news">${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></details>` : ''}
    </div></div>`;
  }
  function tourSync() {
    const t = document.getElementById('tour');
    if (!t) return;
    const i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
    document.querySelectorAll('.tdots i').forEach((d, j) => d.classList.toggle('on', j === i));
    const nb = document.querySelector('[data-act=tour-next]');
    if (nb) nb.textContent = i >= TOUR.length - 1 ? 'Done' : 'Next';
  }
  $app.addEventListener('scroll', e => { if (e.target.id === 'tour') tourSync(); }, true);

  /* --- feedback you can see and hear (iPhone ignores vibration) --- */
  function chime(kind = 'done') {
    if (S.prefs.sound === false) return;
    try {
      unlockAudio();
      const t = ac.currentTime, notes = kind === 'water' ? [740, 988] : [660, 990];
      notes.forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), at = t + i * 0.07;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.09, at + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
        o.connect(g).connect(ac.destination); o.start(at); o.stop(at + 0.25);
      });
    } catch (e) {}
  }
  // briefly highlights what was just completed
  function flashDone() {
    const id = V.flash;
    if (!id) return;
    V.flash = null;
    requestAnimationFrame(() => document.querySelectorAll(`[data-rid="${id}"], .hero[data-rid="${id}"]`).forEach(el => {
      el.classList.remove('justdone'); void el.offsetWidth; el.classList.add('justdone');
      setTimeout(() => el.classList.remove('justdone'), 900);
    }));
  }

  /* --- events --- */
  $app.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    switch (el.dataset.act) {
      case 'sheet-x': { const bg = el.closest('.sheet-bg'); if (bg) bg.dispatchEvent(new MouseEvent('click', { bubbles: true })); break; }
      case 'dpage': V.dpage = el.dataset.v || null; render(); document.querySelector('.sheet')?.scrollTo(0, 0); break;
      case 'open-water': V.slide = 'r'; V.tab = 'water'; render(); scrollTo(0, 0); break;
      case 'tour-next': {
        const t = document.getElementById('tour'), i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
        if (i >= TOUR.length - 1) { V.whatsNew = false; S.seenVersion = APP_VERSION; save(); render(); }
        else t.scrollTo({ left: (i + 1) * t.clientWidth, behavior: 'smooth' });
        break;
      }
      case 'tour-siri': V.whatsNew = false; S.seenVersion = APP_VERSION; save(); V.siri = true; V.siriFresh = true; render(); V.siriFresh = false; break;
      case 'tour-backup': V.whatsNew = false; S.seenVersion = APP_VERSION; save(); V.data = true; V.dpage = 'backup'; render(); break;
      default: return;
    }
    // the redraw can reuse the tapped element for a different button; don't let later handlers act on it
    e.stopImmediatePropagation();
  });
