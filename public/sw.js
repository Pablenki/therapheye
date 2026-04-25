// =========================================
// SERVICE WORKER — Therapheye Push Notifications
// =========================================

const APP_NAME = 'Therapheye';
const DEFAULT_ICON = '/therapheye-icon.svg';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ── Push handler ──────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { data = { title: APP_NAME, body: event.data.text() }; }

  const options = {
    body: data.body || '',
    icon: data.icon || DEFAULT_ICON,
    badge: DEFAULT_ICON,
    tag: data.tag || 'therapheye-notif',
    renotify: true,
    requireInteraction: false,
    data: { url: data.url || '/' },
    actions: data.actions || [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || APP_NAME, options)
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (const client of windowClients) {
          if ('focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
