// Service worker: la guía carga más rápido en las visitas siguientes y queda disponible sin conexión.
// `VERSION` lo actualiza `npm run bump` (tools/bump-version.mjs); no lo cambies a mano.
// IMPORTANTE: cada vez que cambies archivos de data/ o del código, corré `npm run bump -- patch`.
const VERSION = '1.1.4';
const CORE = `sarmiento-core-${VERSION}`; // código y estáticos de esta versión
const DATA = `sarmiento-data-${VERSION}`; // data/*.json de esta versión (la URL lleva ?v=VERSION)
const RUNTIME = 'sarmiento-runtime-v1'; // three.js y tipografías (CDN)

const CORE_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/main.js', 'js/bus.js', 'js/buildings.js', 'js/casas-destacadas.js', 'js/config.js', 'js/geo.js', 'js/icons.js',
  'js/labels.js', 'js/landmarks.js', 'js/life.js', 'js/mascotas.js', 'js/nav.js', 'js/route.js',
  'js/scene-utils.js', 'js/ui.js', 'js/util.js', 'js/wide.js', 'js/world.js',
  'data/meta.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'img/logo-sarmiento.webp',
];
const DATA_FILES = [
  'sarmiento-osm.geojson', 'places.json', 'tours.json', 'guides.json', 'landmarks.json', 'casonas.json', 'mascots.json',
].map((f) => `data/${f}?v=${VERSION}`);

// three.js y sus extensiones (misma versión que el importmap de index.html): se guardan al instalar,
// así la guía abre sin conexión incluso en la segunda visita.
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.164.1/';
const CDN_FILES = [
  'build/three.module.min.js',
  ...['controls/OrbitControls', 'loaders/GLTFLoader', 'utils/BufferGeometryUtils', 'postprocessing/EffectComposer', 'postprocessing/Pass',
    'postprocessing/MaskPass', 'postprocessing/RenderPass', 'postprocessing/ShaderPass', 'postprocessing/UnrealBloomPass',
    'postprocessing/OutputPass', 'shaders/CopyShader', 'shaders/LuminosityHighPassShader', 'shaders/OutputShader',
    'shaders/HorizontalTiltShiftShader', 'shaders/VerticalTiltShiftShader', 'renderers/CSS2DRenderer'].map((f) => `examples/jsm/${f}.js`),
].map((f) => CDN + f);

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(RUNTIME).then((c) => Promise.all(CDN_FILES.map((u) => c.add(u).catch(() => null)))),
      caches.open(CORE).then((c) => Promise.all(CORE_FILES.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => null)))),
      caches.open(DATA).then((c) => Promise.all(DATA_FILES.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => null)))),
    ]).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([CORE, DATA, RUNTIME]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Red primero (así se ve siempre lo último que subiste); sin conexión, lo guardado. */
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CORE)).put(req, res.clone());
    return res;
  } catch {
    return (await caches.match(req, { ignoreSearch: true })) || Response.error();
  }
}

/** Lo guardado primero (archivos que no cambian dentro de una misma versión). */
async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(cacheName)).put(req, res.clone());
  return res;
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
  const path = url.pathname;
  if (req.mode === 'navigate' || path.endsWith('/data/meta.json') || /\.(?:js|css|html|webmanifest)$/.test(path)) {
    event.respondWith(networkFirst(req));
    return;
  }
  if (path.includes('/data/') && url.searchParams.has('v')) {
    event.respondWith(cacheFirst(req, DATA).catch(() => Response.error()));
    return;
  }
  event.respondWith(cacheFirst(req, CORE).catch(() => Response.error()));
});
