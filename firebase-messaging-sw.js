importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
importScripts('firebase-config.js');

// The firebaseConfig is loaded and initialized from firebase-config.js
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);
  
  // If the payload already contains a notification object, Firebase Web SDK 
  // will render it automatically. We only call showNotification manually 
  // if it's a data-only payload to prevent duplicating banners in Windows/Android.
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

// Handle OS notification click event (Windows Notification Center & Android System Tray)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Resolve target redirect URL
  let targetUrl = 'https://maxawer1.web.app';
  if (event.notification.data && event.notification.data.click_action) {
    targetUrl = event.notification.data.click_action;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Try to find and focus an existing active window of the app
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.indexOf('maxawer1.web.app') !== -1 || client.url.indexOf('mthread.kz') !== -1) {
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      // 2. If no tab is open, launch a new standalone app window/tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
