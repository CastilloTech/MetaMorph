// Bump the version whenever app files change so installed copies update.
// Keep APP_VERSION in index.html in step with this number.
const CACHE = 'metamorph-v16';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon-32.png',
  './img/orb-chaos.webp', './img/orb-sleep.webp', './img/orb-fitness.webp', './img/orb-nutrition.webp', './img/orb-hygiene.webp', './img/orb-other.webp',
  './vendor/morphdom.min.js', './fonts/cinzel.woff2', './vendor/jszip.min.js'];

// A new version installs in the background and waits; the page shows an update prompt
// and sends SKIP_WAITING when the user taps Update.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // only the app's own files are cached; other sites (e.g. Open Food Facts) go straight to the network
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

// a reminder from the push server
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'MetaMorph', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
    icon: './icon-192.png', badge: './favicon-32.png', data: { url: d.url || './' },
  }));
});

// tapping a reminder opens the app straight to that action (log the sip, complete the routine, ...)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) { c.postMessage({ type: 'quick', url }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
