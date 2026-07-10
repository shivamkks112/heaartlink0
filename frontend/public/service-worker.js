const CACHE_NAME = 'heartlink-v2';
const STATIC_CACHE = 'heartlink-static-v2';
const API_CACHE = 'heartlink-api-v1';

// Files to cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => {
          return name !== CACHE_NAME && name !== STATIC_CACHE && name !== API_CACHE;
        }).map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - Network first for API, Cache first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip WebSocket
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

  // API calls - Network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful GET API responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets - Cache first, fallback to network
  if (
    url.pathname.startsWith('/static/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML pages - Network first, fallback to cached index
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then((cached) => cached || caches.match('/index.html'));
      })
  );
});

// Firebase messaging (keep existing functionality)
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCbcKatJZVvXgShJ8lOGg-EgMjpgYNyZrk",
  authDomain: "heartlink-6abe9.firebaseapp.com",
  projectId: "heartlink-6abe9",
  storageBucket: "heartlink-6abe9.firebasestorage.app",
  messagingSenderId: "803969423139",
  appId: "1:803969423139:web:f6ff59de191329b3fade96"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || 'HeartLink';
    const notificationOptions = {
      body: payload.notification?.body || 'You have a new notification',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.data?.type || 'general',
      data: payload.data,
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: 'Open App' }
      ]
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch(e) {
  // Firebase not available in this context
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let targetUrl = '/discover';
  
  if (data.type === 'message' && data.match_id) {
    targetUrl = `/chat/${data.match_id}`;
  } else if (data.type === 'match') {
    targetUrl = '/matches';
  } else if (data.type === 'like') {
    targetUrl = '/likes';
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
