// sw.js — improved for https://crewlobbymadgaon.github.io/Abnormal-Working/
const CACHE_NAME = 'blocksys-v5';     // <- bump on deploy to force fresh install
const RUNTIME = 'runtime-v1';

// App shell - minimal (always precache)
const PRECACHE_MIN = [
  './',
  './index.html',
  './manifest.json',
  './abnormal-working-192.png',
  './abnormal-working-512.png'
];

// Additional full-site assets for "download offline"
const PRECACHE_FULL = [
  './',
  './index.html',
  './manifest.json',
  './abnormal-working-192.png',
  './abnormal-working-512.png',
  './operating-form.html',
  './viewer.html',
  './forms/t369.png'
];

// Navigation pages normalized keys we use as fallback
const NAV_PAGES = ['/','/index.html'];

// helpers
function notifyClients(msg) {
  return self.clients.matchAll({ includeUncontrolled: true }).then(clients =>
    clients.forEach(c => c.postMessage(msg))
  );
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_MIN))
  );
  // activate immediately so new SW becomes controlling (you may remove skipWaiting if you want more cautious rollout)
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME && k !== RUNTIME) ? caches.delete(k) : Promise.resolve()))
    ).then(() => self.clients.claim())
  );
});

// Utility: normalise a request URL to a key we know (for nav fallback)
function normalizeForNav(request) {
  try {
    const url = new URL(request.url);
    // Only treat same-origin navigations as pages
    if (url.origin !== self.location.origin) return null;
    // always return index.html key for navigations
    return '/index.html';
  } catch (e) {
    return null;
  }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return; // ignore non-GET

  const url = new URL(req.url);

  // NAVIGATION handling: stale-while-revalidate for pages
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match('/index.html');

      // Kick off a network fetch in background to update the cache
      const networkFetch = fetch(req).then(async networkResponse => {
        try {
          if (networkResponse && networkResponse.ok) {
            // update normalized nav key so offline fallback is consistent
            await cache.put('/index.html', networkResponse.clone());
            // notify clients that we have a new version
            notifyClients({ type: 'NAV_UPDATED' });
          }
        } catch (err) {
          // silent
        }
        return networkResponse;
      }).catch(() => null);

      // If cached response exists, serve it immediately and update in background
      if (cachedResponse) {
        // start networkUpdate but don't wait
        networkFetch.catch(()=>{});
        return cachedResponse;
      }

      // No cached page — wait for network or fall back to cached index if network fails
      const net = await networkFetch;
      if (net) return net;
      // last resort: return any precached nav key
      const fallback = await cache.match('/index.html');
      return fallback || new Response('<h1>Offline</h1><p>Application not available offline.</p>', { headers: { 'Content-Type': 'text/html' }});
    })());
    return;
  }

  // Same-origin assets: cache-first (fast) then network and cache runtime
  if (url.origin === location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const networkResponse = await fetch(req);
        if (networkResponse && networkResponse.ok) {
          cache.put(req, networkResponse.clone()).catch(()=>{});
        }
        return networkResponse;
      } catch (err) {
        // As fallback for images/pages, try index.html so app still shows
        const appShell = await caches.open(CACHE_NAME).then(c => c.match('/index.html'));
        if (appShell) return appShell;
        return new Response('', { status: 504, statusText: 'Gateway Timeout' });
      }
    })());
    return;
  }

  // Cross-origin requests: network-first (no caching) — allow them to fail
  // (you can extend this to cache specific third-party resources if needed)
});


// Message listener for "download offline" & other commands
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data && data.type === 'DOWNLOAD_OFFLINE') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      let ok = 0, fail = 0;
      for (const url of PRECACHE_FULL) {
        try {
          const resp = await fetch(url, { cache: 'no-cache' });
          if (resp && resp.ok) {
            await cache.put(url, resp.clone());
            ok++;
          } else {
            fail++;
          }
        } catch (err) {
          fail++;
        }
      }
      // inform pages
      await notifyClients({ type: 'DOWNLOAD_COMPLETE', ok, fail });
    })());
  }

  // you can also handle a SKIP_WAITING message from page (if you use update flow)
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
