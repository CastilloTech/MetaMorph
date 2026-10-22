  /* ----- practice ----- */

  function practiceView() {
    const seg = `<div class="seg" style="grid-template-columns:1fr 1fr">${[['feature', 'Feature Law'], ['drill', 'Switch Drill']].map(([k, l]) =>
      `<button data-act="ptab" data-v="${k}" class="${V.ptab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    return seg + (V.ptab === 'drill' ? drillView() : featureView());
  }

