// sw.js — GitHub Pages + Safari iOS OK
const CACHE_NAME = 'workout-pwa-v2';
const FILES = [
  '/Workout-pwa/',
  '/Workout-pwa/index.html',
  '/Workout-pwa/style.css',
  '/Workout-pwa/app.js',
  '/Workout-pwa/manifest.json',
  '/Workout-pwa/icon-192.png',
  '/Workout-pwa/icon-512.png'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  evt.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(()=>{});
        return resp;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('/Workout-pwa/index.html');
      });
    })
  );
});
