const CACHE = 'pauta-v2';
const URLS = [
  'https://cdn.jsdelivr.net/npm/@vexflow-fonts/bravura@1.0.2/bravura.woff2',
  'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://unpkg.com/vexflow@3.0.9/releases/vexflow-min.js',
  'https://unpkg.com/vexflow@3.0.9/build/vexflow-min.js',
  'https://cdn.jsdelivr.net/npm/vexflow@3.0.9/releases/vexflow-min.js',
  'https://cdn.jsdelivr.net/npm/vexflow@3.0.9/build/vexflow-min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '/pauta' || url.pathname === '/pauta/') {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
