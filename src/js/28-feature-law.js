  /* ----- feature law ----- */

  const F = () => S.features;
  const TRIALS_NEEDED = 30;

  function lintFeature(t) {
    const x = t.trim().toLowerCase();
    if (!x) return null;
    if (/[,;&+]|\band\b/.test(x)) return { lvl: 'warn', msg: 'One feature only. A Lantern given three bearings lights none of them.' };
    const notice = /^(notice|spot|watch for|listen for|catch)\b/.test(x);
    if (!notice && (/^(be|feel|get|have|win|close|achieve|succeed|make|become|improve|stop|try|land|nail|crush|do)\b/.test(x)
        || /\b(more|less|better|good day|confident|successful|happy|productive|great)\b/.test(x)))
      return { lvl: 'warn', msg: 'That’s an outcome, and the Lantern can’t aim at outcomes. Name something you could notice: “Notice …”' };
    if (notice) return { lvl: 'ok', msg: 'Loadable: something you could notice.' };
    return { lvl: 'info', msg: 'Tip: start with “Notice” and name something you could see or hear.' };
  }

  function featureView() {
    const f = F(), open = f.items.filter(x => !x.check), done = f.items.filter(x => x.check);
    const L = done.filter(x => x.mode === 'loaded'), C = done.filter(x => x.mode === 'control');
    const ar = a => a.length ? avg(a.map(x => x.check.rating)) : null;
    const ub = a => a.length ? Math.round(100 * a.filter(x => x.check.unbidden).length / a.length) : null;
    const la = ar(L), ca = ar(C);
    const enough = done.length >= TRIALS_NEEDED && L.length >= 8 && C.length >= 8;
    let verdict = '';
    if (enough) verdict = la - ca >= 0.5
      ? `<p class="hint ok">Loaded contexts are noticed more (+${(la - ca).toFixed(1)}). The Feature Law is holding for you.</p>`
      : `<p class="hint warn">No clear difference after ${done.length} trials. The book says to mark the Feature Law Speculative in your copy.</p>`;
    const lint = lintFeature(V.fDraft.text);
    return `
      <div class="card">
        <p class="label" style="margin:0">The Feature Law</p>
        <p class="lawq"><b>The Lantern biases perceptual features. It does not bias outcomes.</b> An intent you couldn’t <i>notice</i> gives it nothing to aim at.</p>
      </div>
      <div class="card">
        <p class="label">Load one feature</p>
        <div class="field"><label>For</label><input id="fctx" value="${esc(V.fDraft.ctx)}" placeholder="Today, a meeting, the gym…" autocomplete="off"></div>
        <div class="opts" style="margin:-4px 0 14px">${['Today', 'Meeting', 'Workout', 'Conversation'].map(c => `<button type="button" data-act="f-ctx" data-v="${c}" class="${V.fDraft.ctx === c ? 'on' : ''}">${c}</button>`).join('')}</div>
        <div class="field" style="margin-bottom:0"><label>The one thing you'll notice</label><input id="ftext" value="${esc(V.fDraft.text)}" placeholder="Notice the pause before they answer" autocomplete="off" autocapitalize="sentences" enterkeyhint="done"></div>
        <p class="hint ${lint ? lint.lvl : ''}" id="fhint">${lint ? esc(lint.msg) : ''}</p>
        <label class="checkrow"><input type="checkbox" id="fexp" ${f.experiment ? 'checked' : ''}> Experiment: about 1 in 3 loads becomes a control trial</label>
        <button class="btn primary block" data-act="f-load">Load feature · 30s hold</button>
      </div>
      ${open.length ? `<div class="card"><p class="label">Check in afterwards</p><ul class="flist">${open.slice().reverse().map(x => `<li><span>
          <div class="ctx">${esc(x.ctx || 'Context')} · ${new Date(x.t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}${x.mode === 'control' ? '<span class="mtag ctl">CONTROL</span>' : ''}</div>
          <div class="txt">${esc(x.text)}</div></span>
          <span class="row" style="gap:6px"><button class="btn small ghost" data-act="f-discard" data-id="${x.id}" aria-label="Discard this trial">✕</button><button class="btn small primary" data-act="f-check" data-id="${x.id}">Check in</button></span></li>`).join('')}</ul></div>` : ''}
      <div class="card">
        <p class="label">Is it working for you?</p>
        <div class="cmp">
          <div><b>${la == null ? '—' : la.toFixed(1)}</b><span>Loaded · noticed 0–4<br>${L.length} trial${L.length === 1 ? '' : 's'}${ub(L) != null ? ` · ${ub(L)}% unbidden` : ''}</span></div>
          <div><b>${ca == null ? '—' : ca.toFixed(1)}</b><span>Control · noticed 0–4<br>${C.length} trial${C.length === 1 ? '' : 's'}${ub(C) != null ? ` · ${ub(C)}% unbidden` : ''}</span></div>
        </div>
        <div class="prog"><i style="width:${Math.min(100, 100 * done.length / TRIALS_NEEDED)}%"></i></div>
        <p class="muted num" style="font-size:12px;margin:6px 0 0">${done.length}/${TRIALS_NEEDED} checked-in trials${enough ? '' : ' before a verdict (at least 8 of each kind)'}</p>
        ${verdict}
      </div>
      ${done.length ? `<div class="card"><p class="label">Recent</p><ul class="flist">${done.slice(-8).reverse().map(x => `<li><span>
          <div class="ctx">${esc(x.ctx || 'Context')} · ${new Date(x.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}<span class="mtag ${x.mode === 'control' ? 'ctl' : ''}">${x.mode === 'control' ? 'CONTROL' : 'LOADED'}</span></div>
          <div class="txt">${esc(x.text)}</div></span><span class="num muted">${x.check.rating}/4</span></li>`).join('')}</ul></div>` : ''}`;
  }

  function renderFeatRun() {
    const x = F().items.find(i => i.id === featRun.id);
    if (!x) { featRun = null; return render(); }
    let center, controls;
    if (featRun.mode === 'control') {
      center = `<div class="phase" style="color:var(--release)">CONTROL TRIAL</div>
        <div class="holdtext">${esc(x.text)}</div>
        <div class="instr">Don’t rehearse it. Put it out of mind and go in as you normally would. You’ll check in the same way afterwards, so the two can be compared.</div>`;
      controls = `<div class="controls one"><button class="btn primary" data-act="f-done">Got it</button></div>`;
    } else if (featRun.held) {
      center = `${orb('chaos', 110, 'still')}
        <div class="phase" style="color:var(--ok)">LOADED</div>
        <div class="holdtext">${esc(x.text)}</div>
        <div class="instr">Go in. Check in afterwards from the Feature tab.</div>`;
      controls = `<div class="controls one"><button class="btn primary" data-act="f-done">Done</button></div>`;
    } else {
      center = `${orb('chaos', 110, 'still')}
        <div class="phase" style="color:var(--accent)">HOLD THE FEATURE</div>
        <div class="holdtext">${esc(x.text)}</div>
        <div class="clock" id="clock" style="font-size:56px">${mmss((featRun.end - Date.now()) / 1000)}</div>
        <div class="bar" style="color:var(--accent);max-width:240px"><i id="bar"></i></div>
        <div class="instr">Keep it in view until the context begins.</div>`;
      controls = `<div class="controls one"><button class="btn ghost" data-act="f-done">Skip the hold</button></div>`;
    }
    view.html = `<div class="run"><div class="inner">
      <div class="top"><span>${esc(x.ctx || 'Feature')}</span><span></span></div>
      <div class="center">${center}</div>${controls}</div></div>`;
    tick();
  }

  function checkSheet() {
    const c = V.fcheck, x = F().items.find(i => i.id === c.id);
    const opts = (k, list) => `<div class="opts" style="margin-bottom:16px">${list.map(([v, l]) =>
      `<button type="button" data-act="fc-set" data-k="${k}" data-v="${v}" class="${c[k] != null && String(c[k]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    return `<div class="sheet-bg ${c.fresh ? 'enter' : ''}" data-act="fc-cancel-bg"><div class="sheet"><div class="grab" aria-hidden="true"></div>
      <h2>Check in</h2>
      <p class="muted" style="margin:-6px 0 16px">${esc(x.ctx || 'Context')}: <b style="color:var(--text)">${esc(x.text)}</b></p>
      <p class="label">How often did you notice it?</p>
      ${opts('rating', [[0, 'Never'], [1, 'Once'], [2, 'A few times'], [3, 'Often'], [4, 'Constantly']])}
      <p class="label">Did it come up without you calling it?</p>
      ${opts('unbidden', [[1, 'Yes'], [0, 'No']])}
      <p class="label">When did it stop presenting? <span style="text-transform:none;letter-spacing:0">(optional)</span></p>
      ${opts('stopped', [['still', 'Still going'], ['lt1', 'Under 1h'], ['1to3', '1–3h'], ['gt3', '3h+'], ['never', 'Didn’t start']])}
      <button class="btn primary block" data-act="fc-save" ${c.rating == null || c.unbidden == null ? 'disabled' : ''}>Save check-in</button>
      <button class="btn ghost block" data-act="fc-cancel" style="margin-top:8px">Cancel</button>
    </div></div>`;
  }

  const anySheet = () => !!(V.cam || V.review || V.mup || V.mview || V.mcmp || V.woEx || V.nmeal || V.qa || V.edit || V.data || V.whatsNew || V.wedit || V.fcheck || V.tedit || V.nadd || V.ngoals || V.nprep || V.sedit || V.scan);

