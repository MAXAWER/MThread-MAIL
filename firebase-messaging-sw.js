importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// We need to initialize Firebase in the service worker too
// It will grab the config from the URL parameters or we can hardcode the public ones
firebase.initializeApp({
  apiKey: "YOUR_API_KEY", // Note: The actual key isn't strictly required for the SW to receive messages, but it's best practice. We'll rely on the default behavior where Firebase passes it.
  projectId: "maxawer1",
  messagingSenderId: "374246061142",
  appId: "1:374246061142:web:1301e859b7ef40e4f8e5c2"
});

const messaging = firebase.messaging();

// If you want to customize background notifications
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
