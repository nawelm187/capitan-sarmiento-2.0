// Baja de OpenStreetMap los lugares de interés y los edificios especiales (iglesias, municipalidad,
// museo, escuelas, hospital, bomberos, estación…) y los deja LISTOS para verse en la web:
//   - data/places.json     → pines con nombre sobre el mapa y fichas en el panel
//   - data/landmarks.json  → edificios con forma propia (reconocibles desde arriba)
//
//   npm run lugares                                    (baja todo y lo suma a lo que ya tengas)
//   npm run lugares -- --reset                         (descarta lo que había y arma de cero)
//   npm run lugares -- --agregar --nombre="Iglesia San José" --tipo=iglesia --lat=-34.17 --lng=-59.78
//        (agrega a mano un lugar que OpenStreetMap no tiene; --cat=ver|comer|dormir|servicios es opcional)
//
// Lo que ya hayas escrito a mano en places.json / landmarks.json NO se pisa (solo se borra el contenido de
// ejemplo). Los datos de OpenStreetMap son © colaboradores de OpenStreetMap (ODbL).

import { readFile, writeFile } from 'node:fs/promises';
import { setCenter, toLngLat, toLocal } from '../js/geo.js';

const dataDir = new URL('../data/', import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const i = a.indexOf('=');
  return i < 0 ? [a.replace(/^--/, ''), true] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)];
}));
const readJSON = async (name, fallback) => {
  try {
    return JSON.parse(await readFile(new URL(name, dataDir), 'utf8'));
  } catch {
    return fallback;
  }
};
const writeJSON = (name, v) => writeFile(new URL(name, dataDir), JSON.stringify(v, null, 2) + '\n');
const r6 = (n) => Math.round(n * 1e6) / 1e6;

const meta = await readJSON('meta.json', null);
if (!meta) throw new Error('No encuentro data/meta.json. Corré el comando dentro de la carpeta del proyecto.');
setCenter(meta.center);
const half = meta.osm?.halfSizeMeters ?? 2000;

// Tipos de edificio especial → categoría de la ficha
const KIND_CAT = {
  iglesia: 'ver', municipalidad: 'servicios', cultura: 'ver', museo: 'ver', biblioteca: 'ver', escuela: 'servicios',
  hospital: 'servicios', bomberos: 'servicios', policia: 'servicios', estacion: 'ver', monumento: 'ver', plaza: 'ver',
  tanque: 'ver', silo: 'ver', edificio: 'ver',
};
const KIND_LABEL = {
  iglesia: 'Iglesia', municipalidad: 'Municipalidad', cultura: 'Casa de la cultura', museo: 'Museo', biblioteca: 'Biblioteca',
  escuela: 'Escuela', hospital: 'Salud', bomberos: 'Bomberos', policia: 'Policía', estacion: 'Estación de tren',
  monumento: 'Monumento', plaza: 'Plaza', tanque: 'Tanque de agua', silo: 'Silos', edificio: 'Edificio',
};

// ---------- Modo manual ----------
if (args.agregar) {
  const lat = Number(args.lat);
  const lng = Number(args.lng);
  const kind = String(args.tipo || 'edificio');
  if (!args.nombre || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.error('Uso: npm run lugares -- --agregar --nombre="Iglesia San José" --tipo=iglesia --lat=-34.17 --lng=-59.78');
    console.error('Tipos de edificio con forma propia: ' + Object.keys(KIND_CAT).join(', '));
    console.error('Tip: en Google Maps, clic derecho sobre el lugar → el primer renglón son "lat, lng".');
    process.exit(1);
  }
  const id = String(args.nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const places = (await readJSON('places.json', [])).filter((p) => p.id !== id);
  const lm = await readJSON('landmarks.json', { items: [] });
  lm.items = (lm.items || []).filter((l) => l.id !== id);
  const cat = String(args.cat || KIND_CAT[kind] || 'ver');
  places.push(placeObj({ id, name: String(args.nombre), category: cat, lat, lng, kind, source: 'Cargado a mano' }));
  if (args.tipo) lm.items.push({ id, name: String(args.nombre), kind, lat, lng, rotY: Number(args.rot || 0), ...(args.w ? { w: Number(args.w), d: Number(args.d || args.w) } : {}) });
  await writeJSON('places.json', places);
  await writeJSON('landmarks.json', lm);
  meta.dataRev = Date.now().toString(36);
  await writeJSON('meta.json', meta);
  console.log(`Listo: "${args.nombre}" agregado. Mirá data/places.json para completar descripción y dato de local.`);
  process.exit(0);
}

function placeObj({ id, name, category, lat, lng, kind, roofH = 0, address = '', hours = '', phone = '', web = '', source }) {
  const what = KIND_LABEL[kind] || '';
  return {
    id,
    name,
    category,
    lat: r6(lat),
    lng: r6(lng),
    address,
    hours,
    phone,
    web,
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${r6(lat)},${r6(lng)}`,
    reviewsUrl: '',
    photo: '',
    description: what ? `${what}. Ficha creada a partir de OpenStreetMap: falta sumar la historia y los detalles.` : 'Ficha creada a partir de OpenStreetMap: falta sumar la descripción.',
    localTip: '',
    source,
    updated: meta.date || new Date().toISOString().slice(0, 10),
    ...(roofH ? { roofH } : {}),
  };
}

// ---------- Descarga ----------
const sw = toLngLat(-half, half);
const ne = toLngLat(half, -half);
const bbox = [sw.lat, sw.lng, ne.lat, ne.lng].map((n) => n.toFixed(6)).join(',');
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
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

console.log('Bajando lugares y edificios especiales de OpenStreetMap…');
const query = `[out:json][timeout:120];
(
  nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream|hospital|clinic|pharmacy|police|fire_station|fuel|bank|post_office|townhall|place_of_worship|library|school|kindergarten|college|marketplace|arts_centre|community_centre|theatre|cinema|courthouse)$"](${bbox});
  nwr["shop"~"^(bakery|butcher|supermarket|convenience|kiosk)$"](${bbox});
  nwr["tourism"~"^(hotel|hostel|guest_house|motel|apartment|chalet|camp_site|attraction|museum|viewpoint|information|artwork|gallery)$"](${bbox});
  nwr["historic"](${bbox});
  nwr["building"~"^(church|chapel|cathedral|train_station|civic|government|hospital|school|silo)$"](${bbox});
  nwr["railway"="station"](${bbox});
  nwr["man_made"~"^(water_tower|silo)$"](${bbox});
  nwr["leisure"~"^(stadium|sports_centre)$"](${bbox});
  nwr["place"="square"](${bbox});
  nwr["leisure"="park"]["name"~"[Pp]laza"](${bbox});
);
out tags geom center;`;
const data = await overpass(query);

function kindOf(t) {
  if (t.amenity === 'place_of_worship' || /^(church|chapel|cathedral)$/.test(t.building || '')) return 'iglesia';
  if (t.amenity === 'townhall' || /^(civic|government)$/.test(t.building || '') || /municipalidad|palacio municipal/i.test(t.name || '')) return 'municipalidad';
  if (t.tourism === 'museum' || /museo/i.test(t.name || '')) return 'museo';
  if (/^(arts_centre|community_centre|theatre|cinema)$/.test(t.amenity || '') || /cultura|teatro|cine /i.test(t.name || '')) return 'cultura';
  if (t.amenity === 'library' || /biblioteca/i.test(t.name || '')) return 'biblioteca';
  if (/^(school|kindergarten|college)$/.test(t.amenity || '') || t.building === 'school') return 'escuela';
  if (/^(hospital|clinic)$/.test(t.amenity || '') || t.building === 'hospital') return 'hospital';
  if (t.amenity === 'fire_station') return 'bomberos';
  if (t.amenity === 'police') return 'policia';
  if (t.railway === 'station' || t.building === 'train_station') return 'estacion';
  if (t.man_made === 'water_tower') return 'tanque';
  if (t.man_made === 'silo' || t.building === 'silo') return 'silo';
  if (/^(monument|memorial)$/.test(t.historic || '')) return 'monumento';
  if (t.place === 'square' || (t.leisure === 'park' && /plaza/i.test(t.name || ''))) return 'plaza';
  return null;
}
const catOf = (t, kind) => {
  if (/^(restaurant|cafe|bar|pub|fast_food|ice_cream)$/.test(t.amenity || '') || /^(bakery|butcher)$/.test(t.shop || '')) return 'comer';
  if (/^(hotel|hostel|guest_house|motel|apartment|chalet|camp_site)$/.test(t.tourism || '')) return 'dormir';
  if (kind) return KIND_CAT[kind];
  if (/^(attraction|museum|viewpoint|artwork|gallery)$/.test(t.tourism || '') || t.historic) return 'ver';
  return 'servicios';
};

/** Rectángulo orientado que envuelve la geometría: centro, largo, ancho y rotación (para rotation.y). */
/** Rectángulo orientado que envuelve unos puntos locales: centro, largo, ancho y rotación (para rotation.y). */
function rectOf(pts) {
  if (pts.length < 3) return null;
  // eje = dirección del lado más largo
  let best = 0;
  let ang = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    if (l > best) {
      best = l;
      ang = Math.atan2(pts[i].z - pts[i - 1].z, pts[i].x - pts[i - 1].x);
    }
  }
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of pts) {
    const u = p.x * c + p.z * s;
    const v = -p.x * s + p.z * c;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  let w = u1 - u0;
  let d = v1 - v0;
  let rot = -ang;
  if (d > w) { // el lado largo debe ir en x
    [w, d] = [d, w];
    rot -= Math.PI / 2;
  }
  const um = (u0 + u1) / 2;
  const vm = (v0 + v1) / 2;
  const cx = um * c - vm * s;
  const cz = um * s + vm * c;
  let deg = (rot * 180) / Math.PI;
  deg = ((deg % 180) + 180) % 180;
  if (deg > 90) deg -= 180;
  const ll = toLngLat(cx, cz);
  return { lat: ll.lat, lng: ll.lng, w: Math.round(w), d: Math.round(d), rotY: Math.round(deg * 10) / 10 };
}
const localPts = (e) => {
  const nodes = [];
  if (e.geometry) nodes.push(...e.geometry);
  for (const m of e.members || []) if (m.geometry && m.role !== 'inner') nodes.push(...m.geometry);
  return nodes.filter(Boolean).map((n) => toLocal(n.lon, n.lat));
};
const footprint = (e) => rectOf(localPts(e));

// Edificios reales ya importados: sirven para encontrar el edificio verdadero dentro de un terreno (escuela, hospital…).
const pointIn = (x, z, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};
const polyArea = (pts) => {
  let A = 0;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[(i + 1) % pts.length];
    A += pts[i].x * q.z - q.x * pts[i].z;
  }
  return Math.abs(A) / 2;
};
const buildings = [];
const gj = await readJSON('sarmiento-osm.geojson', null);
{
  for (const f of gj?.features || []) {
    if (f.properties?.kind !== 'building') continue;
    const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates[0]?.[0] : null;
    if (!ring || ring.length < 4) continue;
    const pts = ring.map(([lng, lat]) => toLocal(lng, lat));
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cz = pts.reduce((a, p) => a + p.z, 0) / pts.length;
    delete f.properties.special; // se vuelve a marcar en cada corrida
    buildings.push({ pts, cx, cz, area: polyArea(pts), f });
  }
}
/** Edificios reales cuyo centro cae dentro de un polígono (terreno de una escuela, hospital…). */
const buildingsIn = (poly) => buildings.filter((b) => b.area >= 25 && pointIn(b.cx, b.cz, poly));
/** Edificio real que contiene a un punto. */
const buildingAt = (x, z) => {
  let best = null;
  for (const b of buildings) if (b.area >= 25 && pointIn(x, z, b.pts) && (!best || b.area > best.area)) best = b;
  return best;
};
/** Edificio real más cercano a un punto (hasta maxD metros del borde aproximado). Sirve cuando OSM pone el punto en la vereda o la calle. */
const nearestBuilding = (x, z, maxD = 40) => {
  let best = null;
  let bd = Infinity;
  for (const b of buildings) {
    if (b.area < 80) continue;
    const d = Math.hypot(b.cx - x, b.cz - z) - Math.sqrt(b.area) / 2;
    if (d < maxD && d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
};
const MAX_W = 70;
const MAX_D = 50;

const places = [];
const landmarks = [];
const seen = new Set();
for (const e of data.elements) {
  const t = e.tags || {};
  const id = `osm-${e.type[0]}${e.id}`;
  if (seen.has(id)) continue;
  seen.add(id);
  const kind = kindOf(t);
  const buildable = kind && !['plaza', 'tanque', 'silo', 'monumento'].includes(kind);
  let fp = null;
  let mark = null; // { group, main, rect } cuando se resalta un edificio real
  if (buildable) {
    let group = [];
    if (e.type === 'node') {
      const b = buildingAt(...Object.values(toLocal(e.lon, e.lat)));
      if (b) group = [b];
    } else {
      const pts = localPts(e);
      if (pts.length >= 3) group = buildingsIn(pts);
    }
    if (!group.length && e.type === 'way' && t.building) {
      // El propio contorno de OSM es de un edificio: sirve de huella aunque no esté en la capa de edificios reales.
      const r = footprint(e);
      if (r && r.w >= 8 && r.w <= 45 && r.d >= 6 && r.d <= 35) fp = r;
    }
    if (!group.length && !fp) {
      // El punto de OSM puede estar en la calle: se busca el edificio real más cercano; si no hay, solo queda el pin (sin modelo).
      let q = null;
      if (e.type === 'node') q = toLocal(e.lon, e.lat);
      else {
        const pp = localPts(e);
        if (pp.length) q = { x: pp.reduce((a, p) => a + p.x, 0) / pp.length, z: pp.reduce((a, p) => a + p.z, 0) / pp.length };
        else if (e.center) q = toLocal(e.center.lon, e.center.lat);
      }
      const nb = q && nearestBuilding(q.x, q.z);
      if (nb) group = [nb];
    }
    if (group.length) {
      const xs = group.flatMap((b) => b.pts.map((p) => p.x));
      const zs = group.flatMap((b) => b.pts.map((p) => p.z));
      if (Math.max(...xs) - Math.min(...xs) > 170 || Math.max(...zs) - Math.min(...zs) > 170) group = [];
    }
    if (group.length) {
      const main = group.reduce((a, b) => (b.area > a.area ? b : a));
      const rect = rectOf(main.pts);
      // Iglesia compacta (un solo edificio chico): se reemplaza por el modelo en cruz. Todo lo demás: se resaltan los edificios reales.
      if (kind === 'iglesia' && group.length === 1 && rect.w <= 45 && rect.d <= 35 && rect.w >= 8) fp = rect;
      else mark = { group, main, rect };
    }
  } else if (kind && e.type !== 'node') {
    fp = footprint(e);
  }
  const ref = fp || mark?.rect;
  if (!e.center && e.type !== 'node' && !ref) {
    const pp = localPts(e);
    if (pp.length) e.center = (({ lat, lng }) => ({ lat, lon: lng }))(toLngLat(pp.reduce((a, p) => a + p.x, 0) / pp.length, pp.reduce((a, p) => a + p.z, 0) / pp.length));
  }
  const lat = ref?.lat ?? e.lat ?? e.center?.lat;
  const lng = ref?.lng ?? e.lon ?? e.center?.lon;
  if (lat == null || lng == null) continue;
  const name = t.name || (kind ? KIND_LABEL[kind] : null);
  if (!name) continue; // un comercio sin nombre no sirve como ficha
  let roofH = 0;
  if (mark) {
    for (const b of mark.group) b.f.properties.special = kind;
    roofH = Math.round((Number(mark.main.f.properties.h) || 4) * 1.6);
  }
  if (kind && (mark || fp || !buildable)) {
    const item = { _b: mark?.main || null, named: Boolean(t.name), id, name, kind, lat: r6(lat), lng: r6(lng), rotY: fp?.rotY ?? mark?.rect.rotY ?? 0 };
    if (mark) {
      item.mode = 'resaltar';
      item.roofH = roofH;
    } else if (fp && fp.w >= 8 && fp.d >= 6 && buildable) {
      item.w = Math.min(fp.w, MAX_W);
      item.d = Math.min(fp.d, MAX_D);
    }
    if (kind === 'plaza' && fp) item.size = [Math.min(fp.w, 140), Math.min(fp.d, 140)];
    landmarks.push(item);
  }
  if (!t.name) continue; // sin nombre no hay ficha (el edificio igual queda resaltado)
  const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
  places.push(placeObj({
    id,
    name,
    category: catOf(t, kind),
    lat,
    lng,
    kind,
    roofH,
    address: street,
    hours: t.opening_hours || '',
    phone: t.phone || t['contact:phone'] || '',
    web: /^https?:\/\//.test(t.website || t['contact:website'] || '') ? t.website || t['contact:website'] : '',
    source: 'OpenStreetMap (revisar y completar)',
  }));
}

// ---------- Mezcla con lo que ya había ----------
const keep = (list) => (args.reset ? [] : list.filter((x) => !x.demo));
const dist = (a, b) => Math.hypot(...[toLocal(a.lng, a.lat), toLocal(b.lng, b.lat)].reduce((p, q) => [q.x - p.x, q.z - p.z]));
const oldPlaces = keep(await readJSON('places.json', []));
// Los edificios especiales que salen de OSM se rehacen en cada corrida (son geometría, no texto tuyo).
const oldLm = keep((await readJSON('landmarks.json', { items: [] })).items || []).filter((l) => !String(l.id).startsWith('osm-'));
const mergeBy = (olds, news) => {
  const ids = new Set(olds.map((o) => o.id));
  // lo que cargaste a mano manda; también se evita duplicar por nombre muy cercano
  return [...olds, ...news.filter((n) => !ids.has(n.id))];
};
// Si ya tenés a mano un lugar con ese nombre, no se repite el de OSM.
const nameKey = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const handNames = new Set(oldPlaces.filter((p) => !String(p.id).startsWith('osm-')).map((p) => nameKey(p.name)));
const placesNew = [];
for (const p of places.filter((x) => !handNames.has(nameKey(x.name)))) {
  if (!placesNew.some((o) => nameKey(o.name) === nameKey(p.name) && dist(o, p) < 60)) placesNew.push(p);
}
const placesOut = mergeBy(oldPlaces, placesNew);
// Sin duplicados: dos edificios del mismo tipo a menos de 30 m son el mismo (gana el que tiene huella real).
const lmNew = [];
for (const l of landmarks.filter((x) => !handNames.has(nameKey(x.name))).sort((a, b) => (b.named ? 1 : 0) - (a.named ? 1 : 0) || (b.w ? 1 : 0) - (a.w ? 1 : 0))) {
  if (['plaza', 'monumento'].includes(l.kind)) { lmNew.push(l); continue; }
  if (l._b && lmNew.some((o) => o._b === l._b)) continue; // el mismo edificio ya está
  if (!lmNew.some((o) => o.kind === l.kind && dist(o, l) < 30)) lmNew.push(l);
}
for (const l of lmNew) { delete l._b; delete l.named; }
const lmOut = mergeBy(oldLm, lmNew);

if (gj && buildings.length) await writeFile(new URL('sarmiento-osm.geojson', dataDir), JSON.stringify(gj));
await writeJSON('places.json', placesOut);
const lmFile = await readJSON('landmarks.json', { items: [] });
lmFile.items = lmOut;
await writeJSON('landmarks.json', lmFile);
meta.demoContent = false;
meta.dataRev = Date.now().toString(36); // cambia la clave de caché de los datos: el navegador baja los nuevos
await writeJSON('meta.json', meta);

const byCat = {};
for (const p of placesOut) byCat[p.category] = (byCat[p.category] || 0) + 1;
const byKind = {};
for (const l of lmOut) byKind[l.kind] = (byKind[l.kind] || 0) + 1;
console.log(`\n${placesOut.length} lugares en data/places.json  ${JSON.stringify(byCat)}`);
console.log(`${lmOut.length} edificios especiales en data/landmarks.json  ${JSON.stringify(byKind)}`);
if (placesOut.length < 8) {
  console.log('\nOpenStreetMap tiene pocos lugares cargados en Capitán Sarmiento. Podés sumar los que falten a mano:');
  console.log('  npm run lugares -- --agregar --nombre="Iglesia San José" --tipo=iglesia --lat=-34.17 --lng=-59.78');
  console.log('  (tipos: ' + Object.keys(KIND_CAT).join(', ') + ')');
}
console.log('\nListo. Probalo con: npm run serve');
