/*
 * Offline support for the product configurator kiosk. Only the configurator registers it.
 * - App code (/_next/static, hashed and immutable): cache first.
 * - Pages and other same-origin GETs: network first (4 s), the cached copy when offline.
 * - API calls are never cached; designs made offline wait in the page's IndexedDB outbox.
 * The page registers it as configurator-sw.js?v=<release>: each release gets its own cache and
 * activating it deletes the previous releases' caches, so old hashed files never pile up.
 */
const RELEASE = (new URL(self.location.href).searchParams.get('v') || 'v1').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'v1';
const CACHE = `rf-configurator-${RELEASE}`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('rf-configurator-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// The page lists what it loaded before this worker controlled it (the page itself, its chunks, the 3D code).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'warm' && Array.isArray(event.data.urls)) event.waitUntil(warm(event.data.urls));
});
async function warm(urls) {
  const cache = await caches.open(CACHE);
  await Promise.all(
    urls.map(async (url) => {
      try {
        if (new URL(url).origin !== self.location.origin) return;
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-cache' });
        if (response.ok) await cache.put(url.split('#')[0], response);
      } catch {
        /* Offline right now: the next visit warms it. */
      }
    }),
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await Promise.race([fetch(request), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))]);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_next/static/')) event.respondWith(cacheFirst(request));
  else event.respondWith(networkFirst(request));
});
