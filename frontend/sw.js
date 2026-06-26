const CACHE_NAME = 'library-kiosk-student-v1';
const ASSETS_TO_CACHE = [
  './index.html',
  './student-dashboard.html',
  './style.css',
  './student.js',
  './student-dashboard.js',
  './config.js',
  './icon.svg',
  './manifest.json'
];

// Install Event: Cache all shell assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing and caching app shell...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Event: Cleanup old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating and sweeping old caches...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event: Cache-first fallback to network strategy for static shell
self.addEventListener('fetch', event => {
  // Only intercept HTTP/HTTPS schemes (avoid chrome-extension:// etc.)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Avoid caching API network calls
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        // Cache dynamic assets if they are successful static gets
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(err => {
        console.error('[Service Worker] Fetch failed:', err);
      });
    })
  );
});
