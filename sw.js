const CACHE_NAME = 'blocksys-v1';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './abnormal-working-192.png',
  './abnormal-working-512.png'
  './operating-form.html'
  './viewer.html'
];

// install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)
    ))
  );
  self.clients.claim();
});

// fetch
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./')));
    return;
  }
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
