// ─────────────────────────────────────────────────────
//  Memento — Service Worker
//  Strategy: Cache-first for app shell, network-first for fonts
// ─────────────────────────────────────────────────────

const SW_VERSION = '1.3.0';
const CACHE_NAME = `memento-v${SW_VERSION}`;

// App shell — everything needed to run offline
const SHELL = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── Install: pre-cache the app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())   // activate immediately
  );
});

// ── Activate: delete old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('memento-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for same-origin, network-first for external (fonts) ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Google Fonts — network with cache fallback
  if (url.hostname.includes('fonts.')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // App shell & same-origin assets — cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          // Cache successful responses
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else — network only
  event.respondWith(fetch(event.request));
});

// ── Message: allow clients to trigger cache update ──
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
