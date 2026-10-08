// Bump the version whenever app files change so installed copies update.
// Keep APP_VERSION in index.html in step with this number.
const CACHE = 'metamorph-v7';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon-32.png',
  './img/orb-chaos.webp', './img/orb-sleep.webp', './img/orb-fitness.webp', './img/orb-nutrition.webp', './img/orb-hygiene.webp'];

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
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
