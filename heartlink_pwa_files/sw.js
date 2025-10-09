const CACHE_NAME = 'heartlink-v1.2.0';
const STATIC_CACHE_URLS = [
  '/',
  '/discover', 
  '/matches',
  '/chat',
  '/profile',
  '/auth',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

const DYNAMIC_CACHE = 'heartlink-dynamic-v1';

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('[HeartLink SW] Installing service worker');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[HeartLink SW] Caching static resources');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[HeartLink SW] Activating service worker');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
              console.log('[HeartLink SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip chrome-extension and other non-http requests
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[HeartLink SW] Serving from cache:', request.url);
          return cachedResponse;
        }

        return fetch(request)
          .then((networkResponse) => {
            // Don't cache API calls
            if (request.url.includes('/api/')) {
              return networkResponse;
            }

            // Cache successful responses
            if (networkResponse.status === 200 && request.url.startsWith(self.location.origin)) {
              const responseClone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE)
                .then((cache) => {
                  cache.put(request, responseClone);
                });
            }

            return networkResponse;
          })
          .catch((error) => {
            console.log('[HeartLink SW] Network request failed:', error);
            
            // Return cached version or offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/') ||
                     new Response('HeartLink is offline. Please check your connection.', {
                       status: 503,
                       statusText: 'Service Unavailable'
                     });
            }
            
            throw error;
          });
      })
  );
});

// Push notifications for matches and messages
self.addEventListener('push', (event) => {
  console.log('[HeartLink SW] Push notification received');
  
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'You have a new notification from HeartLink!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'heartlink-notification',
    data: data,
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'dismiss', 
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('HeartLink', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[HeartLink SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/matches')
    );
  }
});