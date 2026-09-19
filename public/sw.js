// WinDaq Android PWA Service Worker v2.5
const CACHE_NAME = 'windaq-cache-v2.5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/wallet.js',
  '/js/soundEngine.js',
  '/games/aviator.js',
  '/games/wingo.js',
  '/games/roulette.js',
  '/games/dragontiger.js',
  '/games/teenpatti.js',
  '/games/andarbahar.js',
  '/games/mines.js',
  '/games/slots.js',
  '/games/sports.js',
  '/assets/windaq_logo.png',
  '/assets/icon-192.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('⚡ WinDaq Service Worker: Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => console.warn('Cache warning:', err));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests, bypass API & WebSocket
  if (event.request.method !== 'GET' || event.request.url.includes('/api/') || event.request.url.includes('ws://') || event.request.url.includes('wss://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        return networkResponse;
      }).catch(() => {
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});
