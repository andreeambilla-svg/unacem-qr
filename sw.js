/* UNACEM QR - Service Worker
 * Objetivo: que la app abra al instante en visitas siguientes y siga
 * funcionando un momento aunque la señal 4G se corte en planta.
 * No cachea nada de la API (Apps Script) — esos datos siempre van a la red;
 * el propio index.html maneja su caché de datos con un TTL corto. */

const CACHE_NAME = 'unacem-qr-v3';
const SHELL_URLS = ['./', './index.html', './manifest.json', './icon-192.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  // La API (Apps Script) nunca se cachea aquí: siempre a la red.
  if (url.hostname.indexOf('script.google') !== -1) return;
  if (req.method !== 'GET') return;

  // Documento principal: red primero (para traer cambios nuevos), con la
  // copia guardada como respaldo si no hay conexión.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copia));
          return resp;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./')))
    );
    return;
  }

  // Fuentes y otros recursos estáticos: caché primero, ya que casi nunca cambian.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          if (resp && resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copia));
          }
          return resp;
        })
        .catch(() => cached);
    })
  );
});
