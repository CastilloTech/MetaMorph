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

### Companion chat

The companion's chat goes through the same Worker (`push/src/chat.js`), which holds the Anthropic API key so it never reaches the browser. Each message carries a short snapshot of the day; Claude replies and suggests changes as tool calls, which the app shows as cards to accept or skip.

```
cd push
npx wrangler secret put ANTHROPIC_API_KEY    # from console.anthropic.com
npx wrangler secret put COMPANION_CODE       # any long random code; enter it once in the app (Companion → Chat)
npx wrangler deploy
```

`CHAT_MODEL` and `CHAT_DAILY_LIMIT` in `wrangler.toml` set the model and a daily message cap. Set a monthly spend limit in the Anthropic console too.

### Siri & Shortcuts inbox

`push/src/inbox.js` lets an iPhone shortcut log things without opening the app: it POSTs a short message (`water 500`, `done`, `weight 182`, or any free text) to `/inbox` with the `X-Companion-Code` header. The app picks waiting messages up when it opens, applies them with the time they were sent, and clears them. Free text goes to the companion chat. Setup steps for the phone are in the app under Settings → Siri & Shortcuts.

### Cloud backup

`push/src/backup.js` stores the app's daily backup. The app encrypts it first (AES-GCM, key from the user's passphrase via PBKDF2), so the server only holds unreadable bytes; one copy per day is kept for 30 days, plus the latest. Restore is in the app under Settings → Cloud backup.

The private key never goes in the repo. If it's lost, generate a new pair, update `VAPID_PUBLIC` in `wrangler.toml` and `src/js/24b-reminders.js`, and devices re-enable reminders once.
