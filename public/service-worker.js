// Bump this when changing cache behavior so stale hashed chunks are cleared.
const CACHE_NAME = 'calm-beach-v2026-06-26-assets-cache-first';
const WEATHER_API_HOSTS = new Set([
  'api.open-meteo.com',
  'marine-api.open-meteo.com',
  'air-quality-api.open-meteo.com',
]);
// A list of stable files to cache. Keep index.html out of precache so deploys
// do not leave clients running an app shell that imports removed chunks.
const urlsToCache = [
  '/manifest.json',
  '/calmbeach-mark.svg'
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

// --- Resilient response helpers -------------------------------------------
// Every fetch-handler branch MUST resolve to a valid Response. Resolving to
// `undefined` throws "Failed to convert value to 'Response'", and a bare
// `caches.open().then(...)` rejects the whole respondWith when CacheStorage is
// unavailable (private/guest browsing) — both of which break navigations and
// silently drop requests such as the analytics beacon.
const openCacheSafely = () => caches.open(CACHE_NAME).catch(() => null);

const matchCache = request =>
  openCacheSafely()
    .then(cache => (cache ? cache.match(request) : undefined))
    .catch(() => undefined);

// Best-effort write; never let a cache failure affect the served response.
const putInCache = (request, response) => {
  if (!response || !response.ok) return;
  const copy = response.clone();
  openCacheSafely().then(cache => (cache ? cache.put(request, copy) : undefined)).catch(() => {});
};

// A redirected response cannot be returned for a navigation request (it throws),
// and it must not be cached as the app shell. Our /beaches/* routes 301-redirect
// to add a trailing slash, so navigations routinely produce redirected responses.
// Rebuild them as a fresh, non-redirected Response with safe headers.
const stripRedirect = response => {
  if (!response.redirected) return response;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

// Cache and return requests
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. App shell / page navigations (Network First)
  // Always prefer the latest index.html so the app imports the current hashed chunks.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    // The OAuth return page is a deliberately stripped copy of the shell (no
    // canonical, no structured data, noindex). Every navigation overwrites the
    // cached '/index.html', so letting this one through would make that stripped
    // copy the offline fallback for the whole site until the next online visit.
    const isAuthCallback = url.pathname.replace(/\/+$/, '') === '/auth/callback';

    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(networkResponse => {
          const response = stripRedirect(networkResponse);
          if (!isAuthCallback) putInCache('/index.html', response);
          return response;
        })
        .catch(() => matchCache('/index.html').then(cached => cached || Response.error()))
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

  // 2c. EVERY other cross-origin request is handed back to the browser untouched.
  //
  // This has to sit here — above the asset branches — and the first attempt at it
  // (30/07/2026) did not, which is why it only half-worked. Branch 5 below matches
  // on `url.pathname` ending in .png/.jpg/.webp WITHOUT checking the origin, so map
  // tiles from tile.openstreetmap.org and beach photos from upload.wikimedia.org
  // and live.staticflickr.com went on being fetched by the worker even after the
  // default branch stopped doing it. The reports kept arriving and named exactly
  // those hosts.
  //
  // Why it matters: a fetch() issued from inside a service worker counts as
  // **connect-src**, not img-src, however the result is painted. `img-src https:`
  // could never apply to them.
  //
  // Returning without calling respondWith() lets the browser make the request
  // itself, where it is attributed to img-src correctly. Nothing changes for the
  // visitor: cross-origin photos were being written into the cache by branch 5 but
  // are re-fetched constantly anyway (Wikimedia sets its own cache headers, which
  // the browser honours better than we did).
  if (url.origin !== self.location.origin) return;

  // 2b. Same-origin forecast proxy (network only)
  // When the app routes forecasts through our own edge proxy (/api/forecast/*,
  // enabled via VITE_FORECAST_PROXY_BASE) the request is same-origin, so the
  // WEATHER_API_HOSTS check above no longer catches it. Apply the SAME rule: never
  // let the SW serve a stale forecast. The app's localStorage layer owns freshness
  // and the Netlify CDN owns shared caching — the SW just passes through to network.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/forecast/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(error => {
        console.warn('[Service Worker] Forecast proxy request failed', {
          url: event.request.url,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      })
    );
    return;
  }

  // 3. Beach Dataset (Network First)
  // Beach counts and attributes must update immediately after data rebuilds. The shoreline
  // drawings live under /data/coastline/shape/ and are rebuilt from the same source, so they
  // follow the same rule — a cached shoreline outliving a pin correction is exactly the
  // staleness the build-time guard exists to prevent.
  // /greek_beaches.json was listed here until 13/08/2026. Nothing requests it any more —
  // the national dump is no longer published (scripts/stripNationalDumpFromDist.mjs) and
  // the app reads the per-region shards below.
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/data/beaches/') ||
      url.pathname.startsWith('/data/coastline/'))
  ) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(networkResponse => {
          putInCache(event.request, networkResponse);
          return networkResponse;
        })
        .catch(() => matchCache(event.request).then(cached => cached || Response.error()))
    );
    return;
  }

  // 3b. Content-hashed build assets (Cache First)
  // Everything under /assets/ is emitted by Vite with a content hash in the
  // filename, so a given URL is immutable. Serve it from cache instantly and
  // only hit the network on a miss — this avoids re-fetching/re-validating the
  // ~200 KB CSS bundle on every page navigation (the cause of slow-to-open
  // static guide/region pages). A new deploy references new hashes, and the
  // network-first navigation handler keeps index.html fresh, so we never get
  // stuck on a stale entry point.
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      matchCache(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(networkResponse => {
            putInCache(event.request, networkResponse);
            return networkResponse;
          })
          .catch(() => Response.error());
      })
    );
    return;
  }

  // 4. Other versioned app scripts/styles (Network First)
  // If a deploy removed a chunk, cache-first can keep an old entry point alive.
  if (url.origin === self.location.origin && url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          putInCache(event.request, networkResponse);
          return networkResponse;
        })
        .catch(() => matchCache(event.request).then(cached => cached || Response.error()))
    );
    return;
  }

  // 5. Stable assets (Cache First)
  // Images and app icons can be cached aggressively.
  if (urlsToCache.includes(url.pathname) || url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|woff2)$/)) {
    event.respondWith(
      matchCache(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(networkResponse => {
            putInCache(event.request, networkResponse);
            return networkResponse;
          })
          .catch(() => Response.error());
      })
    );
    return;
  }

  // Default: Network First, falling back to cache, then a network error.
  event.respondWith(
    fetch(event.request).catch(() => matchCache(event.request).then(cached => cached || Response.error()))
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
