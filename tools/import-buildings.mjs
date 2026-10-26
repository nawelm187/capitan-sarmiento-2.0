// Importa huellas REALES de edificios desde un archivo GeoJSON que vos descargues
// (por ejemplo de Overture Maps, de Microsoft Building Footprints o de Google Open Buildings)
// y las suma a data/sarmiento-osm.geojson. Sirve cuando OpenStreetMap tiene pocos edificios.
//
//   npm run buildings -- archivo.geojson --source="Overture Maps Foundation"
//
// Acepta GeoJSON normal (FeatureCollection) o GeoJSON de una línea por feature (.geojsonl / .jsonl).
// Opciones:
//   --source="Nombre"   cómo se acredita la fuente en el "Aviso importante" (obligatorio por licencia)
//   --height=4          altura fija en metros para los edificios sin dato de altura. Si no lo pasás,
//                       se reparten alturas parejas y repetibles (casas bajas de 3 a 6 m; galpones y
//                       edificios grandes más altos) para que no se vea todo igual
//   --min-area=6        descarta polígonos de menos de N m² (ruido)
//
// Qué hace:
//  - Se queda solo con los edificios dentro del recuadro del mapa (meta.json: center + osm.halfSizeMeters).
//  - Descarta los que ya existen en OpenStreetMap (para no duplicar) y borra las casas aproximadas
//    de `npm run fill`, que quedan reemplazadas por las reales.
//  - Es repetible: volver a importar reemplaza la importación anterior.
//
// IMPORTANTE: revisá la licencia de la fuente y mantené su atribución (la herramienta la agrega a
// los créditos). Los datos de OpenStreetMap son ODbL; combinarlos con otras fuentes puede exigir
// que el resultado conserve condiciones compatibles.

import { readFile, writeFile } from 'node:fs/promises';
import { setCenter, toLocal } from '../js/geo.js';

const dataDir = new URL('../data/', import.meta.url);
const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const args = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
if (!file) {
  console.error('Uso: npm run buildings -- archivo.geojson --source="Overture Maps Foundation"');
  process.exit(1);
}

const metaUrl = new URL('meta.json', dataDir);
const geoUrl = new URL('sarmiento-osm.geojson', dataDir);
const meta = JSON.parse(await readFile(metaUrl, 'utf8'));
const gj = JSON.parse(await readFile(geoUrl, 'utf8'));
setCenter(meta.center);
const half = meta.osm?.halfSizeMeters ?? 2000;
const FIXED_H = Number(args.height) || 0;
const hash01 = (x, y) => { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); };
const MIN_AREA = Number(args['min-area'] ?? 6);
const r6 = (n) => Math.round(n * 1e6) / 1e6;

// ---------- Leer el archivo ----------
const text = await readFile(file, 'utf8');
let features = [];
try {
  const j = JSON.parse(text);
  features = j.type === 'FeatureCollection' ? j.features : j.type === 'Feature' ? [j] : [];
} catch {
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim().replace(/^\x1e/, '');
    if (!t) continue;
    try {
      const f = JSON.parse(t);
      if (f.type === 'Feature') features.push(f);
    } catch { /* línea inválida: se ignora */ }
  }
}
if (!features.length) {
  console.error('No encontré features GeoJSON en el archivo. ¿Es un .geojson / .geojsonl?');
  process.exit(1);
}
console.log(`Archivo: ${features.length} elementos`);

// ---------- Existentes ----------
const polysOf = (g) => (g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []);
const loc = (c) => toLocal(c[0], c[1]);
function inPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
const centroid = (pts) => {
  let x = 0;
  let z = 0;
  for (const p of pts) { x += p.x; z += p.z; }
  return { x: x / pts.length, z: z / pts.length };
};
const areaOf = (pts) => {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += pts[j].x * pts[i].z - pts[i].x * pts[j].z;
  return Math.abs(s) / 2;
};

const before = gj.features.length;
gj.features = gj.features.filter((f) => !f.properties?.approx && f.properties?.src !== 'import');
const dropped = before - gj.features.length;

const GC = 40;
const grid = new Map();
const existing = [];
for (const f of gj.features) {
  if (f.properties?.kind !== 'building') continue;
  for (const p of polysOf(f.geometry)) {
    const pts = p[0].map(loc);
    const c = centroid(pts);
    const e = { pts, c };
    existing.push(e);
    const k = `${Math.floor(c.x / GC)},${Math.floor(c.z / GC)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(e);
  }
}
function duplicate(pts, c) {
  const cx = Math.floor(c.x / GC);
  const cz = Math.floor(c.z / GC);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    for (const e of grid.get(`${cx + i},${cz + j}`) || []) {
      if (inPoly(c.x, c.z, e.pts) || inPoly(e.c.x, e.c.z, pts)) return true;
    }
  }
  return false;
}

// ---------- Importar ----------
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const stat = { fuera: 0, repetidos: 0, chicos: 0, otros: 0, ok: 0 };
const added = [];
for (const f of features) {
  const g = f.geometry;
  const polys = polysOf(g);
  if (!polys.length) { stat.otros++; continue; }
  const pr = f.properties || {};
  const given = num(pr.height) > 0 ? num(pr.height) : num(pr.num_floors ?? pr['building:levels'] ?? pr.floors) > 0 ? num(pr.num_floors ?? pr['building:levels'] ?? pr.floors) * 3 : 0;
  for (const p of polys) {
    const ring = p[0];
    if (!ring || ring.length < 4) { stat.otros++; continue; }
    const pts = ring.map(loc);
    const c = centroid(pts);
    if (Math.abs(c.x) > half || Math.abs(c.z) > half) { stat.fuera++; continue; }
    const area = areaOf(pts);
    if (area < MIN_AREA) { stat.chicos++; continue; }
    if (duplicate(pts, c)) { stat.repetidos++; continue; }
    let h = given || FIXED_H;
    if (!h) {
      const r = hash01(ring[0][0] * 1e4, ring[0][1] * 1e4);
      h = area > 600 ? 6 + r * 3 : area > 250 ? 4.5 + r * 2.5 : 3 + r * 3;
    }
    h = Math.round(Math.min(Math.max(h, 2.5), 120) * 10) / 10;
    added.push({
      type: 'Feature',
      properties: { kind: 'building', h, hw: null, name: pr.names?.primary || pr.name || null, src: 'import' },
      geometry: { type: 'Polygon', coordinates: [ring.map(([lng, lat]) => [r6(lng), r6(lat)])] },
    });
    stat.ok++;
  }
}
gj.features.push(...added);

// ---------- Guardar ----------
const source = typeof args.source === 'string' ? args.source : null;
if (!source) console.warn('ATENCIÓN: falta --source="Nombre de la fuente". Sin eso no se puede acreditar; agregala antes de publicar.');
meta.buildingSources = [source || 'Huellas de edificios importadas (completar fuente)'];
meta.importedBuildings = stat.ok;
delete meta.approxBuildings;
await writeFile(geoUrl, JSON.stringify(gj));
meta.dataRev = Date.now().toString(36); // cambia la clave de caché de los datos: el navegador baja los nuevos
await writeFile(metaUrl, JSON.stringify(meta, null, 2) + '\n');

console.log(`Edificios importados: ${stat.ok}`);
console.log(`Descartados: ${stat.fuera} fuera del recuadro, ${stat.repetidos} ya estaban en OpenStreetMap, ${stat.chicos} muy chicos, ${stat.otros} sin geometría válida`);
if (dropped) console.log(`Se quitaron ${dropped} edificios de importaciones/aproximaciones anteriores.`);
console.log(`Edificios en total: ${gj.features.filter((f) => f.properties?.kind === 'building').length} · data/sarmiento-osm.geojson: ${(JSON.stringify(gj).length / 1e6).toFixed(2)} MB`);
