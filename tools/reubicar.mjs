// Aplica tus correcciones de lugares: los que moviste de lugar y los que eliminaste.
//   Se editan desde  http://localhost:8080/reubicar  (con  npm run serve ), que escribe estos archivos:
//     fuentes/reubicados.txt   id | latitud, longitud | nombre
//     fuentes/eliminados.txt   id | nombre
//   Y este comando los aplica sobre data/places.json y data/landmarks.json (npm run lugares lo hace solo al final).
//
//   npm run reubicar          aplica los cambios
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { setCenter, toLocal } from '../js/geo.js';
import { prepararCalzado, calzar } from '../js/calzar.js';

const root = new URL('../', import.meta.url);
const leerLineas = async (f) => (existsSync(new URL(f, root)) ? (await readFile(new URL(f, root), 'utf8')).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : []);
const json = async (f, def) => { try { return JSON.parse(await readFile(new URL(f, root), 'utf8')); } catch { return def; } };
const clave = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const meta = await json('data/meta.json', null);
const places = await json('data/places.json', null);
if (!meta || !places) { console.log('Faltan data/meta.json o data/places.json: corré primero npm run lugares.'); process.exit(0); }
setCenter(meta.center);
const lmFile = await json('data/landmarks.json', { items: [] });
const lms = lmFile.items || [];
const dist = (a, b) => { const p = toLocal(a.lng, a.lat), q = toLocal(b.lng, b.lat); return Math.hypot(p.x - q.x, p.z - q.z); };

const mover = new Map();
for (const l of await leerLineas('fuentes/reubicados.txt')) {
  const [id, ll = ''] = l.split('|').map((x) => x.trim());
  const m = ll.match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);
  if (id && m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180) mover.set(id, { lat: +m[1], lng: +m[2] });
}
const eliminar = new Set((await leerLineas('fuentes/eliminados.txt')).map((l) => l.split('|')[0].trim()).filter(Boolean));


const gj = existsSync(new URL('data/sarmiento-osm.geojson', root)) ? JSON.parse(await readFile(new URL('data/sarmiento-osm.geojson', root), 'utf8')) : null;
const ctx = prepararCalzado(gj);
const gjFile = new URL('data/sarmiento-osm.geojson', root);
const calzarL = (l, lat, lng, vieja) => calzar(ctx, l, lat, lng, vieja);
let movidos = 0, eliminados = 0, calzados = 0;
for (const p of places.slice()) {
  if (eliminar.has(p.id)) {
    for (let i = lms.length - 1; i >= 0; i--) if (clave(lms[i].name) === clave(p.name) && Number.isFinite(lms[i].lat) && dist(lms[i], p) < 80) lms.splice(i, 1);
    places.splice(places.indexOf(p), 1);
    eliminados++;
    continue;
  }
  const to = mover.get(p.id);
  if (!to) continue;
  if (Math.abs(p.lat - to.lat) < 1e-7 && Math.abs(p.lng - to.lng) < 1e-7) { // ya está ahí: igual se vuelve a calzar el modelo sobre el edificio
    for (const l of lms) if (clave(l.name) === clave(p.name) && Number.isFinite(l.lat) && dist(l, p) < 80 && calzarL(l, to.lat, to.lng, { lat: l.lat, lng: l.lng })) calzados++;
    continue;
  }
  for (const l of lms) if (clave(l.name) === clave(p.name) && Number.isFinite(l.lat) && dist(l, p) < 80) { if (calzarL(l, to.lat, to.lng, { lat: l.lat, lng: l.lng })) calzados++; }
  p.lat = to.lat; p.lng = to.lng; p.fijo = true;
  movidos++;
}
if (movidos || eliminados || calzados) {
  await writeFile(new URL('data/places.json', root), JSON.stringify(places, null, 2) + '\n');
  lmFile.items = lms;
  await writeFile(new URL('data/landmarks.json', root), JSON.stringify(lmFile, null, 2) + '\n');
  if (ctx.cambio) await writeFile(gjFile, JSON.stringify(gj));
  meta.dataRev = Date.now().toString(36);
  await writeFile(new URL('data/meta.json', root), JSON.stringify(meta, null, 2) + '\n');
}
console.log(`Correcciones aplicadas: ${movidos} lugar(es) movido(s), ${eliminados} eliminado(s)${calzados ? `, ${calzados} edificio(s) importante(s) calzado(s) sobre el edificio real` : ''}.`);
