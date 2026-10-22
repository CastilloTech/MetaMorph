  /* ----- what's new ----- */

  function whatsNewSheet() {
    // 6 was the last version before "What's new" existed
    const from = typeof S.seenVersion === 'number' ? S.seenVersion : 6;
    const notes = Object.keys(CHANGELOG).map(Number).filter(v => v > from && v <= APP_VERSION)
      .sort((a, b) => b - a).flatMap(v => CHANGELOG[v]);
    return `
      <div class="sheet-bg enter" data-act="whatsnew-close-bg">
        <div class="sheet"><div class="grab" aria-hidden="true"></div>
          <div class="whatsnew-head">${orb('chaos', 56, 'enter')}<div><h2>What's new</h2><span class="muted num">Version ${APP_VERSION}</span></div></div>
          <ul class="news">${(notes.length ? notes : ['Small fixes and improvements']).map(n => `<li>${esc(n)}</li>`).join('')}</ul>
          <button class="btn primary block" data-act="whatsnew-close" style="margin-top:12px">Got it</button>
        </div>
      </div>`;
  }

