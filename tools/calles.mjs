// Baja las CALLES REALES (y vías de tren, agua y verdes) de OpenStreetMap y reemplaza las de ejemplo
// en data/sarmiento-osm.geojson. NO toca los edificios. No necesita `npm install`.
//
//   npm run calles                  (la página alinea sola las calles con las casas al cargar)
//   npm run calles -- --alinear     (además mueve las casas en el archivo; normalmente no hace falta)
//
// Después corré:  npm run lugares   (pega los lugares a su edificio y rearma los recorridos por las calles)

import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setCenter, toLngLat, toLocal } from '../js/geo.js';

const dataDir = new URL('../data/', import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));

const meta = JSON.parse(await readFile(new URL('meta.json', dataDir), 'utf8'));
if (args.center) {
  const [lat, lng] = String(args.center).split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('--center debe ser LAT,LNG (ej. --center=-34.17,-59.79)');
  meta.center = { lat, lng };
}
if (args.half) meta.osm = { ...(meta.osm || {}), halfSizeMeters: Number(args.half) };
const half = meta.osm?.halfSizeMeters ?? 2000;
setCenter(meta.center);
const sw = toLngLat(-half, half);
const ne = toLngLat(half, -half);
const bbox = [sw.lat, sw.lng, ne.lat, ne.lng].map((n) => n.toFixed(6)).join(',');

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
async function overpass(query) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'guia-sarmiento/1.0 (proyecto personal sin fines de lucro)' },
          body: 'data=' + encodeURIComponent(query),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
        console.warn(`  ${url}: ${e.message}`);
      }
    }
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
  }
  throw lastErr;
}

console.log('Bajando las calles reales de OpenStreetMap (hace falta internet)…');
const data = await overpass(`[out:json][timeout:180];
(
  way["highway"](${bbox});
  way["railway"~"^(rail|abandoned|disused|light_rail)$"](${bbox});
  way["waterway"~"^(river|stream|canal|drain)$"](${bbox});
  way["natural"="water"](${bbox});
  way["leisure"~"^(park|pitch|playground|garden|recreation_ground|sports_centre|stadium)$"](${bbox});
  way["landuse"~"^(grass|recreation_ground|cemetery|village_green|meadow)$"](${bbox});
);
out tags geom;`);

const r6 = (n) => Math.round(n * 1e6) / 1e6;
const SKIP_HW = new Set(['proposed', 'construction', 'steps', 'corridor', 'elevator', 'platform', 'bus_guideway', 'raceway']);
const GREEN_LEISURE = /^(park|pitch|playground|garden|recreation_ground|sports_centre|stadium)$/;
const GREEN_LANDUSE = /^(grass|recreation_ground|cemetery|village_green|meadow)$/;

const feats = [];
const counts = {};
for (const e of data.elements || []) {
  if (e.type !== 'way' || !e.geometry || e.geometry.length < 2) continue;
  const t = e.tags || {};
  const coords = e.geometry.map((p) => [r6(p.lon), r6(p.lat)]);
  const closed = coords.length > 3 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1];
  let kind = null;
  let geometry = { type: 'LineString', coordinates: coords };
  if (t.highway) {
    if (SKIP_HW.has(t.highway) || t.area === 'yes') continue;
    kind = 'road';
  } else if (t.railway) kind = 'rail';
  else if (t.waterway) kind = 'water';
  else if (closed && t.natural === 'water') {
    kind = 'water';
    geometry = { type: 'Polygon', coordinates: [coords] };
  } else if (closed && (GREEN_LEISURE.test(t.leisure || '') || GREEN_LANDUSE.test(t.landuse || ''))) {
    kind = 'green';
    geometry = { type: 'Polygon', coordinates: [coords] };
  }
  if (!kind) continue;
  feats.push({ type: 'Feature', properties: { kind, h: 0, hw: t.highway || null, name: t.name || null }, geometry });
  counts[kind] = (counts[kind] || 0) + 1;
}

if (!counts.road) {
  console.error('\nOpenStreetMap no devolvió calles para esta zona (¿internet? ¿centro correcto?). No se cambió nada. Probá de nuevo en un minuto.');
  process.exit(1);
}

const gjUrl = new URL('sarmiento-osm.geojson', dataDir);
const gj = JSON.parse(await readFile(gjUrl, 'utf8'));
const wasDemo = meta.dataSource === 'demo';
// Si los datos eran de ejemplo, también lo eran las casas (inventadas): se descartan junto con los lugares de ejemplo.
if (wasDemo && !args['keep-demo']) gj.features = gj.features.filter((f) => f.properties?.kind !== 'building');
const buildings = gj.features.filter((f) => f.properties?.kind === 'building');

// --- ¿Los edificios están corridos respecto de las calles? (se prueban corrimientos de hasta ±30 m)
const roadsLocal = feats.filter((f) => f.properties.kind === 'road' && f.geometry.type === 'LineString').map((f) => ({
  hw: f.properties.hw,
  pts: f.geometry.coordinates.map(([lng, lat]) => toLocal(lng, lat)),
}));
const HALF_W = { motorway: 10, trunk: 10, primary: 8, secondary: 7, tertiary: 6, unclassified: 5, residential: 5, living_street: 4, service: 3 };
const cell = 30;
const segGrid = new Map();
const keyOf = (cx, cz) => cx + ',' + cz;
for (const r of roadsLocal) {
  const hw = HALF_W[r.hw];
  if (!hw) continue;
  for (let i = 1; i < r.pts.length; i++) {
    const a = r.pts[i - 1];
    const b = r.pts[i];
    const seg = { a, b, hw };
    for (let cx = Math.floor((Math.min(a.x, b.x) - 12) / cell); cx <= Math.floor((Math.max(a.x, b.x) + 12) / cell); cx++) {
      for (let cz = Math.floor((Math.min(a.z, b.z) - 12) / cell); cz <= Math.floor((Math.max(a.z, b.z) + 12) / cell); cz++) {
        const k = keyOf(cx, cz);
        if (!segGrid.has(k)) segGrid.set(k, []);
        segGrid.get(k).push(seg);
      }
    }
  }
}
const onRoad = (x, z) => {
  const l = segGrid.get(keyOf(Math.floor(x / cell), Math.floor(z / cell)));
  if (!l) return false;
  for (const s of l) {
    const dx = s.b.x - s.a.x;
    const dz = s.b.z - s.a.z;
    const t = Math.min(1, Math.max(0, ((x - s.a.x) * dx + (z - s.a.z) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(x - (s.a.x + dx * t), z - (s.a.z + dz * t)) < s.hw) return true;
  }
  return false;
};
const centroids = [];
for (const f of buildings) {
  const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates?.[0]?.[0];
  if (!ring?.length) continue;
  let cx = 0;
  let cz = 0;
  for (const [lng, lat] of ring) {
    const p = toLocal(lng, lat);
    cx += p.x;
    cz += p.z;
  }
  centroids.push([cx / ring.length, cz / ring.length]);
}
const sample = centroids.length > 3000 ? centroids.filter((_, i) => i % Math.ceil(centroids.length / 3000) === 0) : centroids;
const score = (dx, dz) => sample.reduce((n, [x, z]) => n + (onRoad(x + dx, z + dz) ? 1 : 0), 0) / (sample.length || 1);
let best = { dx: 0, dz: 0, s: score(0, 0) };
const base = best.s;
if (sample.length > 50) {
  for (let dx = -30; dx <= 30; dx += 3) {
    for (let dz = -30; dz <= 30; dz += 3) {
      const s = score(dx, dz);
      if (s < best.s) best = { dx, dz, s };
    }
  }
  const c = { ...best };
  for (let dx = c.dx - 3; dx <= c.dx + 3; dx += 1) {
    for (let dz = c.dz - 3; dz <= c.dz + 3; dz += 1) {
      const s = score(dx, dz);
      if (s < best.s) best = { dx, dz, s };
    }
  }
}
console.log(`Casas que quedan encima de una calle: ${(base * 100).toFixed(1)} %` + (best.s < base * 0.7 ? ` (con un corrimiento de ${best.dx} m este / ${best.dz} m sur bajaría a ${(best.s * 100).toFixed(1)} %)` : ''));

let moved = false;
if (args.alinear && best.s < base * 0.7 && (best.dx || best.dz)) {
  // Mover las casas (dx, dz) metros: se suma al lng/lat de cada vértice.
  const o = toLngLat(0, 0);
  const d = toLngLat(best.dx, best.dz);
  const dlng = d.lng - o.lng;
  const dlat = d.lat - o.lat;
  const shift = (c) => (typeof c[0] === 'number' ? [r6(c[0] + dlng), r6(c[1] + dlat)] : c.map(shift));
  for (const f of buildings) f.geometry.coordinates = shift(f.geometry.coordinates);
  moved = true;
  console.log(`✔ Edificios corridos ${best.dx} m al este y ${best.dz} m al sur para que calzaran con las calles.`);
}

const others = gj.features.filter((f) => !['road', 'rail', 'water', 'green'].includes(f.properties?.kind));
await writeFile(gjUrl, JSON.stringify({ ...gj, features: [...feats, ...others] }));
if (wasDemo && !args['keep-demo']) {
  const empty = (name, v) => writeFile(new URL(name, dataDir), JSON.stringify(v, null, 2) + '\n');
  await Promise.all([empty('places.json', []), empty('tours.json', []), empty('landmarks.json', { items: [] }), empty('casonas.json', { items: [] }), empty('mascots.json', { items: [] })]);
  meta.demoContent = false;
  console.log('Se borró el contenido de ejemplo (casas, lugares, recorridos): no coincide con el pueblo real. Falta sumar las casas reales (npm run mapa).');
}
meta.dataSource = 'osm';
meta.dataRev = Date.now().toString(36);
await writeFile(new URL('meta.json', dataDir), JSON.stringify(meta, null, 2) + '\n');

console.log('Calles reales guardadas:', counts, moved ? '(edificios alineados)' : '');
if (args['sin-lugares']) process.exit(0);
console.log('\nAcomodando los lugares y recorridos sobre las calles nuevas…');
try {
  execFileSync(process.execPath, [fileURLToPath(new URL('./lugares.mjs', import.meta.url))], { stdio: 'inherit' });
} catch {
  console.warn('No se pudieron actualizar los lugares ahora: corré  npm run lugares');
}
