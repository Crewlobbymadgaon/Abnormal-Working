// sw.js — for https://crewlobbymadgaon.github.io/Abnormal-Working/
const CACHE_NAME = 'blocksys-v4';
const RUNTIME = 'runtime-v1';

// Minimal app shell (loads page when offline)
const PRECACHE_MIN = [
  './',
  './index.html',
  './manifest.json',
  './abnormal-working-192.png',
  './abnormal-working-512.png'
];

// Full site to download for offline use
const PRECACHE_FULL = [
  './',
  './index.html',
  './manifest.json',
  './abnormal-working-192.png',
  './abnormal-working-512.png',
  './operating-form.html',
  './viewer.html'
  '.forms/t369.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_MIN))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k =>
          k !== CACHE_NAME && k !== RUNTIME ? caches.delete(k) : null
        )
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Handle navigations (HTML pages)
  if (
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html')
  ) {
    event.respondWith(
      fetch(req)
        .then(r => {
          caches.open(RUNTIME).then(c => c.put(req, r.clone()));
          return r;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first strategy for local assets
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req)
          .then(r => {
            caches.open(RUNTIME).then(c => c.put(req, r.clone()));
            return r;
          })
          .catch(() => caches.match('./index.html'));
      })
    );
  }
});

// Handle "download full site" message
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'DOWNLOAD_OFFLINE') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(async cache => {
        let ok = 0,
          fail = 0;
        for (const url of PRECACHE_FULL) {
          try {
            const r = await fetch(url, { cache: 'no-cache' });
            if (r.ok) {
              await cache.put(url, r.clone());
              ok++;
            } else fail++;
          } catch {
            fail++;
          }
        }
        const clientsList = await self.clients.matchAll();
        for (const c of clientsList)
          c.postMessage({ type: 'DOWNLOAD_COMPLETE', ok, fail });
      })
    );
  }
});
