// sw.js — place at your site root (/) so it controls the whole app scope
const CACHE_NAME = 'blocksys-v1'; // bump this string when you want clients to refresh cache
const PRECACHE_URLS = [
  '/',                // root (GitHub Pages will serve index.html)
  '/index.html',      // ensure your index is cached (adjust path if the file is at repo root or docs/)
  '/manifest.json',
  // Add any static files you want cached (icons, CSS). Example:
  '/styles.css',
  '/app.js'
  // if you don't have separate files for CSS/JS, you can omit them.
];

// A simple limit helper to avoid unbounded cache growth
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => {
        if (k !== CACHE_NAME) return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Navigation requests (HTML): network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(resp => {
        // update cache with fresh index.html for next offline
        caches.open(CACHE_NAME).then(cache => cache.put('/', resp.clone()));
        return resp;
      }).catch(() => caches.match('/') )
    );
    return;
  }

  // For same-origin assets: cache-first (fast offline)
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
          // cache only GET and basic responses
          if (request.method === 'GET' && resp && resp.type === 'basic' && resp.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, resp.clone());
              trimCache(CACHE_NAME, 60); // keep cache size under control
            });
          }
          return resp;
        }).catch(() => {
          // optional: return a fallback image for images, etc.
          return caches.match('/'); // fallback to shell
        });
      })
    );
    return;
  }

  // Default: try network, fallback to cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
