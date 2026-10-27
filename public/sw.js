// Service worker för appen. Sparar bara offlinesidan – bokningar och annan data hämtas alltid färskt.
const CACHE = 'halkbana-v1';
const OFFLINE = ['/offline.html', '/icons/icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
  } else if (OFFLINE.includes(new URL(request.url).pathname)) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
  }
});
