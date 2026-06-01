// Bump this when changing cache behavior so stale hashed chunks are cleared.
const CACHE_NAME = 'calm-beach-v2026-05-25-beach-data-refresh';
const WEATHER_API_HOSTS = new Set([
  'api.open-meteo.com',
  'marine-api.open-meteo.com',
]);
// A list of stable files to cache. Keep index.html out of precache so deploys
// do not leave clients running an app shell that imports removed chunks.
const urlsToCache = [
  '/manifest.json',
  '/beach-buddy-icon.svg'
];

// Install a service worker
self.addEventListener('install', event => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Cache and return requests
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. App shell / page navigations (Network First)
  // Always prefer the latest index.html so the app imports the current hashed chunks.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => (
        fetch(event.request, { cache: 'no-store' }).then(networkResponse => {
          if (networkResponse.ok) cache.put('/index.html', networkResponse.clone());
          return networkResponse;
        }).catch(() => cache.match('/index.html').then(cachedResponse => cachedResponse || Response.error()))
      ))
    );
    return;
  }

  // 2. Weather APIs (network only)
  // Weather freshness is handled in the app with localStorage fallback metadata.
  // The service worker must not serve stale weather API responses as if fresh.
  if (WEATHER_API_HOSTS.has(url.hostname)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(error => {
        console.warn('[Service Worker] Weather API request failed', {
          url: event.request.url,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      })
    );
    return;
  }

  // 3. Beach Dataset (Network First)
  // Beach counts and attributes must update immediately after data rebuilds.
  if (url.origin === self.location.origin && (url.pathname === '/greek_beaches.json' || url.pathname.startsWith('/data/beaches/'))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return fetch(event.request, { cache: 'no-store' }).then(networkResponse => {
          if (networkResponse.ok) cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(error => {
          console.warn('[Service Worker] Beach dataset refresh failed', error);
          return cache.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            throw error;
          });
        });
      })
    );
    return;
  }

  // 4. Versioned app scripts/styles (Network First)
  // If a deploy removed a chunk, cache-first can keep an old entry point alive.
  if (url.origin === self.location.origin && url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => (
        fetch(event.request).then(networkResponse => {
          if (networkResponse.ok) cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(() => cache.match(event.request).then(cachedResponse => cachedResponse || Response.error()))
      ))
    );
    return;
  }

  // 5. Stable assets (Cache First)
  // Images and app icons can be cached aggressively.
  if (urlsToCache.includes(url.pathname) || url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|woff2)$/)) {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            if (networkResponse.ok) cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Default: Network First
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Update a service worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'CLEAR_RUNTIME_CACHES') return;

  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames
        .filter(cacheName => cacheName.startsWith('beach-buddy-') || cacheName.startsWith('calm-beach-'))
        .map(cacheName => caches.delete(cacheName))
    ))
  );
});

// Listen for push notifications
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Received.');
  // Default notification data
  let data = { title: 'Beach Buddy', body: 'You have a new notification!' };

  // Try to parse the incoming data
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('Push event data is not valid JSON:', e);
      data.body = event.data.text();
    }
  }

  const title = data.title;
  const options = {
    body: data.body,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click Received.');
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
