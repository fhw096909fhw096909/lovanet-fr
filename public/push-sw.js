// Handlers push/notifications importes par le service worker genere (Workbox).
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) {
    payload = { body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'Lovanet';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || 'Nouveau contenu disponible sur Lovanet.',
      icon: '/lovanet-icon-192.png?v=19',
      badge: '/lovanet-icon-192.png?v=19',
      data: { url: payload.url || '/' },
      tag: payload.tag || 'lovanet-push',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) { client.navigate(target); return client.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});
