/**
 * ==========================================================================
 * VAYLUME - Offline-First Service Worker (sw.js)
 * ==========================================================================
 * Provides instant app shell loading, offline assets caching,
 * and reliable offline resilience for the VAYLUME digital sanctuary.
 */

const CACHE_NAME = 'vaylume-pwa-v1.1';

const APP_SHELL_ASSETS = [
  './',
  'index.html',
  'login.html',
  'signup.html',
  'dashboard.html',
  'memories.html',
  'notes.html',
  'locker.html',
  'profile.html',
  'chat.html',
  'css/style.css',
  'css/animations.css',
  'css/responsive.css',
  'js/main.js',
  'js/auth.js',
  'js/dashboard.js',
  'js/memories.js',
  'js/notes.js',
  'js/locker.js',
  'js/profile.js',
  'js/chat.js',
  'js/api.js'
];

// Installation — Pre-cache critical app shell files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[VAYLUME SW] Pre-caching offline app shell');
      return cache.addAll(APP_SHELL_ASSETS).catch((err) => {
        console.warn('[VAYLUME SW] Some assets could not be cached immediately:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activation — Purge stale cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[VAYLUME SW] Purging obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Strategy — Network First for API routes, Stale-While-Revalidate for App Shell
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass API calls — handled dynamically by frontend/js/api.js with outbox queue
  if (url.pathname.includes('/api/v1') || url.pathname.includes('/auth/') || url.pathname.includes('/notes/')) {
    return;
  }

  // Stale-While-Revalidate strategy for static resources
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Network offline — return cached fallback if available
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
