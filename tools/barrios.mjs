// Baja de OpenStreetMap los barrios que estén dibujados como zonas (place=neighbourhood/suburb/quarter,
// límites administrativos de nivel 9-10, etc.) y los guarda en data/barrios.json.
//
//   npm run barrios                 (suma lo que encuentre; no pisa los barrios que ya dibujaste vos)
//   npm run barrios -- --reemplazar (reemplaza todo por lo que haya en OpenStreetMap)
//
// Barrios que faltan: escribilos en fuentes/barrios-puntos.txt (archivo tuyo), una línea por barrio:
//     Nombre | link de Google Maps (o "lat, lng") del medio del barrio
//     Ruta 8 = Los Patos          (cambia el nombre de un barrio que viene de OpenStreetMap)
// Si OpenStreetMap no responde, igual se arman los de ese archivo.
//
// Si OpenStreetMap no tiene los barrios de Capitán Sarmiento dibujados (es lo más probable en un pueblo chico),
// no se inventa nada: dibujalos vos con `npm run serve` y abriendo http://localhost:8080/barrios

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { setCenter, toLngLat, toLocal } from '../js/geo.js';

const dataDir = new URL('../data/', import.meta.url);
const args = new Set(process.argv.slice(2));
const meta = JSON.parse(await readFile(new URL('meta.json', dataDir), 'utf8'));
setCenter(meta.center);
const half = meta.osm?.halfSizeMeters ?? 2000;
const sw = toLngLat(-half, half);
const ne = toLngLat(half, -half);
const bbox = [sw.lat, sw.lng, ne.lat, ne.lng].map((n) => n.toFixed(6)).join(',');

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
async function overpass(query) {
  let last;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'guia-sarmiento/1.0 (proyecto personal sin fines de lucro)' }, body: 'data=' + encodeURIComponent(query) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) { last = e; console.warn(`  ${url}: ${e.message}`); }
  }
  throw last;
}

console.log('Buscando barrios en OpenStreetMap…');
let data = { elements: [] };
try {
  data = await overpass(`[out:json][timeout:120];
(
  way["place"~"^(neighbourhood|suburb|quarter)$"](${bbox});
  relation["place"~"^(neighbourhood|suburb|quarter)$"](${bbox});
  relation["boundary"~"^(administrative|neighbourhood)$"]["admin_level"~"^(9|10|11)$"](${bbox});
  way["boundary"="neighbourhood"](${bbox});
  node["place"~"^(neighbourhood|suburb|quarter)$"](${bbox});
);
out tags geom;`);
} catch (e) {
  console.log(`\nOpenStreetMap no respondió (${e.message}). Sigo solo con lo que hay en fuentes/barrios-puntos.txt y con lo ya guardado.`);
}

const r6 = (n) => Math.round(n * 1e6) / 1e6;
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const closed = (c) => c.length > 3 && c[0][0] === c[c.length - 1][0] && c[0][1] === c[c.length - 1][1];
// une los tramos de una relación en un anillo cerrado (cuando se puede)
function joinWays(ways) {
  const segs = ways.map((w) => w.slice());
  const ring = segs.shift() || [];
  let guard = 0;
  while (segs.length && guard++ < 500) {
    const end = ring[ring.length - 1];
    const i = segs.findIndex((s) => s[0][0] === end[0] && s[0][1] === end[1]);
    const j = i >= 0 ? -1 : segs.findIndex((s) => s[s.length - 1][0] === end[0] && s[s.length - 1][1] === end[1]);
    if (i >= 0) ring.push(...segs.splice(i, 1)[0].slice(1));
    else if (j >= 0) ring.push(...segs.splice(j, 1)[0].reverse().slice(1));
    else break;
  }
  return closed(ring) ? ring : null;
}

const found = [];
const puntos = []; // barrios que en OpenStreetMap son solo un punto: {name, lat, lng}
for (const e of data.elements || []) {
  const name = e.tags?.name;
  if (!name) continue;
  let ring = null;
  const pts = e.type === 'node' ? [{ lat: e.lat, lon: e.lon }] : e.geometry || (e.members || []).flatMap((m) => m.geometry || []);
  if (pts.length) puntos.push({ name, lat: pts.reduce((a, q) => a + q.lat, 0) / pts.length, lng: pts.reduce((a, q) => a + q.lon, 0) / pts.length });
  if (e.type === 'way' && e.geometry) {
    const c = e.geometry.map((p) => [p.lon, p.lat]);
    if (closed(c)) ring = c;
  } else if (e.type === 'relation') {
    const outer = (e.members || []).filter((m) => m.type === 'way' && m.role !== 'inner' && m.geometry).map((m) => m.geometry.map((p) => [p.lon, p.lat]));
    ring = joinWays(outer);
  }
  if (!ring) { console.log(`  · ${name}: en OpenStreetMap es solo un punto (se arma una zona aproximada).`); continue; }
  found.push({ id: slug(name), name, polygon: ring.slice(0, -1).map(([x, y]) => [r6(x), r6(y)]) });
}

// Zonas APROXIMADAS para los barrios que son solo un punto: cada punto se queda con la parte del pueblo
// que le queda más cerca (diagrama de Voronoi), recortada a ~900 m. Quedan marcadas "aprox." y se corrigen en /barrios.
function voronoi(centros, radio) {
  const out = [];
  for (const c of centros) {
    let poly = [[c.x - radio, c.z - radio], [c.x + radio, c.z - radio], [c.x + radio, c.z + radio], [c.x - radio, c.z + radio]];
    for (const o of centros) {
      if (o === c || !poly.length) continue;
      // semiplano: puntos más cerca de c que de o
      const mx = (c.x + o.x) / 2, mz = (c.z + o.z) / 2, nx = o.x - c.x, nz = o.z - c.z;
      const f = (q) => (q[0] - mx) * nx + (q[1] - mz) * nz; // <= 0 queda
      const res = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
        if (fa <= 0) res.push(a);
        if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { const t = fa / (fa - fb); res.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      poly = res;
    }
    if (poly.length >= 3) out.push({ c, poly });
  }
  return out;
}
// ---- fuentes/barrios-puntos.txt: barrios que sumás vos (por link de Google Maps) y cambios de nombre ----
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^barrio\s+/, '').trim();
const ALIAS = new Map([['ruta 8', 'Los Patos']]); // OpenStreetMap lo llama "Ruta 8"; el barrio se llama Los Patos
const filePts = [];
const fpath = new URL('../fuentes/barrios-puntos.txt', import.meta.url);
if (existsSync(fpath)) {
  const fromText = (t) => {
    const m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(t) || /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(t) || /[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/.exec(t) || /^\s*(-?\d{1,2}\.\d+)\s*[,; ]\s*(-?\d{1,3}\.\d+)\s*$/.exec(t);
    return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
  };
  const locate = async (spec) => {
    const d = fromText(spec);
    if (d || !/^https?:\/\//.test(spec)) return d;
    try {
      const res = await fetch(spec, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 guia-sarmiento' } });
      return fromText(decodeURIComponent(res.url)) || fromText(await res.text());
    } catch { return null; }
  };
  for (const raw of (await readFile(fpath, 'utf8')).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (/^[^|]+=[^|]+$/.test(line)) { const [a, b] = line.split('=').map((x) => x.trim()); ALIAS.set(norm(a), b); continue; }
    const [name, spec = ''] = line.split('|').map((x) => x.trim());
    const pos = spec ? await locate(spec) : null;
    if (!pos) { console.log(`  · ${name}: falta la ubicación (pegá el link de Google Maps del medio del barrio en fuentes/barrios-puntos.txt).`); continue; }
    filePts.push({ name, lat: pos.lat, lng: pos.lng });
  }
}
for (const q of puntos) { const nn = ALIAS.get(norm(q.name)); if (nn) q.name = nn; }
for (const q of filePts) if (!puntos.some((o) => norm(o.name) === norm(q.name))) puntos.push(q); else Object.assign(puntos.find((o) => norm(o.name) === norm(q.name)), { lat: q.lat, lng: q.lng });
const sinFigura = puntos.filter((q) => !found.some((f) => slug(f.name) === slug(q.name)));
const aprox = [];
if (sinFigura.length) {
  const cs = sinFigura.map((q) => ({ ...q, ...(() => { const l = toLocal(q.lng, q.lat); return { x: l.x, z: l.z }; })() }));
  for (const { c, poly } of voronoi(cs, 900)) {
    aprox.push({ id: slug(c.name), name: c.name.replace(/^barrio\s+/i, ''), approx: true, polygon: poly.map(([x, z]) => { const g = toLngLat(x, z); return [r6(g.lng), r6(g.lat)]; }) });
  }
}
found.push(...aprox);

const file = new URL('barrios.json', dataDir);
const current = args.has('--reemplazar') ? [] : JSON.parse(await readFile(file, 'utf8').catch(() => '[]'));
// Las zonas "aprox." que armó esta herramienta a partir de puntos se rehacen cada vez (así los barrios nuevos se reparten el espacio).
// Las que corregiste en /barrios (sin "aprox.") no se tocan nunca.
const regen = new Set([...sinFigura.map((q) => slug(q.name.replace(/^barrio\s+/i, ''))), ...[...ALIAS.keys()].map((k) => slug(k))]);
for (let i = current.length - 1; i >= 0; i--) if (current[i].approx && regen.has(slug(current[i].name))) current.splice(i, 1);
const names = new Set(current.map((b) => slug(b.name)));
let added = 0;
for (const b of found) if (!names.has(slug(b.name)) && b.polygon.length >= 3) { current.push(b); names.add(slug(b.name)); added++; }
if (added || args.has('--reemplazar')) {
  await writeFile(file, JSON.stringify(current, null, 1) + '\n');
  meta.dataRev = Date.now().toString(36);
  await writeFile(new URL('meta.json', dataDir), JSON.stringify(meta, null, 2) + '\n');
}
if (aprox.length) console.log(`\nSe armaron ${aprox.length} zonas APROXIMADAS (a partir del punto de cada barrio). Se ven como "aprox." y las podés corregir en http://localhost:8080/barrios`);
if (!found.length) console.log('\nOpenStreetMap no tiene barrios dibujados en esta zona.\nDibujalos vos: npm run serve → http://localhost:8080/barrios (se hace clic en las esquinas de cada barrio).');
else console.log(`\nBarrios encontrados: ${found.length} · sumados: ${added}. Mirá el resultado en http://localhost:8080/barrios y ajustalo si hace falta.`);
