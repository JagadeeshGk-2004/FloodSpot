const CACHE_NAME = 'floodspot-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/', '/index.html']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 1. Cache-First Strategy: Return cached response immediately if found
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // 2. Fallback to Network if not in cache
      return fetch(event.request)
        .then((response) => {
          // Verify response is valid before caching
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          return response;
        })
        .catch((err) => {
          console.warn('[SW] Network fetch failed and no cache found:', err);
          // Optional: Return an offline fallback page or icon here if desired
        });
    })
  );
});
