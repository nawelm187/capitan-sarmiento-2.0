// Genera casas APROXIMADAS a lo largo de las calles, para pueblos donde OpenStreetMap casi no
// tiene edificios cargados. Las calles son las reales; las casas NO: son una estimación.
//
//   npm run fill                       genera (y reemplaza las generadas antes)
//   npm run fill -- --min-road=500     zona más amplia (por defecto 700; bajalo si faltan casas en las afueras)
//   npm run fill -- --max=4000         tope de casas (por defecto 6000)
//   npm run fill -- --seed=7           otra distribución al azar
//   npm run fill -- --clear            borra las generadas
//
// Cómo decide:
//  - Solo pone casas donde hay red de calles densa (zona urbana). El campo queda vacío.
//  - Casas a ambos lados de cada calle, con retiro, sin pisar calles, vías, agua ni espacios verdes.
//  - No se superponen entre sí ni con edificios reales (los reales siempre tienen prioridad).
//  - Cada casa generada lleva `approx: true`; si más adelante cargás edificios reales
//    (npm run buildings), las generadas que los pisen se descartan al volver a correr este script.
//
// Es determinístico: con los mismos datos y la misma --seed da siempre el mismo resultado.

import { readFile, writeFile } from 'node:fs/promises';
import { setCenter, toLngLat, toLocal } from '../js/geo.js';
import { buildPath, sample } from '../js/route.js';
import { mulberry32 } from '../js/util.js';

const dataDir = new URL('../data/', import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));

const metaUrl = new URL('meta.json', dataDir);
const geoUrl = new URL('sarmiento-osm.geojson', dataDir);
const meta = JSON.parse(await readFile(metaUrl, 'utf8'));
const gj = JSON.parse(await readFile(geoUrl, 'utf8'));
setCenter(meta.center);

const MAX = Number(args.max) || 6000;
const MIN_ROAD = Number(args['min-road']) || 700; // metros de calle en una ventana de 300x300 m
const rng = mulberry32(Number(args.seed) || 1);
const r6 = (n) => Math.round(n * 1e6) / 1e6;

// ---------- 1. Quitar las generadas antes ----------
const before = gj.features.length;
gj.features = gj.features.filter((f) => !f.properties?.approx);
const removed = before - gj.features.length;
if (args.clear) {
  delete meta.approxBuildings;
  await writeFile(geoUrl, JSON.stringify(gj));
  meta.dataRev = Date.now().toString(36); // cambia la clave de caché de los datos: el navegador baja los nuevos
await writeFile(metaUrl, JSON.stringify(meta, null, 2) + '\n');
  console.log(`Se borraron ${removed} casas generadas.`);
  process.exit(0);
}

// ---------- 2. Datos en metros locales ----------
const HALF = { motorway: 12, trunk: 11, primary: 8, secondary: 7, tertiary: 6, unclassified: 5, residential: 5, living_street: 4, service: 3, pedestrian: 3, track: 2.5, path: 1.5, footway: 1.5, cycleway: 1.5 };
const FRONT = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street']);
const loc = (c) => toLocal(c[0], c[1]);

const lines = []; // todas las vías (para no pisarlas)
const front = []; // calles con casas a los lados
const blockers = []; // agua y verdes
const real = []; // edificios reales (caja envolvente)

function polysOf(g) {
  return g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
}
for (const f of gj.features) {
  const { kind, hw } = f.properties;
  const g = f.geometry;
  if (kind === 'road' && g.type === 'LineString') {
    const pts = g.coordinates.map(loc);
    lines.push({ pts, half: HALF[hw] ?? 3 });
    if (FRONT.has(hw)) front.push({ pts, half: HALF[hw] ?? 5 });
  } else if (kind === 'rail' && g.type === 'LineString') {
    lines.push({ pts: g.coordinates.map(loc), half: 4 });
  } else if ((kind === 'water' || kind === 'green') && g.type !== 'LineString') {
    for (const p of polysOf(g)) blockers.push(bboxed(p[0].map(loc)));
  } else if (kind === 'building') {
    for (const p of polysOf(g)) {
      const pts = p[0].map(loc);
      const b = bboxed(pts);
      real.push({ cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, ux: 1, uz: 0, hu: (b.x1 - b.x0) / 2, hv: (b.z1 - b.z0) / 2 });
    }
  }
}
function bboxed(pts) {
  const xs = pts.map((p) => p.x);
  const zs = pts.map((p) => p.z);
  return { pts, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}
if (!front.length) {
  console.error('No hay calles en data/sarmiento-osm.geojson. Corré primero: npm run osm');
  process.exit(1);
}

function inPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
const blocked = (x, z) => blockers.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && inPoly(x, z, b.pts));

// ---------- 3. Índice de segmentos (distancia a la vía más cercana) ----------
const SEG = 50;
const segGrid = new Map();
const segs = [];
for (const l of lines) {
  for (let i = 1; i < l.pts.length; i++) {
    const a = l.pts[i - 1];
    const b = l.pts[i];
    const id = segs.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, half: l.half }) - 1;
    const pad = 30;
    for (let cx = Math.floor((Math.min(a.x, b.x) - pad) / SEG); cx <= Math.floor((Math.max(a.x, b.x) + pad) / SEG); cx++) {
      for (let cz = Math.floor((Math.min(a.z, b.z) - pad) / SEG); cz <= Math.floor((Math.max(a.z, b.z) + pad) / SEG); cz++) {
        const k = `${cx},${cz}`;
        if (!segGrid.has(k)) segGrid.set(k, []);
        segGrid.get(k).push(id);
      }
    }
  }
}
function distToSeg(px, pz, s) {
  const dx = s.bx - s.ax;
  const dz = s.bz - s.az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (pz - s.az) * dz) / l2));
  return Math.hypot(px - (s.ax + t * dx), pz - (s.az + t * dz));
}
/** Menor distancia libre a cualquier vía (distancia al eje menos medio ancho). */
function clearance(x, z) {
  let best = Infinity;
  for (const id of segGrid.get(`${Math.floor(x / SEG)},${Math.floor(z / SEG)}`) || []) {
    const s = segs[id];
    best = Math.min(best, distToSeg(x, z, s) - s.half);
  }
  return best;
}

// ---------- 4. Zona urbana: densidad de calles ----------
const DC = 100;
const dens = new Map();
for (const r of front) {
  for (let i = 1; i < r.pts.length; i++) {
    const a = r.pts[i - 1];
    const b = r.pts[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(len / 10));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const key = `${Math.floor((a.x + (b.x - a.x) * t) / DC)},${Math.floor((a.z + (b.z - a.z) * t) / DC)}`;
      dens.set(key, (dens.get(key) || 0) + len / n);
    }
  }
}
function density(x, z) {
  const cx = Math.floor(x / DC);
  const cz = Math.floor(z / DC);
  let sum = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) sum += dens.get(`${cx + dx},${cz + dz}`) || 0;
  return sum;
}

// ---------- 5. Colocación ----------
const boxes = [...real];
const boxGrid = new Map();
const BG = 40;
const addBox = (b) => {
  const k = `${Math.floor(b.cx / BG)},${Math.floor(b.cz / BG)}`;
  if (!boxGrid.has(k)) boxGrid.set(k, []);
  boxGrid.get(k).push(b);
};
real.forEach(addBox);

/** Superposición de dos rectángulos orientados (SAT) con margen m. */
function overlap(a, b, m) {
  const axes = [[a.ux, a.uz], [-a.uz, a.ux], [b.ux, b.uz], [-b.uz, b.ux]];
  const dx = b.cx - a.cx;
  const dz = b.cz - a.cz;
  for (const [ax, az] of axes) {
    const ra = a.hu * Math.abs(a.ux * ax + a.uz * az) + a.hv * Math.abs(-a.uz * ax + a.ux * az);
    const rb = b.hu * Math.abs(b.ux * ax + b.uz * az) + b.hv * Math.abs(-b.uz * ax + b.ux * az);
    if (Math.abs(dx * ax + dz * az) > ra + rb + m) return false;
  }
  return true;
}
function collides(box) {
  const cx = Math.floor(box.cx / BG);
  const cz = Math.floor(box.cz / BG);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    for (const o of boxGrid.get(`${cx + i},${cz + j}`) || []) if (overlap(box, o, 1)) return true;
  }
  return false;
}

const generated = [];
const why = { zona: 0, agua_verde: 0, via: 0, choque: 0, hueco: 0 };
for (const road of front) {
  const path = buildPath(road.pts);
  if (path.len < 8) continue;
  let d = rng() * 8;
  while (d < path.len && generated.length < MAX) {
    const s = sample(path, d);
    const w = 8 + rng() * 6; // frente
    const dp = 9 + rng() * 7; // fondo
    d += w + 0.8 + rng() * 5;
    for (const side of [-1, 1]) {
      if (rng() < 0.1) { why.hueco++; continue; }
      const off = road.half + 2 + rng() * 3 + dp / 2;
      const nx = -s.tz * side;
      const nz = s.tx * side;
      const box = { cx: s.x + nx * off, cz: s.z + nz * off, ux: s.tx, uz: s.tz, hu: w / 2, hv: dp / 2 };
      const dens3 = density(box.cx, box.cz);
      if (dens3 < MIN_ROAD) { why.zona++; continue; }
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({
        x: box.cx + s.tx * box.hu * a + (-s.tz) * box.hv * b,
        z: box.cz + s.tz * box.hu * a + s.tx * box.hv * b,
      }));
      // Puntos de control: centro, esquinas y 3 puntos por lado (una calle curva puede rozar entre esquinas)
      const probe = [{ x: box.cx, z: box.cz }, ...corners];
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        for (const t of [0.25, 0.5, 0.75]) probe.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      }
      if (probe.some((c) => blocked(c.x, c.z))) { why.agua_verde++; continue; }
      if (probe.some((c) => clearance(c.x, c.z) < 0.8)) { why.via++; continue; }
      if (collides(box)) { why.choque++; continue; }
      const r = rng();
      const central = dens3 > MIN_ROAD * 2.2;
      const levels = r < (central ? 0.55 : 0.75) ? 1 : r < (central ? 0.9 : 0.96) ? 2 : 3;
      box.h = Math.round((levels * 3.2 + rng() * 0.4) * 10) / 10;
      box.corners = corners;
      boxes.push(box);
      addBox(box);
      generated.push(box);
    }
  }
}

// ---------- 6. Guardar ----------
for (const b of generated) {
  const ring = b.corners.map((c) => {
    const p = toLngLat(c.x, c.z);
    return [r6(p.lng), r6(p.lat)];
  });
  ring.push(ring[0]);
  gj.features.push({
    type: 'Feature',
    properties: { kind: 'building', h: b.h, hw: null, name: null, approx: true },
    geometry: { type: 'Polygon', coordinates: [ring] },
  });
}
meta.approxBuildings = generated.length;
await writeFile(geoUrl, JSON.stringify(gj));
meta.dataRev = Date.now().toString(36); // cambia la clave de caché de los datos: el navegador baja los nuevos
await writeFile(metaUrl, JSON.stringify(meta, null, 2) + '\n');

const xs = generated.map((b) => b.cx);
const zs = generated.map((b) => b.cz);
console.log(`Casas aproximadas generadas: ${generated.length}${removed ? ` (reemplazan ${removed} de antes)` : ''}`);
console.log(`Edificios reales de OSM que se respetaron: ${real.length}`);
if (generated.length) {
  console.log(`Zona cubierta: ${Math.round(Math.max(...xs) - Math.min(...xs))} m (este-oeste) x ${Math.round(Math.max(...zs) - Math.min(...zs))} m (norte-sur)`);
}
console.log(`Descartadas: ${why.zona} fuera de la zona urbana, ${why.agua_verde} sobre agua/verde, ${why.via} sobre calles/vías, ${why.choque} por choque, ${why.hueco} huecos a propósito`);
if (generated.length >= MAX) console.warn(`Se llegó al tope de ${MAX} casas: subilo con --max si falta cobertura.`);
if (!generated.length) console.warn('No se generó ninguna casa. Probá bajar --min-road (ej. --min-road=400).');
console.log(`data/sarmiento-osm.geojson: ${(JSON.stringify(gj).length / 1e6).toFixed(2)} MB`);
