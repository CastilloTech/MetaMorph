  /* ----- CSV export ----- */

  const csvCell = v => { const x = v == null ? '' : String(v); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
  const csv = (head, rows) => [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  async function exportCSV() {
    const files = {};
    files['workouts.csv'] = csv(['date', 'workout', 'exercise', 'kind', 'set', 'reps', 'weight', 'bar', 'per_side', 'minutes', 'distance', 'unit', 'pr'],
      WK().log.flatMap(w => w.items.flatMap(it => it.sets.map((x, i) => [w.date, w.title || '', it.name, it.kind, i + 1, x.r ?? '', it.kind === 'strength' ? setW(x) : '', x.bar ?? '', x.ps ?? '', x.min ?? '', x.dist ?? '', WK().unit, (w.prs || []).includes(it.name) ? 'yes' : '']))));
    files['body.csv'] = csv(['date', 'weight_lb', 'body_fat_pct', ...PARTS.map(([k]) => k + '_in')],
      entriesSorted().map(e => [e.date, e.weight ?? '', navyBF(e) ?? '', ...PARTS.map(([k]) => e[k] ?? '')]));
    const nKeys = Object.keys(N().log).sort();
    files['nutrition_entries.csv'] = csv(['date', 'meal', 'food', 'servings', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
      nKeys.flatMap(k => nLog(k).map(e => [k, e.meal, e.name, e.qty, Math.round(e.kcal * e.qty), r1(e.p * e.qty), r1(e.c * e.qty), r1(e.f * e.qty)])));
    files['nutrition_daily.csv'] = csv(['date', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'goal_kcal', 'goal_protein_g'],
      nKeys.map(k => { const t = nTotals(k), g = goalsFor(k); return [k, Math.round(t.kcal), r1(t.p), r1(t.c), r1(t.f), g.kcal, g.p]; }));
    const dayKeys = Object.keys(S.done).sort();
    files['routines.csv'] = csv(['date', 'gate', 'routine', 'done', 'finished_at', 'late'],
      dayKeys.flatMap(k => GATES.flatMap(g => S.gates[g.id].filter(r => S.done[k][r.id]).map(r => { const ts = finOf(r.id, k); return [k, g.name, r.title, 'yes', ts ? new Date(ts).toLocaleString() : '', ts && finText(r, k).late ? 'yes' : '']; }))));
    files['water.csv'] = csv(['date', 'total_ml', 'target_ml'], Object.keys(W().log).sort().map(k => [k, wTotal(k), W().target]));
    const JSZip = await loadZip(), zip = new JSZip();
    for (const [name, text] of Object.entries(files)) zip.file(name, '﻿' + text);   // BOM so Excel reads UTF-8
    const blob = await zip.generateAsync({ type: 'blob' });
    if (await ask({ title: 'Spreadsheets ready', text: `${Object.keys(files).length} CSV files in one ZIP. Opens in Excel, Numbers or Google Sheets.`, ok: 'Save / share' }))
      deliver(new Blob([blob], { type: 'application/zip' }), `metamorph-export-${today()}.zip`, 'MetaMorph export');
  }

