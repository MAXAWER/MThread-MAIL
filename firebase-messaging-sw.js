importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
importScripts('firebase-config.js');

// Initialize Firebase Cloud Messaging
const messaging = firebase.messaging();

// PWA Cache Configuration
const CACHE_NAME = 'mthread-cache-v1.7';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css?v=1.0.8',
  '/style.css',
  '/app.js?v=1.4.0',
  '/app.js',
  '/firebase-config.js',
  '/manifest.json',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-appcheck-compat.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200'
];

// Service Worker Install Event - Cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Service Worker Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Service Worker Fetch Event - Stale-While-Revalidate with Firebase API bypass
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass caching for all Firebase APIs (Auth, Firestore, Functions, App Check, database)
  // as well as chrome-extension resources, and any non-GET requests.
  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('cloudfunctions.net') ||
    url.hostname.includes('firebaseio.com') ||
    url.pathname.includes('/v1/projects/') ||
    url.protocol === 'chrome-extension:'
  ) {
    // Network-only fallback
    return;
  }

  // Stale-While-Revalidate strategy for normal assets, CDN files, Google Fonts, and images (e.g. Firebase Storage)
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch((err) => {
          console.warn('[Service Worker] Fetch failed for:', event.request.url, err);
        });

        // Return the cached response if available, otherwise wait for the network request
        return cachedResponse || fetchPromise;
      });
    })
  );
});

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);
  
  if (payload.notification) {
    console.log('[firebase-messaging-sw.js] Notification object detected. Letting Firebase SDK handle display.');
    return;
  }

  const notificationTitle = payload.data ? payload.data.title : 'Новое сообщение';
  const notificationOptions = {
    body: payload.data ? payload.data.body : '',
    icon: 'https://ui-avatars.com/api/?name=MThread&background=d0e2ff&color=53647d',
    vibrate: [200, 100, 200],
    data: {
      click_action: (payload.data && payload.data.click_action) ? payload.data.click_action : 'https://maxawer1.web.app'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle OS notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  let targetUrl = 'https://maxawer1.web.app';
  if (event.notification.data && event.notification.data.click_action) {
    targetUrl = event.notification.data.click_action;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.indexOf('maxawer1.web.app') !== -1 || client.url.indexOf('mthread.kz') !== -1) {
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
