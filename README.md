# MetaMorph

An offline web app (PWA) for the four Gates (sleep, fitness, nutrition, hygiene), routines, nutrition, workouts, body tracking and attention practice.

Live: https://castillotech.github.io/MetaMorph/

## Working on it

The app is built from `src/` into a single page, `app/index.html`.

```
src/template.html   the page shell
src/css/*.css       styles, joined in file order
src/js/*.js         script parts, joined in file order into one script
build.mjs           joins them (no dependencies)
```

```
npm install         # once; installs the test browser driver (no browser download)
npm run build       # rebuild app/index.html after editing src/
npm run dev         # build and serve at http://127.0.0.1:5173
npm test            # build and run every test suite (uses Edge or Chrome)
node tests/run.js reg body   # run just some suites
```

Commit the rebuilt `app/index.html` with your changes. On every push, GitHub builds, checks that the committed page matches, runs all tests, and only publishes if they pass.

When app files change, bump `CACHE` in `app/sw.js` and `APP_VERSION` (with a `CHANGELOG` entry) in `src/js/` so installed copies show the update prompt.

## Push reminders (`push/`)

A small Cloudflare Worker that stores each device's reminder schedule and sends due reminders once a minute (encrypted Web Push, VAPID-signed).

One-time setup (needs a free Cloudflare account):

```
cd push
npx wrangler login
npx wrangler kv namespace create SUBS        # put the printed id into wrangler.toml
npx wrangler secret put VAPID_PRIVATE_JWK    # paste privateJwk from ~/.metamorph/vapid.json
npx wrangler deploy                          # prints the worker's URL
```

Then set `PUSH_URL` in `src/js/24b-reminders.js` to that URL, rebuild and push. `node push/test.mjs` checks encryption and scheduling offline; `node push/e2e.mjs` sends a real notification through this machine's browser.

The private key never goes in the repo. If it's lost, generate a new pair, update `VAPID_PUBLIC` in `wrangler.toml` and `src/js/24b-reminders.js`, and devices re-enable reminders once.
