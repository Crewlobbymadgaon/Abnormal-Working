/* sw.js - place at repo root */
const CACHE_NAME = 'blocksys-v1';
const APP_SHELL = self.location.origin + self.location.pathname; // canonical app shell
const PRECACHE = [ APP_SHELL, './' ];

/* Safe cache put helper */
async function safeCachePut(request, response) {
  try {
    if (!response || response.status !== 200) return;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (e) {
    console.warn('safeCachePut failed', e);
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // best-effort addAll precache
      return cache.addAll(PRECACHE).catch(err => {
        console.warn('Precaching failed (non-fatal):', err);
        return Promise.resolve();
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Navigation requests -> serve app shell (cache-first), fallback to network then fallback page
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(APP_SHELL).then(cached => {
        if (cached) return cached;
        return fetch(req).then(net => {
          safeCachePut(APP_SHELL, net.clone()).catch(()=>{});
          return net;
        }).catch(() => caches.match(APP_SHELL).then(f => f || new Response('Offline', { status: 503 })));
      })
    );
    return;
  }

  // Same-origin static assets: cache-first, then network and cache
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(net => {
          // cache successful basic responses
          if (net && net.status === 200 && net.type === 'basic') safeCachePut(req, net.clone());
          return net;
        }).catch(() => {
          // fallback to app shell for HTML accepts
          const accept = req.headers.get('accept') || '';
          if (accept.includes('text/html')) return caches.match(APP_SHELL);
          return caches.match(APP_SHELL);
        });
      })
    );
    return;
  }

  // Cross-origin requests: network-first then cache fallback
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

/* Optional message controls (callable from page)
   postMessage('downloadOffline') or postMessage('skipWaiting')
*/
self.addEventListener('message', evt => {
  if (!evt.data) return;
  if (evt.data === 'skipWaiting') return self.skipWaiting();
  if (evt.data === 'downloadOffline') {
    caches.open(CACHE_NAME).then(async cache => {
      // best-effort: try to cache the app shell
      try {
        const r = await fetch(APP_SHELL).catch(()=>null);
        if (r && r.ok) await cache.put(APP_SHELL, r.clone());
      } catch (e) { console.warn('downloadOffline failed', e); }
    });
  }
});
