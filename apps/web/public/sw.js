const SHELL_CACHE = 'course-data-shell-v3';
const API_CACHE = 'course-data-api-v2';
const CURRENT_CACHES = new Set([SHELL_CACHE, API_CACHE]);
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((key) => !CURRENT_CACHES.has(key)).map((key) => caches.delete(key)),
          ),
        ),
    ]),
  );
});

const unavailableApiResponse = () =>
  new Response(
    JSON.stringify({
      type: 'about:blank',
      title: 'Catalogue unavailable offline',
      status: 503,
      detail: 'No cached response is available for this request.',
    }),
    {
      status: 503,
      headers: { 'content-type': 'application/problem+json' },
    },
  );

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Cross-origin requests, including the separate API Worker used during local
  // development, are owned by the browser and its CORS implementation. The PWA
  // service worker only caches same-origin resources.
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/v1/')) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(API_CACHE);
            await cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(async () => (await caches.match(event.request)) ?? unavailableApiResponse()),
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => (await caches.match('/')) ?? Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(SHELL_CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    }),
  );
});
