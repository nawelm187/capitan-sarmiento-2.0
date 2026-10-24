// Punto de entrada: carga datos, arma la escena 3D y conecta la interfaz.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

import { setCenter, toLngLat } from './geo.js';
import { emit } from './bus.js';
import { COLORS, LOW_END } from './config.js';
import { clamp } from './util.js';
import { buildWorld } from './world.js';
import { buildWide } from './wide.js';
import { initLandmarks } from './landmarks.js';
import { initCasas } from './casas-destacadas.js';
import { initLabels } from './labels.js';
import { initNav } from './nav.js';
import { initLife } from './life.js';
import { initMascotas } from './mascotas.js';
import { initUI } from './ui.js';

const $ = (id) => document.getElementById(id);
const splash = $('splash');
const setMsg = (t) => {
  const el = $('splash-msg');
  if (el) el.textContent = t;
};

async function getJSON(url, bust) {
  const res = await fetch(bust ? `${url}?v=${encodeURIComponent(bust)}` : url, { cache: bust ? 'default' : 'no-cache' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}
const optional = (p, fallback) => p.catch(() => fallback);

// Progreso de carga: el logo se va coloreando en círculo y se muestra el porcentaje.
const logoEl = $('splash-logo');
const pctEl = $('splash-pct');
let shown = 0;
let target = 0;
let raf = 0;
function paint() {
  shown += (target - shown) * 0.25;
  if (target - shown < 0.4) shown = target;
  logoEl?.style.setProperty('--p', shown.toFixed(1));
  if (pctEl) pctEl.textContent = `${Math.round(shown)} %`;
  if (shown < target) raf = requestAnimationFrame(paint);
}
const setProgress = (p) => {
  target = Math.max(target, Math.min(100, p));
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(paint);
};
// Deja que el navegador dibuje el avance antes de seguir con trabajo pesado.
const tick = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const stage = async (p, msg) => {
  if (msg) setMsg(msg);
  setProgress(p);
  await tick();
};
const hideSplash = () => {
  setProgress(100);
  setTimeout(() => splash.classList.add('hide'), 450);
};

function fail(err) {
  console.error(err);
  setMsg('No se pudo cargar la guía. Revisá tu conexión y volvé a intentar.');
  pctEl?.remove();
}

/** Navegación mínima para cuando el navegador no soporta WebGL (solo lista). */
function stubNav(tours, places) {
  const byId = new Map(places.map((p) => [p.id, p]));
  let tour = null;
  let step = 0;
  const go = (i) => {
    if (!tour) return;
    step = clamp(i, 0, tour.stops.length - 1);
    emit('tour:step', { tour, step, place: byId.get(tour.stops[step].placeId) || null });
  };
  return {
    focusPlace() {}, flyTo() {}, resetNorth() {}, cancel() {}, update() {},
    startTour(id) { tour = tours.find((t) => t.id === id) || null; go(0); },
    stopTour() { tour = null; },
    goStep: go, next: () => go(step + 1), prev: () => go(step - 1),
  };
}
const stubLabels = { setFilter() {}, highlight() {}, update() {} };

async function main() {
  const meta = await getJSON('data/meta.json');
  const v = meta.version;
  setCenter(meta.center);
  $('splash-title').textContent = `${meta.title?.[0] ?? meta.town} ${meta.title?.[1] ?? ''}`.trim();
  document.title = `${meta.name} · ${meta.town}`;

  await stage(8, 'Descargando datos…');
  const [gj, places, tours, guides, landmarks, casonas, mascots] = await Promise.all([
    getJSON('data/sarmiento-osm.geojson', v),
    getJSON('data/places.json', v),
    getJSON('data/tours.json', v),
    optional(getJSON('data/guides.json', v), []),
    optional(getJSON('data/landmarks.json', v), { items: [] }),
    optional(getJSON('data/casonas.json', v), { items: [] }),
    optional(getJSON('data/mascots.json', v), { items: [] }),
  ]);

  await stage(40);

  // ---------- Renderer (con salida de emergencia sin WebGL) ----------
  const canvas = $('gl');
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW_END, powerPreference: 'high-performance' });
  } catch (e) {
    console.warn('WebGL no disponible', e);
  }
  if (!renderer) {
    const warn = document.createElement('div');
    warn.className = 'nogl';
    warn.textContent = 'Tu navegador no pudo iniciar la maqueta 3D. Podés usar la guía en modo lista.';
    document.body.append(warn);
    initUI({ meta, places, tours, guides, nav: stubNav(tours, places), labels: stubLabels, controls: null, hasGL: false });
    hideSplash();
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW_END ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.bg);
  scene.fog = new THREE.Fog(COLORS.bg, 1500, 5200);

  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 2, 12000);
  camera.position.set(260, 420, 520);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.minDistance = 40;
  controls.maxDistance = 2400;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.update();

  // ⌥ (Alt) + arrastrar = girar e inclinar
  const setAlt = (on) => {
    controls.mouseButtons.LEFT = on ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
  };
  addEventListener('keydown', (e) => e.key === 'Alt' && setAlt(true));
  addEventListener('keyup', (e) => e.key === 'Alt' && setAlt(false));
  addEventListener('blur', () => setAlt(false));

  // ---------- Luces ----------
  scene.add(new THREE.HemisphereLight(0xcfdcff, 0x3a3326, 1.0));
  const sun = new THREE.DirectionalLight(0xffe5b8, 2.3);
  const SUN_OFFSET = new THREE.Vector3(-420, 620, 260);
  sun.castShadow = true;
  const sm = LOW_END ? 1024 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  Object.assign(sun.shadow.camera, { left: -520, right: 520, top: 520, bottom: -520, near: 50, far: 1800 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);

  // ---------- Postproceso ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (!LOW_END) composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.16, 0.5, 0.92));
  const hTilt = new ShaderPass(HorizontalTiltShiftShader);
  const vTilt = new ShaderPass(VerticalTiltShiftShader);
  hTilt.uniforms.r.value = 0.5;
  vTilt.uniforms.r.value = 0.5;
  if (!LOW_END) composer.addPass(hTilt);
  if (!LOW_END) composer.addPass(vTilt);
  composer.addPass(new OutputPass());

  const labelRenderer = new CSS2DRenderer({ element: $('labels') });

  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    labelRenderer.setSize(w, h);
    hTilt.uniforms.h.value = 1.5 / w;
    vTilt.uniforms.v.value = 1.5 / h;
  }
  addEventListener('resize', resize);
  resize();

  // ---------- Mundo ----------
  await stage(48, 'Armando la maqueta del pueblo…');
  const world = buildWorld(scene, gj, meta, { lowEnd: LOW_END });
  await stage(62);
  await buildWide(scene, world, meta, { lowEnd: LOW_END });
  await stage(76);
  await Promise.all([initLandmarks(scene, landmarks), initCasas(scene, casonas)]);
  const mascotas = await initMascotas(scene, mascots);
  await stage(86);
  const life = initLife(scene, world, { lowEnd: LOW_END });

  const labels = initLabels(scene, places);
  const nav = initNav(scene, camera, controls, places, tours);
  const ui = initUI({ meta, places, tours, guides, nav, labels, controls, hasGL: true });
  setProgress(95);

  // Doble toque / doble clic para acercar al punto tocado
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  let down = null;
  let lastTap = { t: 0, x: 0, y: 0 };
  renderer.domElement.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
    nav.cancel();
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
    const now = performance.now();
    if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 24) {
      ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
      if (ray.ray.intersectPlane(plane, hit)) {
        const dist = camera.position.distanceTo(controls.target);
        const pitch = THREE.MathUtils.radToDeg(Math.asin(clamp((camera.position.y - controls.target.y) / dist, 0, 1)));
        const ll = toLngLat(hit.x, hit.z);
        nav.flyTo(ll.lng, ll.lat, { dist: Math.max(controls.minDistance + 10, dist * 0.5), pitch: clamp(pitch, 25, 75), dur: 0.8 });
      }
      lastTap = { t: 0, x: 0, y: 0 };
    } else {
      lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
  });

  // ---------- Bucle ----------
  const clock = new THREE.Clock();
  const prev = new THREE.Vector3();
  const lim = world.half * 0.95;
  let firstFrame = true;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.1, clock.getDelta());
    nav.update(dt);
    life.update(dt);
    mascotas.update(dt);
    controls.update();

    // Mantener el objetivo dentro del pueblo (y mover la cámara con él)
    prev.copy(controls.target);
    controls.target.x = clamp(controls.target.x, -lim, lim);
    controls.target.z = clamp(controls.target.z, -lim, lim);
    controls.target.y = 0;
    camera.position.add(prev.subVectors(controls.target, prev));

    sun.target.position.copy(controls.target);
    sun.position.copy(controls.target).add(SUN_OFFSET);
    labels.update(camera);
    ui.update();

    composer.render();
    labelRenderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      hideSplash();
    }
  });

  // ---------- PWA ----------
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
}

main().catch(fail);
