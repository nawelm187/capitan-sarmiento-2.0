// Busca lugares repetidos en data/places.json y, si se lo pedís, los junta en uno solo.
//
//   npm run duplicados              (solo muestra qué encontró; no cambia nada)
//   npm run duplicados -- --aplicar (junta los repetidos; antes guarda una copia en data/places.antes-de-duplicados.json)
//
// Se considera repetido cuando:
//   · tienen el mismo nombre (o uno contiene al otro, o casi iguales) y están a menos de 150 m, o
//   · son del mismo tipo y están a menos de 12 m (por ejemplo el mismo local cargado con otro nombre).
// Con el mismo nombre pero lejos NO se juntan (puede ser una cadena con dos locales): solo se avisan.
// Se conserva el que cargaste vos antes que el de OpenStreetMap, y el que tiene más datos completos; al que queda se le
// pasan los datos que le falten. Los recorridos que usaban al repetido pasan a usar al que queda.
// Para que no vuelvan a aparecer: la línea de fuentes/lugares-extra.txt se comenta y el id de OpenStreetMap se anota en
// fuentes/ignorar-ids.txt.

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { setCenter, toLocal } from '../js/geo.js';

const dataDir = new URL('../data/', import.meta.url);
const extraFile = new URL('../fuentes/lugares-extra.txt', import.meta.url);
const ignoreFile = new URL('../fuentes/ignorar-ids.txt', import.meta.url);
const apply = process.argv.includes('--aplicar');
const readJSON = async (n, d) => JSON.parse(await readFile(new URL(n, dataDir), 'utf8').catch(() => JSON.stringify(d)));

const meta = await readJSON('meta.json', {});
setCenter(meta.center);
const places = await readJSON('places.json', []);
const tours = await readJSON('tours.json', []);

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const key = (s) => norm(s).replace(/[^a-z0-9]/g, '');
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'club', 'bar', 'cafe', 'resto', 'restaurante', 'pizzeria', 'farmacia', 'supermercado', 'srl', 'sa', 'hnos']);
const tokens = (s) => new Set(norm(s).split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)));
const xy = places.map((p) => toLocal(p.lng, p.lat));
const meters = (i, j) => Math.hypot(xy[i].x - xy[j].x, xy[i].z - xy[j].z);
function sameName(a, b) {
  const ka = key(a), kb = key(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (Math.min(ka.length, kb.length) >= 6 && (ka.includes(kb) || kb.includes(ka))) return true;
  const ta = tokens(a), tb = tokens(b);
  if (!ta.size || !tb.size) return false;
  return jac(ta, tb) >= 0.8;
}
function jac(ta, tb) {
  if (!ta.size || !tb.size) return 0;
  return [...ta].filter((t) => tb.has(t)).length / new Set([...ta, ...tb]).size;
}

// ---- grupos de repetidos (union-find) ----
const parent = places.map((_, i) => i);
const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
const reasons = new Map();
const far = [];
const maybe = [];
for (let i = 0; i < places.length; i++) {
  for (let j = i + 1; j < places.length; j++) {
    const d = meters(i, j);
    const nameMatch = sameName(places[i].name, places[j].name);
    let why = null;
    if (nameMatch && d < 150) why = `mismo nombre a ${Math.round(d)} m`;
    else if (places[i].icon && places[i].icon === places[j].icon && d < 12) why = `mismo tipo a ${Math.round(d)} m`;
    else if (nameMatch && d >= 150) far.push([i, j, d]);
    else if (d < 150 && jac(tokens(places[i].name), tokens(places[j].name)) >= 0.5) maybe.push([i, j, d]);
    if (why) {
      parent[find(j)] = find(i);
      reasons.set(`${i}-${j}`, why);
    }
  }
}
const groups = new Map();
places.forEach((_, i) => {
  const r = find(i);
  if (!groups.has(r)) groups.set(r, []);
  groups.get(r).push(i);
});
const dupGroups = [...groups.values()].filter((g) => g.length > 1);

const rank = (p) => (String(p.id).startsWith('osm-') ? 2 : String(p.id).startsWith('extra-') ? 1 : 0);
const filled = (p) => ['description', 'hours', 'phone', 'web', 'photo', 'address', 'localTip', 'reviewsUrl'].filter((k) => String(p[k] || '').trim()).length;
const label = (p) => `${p.name} [${p.id}]`;

if (!dupGroups.length) console.log('No se encontraron lugares repetidos. 👍');
const removed = new Map(); // id repetido → id que queda
for (const g of dupGroups) {
  const sorted = g.slice().sort((a, b) => rank(places[a]) - rank(places[b]) || filled(places[b]) - filled(places[a]) || a - b);
  const keeper = sorted[0];
  console.log(`\n• Queda: ${label(places[keeper])}`);
  for (const i of sorted.slice(1)) {
    const why = reasons.get(`${Math.min(i, keeper)}-${Math.max(i, keeper)}`) || 'repetido por otro del grupo';
    console.log(`    se junta: ${label(places[i])}  (${why})`);
    removed.set(places[i].id, places[keeper].id);
  }
}
if (maybe.length) {
  console.log('\nPosibles repetidos (nombres parecidos y cerca; NO se juntan solos, mirá si es el mismo):');
  for (const [i, j, d] of maybe.slice(0, 30)) console.log(`  - "${places[i].name}" y "${places[j].name}" a ${Math.round(d)} m (${places[i].id} / ${places[j].id})`);
}
if (far.length) {
  console.log('\nMismo nombre pero lejos (no se tocan; revisá si son locales distintos):');
  for (const [i, j, d] of far.slice(0, 20)) console.log(`  - ${places[i].name}: ${Math.round(d)} m entre uno y otro (${places[i].id} / ${places[j].id})`);
}

// ---- líneas repetidas dentro de lugares-extra.txt ----
let extraText = existsSync(extraFile) ? await readFile(extraFile, 'utf8') : '';
const seenLines = new Map();
const lines = extraText.split(/\r?\n/);
let dupLines = 0;
lines.forEach((l, i) => {
  if (!l.trim() || l.trim().startsWith('#')) return;
  const [name, , spec = ''] = l.split('|').map((x) => x.trim());
  const k = key(name);
  if (!seenLines.has(k)) { seenLines.set(k, i); return; }
  dupLines++;
  const first = seenLines.get(k);
  const firstSpec = (lines[first].split('|')[2] || '').trim();
  console.log(`\n• Línea repetida en fuentes/lugares-extra.txt: "${name}"`);
  if (apply) {
    // se conserva la que tiene ubicación (si la repetida es la que la tiene, se intercambian)
    if (!firstSpec && spec) { lines[first] = l; }
    lines[i] = `# (repetido) ${l}`;
  }
});

if (!apply) {
  console.log(`\n${removed.size} lugares y ${dupLines} líneas repetidas. Para juntarlos corré:  npm run duplicados -- --aplicar`);
  process.exit(0);
}
if (!removed.size && !dupLines) process.exit(0);

// ---- aplicar ----
await writeFile(new URL('places.antes-de-duplicados.json', dataDir), JSON.stringify(places, null, 2) + '\n');
const byId = new Map(places.map((p) => [p.id, p]));
for (const [dup, keepId] of removed) {
  const k = byId.get(keepId);
  const d = byId.get(dup);
  for (const f of ['description', 'hours', 'phone', 'web', 'photo', 'address', 'localTip', 'reviewsUrl']) if (!String(k[f] || '').trim() && String(d[f] || '').trim()) k[f] = d[f];
  if (!k.roofH && d.roofH) k.roofH = d.roofH;
}
const out = places.filter((p) => !removed.has(p.id));
await writeFile(new URL('places.json', dataDir), JSON.stringify(out, null, 2) + '\n');

// recorridos: los repetidos pasan al que queda (y no se repite una parada seguida)
let toursChanged = 0;
for (const t of tours) {
  const stops = [];
  for (const s of t.stops || []) {
    const id = removed.get(s.placeId) || s.placeId;
    if (id !== s.placeId) toursChanged++;
    if (stops.length && stops[stops.length - 1].placeId === id) continue;
    stops.push({ ...s, placeId: id });
  }
  t.stops = stops;
}
if (toursChanged) await writeFile(new URL('tours.json', dataDir), JSON.stringify(tours, null, 2) + '\n');

// que no vuelvan a aparecer: líneas de lugares-extra comentadas y ids de OSM ignorados
const gone = [...removed.keys()];
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
for (const id of gone.filter((x) => x.startsWith('extra-'))) {
  const i = lines.findIndex((l) => l.trim() && !l.trim().startsWith('#') && 'extra-' + slug(l.split('|')[0]) === id);
  if (i >= 0) lines[i] = `# (repetido) ${lines[i]}`;
}
if (extraText) await writeFile(extraFile, lines.join('\n'));
const osmGone = gone.filter((x) => x.startsWith('osm-'));
if (osmGone.length) {
  const before = existsSync(ignoreFile) ? await readFile(ignoreFile, 'utf8') : '# Lugares de OpenStreetMap que no se quieren (repetidos). Una id por línea.\n';
  await writeFile(ignoreFile, before.replace(/\n*$/, '\n') + osmGone.join('\n') + '\n');
}
meta.dataRev = Date.now().toString(36);
await writeFile(new URL('meta.json', dataDir), JSON.stringify(meta, null, 2) + '\n');
console.log(`\n✔ Se juntaron ${removed.size} lugares repetidos (quedan ${out.length}).${toursChanged ? ` Se actualizaron ${toursChanged} paradas de recorridos.` : ''} La copia anterior está en data/places.antes-de-duplicados.json.`);
console.log('Ahora corré  npm run lugares  para rearmar el mapa.');
