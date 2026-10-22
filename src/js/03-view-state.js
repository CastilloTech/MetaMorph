  /* ---------- view state ---------- */

  const V = { tab: 'today', gate: 'sleep', edit: null, summary: null, cal: 'day', anchor: null, sel: null, data: false, slide: null,
              update: null, whatsNew: false, wedit: null, wFrom: null, fcheck: null, fDraft: { ctx: 'Today', text: '' },
              ptab: 'feature', qa: null, tedit: null, todoWhen: 'today', todoDraft: { text: '', date: '', time: '' }, nadd: null, ngoals: null, nprep: null,
              woKind: 'strength', btab: 'overview', bform: null, mfilter: 'all', mup: null, mview: null, mcmp: null, nday: null, nhist: 7, nmeal: null, woName: '', ttab: 'todo', supCat: 'Grocery', sedit: null, scan: false };
  const CALS = ['day', 'week', 'month'];
  const slideTo = (list, from, to) => list.indexOf(to) > list.indexOf(from) ? 'r' : list.indexOf(to) < list.indexOf(from) ? 'l' : null;
  let drillRun = null;  // { phase: settle|focus|release, round, doneRounds, start, end, latencies[], catches, falseTaps, locked }
  let featRun = null;   // { id, mode: loaded|control, end, held }
  let run = null;       // { gate, rid, idx, phase: step|between|complete, total, end, paused, remaining }
  let ticker = null;

  function startTicker() { stopTicker(); ticker = setInterval(tick, 200); }
  function stopTicker() { clearInterval(ticker); ticker = null; }

