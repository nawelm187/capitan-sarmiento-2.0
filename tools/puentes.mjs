// Baja de OpenStreetMap los PUENTES CON NOMBRE de la zona del mapa (ríos, arroyos, canales, vías, rutas) y los
// guarda en fuentes/puentes.txt para que `npm run lugares` los sume como lugares ("Puentes, pesca y agua").
//
//   npm run puentes            (después: npm run lugares)
//
// Los puentes sin nombre en OpenStreetMap no se cargan. Para sumar uno a mano (con nombre y ubicación) escribilo en
// fuentes/puentes-manual.txt:   Nombre | puente | lat, lng      (tipo "pesca" para un lugar de pesca)
// Ese archivo es tuyo: las actualizaciones no lo pisan.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { setCenter, toLngLat } from '../js/geo.js';

const root = new URL('../', import.meta.url);
const meta = JSON.parse(await readFile(new URL('data/meta.json', root), 'utf8'));
setCenter(meta.center);
const half = meta.osm?.halfSizeMeters ?? 2000;
const sw = toLngLat(-half, half);
const ne = toLngLat(half, -half);
const bbox = [sw.lat, sw.lng, ne.lat, ne.lng].map((n) => n.toFixed(6)).join(',');

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
async function overpass(query) {
  let last;
  for (let round = 0; round < 3; round++) {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'guia-sarmiento/1.0 (proyecto personal sin fines de lucro)' }, body: 'data=' + encodeURIComponent(query) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) { last = e; console.warn(`  ${url}: ${e.message}`); }
    }
    await new Promise((r) => setTimeout(r, 4000 * (round + 1)));
  }
  throw last;
}

console.log('Buscando puentes con nombre en OpenStreetMap…');
const data = await overpass(`[out:json][timeout:180];
(
  way["bridge"]["bridge"!="no"]["name"](${bbox});
  way["man_made"="bridge"]["name"](${bbox});
  node["bridge"]["bridge"!="no"]["name"](${bbox});
);
out tags center;`);

const r6 = (n) => Math.round(n * 1e6) / 1e6;
const clean = (s) => String(s).replace(/\|/g, '/').trim();
const seen = new Map();
for (const e of data.elements || []) {
  const name = clean(e.tags?.name || '');
  if (!name) continue;
  const c = e.center || { lat: e.lat, lon: e.lon };
  if (!Number.isFinite(c?.lat)) continue;
  // un puente suele venir partido en varios tramos con el mismo nombre: se queda uno por nombre y zona (150 m)
  const key = name.toLowerCase();
  const prev = seen.get(key) || [];
  if (prev.some((q) => Math.hypot((q.lat - c.lat) * 111000, (q.lon - c.lon) * 91000) < 150)) continue;
  prev.push({ lat: c.lat, lon: c.lon, name, via: e.tags.highway || e.tags.railway || '' });
  seen.set(key, prev);
}
const out = [...seen.values()].flat().sort((a, b) => a.name.localeCompare(b.name, 'es'));
const lines = [
  '# Puentes con nombre de OpenStreetMap (los genera `npm run puentes`; no hace falta editarlo).',
  '# Nombre | tipo | ubicación | dirección | estado',
  ...out.map((q) => `${/^puente\b/i.test(q.name) ? q.name : 'Puente ' + q.name} | puente | ${r6(q.lat)}, ${r6(q.lon)} | ${q.via === 'rail' ? 'Vía del tren' : ''} | de OpenStreetMap`),
];
await mkdir(new URL('fuentes/', root), { recursive: true });
await writeFile(new URL('fuentes/puentes.txt', root), lines.join('\n') + '\n');
if (!existsSync(new URL('fuentes/puentes-manual.txt', root))) {
  await writeFile(new URL('fuentes/puentes-manual.txt', root), '# Tus puentes y lugares de pesca. Una línea por lugar:\n#   Nombre | puente | lat, lng\n#   Nombre | pesca | lat, lng\n');
}
console.log(out.length ? `Puentes con nombre encontrados: ${out.length}\n${out.map((q) => '  · ' + q.name).join('\n')}\n\nAhora corré: npm run lugares` : 'OpenStreetMap no tiene puentes con nombre en esta zona. Sumalos a mano en fuentes/puentes-manual.txt (Nombre | puente | lat, lng).');
