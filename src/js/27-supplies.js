  /* ----- supplies ----- */

  const SUP = () => S.supplies;
  const SUP_CATS = ['Grocery', 'Hygiene', 'Household', 'Other'];
  const money = n => (n == null || n === '' ? '—' : Number(n).toLocaleString(undefined, { style: 'currency', currency: 'USD' }));
  const walmartUrl = x => x.url || `https://www.walmart.com/search?q=${encodeURIComponent(x.name)}`;
  function priceTrend(x) {
    const h = x.history || [];
    if (h.length < 2) return '';
    const a = h[h.length - 2].price, b = h[h.length - 1].price;
    if (b > a) return ` · <span class="up">↑ was ${money(a)}</span>`;
    if (b < a) return ` · <span class="down">↓ was ${money(a)}</span>`;
    return '';
  }

  function todoTabView() {
    if (!on('todo')) V.ttab = 'supplies';
    if (!on('supplies')) V.ttab = 'todo';
    if (!on('todo') || !on('supplies')) return V.ttab === 'supplies' ? suppliesView() : todoView();
    const seg = `<div class="seg" style="grid-template-columns:1fr 1fr">${[['todo', 'To-do'], ['supplies', 'Supplies']].map(([k, l]) =>
      `<button data-act="ttab" data-v="${k}" class="${V.ttab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    return seg + (V.ttab === 'supplies' ? suppliesView() : todoView());
  }

  function supRow(x, onList) {
    return `<li>
      ${onList ? `<button class="chk" data-act="sup-bought" data-id="${x.id}" aria-label="Bought">✓</button>` : '<span></span>'}
      <span class="nm" data-act="sup-edit" data-id="${x.id}"><div>${esc(x.name)}${onList && (x.qty || 1) > 1 ? ` <span class="muted">× ${x.qty}</span>` : ''}</div>
        <div class="t num">${money(x.price)}${x.priceAt ? ` · checked ${ago(x.priceAt)}` : ''}${priceTrend(x)}</div></span>
      <span class="acts2">
        ${onList ? `<button class="btn" data-act="sup-qty" data-id="${x.id}" data-d="-1" aria-label="Fewer">−</button><button class="btn" data-act="sup-qty" data-id="${x.id}" data-d="1" aria-label="More">+</button>`
                 : `<button class="btn ${x.need ? 'on' : ''}" data-act="sup-list" data-id="${x.id}">${x.need ? 'On list' : '+ List'}</button>`}
        <a class="btn" href="${walmartUrl(x)}" target="_blank" rel="noopener" aria-label="Check ${esc(x.name)} on Walmart"><span class="wm">✱</span> Walmart</a>
      </span></li>`;
  }

  function suppliesView() {
    const items = SUP().items, list = items.filter(x => x.need);
    const total = list.reduce((t, x) => t + (x.price || 0) * (x.qty || 1), 0), unpriced = list.filter(x => x.price == null).length;
    return `
      <form class="card" id="supadd" autocomplete="off">
        <div class="custom" style="margin:0"><input name="name" placeholder="Add an item (e.g. toothpaste)" aria-label="Item name" autocapitalize="sentences" enterkeyhint="done"><button class="btn primary" type="submit">Add</button></div>
        <div class="opts" style="margin-top:10px">${SUP_CATS.map(c => `<button type="button" data-act="sup-cat" data-v="${c}" class="${V.supCat === c ? 'on' : ''}">${c}</button>`).join('')}</div>
        <div class="grid2" style="margin-top:10px">
          <div class="field" style="margin:0"><label>Walmart price (optional)</label><input name="price" type="number" inputmode="decimal" min="0" step="0.01" placeholder="$"></div>
          <label class="checkrow" style="margin:22px 0 0"><input type="checkbox" name="need" checked> Add to shopping list</label>
        </div>
      </form>
      <div class="sechead"><h3>Shopping list</h3><span class="muted num" style="font-size:13px">${list.length} item${list.length === 1 ? '' : 's'}</span></div>
      <div class="card">${list.length ? `<ul class="todos sup">${list.map(x => supRow(x, true)).join('')}</ul>
        <div class="sumrow"><span class="muted">Estimated total${unpriced ? ` · ${unpriced} without a price` : ''}</span><b>${money(total)}</b></div>`
        : '<p class="muted" style="margin:0">Nothing on the list. Tap “+ List” on an item below.</p>'}</div>
      ${SUP_CATS.map(c => { const xs = items.filter(x => x.cat === c); return xs.length ? `
        <div class="grouphead"><h3>${c}</h3><span class="muted num" style="font-size:13px">${xs.length}</span></div>
        <div class="card" style="padding-top:6px;padding-bottom:6px"><ul class="todos sup">${xs.map(x => supRow(x, false)).join('')}</ul></div>` : ''; }).join('')}
      <p class="note">Prices are what you enter. “Walmart” opens Walmart’s search for the item so you can check the current price, then tap the item to update it. Walmart doesn’t offer a public price feed.</p>`;
  }

  function supSheet() {
    const e = V.sedit;
    return `<div class="sheet-bg ${e.fresh ? 'enter' : ''}" data-act="sup-cancel-bg">
      <form class="sheet" id="supform" autocomplete="off"><div class="grab" aria-hidden="true"></div>
        <h2>Edit item</h2>
        <div class="field"><label>Name</label><input name="name" required value="${esc(e.name)}"></div>
        <div class="opts" style="margin-bottom:12px">${SUP_CATS.map(c => `<label class="chip"><input type="radio" name="cat" value="${c}" ${e.cat === c ? 'checked' : ''}><span>${c}</span></label>`).join('')}</div>
        <div class="grid2">
          <div class="field"><label>Walmart price</label><input name="price" type="number" inputmode="decimal" min="0" step="0.01" value="${e.price ?? ''}"></div>
          <div class="field"><label>Quantity on list</label><input name="qty" type="number" inputmode="numeric" min="1" step="1" value="${e.qty || 1}"></div>
        </div>
        <div class="field"><label>Walmart product link (optional)</label><input name="url" type="url" placeholder="https://www.walmart.com/ip/…" value="${esc(e.url || '')}"></div>
        <a class="btn block" href="${walmartUrl(e)}" target="_blank" rel="noopener" style="margin-bottom:8px;text-align:center;text-decoration:none"><span class="wm">✱</span> Check price on Walmart</a>
        ${(e.history || []).length ? `<p class="label" style="margin-top:6px">Price history</p><ul class="flog">${e.history.slice(-6).reverse().map(h => `<li><span class="num">${new Date(h.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span><span class="num">${money(h.price)}</span></li>`).join('')}</ul>` : ''}
        <button class="btn primary block" type="submit" style="margin:12px 0 8px">Save</button>
        <div class="grid2"><button class="btn" type="button" data-act="sup-cancel">Cancel</button><button class="btn danger" type="button" data-act="sup-del" data-id="${e.id}">Delete</button></div>
      </form></div>`;
  }
  function setPrice(x, price) {
    if (price == null || isNaN(price)) return;
    price = Math.round(price * 100) / 100;
    x.history = x.history || [];
    if (!x.history.length || x.history[x.history.length - 1].price !== price) x.history.push({ t: Date.now(), price });
    x.price = price; x.priceAt = Date.now();
  }

