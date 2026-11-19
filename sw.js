// Offline cache for Crown of Seas: Chess TD. Bump VERSION whenever you publish a new build.
const VERSION = 'chess-td-v1';
const CORE = ['./', './index.html', './data.js', './art.js', './game.js', './treasure.js', './app.js', './manifest.webmanifest',
  './assets/home.webp', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first so updates arrive when online; anything fetched (hero pictures included) is cached for offline play.
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, {ignoreSearch:true}).then(r => r || caches.match('./index.html')))
  );
});
