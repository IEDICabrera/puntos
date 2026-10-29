// Un solo service worker para todas las apps: funcionan sin internet.
// Primero intenta la red (para recibir actualizaciones) y si no hay, usa la copia guardada.
const CACHE = 'banco-puntos-v6';
const ARCHIVOS = ['./', 'index.html', 'saldo.html', 'nucleo.js', 'nucleo.css', 'qrcode.js', 'catalogo.json',
  'banco/', 'banco/manifest.webmanifest', 'asistencia/', 'asistencia/manifest.webmanifest',
  'informes/', 'informes/manifest.webmanifest', 'mis-puntos/', 'mis-puntos/manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'icon-asistencia-192.png', 'icon-asistencia-512.png', 'icon-informes-192.png', 'icon-informes-512.png', 'icon-mis-puntos-192.png', 'icon-mis-puntos-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
