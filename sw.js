// sw.js — PWA Safari/GitHub Pages FIX ✅
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

// 📦 INSTALLATION — précache les fichiers
self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES))
  );
  self.skipWaiting();
});

// 🧹 ACTIVATION — nettoie anciens caches
self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// 🚀 FETCH — stratégie cache-first
self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  const url = new URL(req.url);

  // on ne gère que les GET de notre origine
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  evt.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(()=>{});
        return resp;
      }).catch(() => {
        // fallback: renvoie index.html pour les navigations
        if (req.mode === 'navigate') return caches.match('/Workout-pwa/index.html');
      });
    })
  );
});
