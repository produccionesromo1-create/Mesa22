// Service Worker for Mesa 22 Push Notifications & Background Alerts
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle push notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Focus existing open window or open new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Handle incoming Web Push message if payload sent via WebPush
self.addEventListener('push', (event) => {
  let data = { title: 'Mesa 22', body: 'Tienes una nueva notificación' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const title = data.title || 'Mesa 22 Notificación';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    vibrate: [200, 100, 200, 100, 200],
    data: data.url || '/',
    requireInteraction: true,
    tag: data.tag || 'm22-notification'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});
