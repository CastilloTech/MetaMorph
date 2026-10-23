// Runs every test suite against a local copy of the app and fails if any check fails.
//   npm test               (builds first, then runs all suites)
//   node tests/run.js reg  (just the named suites)
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');

const APP = path.join(__dirname, '..', 'app'), PORT = 8765;
const SUITES = ['reg', 'storage', 'schedule', 'nutrition', 'workouts', 'body', 'media', 'review', 'companion', 'quick', 'cloud', 'ux'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
                '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = path.join(APP, rel);
      if (!file.startsWith(APP) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(rsp);
    }).listen(PORT, '127.0.0.1', () => res(srv));
  });
}

function runSuite(name) {
  return new Promise(res => {
    const started = Date.now(), ch = spawn(process.execPath, [path.join(__dirname, name + '.js')], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    ch.stdout.on('data', d => { out += d; });
    ch.stderr.on('data', d => { out += d; });
    ch.on('close', code => res({ name, out, code, secs: Math.round((Date.now() - started) / 1000) }));
  });
}

(async () => {
  const only = process.argv.slice(2), list = only.length ? SUITES.filter(s => only.includes(s)) : SUITES;
  const srv = await serve();
  let pass = 0, fail = 0;
  for (const name of list) {
    const r = await runSuite(name);
    const p = (r.out.match(/^PASS /gm) || []).length, f = (r.out.match(/^FAIL /gm) || []).length;
    const broken = r.code !== 0 || (p === 0 && f === 0);
    pass += p; fail += f + (broken && f === 0 ? 1 : 0);
    console.log(`${f || broken ? '✗' : '✓'} ${name.padEnd(10)} ${p} passed${f ? `, ${f} failed` : ''}${broken && !f ? ' (suite crashed)' : ''}  ${r.secs}s`);
    if (f || broken) console.log(r.out.split(/\r?\n/).filter(l => !l.startsWith('PASS ')).map(l => '    ' + l).join('\n'));
  }
  srv.close();
  console.log(`\n${pass} checks passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
