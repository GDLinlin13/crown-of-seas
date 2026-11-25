// Offline cache for Crown of Seas: Chess TD. Bump VERSION whenever you publish a new build.
const VERSION = 'chess-td-v12';
const CORE = ['./', './index.html', './data.js', './art.js', './game.js', './treasure.js', './app.js', './manifest.webmanifest',
  './assets/home.webp', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, {cache:'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first, revalidated every time (no-cache = cheap 304 if unchanged), so a new publish shows up on the next open.
// Anything fetched (hero pictures included) is also cached for offline play.
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const nav = req.mode === 'navigate';
  e.respondWith(
    fetch(nav ? req.url : req, {cache:'no-cache'}).then(res => {
      if(nav && res.redirected) return Response.redirect(res.url, 302);   // e.g. /crown-of-seas -> /crown-of-seas/
      if(!res.ok) return caches.match(req, {ignoreSearch:true}).then(r => r || res);
      const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req, {ignoreSearch:true}).then(r => r || caches.match('./index.html')))
  );
});
