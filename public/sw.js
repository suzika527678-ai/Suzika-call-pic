const CACHE_NAME = 'suzika-pwa-v19';
const APP_SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/og-image.png',
  '/og-image.png?v=5',
  '/assets/aistudio/GFaUzPeDriMGokPtkPoTWewUe0A_edbeb29f.jpg',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        APP_SHELL_URLS.map((url) => cache.add(url).catch(() => null))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only intercept same-origin requests; leave external CDNs and ad networks untouched
  if (url.origin !== self.location.origin) return;

  // Never cache or intercept API calls, SSE streams, uploaded media, APK binaries, or range requests
  if (
    request.headers.has('range') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/uploads/') ||
    url.pathname.startsWith('/apk/') ||
    url.pathname.endsWith('.apk')
  ) {
    return;
  }

  // Network-first strategy for document navigation (ensures fresh live app + offline fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && !response.redirected) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached || Response.error()))
    );
    return;
  }

  // Network-first with cache fallback for same-origin static assets (never cache HTML redirects as assets)
  event.respondWith(
    fetch(request)
      .then((response) => {
        const ct = (response.headers.get('content-type') || '').toLowerCase();
        const isAssetPath =
          url.pathname.startsWith('/assets/') ||
          url.pathname.endsWith('.png') ||
          url.pathname.endsWith('.svg') ||
          url.pathname.endsWith('.webmanifest');
        if (response && response.ok && !response.redirected && isAssetPath && !ct.includes('text/html')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  );
});
