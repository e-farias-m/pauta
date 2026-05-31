const CACHE = 'pauta-v1';
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
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
