// Service worker: la guía queda disponible sin conexión.
// `VERSION` lo actualiza `npm run bump` (tools/bump-version.mjs); no lo cambies a mano.
const VERSION = '1.0.0';
const CORE = `sarmiento-core-${VERSION}`;
const RUNTIME = 'sarmiento-runtime-v1';

const CORE_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/main.js', 'js/bus.js', 'js/casas-destacadas.js', 'js/config.js', 'js/geo.js', 'js/icons.js',
  'js/labels.js', 'js/landmarks.js', 'js/life.js', 'js/mascotas.js', 'js/nav.js', 'js/route.js',
  'js/scene-utils.js', 'js/ui.js', 'js/util.js', 'js/wide.js', 'js/world.js',
  'data/meta.json', 'data/sarmiento-osm.geojson', 'data/places.json', 'data/tours.json',
  'data/guides.json', 'data/landmarks.json', 'data/casonas.json', 'data/mascots.json',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CORE)
      .then((cache) => Promise.all(CORE_FILES.map((f) => cache.add(f).catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CORE && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CORE)).put(req, res.clone());
    return res;
  } catch {
    return (await caches.match(req, { ignoreSearch: true })) || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(req);
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || (await fresh) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(staleWhileRevalidate(req)); // three.js (CDN) y tipografías
    return;
  }
  if (req.mode === 'navigate' || url.pathname.endsWith('/data/meta.json')) {
    event.respondWith(networkFirst(req));
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || staleWhileRevalidate(req)),
  );
});
