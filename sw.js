// sw.js — put this next to index.html inside your Abnormal-Working folder
const CACHE_NAME = 'blocksys-v1';
const PRECACHE = [
  './',               // navigation shell (index.html)
  './index.html',
  './manifest.json',
  './icons/abnormal-192.png',
  './icons/abnormal-512.png'
  // add other static assets you want cached: './styles.css', './app.js'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evt => {
  const req = evt.request;
  // navigation requests: try network, fallback to cache shell
  if (req.mode === 'navigate') {
    evt.respondWith(
      fetch(req).then(res => {
        caches.open(CACHE_NAME).then(c => c.put('./', res.clone()));
        return res;
      }).catch(() => caches.match('./'))
    );
    return;
  }

  // same-origin assets: cache-first
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    evt.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(net => {
        if (req.method === 'GET' && net && net.status === 200 && net.type === 'basic') {
          caches.open(CACHE_NAME).then(c => c.put(req, net.clone()));
        }
        return net;
      }).catch(()=> caches.match('./')))
    );
    return;
  }

  // cross-origin: network-first fallback to cache
  evt.respondWith(fetch(req).catch(()=> caches.match(req)));
});
