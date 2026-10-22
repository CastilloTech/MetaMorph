// Shared test helpers: launch a browser, open the app with seeded state, tap things, read saved state.
// Uses Edge on Windows, Chrome/Chromium elsewhere (or CHROME_PATH).
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const BROWSER = process.env.CHROME_PATH || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(fs.existsSync);
const URL = process.env.BASE_URL || 'http://127.0.0.1:8765/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const launch = (args = []) => puppeteer.launch({ executablePath: BROWSER, headless: true, args: [...args, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])] });

async function open({ width = 390, height = 844, mobile = false, args = [] } = {}) {
  const browser = await launch(args);
  const p = await browser.newPage();
  await p.setViewport({ width, height, isMobile: mobile, hasTouch: mobile });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(URL); await sleep(400);
  const out = [];
  const t = {
    browser, p, errs, out, sleep,
    ok: (name, v) => out.push((v ? 'PASS ' : 'FAIL ') + name),
    // tap by DOM click so the fixed tab bar can't swallow it
    tap: async (sel, wait = 260) => { await p.$eval(sel, e => e.click()); await sleep(wait); },
    has: async sel => !!(await p.$(sel)),
    text: async sel => (await p.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null)),
    texts: async sel => p.$$eval(sel, l => l.map(e => e.textContent.replace(/\s+/g, ' ').trim())),
    state: () => p.evaluate(() => JSON.parse(localStorage.getItem('metamorph.v1'))),
    // edit saved state (function source runs in the page with s = state and time helpers), then reload
    seed: async fnSrc => {
      await p.evaluate(`(() => {
        const s = JSON.parse(localStorage.getItem('metamorph.v1'));
        const d = new Date(), now = d.getHours() * 60 + d.getMinutes();
        const hm = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
        const key = (x = new Date()) => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
        s.onboarded = true; s.seenVersion = 999;
        (${fnSrc})(s, { now, hm, key });
        localStorage.setItem('metamorph.v1', JSON.stringify(s));
      })()`);
      await p.reload(); await sleep(500);
      if (await p.$('[data-act=whatsnew-close]')) { await p.$eval('[data-act=whatsnew-close]', e => e.click()); await sleep(250); }
      await p.evaluate(() => document.querySelectorAll('.sheet-bg, .cele').forEach(e => e.remove()));
    },
    clearCele: () => p.evaluate(() => document.querySelectorAll('.cele').forEach(e => e.remove())),
    done: async () => {
      t.ok('no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''), !errs.length);
      console.log(out.join('\n'));
      await browser.close();
    },
  };
  return t;
}
module.exports = { open, sleep, launch, URL, BROWSER };
