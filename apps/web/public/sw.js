/**
 * RenkFlow Service Worker
 * Offline-First PWA with Background Sync
 */

const CACHE_NAME = 'renkflow-v1';
const STATIC_CACHE = 'renkflow-static-v1';
const DYNAMIC_CACHE = 'renkflow-dynamic-v1';
const API_CACHE = 'renkflow-api-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// API routes to cache
const API_ROUTES = [
  '/api/orders',
  '/api/customers',
];

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
};

// ============================================
// Install Event
// ============================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ============================================
// Activate Event
// ============================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((keyList) => {
        return Promise.all(
          keyList.map((key) => {
            if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== API_CACHE) {
              console.log('[SW] Removing old cache:', key);
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ============================================
// Fetch Event
// ============================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching
  if (request.method !== 'GET') {
    // Handle POST/PUT/DELETE for offline queue
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(handleApiMutation(request));
    }
    return;
  }

  // API requests - Network first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }

  // Static assets - Cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Pages - Stale while revalidate
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
    return;
  }

  // Default - Network first
  event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE));
});

// ============================================
// Cache Strategies
// ============================================

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return getOfflineFallback(request);
  }
}

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      // Add header to indicate cached response
      const headers = new Headers(cached.headers);
      headers.set('X-Cache-Status', 'HIT');
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      });
    }
    return getOfflineFallback(request);
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached || getOfflineFallback(request));

  return cached || fetchPromise;
}

// ============================================
// Offline API Mutation Handler
// ============================================

async function handleApiMutation(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (error) {
    // Queue for background sync
    const clonedRequest = request.clone();
    const body = await clonedRequest.text();
    
    await queueForSync({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    });

    // Return optimistic response
    return new Response(
      JSON.stringify({
        success: true,
        offline: true,
        message: 'Operation queued for sync',
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// ============================================
// Background Sync
// ============================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-orders') {
    event.waitUntil(processSyncQueue());
  }
});

async function processSyncQueue() {
  const queue = await getSyncQueue();
  
  for (const item of queue) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });

      if (response.ok) {
        await removeFromSyncQueue(item.id);
        
        // Notify clients
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_SUCCESS',
            url: item.url,
            timestamp: Date.now(),
          });
        });
      }
    } catch (error) {
      console.error('[SW] Sync failed for:', item.url, error);
    }
  }
}

// ============================================
// Sync Queue Storage (using Cache API as fallback)
// ============================================

const SYNC_QUEUE_CACHE = 'renkflow-sync-queue';

async function queueForSync(item) {
  const cache = await caches.open(SYNC_QUEUE_CACHE);
  const id = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const queueItem = { ...item, id };
  
  await cache.put(
    new Request(`/sync-queue/${id}`),
    new Response(JSON.stringify(queueItem))
  );

  // Try to register for background sync
  if ('sync' in self.registration) {
    try {
      await self.registration.sync.register('sync-orders');
    } catch (err) {
      console.warn('[SW] Background sync registration failed:', err);
    }
  }

  return id;
}

async function getSyncQueue() {
  const cache = await caches.open(SYNC_QUEUE_CACHE);
  const keys = await cache.keys();
  const items = [];

  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const item = await response.json();
      items.push(item);
    }
  }

  return items.sort((a, b) => a.timestamp - b.timestamp);
}

async function removeFromSyncQueue(id) {
  const cache = await caches.open(SYNC_QUEUE_CACHE);
  await cache.delete(new Request(`/sync-queue/${id}`));
}

// ============================================
// Push Notifications
// ============================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// ============================================
// Message Handler
// ============================================

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then((keys) => 
          Promise.all(keys.map((key) => caches.delete(key)))
        )
      );
      break;
      
    case 'GET_SYNC_QUEUE':
      getSyncQueue().then((queue) => {
        event.ports[0].postMessage({ queue });
      });
      break;
      
    case 'FORCE_SYNC':
      event.waitUntil(processSyncQueue());
      break;
  }
});

// ============================================
// Utility Functions
// ============================================

function isStaticAsset(pathname) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
}

function getOfflineFallback(request) {
  const url = new URL(request.url);
  
  // Return offline page for HTML requests
  if (request.headers.get('accept')?.includes('text/html')) {
    return caches.match('/offline') || new Response(
      '<html><body><h1>You are offline</h1><p>Please check your internet connection.</p></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Return empty JSON for API requests
  if (url.pathname.startsWith('/api/')) {
    return new Response(
      JSON.stringify({ error: 'Offline', offline: true }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Return empty response for other requests
  return new Response('', { status: 503 });
}

console.log('[SW] Service Worker loaded');
