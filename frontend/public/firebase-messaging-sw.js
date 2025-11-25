// Firebase Cloud Messaging Service Worker
// This file handles background notifications when the app is not in focus

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyCbcKatJZVvXgShJ8lOGg-EgMjpgYNyZrk",
  authDomain: "heartlink-6abe9.firebaseapp.com",
  databaseURL: "https://heartlink-6abe9-default-rtdb.firebaseio.com",
  projectId: "heartlink-6abe9",
  storageBucket: "heartlink-6abe9.firebasestorage.app",
  messagingSenderId: "803969423139",
  appId: "1:803969423139:web:f6ff59de191329b3fade96",
  measurementId: "G-MEQ38V74VL"
});

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  const { notification, data } = payload;
  
  // Customize notification here
  const notificationTitle = notification?.title || 'HeartLink';
  const notificationOptions = {
    body: notification?.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data?.type || 'default',
    data: data,
    requireInteraction: true,
    // Sound and vibration settings
    silent: false,  // Enable sound
    vibrate: [200, 100, 200, 100, 200], // Vibration pattern (vibrate, pause, vibrate...)
    // Visual customization
    image: notification?.image || null,
    // Priority
    renotify: true,
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };

  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  
  event.notification.close();
  
  // Handle different notification types
  const data = event.notification.data;
  let urlToOpen = '/';
  
  if (data && data.type) {
    switch (data.type) {
      case 'new_match':
        urlToOpen = '/matches';
        break;
      case 'new_message':
        urlToOpen = '/matches'; // Or specific chat page
        break;
      case 'new_like':
        urlToOpen = '/discover';
        break;
      case 'verification':
        urlToOpen = '/profile';
        break;
      default:
        urlToOpen = '/';
    }
  }
  
  // Open or focus window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
