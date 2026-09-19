// Student Task Manager - Service Worker
// Provides offline shell, caching, and installability

const CACHE_NAME = 'planner-v2';
const SHELL = [
  '/',
  '/static/manifest.json',
  '/static/style.css',
  '/static/script.js',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/static/icons/maskable-192.png',
  '/login',
  '/register'
];

// Install - cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch - network-first for API and navigation, cache-first for assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET
  if (req.method !== 'GET') return;

  // API: network-first, fallback to cache if offline (stale)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // cache successful GETs for offline reading
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Navigation: network-first with offline fallback to cached "/"
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || caches.match('/');
        })
    );
    return;
  }

  // Static assets: cache-first, then network
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok && url.origin === location.origin) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          // fallback for images
          if (req.destination === 'image') return caches.match('/static/icons/icon-192.png');
        });
    })
  );
});

// Allow page to trigger skipWaiting
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
