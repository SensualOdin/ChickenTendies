// ChickenTinders Service Worker — v2 (passthrough).
//
// Earlier versions cached JS/CSS aggressively, which caused the custom domain
// (chickentinders.app) to serve stale bundles pointing to hashed asset
// filenames that no longer exist on the server, rendering a blank page.
//
// This version is intentionally minimal:
//   - Activates immediately (skipWaiting + claim)
//   - Deletes every cache from prior versions on activate
//   - Does NOT intercept fetch — network handles everything
//   - Keeps push + notificationclick handlers so opted-in users still get
//     web push notifications
//
// Because there is no `fetch` listener, returning visitors with the old
// SW registered will have their stale caches cleared and the page will
// load directly from the network on their very next reload.

const SW_VERSION = 'chickentinders-passthrough-v2';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    (async function () {
      // Nuke every cache created by prior SW versions.
      const names = await caches.keys();
      await Promise.all(names.map(function (name) { return caches.delete(name); }));
      await self.clients.claim();
    })()
  );
});

// Intentionally no 'fetch' handler — letting the browser handle network
// requests directly is the safest thing while we transition users off the
// old caching SW. A future iteration can reintroduce selective caching
// with proper versioning.

self.addEventListener('push', function (event) {
  if (!event.data) return;

  try {
    var data = event.data.json();

    var options = {
      body: data.body || 'You have a new notification',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/',
        dateOfArrival: Date.now()
      },
      actions: data.actions || [],
      tag: data.tag || 'default',
      renotify: true
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'ChickenTinders', options)
    );
  } catch (e) {
    console.error('Push event error:', e);
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  var url = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.location.origin) === 0 && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Version marker — useful when debugging: `registration.active.scriptURL` +
// response body will contain this string.
self.__SW_VERSION__ = SW_VERSION;
