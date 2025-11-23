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
  './viewer.html',
  './forms/t369.webp',
  './forms/tc1425.webp',
  './forms/td1425.webp',
  './forms/t806.webp',
  './forms/t509.webp',
  './forms/t510.webp',
  './forms/t511.webp',
  './forms/t512.webp',
  './forms/ta602.webp',
  './forms/tb602.webp',
  './forms/tc602.webp',
  './forms/td602.webp',
  './forms/te602.webp',
  './forms/tf602.webp',
  './forms/tg602.webp',
  './forms/th602.webp',
  './forms/t609.webp',
  './forms/t409.webp',
  './forms/ta409.webp',
  './forms/tb409.webp',
  './forms/ta912.webp',
  './forms/tb912.webp',
  './forms/tc912.webp',
  './forms/td912.webp',
  './forms/te912.webp',
];

// Helper: cache put but swallow/log errors and ensure we clone once
async function safeCachePut(cacheName, request, response) {
  if (!response || response.type === 'error' || response.status !== 200) return;
  try {
    const cache = await caches.open(cacheName);
    // clone once for cache (we assume caller keeps/or returns original)
    const responseForCache = response.clone();
    await cache.put(request, responseForCache);
  } catch (err) {
    // avoid unhandled rejections and log for debugging
    console.warn('safeCachePut failed for', request.url, err);
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_MIN))
      .catch(err => console.warn('Precaching failed', err))
  );
  // activate as soon as possible
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k => (k !== CACHE_NAME && k !== RUNTIME) ? caches.delete(k) : null)
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // only handle GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // navigation requests: network-first, fallback to cached app shell
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(req);
        // cache the successful response for future navigations (safe)
        safeCachePut(RUNTIME, req, networkResponse);
        // return a clone of the response to the browser
        return networkResponse.clone();
      } catch (err) {
        // fallback to app shell — prefer the root of your app on GH pages
        const fallback = await caches.match('/Abnormal-Working/') || await caches.match('./index.html');
        return fallback || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // for same-origin static assets: cache-first then network (and cache success)
  if (url.origin === location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const networkResponse = await fetch(req);
        // try to cache the resource but don't block response if caching fails
        safeCachePut(RUNTIME, req, networkResponse);
        return networkResponse.clone();
      } catch (err) {
        // as a last resort serve the app shell index
        const fallback = await caches.match('./index.html') || await caches.match('/Abnormal-Working/');
        return fallback || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
  } else {
    // cross-origin requests: network-first with no caching (or you can implement caching for images)
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch (err) {
        return new Response('Network error', { status: 502 });
      }
    })());
  }
});

// Handle "download full site" message
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'DOWNLOAD_OFFLINE') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      let ok = 0, fail = 0;
      for (const url of PRECACHE_FULL) {
        try {
          // prefer a fresh response
          const r = await fetch(url, { cache: 'no-cache' });
          if (r && r.ok) {
            // cache.put expects a Response; clone once here
            await cache.put(url, r.clone());
            ok++;
          } else {
            fail++;
            console.warn('Failed to fetch', url, r && r.status);
          }
        } catch (e) {
          fail++;
          console.warn('Error downloading', url, e);
        }
      }
      // inform clients about result
      const clientsList = await self.clients.matchAll();
      for (const c of clientsList) {
        c.postMessage({ type: 'DOWNLOAD_COMPLETE', ok, fail });
      }
    })());
  }
});
