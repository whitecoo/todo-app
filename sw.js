const CACHE_NAME = 'todo-pwa-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ═══ INSTALL: Cache essential files ═══
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ═══ ACTIVATE: Clean old caches ═══
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ═══ FETCH: Network first, fallback to cache ═══
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).then(response => {
      // Update cache with fresh copy
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return response;
    }).catch(() => {
      // Network failed → use cache (offline mode)
      return caches.match(e.request);
    })
  );
});

// ═══ NOTIFICATION SCHEDULING SYSTEM ═══
let scheduledNotifications = [];
let checkInterval = null;

// Receive notification schedules from main app
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (e.data && e.data.type === 'SYNC_NOTIFICATIONS') {
    scheduledNotifications = e.data.notifications || [];
    // Start checking if not already
    if (!checkInterval) {
      startNotificationChecker();
    }
  }
  if (e.data && e.data.type === 'STOP_NOTIFICATIONS') {
    scheduledNotifications = [];
  }
});

function startNotificationChecker() {
  // Check every 8 seconds
  checkInterval = setInterval(() => {
    const now = Date.now();
    const toFire = [];
    const remaining = [];

    scheduledNotifications.forEach(n => {
      const diff = n.alertTime - now;
      if (diff >= -15000 && diff <= 15000 && !n.fired) {
        toFire.push(n);
      } else if (diff > 15000) {
        remaining.push(n);
      }
      // Skip items that are too old (already past)
    });

    // Fire notifications
    toFire.forEach(n => {
      self.registration.showNotification(n.title, {
        body: n.body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [300, 150, 300, 150, 400],
        tag: n.key,
        requireInteraction: true,
        actions: [
          { action: 'confirm', title: '✓ 확인' },
          { action: 'dismiss', title: '닫기' }
        ],
        data: { todoId: n.todoId }
      });
    });

    scheduledNotifications = remaining;

    // If no more notifications, stop checking
    if (remaining.length === 0) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  }, 8000);
}

// ═══ NOTIFICATION CLICK: Open app ═══
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing window or open new one
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('./');
    })
  );
});
