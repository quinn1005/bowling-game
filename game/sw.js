// Gutter Kings service worker: cache-first for the game's own files so it plays offline once installed.
const CACHE = 'gk-v1';
const FILES = ['./', 'index.html', 'css/style.css', 'icon.svg', 'manifest.webmanifest',
  'js/core.js', 'js/data.js', 'js/physics.js', 'js/scoring.js', 'js/run.js', 'js/frame.js', 'js/audio.js', 'js/render.js', 'js/ui.js', 'js/main.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin !== location.origin) {
    // Fonts: network first, fall back to cache.
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
    return;
  }
  // Own files: serve cached, refresh in the background.
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
