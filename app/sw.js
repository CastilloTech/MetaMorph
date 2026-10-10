// Bump the version whenever app files change so installed copies update.
// Keep APP_VERSION in index.html in step with this number.
const CACHE = 'metamorph-v13';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon-32.png',
  './img/orb-chaos.webp', './img/orb-sleep.webp', './img/orb-fitness.webp', './img/orb-nutrition.webp', './img/orb-hygiene.webp', './img/orb-other.webp',
  './vendor/morphdom.min.js', './fonts/cinzel.woff2'];

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
