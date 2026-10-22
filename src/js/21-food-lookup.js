  /* ----- food lookup: Open Food Facts ----- */

  const OFF = 'https://world.openfoodfacts.org';
  const OFF_FIELDS = 'code,product_name,brands,serving_size,nutriments';
  // per serving when the product lists it, otherwise per 100 g
  function offItem(pr) {
    const n = pr.nutriments || {};
    const per = n['energy-kcal_serving'] != null || n.proteins_serving != null ? 'serving' : '100g';
    const g = k => +(n[`${k}_${per}`] ?? 0) || 0;
    let kcal = g('energy-kcal');
    if (!kcal && n[`energy_${per}`]) kcal = n[`energy_${per}`] / 4.184;   // kJ -> kcal
    const brand = pr.brands ? pr.brands.split(',')[0].trim() : '';
    return { name: [pr.product_name, brand].filter(Boolean).join(' · ') || 'Unnamed product',
             serving: per === 'serving' ? (pr.serving_size || '1 serving') : '100 g',
             kcal: Math.round(kcal), p: r1(g('proteins')), c: r1(g('carbohydrates')), f: r1(g('fat')), code: pr.code || '' };
  }
  // Open Food Facts' search sometimes answers "busy" (and browsers can't read that reply), so retry a few times;
  // if it's still down, fall back to USDA FoodData Central (free demo key: a handful of searches an hour).
  async function offSearch(q) {
    const keep = list => (list || []).filter(x => x.product_name && x.nutriments).map(offItem);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(`${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&fields=${OFF_FIELDS}`);
        if (r.ok) { const res = keep((await r.json()).products); if (res.length) return res; break; }
      } catch (e) {}
      await new Promise(res => setTimeout(res, 900 * (attempt + 1)));
    }
    return fdcSearch(q);
  }
  async function fdcSearch(q) {
    const r = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&query=${encodeURIComponent(q)}&pageSize=20&dataType=Foundation,SR%20Legacy,Branded`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    return (j.foods || []).map(x => {
      const n = {};
      for (const m of x.foodNutrients || []) {
        if (m.nutrientName === 'Energy' && m.unitName !== 'KCAL') continue;
        n[m.nutrientName] = +m.value || 0;
      }
      // USDA values are per 100 g; scale to the labelled serving when there is one
      const g = /^(g|ml|grm)$/i.test(x.servingSizeUnit || '') && x.servingSize ? x.servingSize : null;
      const k = g ? g / 100 : 1;
      const title = (x.description || 'Food').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      return { name: [title, x.brandName || x.brandOwner].filter(Boolean).join(' · '), serving: g ? `${r1(g)} ${String(x.servingSizeUnit).toLowerCase() === 'ml' ? 'ml' : 'g'}` : '100 g',
               kcal: Math.round((n.Energy || n['Energy (Atwater General Factors)'] || 0) * k), p: r1((n.Protein || 0) * k),
               c: r1((n['Carbohydrate, by difference'] || 0) * k), f: r1((n['Total lipid (fat)'] || 0) * k), code: x.gtinUpc || '' };
    }).filter(x => x.kcal || x.p || x.c || x.f);
  }
  async function offBarcode(code) {
    const r = await fetch(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
    if (!r.ok && r.status !== 404) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    return j.status === 1 && j.product ? offItem(j.product) : null;
  }
  const canScan = () => 'BarcodeDetector' in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  function lookupPane(a) {
    const res = a.results;
    return `
      <form id="offform" class="custom" style="margin:0 0 8px" autocomplete="off"><input name="q" class="search" placeholder="Search foods or type a barcode" type="search" enterkeyhint="search" value="${esc(a.oq)}"><button class="btn primary" type="submit">Search</button></form>
      ${canScan() ? '<button class="btn block" data-act="scan-open" style="margin-bottom:8px">Scan a barcode</button>' : ''}
      ${a.busy ? '<p class="muted">Searching…</p>' : a.err ? `<p class="hint warn">${esc(a.err)}</p>` : ''}
      ${res ? (res.length ? `<ul class="foodlist offres">${res.map((x, i) => `<li><span><div>${esc(x.name)}</div><div class="t num">${esc(x.serving)} · ${macLine(x)}</div></span>
          <button class="btn small primary" data-act="off-pick" data-i="${i}">Use</button></li>`).join('')}</ul>` : '<p class="muted">No matches. Try fewer words, or use New food.</p>') : ''}
      <p class="note">Results come from Open Food Facts (and USDA FoodData Central if it’s busy), free public databases. Only your search words are sent.</p>`;
  }
  async function runLookup(q) {
    const a = V.nadd;
    a.oq = q; a.busy = true; a.err = ''; a.results = null; render();
    try {
      if (/^\d{8,14}$/.test(q)) { const x = await offBarcode(q); a.results = x ? [x] : []; if (!x) a.err = 'That barcode isn’t in Open Food Facts yet.'; }
      else a.results = await offSearch(q);
    } catch (e) { a.err = navigator.onLine === false ? 'You’re offline. Food lookup needs internet.' : 'Couldn’t reach the food databases. Try again in a moment, or use New food.'; }
    a.busy = false;
    if (V.nadd === a) render();
  }

  let scanStream = null, scanRaf = 0;
  async function startScan() {
    V.scan = true; render();
    const msg = t => { const m = document.getElementById('scanmsg'); if (m) m.textContent = t; };
    try {
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const v = document.getElementById('scanvid');
      v.srcObject = scanStream; await v.play();
      const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      const loop = async () => {
        if (!V.scan) return;
        try {
          const codes = await det.detect(v);
          if (codes.length) { const code = codes[0].rawValue; stopScan(); V.scan = false; buzz(); runLookup(code); return; }
        } catch (e) {}
        scanRaf = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) { msg('Camera unavailable. Type the barcode number into the search box instead.'); }
  }
  function stopScan() {
    cancelAnimationFrame(scanRaf);
    if (scanStream) scanStream.getTracks().forEach(t => t.stop());
    scanStream = null;
  }

