importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
importScripts('firebase-config.js');

// firebaseConfig is defined and initialized in firebase-config.js
// We don't need to call initializeApp again here, firebase-config.js already does it!

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://ui-avatars.com/api/?name=MThread&background=d0e2ff&color=53647d'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
