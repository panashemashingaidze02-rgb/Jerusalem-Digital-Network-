importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  "projectId": "gen-lang-client-0844782489",
  "appId": "1:92887234284:web:6cb05714b0c5605c1097c9",
  "apiKey": "AIzaSyAzY86vJVv3p4WvUC_pwchzZQGQ5TLYy3Q",
  "authDomain": "gen-lang-client-0844782489.firebaseapp.com",
  "storageBucket": "gen-lang-client-0844782489.firebasestorage.app",
  "messagingSenderId": "92887234284",
  "measurementId": ""
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'System Notification';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/vite.svg',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
