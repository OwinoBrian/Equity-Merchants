importScripts('./config.js');

const CACHE_NAME = `${APP_CONFIG.businessId}-v3`;
const APP_SHELL = [
  './',
  './index.html',
  './admin.html',
  './form.html',
  './detail.html',
  './listings.html',
  './styles.css',
  './brand.css',
  './config.js',
  './script.js',
  './listings.js',
  './form.js',
  './detail.js',
  './admin.js',
  './manifest.json',
  `./${APP_CONFIG.logoSrc}`
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('http') && !event.request.url.startsWith(self.location.origin)) return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname.startsWith('/api/')) return;
  const isAppFile = /\.(?:html|css|js)$/.test(requestUrl.pathname) || requestUrl.pathname.endsWith('/');

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      if (isAppFile) {
        try {
          const response = await fetch(event.request);
          cache.put(event.request, response.clone());
          return response;
        } catch (error) {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          throw error;
        }
      }

      const cached = await cache.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      cache.put(event.request, response.clone());
      return response;
    })
  );
});
