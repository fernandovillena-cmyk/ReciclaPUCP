/* Service worker: deja la app disponible sin conexión.
   Si cambias algún archivo de la app, sube el número de VERSION para que los celulares se actualicen. */
const VERSION = 'recicla-pucp-v4';
const SHELL = [
  './', 'index.html', 'styles.css', 'config.js', 'content.js', 'art.js', 'cloud.js', 'app.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];
const JSQR = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    try { await cache.add(new Request(JSQR, { mode: 'cors' })); } catch { /* se guardará la primera vez que se use */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

// Responde desde la caché y actualiza en segundo plano (la próxima apertura ya trae lo nuevo).
// Las llamadas a la nube (Apps Script) no se tocan: van directo a internet.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cacheable = url.origin === self.location.origin || url.href === JSQR;
  if (!cacheable) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    const refresh = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(refresh); return hit; }
    return (await refresh) || Response.error();
  })());
});
