  /* ----- backup / data ----- */

  const DAY = 864e5;
  // no nagging for a backup file while cloud backup has run in the last few days
  const backupDue = () => !(S.cloud && S.cloud.on && Date.now() - (S.cloud.last || 0) < 3 * DAY) && Date.now() - (S.lastBackup || S.created) > 14 * DAY;
  function ago(t) {
    const d = Math.floor((Date.now() - t) / DAY);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
  }
  function backupBlob() {
    const payload = { app: 'metamorph', exported: new Date().toISOString(), data: S };
    return new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
  }
  const backupName = () => `metamorph-backup-${today()}.json`;
  function markBackedUp() { S.lastBackup = Date.now(); save(); render(); }

  function dataSheet() {
    const p = storageInfo.persisted;
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] }));
    const nDays = Object.keys(S.done).length;
    return `
      <div class="sheet-bg ${V.data === true ? 'enter' : ''}" data-act="data-close-bg">
        <div class="sheet"><div class="grab" aria-hidden="true"></div>
          <h2>Settings &amp; data</h2>
          <p class="label" style="margin-top:4px">Sections</p>
          <p class="note" style="margin:0 0 6px">Hide what you don’t use. Hidden sections keep their data.</p>
          ${[['water', 'Water', 'Fill vessel, sip schedule, reminders'], ['todo', 'To-do', 'Tasks, timed tasks on the timeline'], ['supplies', 'Supplies', 'Groceries, hygiene products, prices'],
             ['practice', 'Practice', 'Feature Law and Switch Drill'], ['other', 'Other', 'Activities outside the four Gates'],
             ['workouts', 'Workout log', 'On the Fitness page'], ['macros', 'Calories & macros', 'On the Nutrition page'], ['body', 'Body', 'Weight, measurements, body fat, photos'], ['companion', 'Companion', 'Your servitor on Today and its voice in reminders']].map(([k, l, d]) =>
            `<label class="switch"><span>${l}<small>${d}</small></span><input type="checkbox" data-sec="${k}" ${on(k) ? 'checked' : ''}></label>`).join('')}
          <label class="switch"><span>Evening mode<small>Warmer, dimmer colors from your Sleep wind-down until morning</small></span><input type="checkbox" data-pref="evening" ${S.prefs.evening ? 'checked' : ''}></label>
          <p class="label" style="margin-top:18px">Your day</p>
          <div class="field"><label>New day starts at</label><input type="time" data-pref-time="dayStart" value="${fromMinHM(dayStart())}"></div>
          <p class="note" style="margin:-4px 0 6px">Anything before this (a late snack, a 1 AM workout) counts for the day before. Default is two hours before your wake time.</p>
          ${on('companion') ? `<p class="label" style="margin-top:18px">Companion</p>
          <button class="btn block" data-act="sv-open">${svBorn() ? `Open ${esc(svName())}` : 'Meet your companion'}</button>` : ''}
          <p class="label" style="margin-top:18px">Reminders</p>
          ${remindersSettings()}
          <p class="label" style="margin-top:18px">Siri &amp; Shortcuts</p>
          <button class="btn block" data-act="siri-open">Log without opening the app</button>
          ${cloudSettings()}
          <p class="label" style="margin-top:18px">Backup</p>
          <button class="btn block" data-act="csv-export" style="margin:8px 0">Export spreadsheets (CSV)</button>
          <div class="kv"><span>Photos &amp; videos</span><span class="v">${S.media.length} items · back up from Body → Media</span></div>
          <div class="kv"><span>Saved on this device</span><span class="v good">Automatically, every change</span></div>
          <div class="kv"><span>Main store (IndexedDB)</span><span class="v ${typeof indexedDB !== 'undefined' ? 'good' : 'warn'}">${typeof indexedDB !== 'undefined' ? 'On' : 'Unavailable'}</span></div>
          <div class="kv"><span>Quick-start copy</span><span class="v">${lsOff ? 'Off (data outgrew it)' : 'On'}</span></div>
          <div class="kv"><span>Protected from auto-clearing</span><span class="v ${p ? 'good' : 'warn'}">${p === null ? 'Unknown' : p ? 'Yes' : 'Not granted'}</span></div>
          <div class="kv"><span>Last backup file</span><span class="v ${backupDue() ? 'warn' : 'good'}">${S.lastBackup ? ago(S.lastBackup) : 'Never'}</span></div>
          <div class="kv"><span>History</span><span class="v num">${nDays} day${nDays === 1 ? '' : 's'} · ${S.drill.sessions.length} drills</span></div>
          <div class="stack">
            ${canShare ? '<button class="btn primary block" data-act="backup-share">Share backup (Drive, Files…)</button>' : ''}
            <button class="btn ${canShare ? '' : 'primary'} block" data-act="backup-save">Download backup file</button>
            <button class="btn block" data-act="backup-restore">Restore from a backup file</button>
            <input type="file" id="restorefile" accept="application/json,.json" hidden>
            ${p ? '' : '<button class="btn block" data-act="persist">Ask browser to protect storage</button>'}
          </div>
          <p class="note">Everything is saved automatically on this device. Uninstalling the app or clearing site data
            erases it, so keep a backup file somewhere else (Drive, iCloud, email) and you can restore on any device.</p>
          <button class="btn ghost block" data-act="data-close" style="margin-top:8px">Close</button>
        </div>
      </div>`;
  }

