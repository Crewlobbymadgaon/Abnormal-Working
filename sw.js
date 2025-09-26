/* sw.js - place at repo root */
const CACHE_NAME = 'blocksys-v1';
const SHELL_PATH = self.location.origin + self.location.pathname;
const PRECACHE = [ SHELL_PATH, './' ];

async function safeCachePut(request, response) {
  try {
    if (!response || response.status !== 200) return;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (e) { console.warn('safeCachePut failed', e); }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(PRECACHE).catch(err => { console.warn('Precaching failed (non-fatal):', err); return Promise.resolve(); })
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(SHELL_PATH).then(cached => {
        if (cached) return cached;
        return fetch(req).then(net => { safeCachePut(SHELL_PATH, net.clone()).catch(()=>{}); return net; })
          .catch(() => caches.match(SHELL_PATH).then(f => f || new Response('Offline', {status:503})));
      })
    );
    return;
  }

  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(net => {
          if (net && net.status === 200 && net.type === 'basic') safeCachePut(req, net.clone());
          return net;
        }).catch(() => {
          const accept = req.headers.get('accept') || '';
          if (accept.includes('text/html')) return caches.match(SHELL_PATH);
          return caches.match(SHELL_PATH);
        });
      })
    );
    return;
  }

  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

self.addEventListener('message', evt => {
  if (!evt.data) return;
  if (evt.data === 'skipWaiting') return self.skipWaiting();
  if (evt.data === 'downloadOffline') {
    caches.open(CACHE_NAME).then(async cache => {
      try {
        const r = await fetch(SHELL_PATH).catch(()=>null);
        if (r && r.ok) await cache.put(SHELL_PATH, r.clone());
      } catch(e){ console.warn('downloadOffline failed', e); }
    });
  }
});
