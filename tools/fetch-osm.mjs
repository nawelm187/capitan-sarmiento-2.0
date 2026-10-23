// Descarga el mapa REAL (edificios, calles, vías, verdes, agua) desde OpenStreetMap vía Overpass
// y lo deja en data/sarmiento-osm.geojson. Con --pois también guarda lugares candidatos.
//
//   npm install                        (una sola vez)
//   node tools/fetch-osm.mjs [opciones]
//
// Opciones:
//   --center=LAT,LNG   centro del mapa (se guarda en data/meta.json)
//   --half=METROS      mitad del lado del recuadro (por defecto, el de meta.json: 2000)
//   --pois             además baja comercios/alojamientos/atractivos a data/places.candidates.json
//   --keep-demo        no borra el contenido de ejemplo (lugares, recorridos, hitos, etc.)
//
// Los datos de OpenStreetMap son © colaboradores de OpenStreetMap, licencia ODbL.
// Usá el servidor público con moderación (no lo llames en bucle).

import { readFile, writeFile } from 'node:fs/promises';
import { setCenter, toLngLat } from '../js/geo.js';

const dataDir = new URL('../data/', import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));

const metaUrl = new URL('meta.json', dataDir);
const meta = JSON.parse(await readFile(metaUrl, 'utf8'));
if (args.center) {
  const [lat, lng] = String(args.center).split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('--center debe ser LAT,LNG (ej. --center=-34.17,-59.79)');
  meta.center = { lat, lng };
}
if (args.half) meta.osm = { ...(meta.osm || {}), halfSizeMeters: Number(args.half) };
const half = meta.osm?.halfSizeMeters ?? 2000;
setCenter(meta.center);

// Recuadro [sur, oeste, norte, este]
const sw = toLngLat(-half, half);
const ne = toLngLat(half, -half);
const bbox = [sw.lat, sw.lng, ne.lat, ne.lng].map((n) => n.toFixed(6)).join(',');
console.log(`Centro ${meta.center.lat}, ${meta.center.lng} · recuadro ${bbox}`);

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

const { default: osmtogeojson } = await import('osmtogeojson').catch(() => {
  throw new Error('Falta la dependencia: ejecutá "npm install" primero.');
});

// ---------- Mapa ----------
const mapQuery = `[out:json][timeout:120];
(
  nwr["building"](${bbox});
  way["highway"](${bbox});
  way["railway"~"^(rail|abandoned|disused|light_rail)$"](${bbox});
  nwr["leisure"~"^(park|pitch|playground|garden|recreation_ground|sports_centre|stadium)$"](${bbox});
  nwr["landuse"~"^(grass|recreation_ground|cemetery|village_green|meadow)$"](${bbox});
  nwr["natural"~"^(water|wood)$"](${bbox});
  way["waterway"~"^(river|stream|canal|drain)$"](${bbox});
);
out body; >; out skel qt;`;

console.log('Descargando mapa…');
const raw = await overpass(mapQuery);
const gj = osmtogeojson(raw);

const r6 = (n) => Math.round(n * 1e6) / 1e6;
const roundCoords = (c) => (typeof c[0] === 'number' ? [r6(c[0]), r6(c[1])] : c.map(roundCoords));
const GREEN_LEISURE = /^(park|pitch|playground|garden|recreation_ground|sports_centre|stadium)$/;
const GREEN_LANDUSE = /^(grass|recreation_ground|cemetery|village_green|meadow)$/;
const SKIP_HW = new Set(['proposed', 'construction', 'steps', 'corridor', 'elevator', 'platform']);

const features = [];
const counts = {};
for (const f of gj.features) {
  const p = f.properties || {};
  const g = f.geometry;
  if (!g) continue;
  const isPoly = g.type === 'Polygon' || g.type === 'MultiPolygon';
  let kind = null;
  if (p.building && isPoly) kind = 'building';
  else if (p.highway && g.type === 'LineString' && !SKIP_HW.has(p.highway)) kind = 'road';
  else if (p.railway && g.type === 'LineString') kind = 'rail';
  else if ((p.natural === 'water' && isPoly) || (p.waterway && g.type === 'LineString')) kind = 'water';
  else if (isPoly && (GREEN_LEISURE.test(p.leisure || '') || GREEN_LANDUSE.test(p.landuse || '') || p.natural === 'wood')) kind = 'green';
  if (!kind) continue;

  const h = parseFloat(p.height) || (parseFloat(p['building:levels']) ? parseFloat(p['building:levels']) * 3 : 0) || 4;
  features.push({
    type: 'Feature',
    properties: { kind, h: kind === 'building' ? Math.round(h * 10) / 10 : 0, hw: p.highway || null, name: p.name || null },
    geometry: { type: g.type, coordinates: roundCoords(g.coordinates) },
  });
  counts[kind] = (counts[kind] || 0) + 1;
}

await writeFile(new URL('sarmiento-osm.geojson', dataDir), JSON.stringify({ type: 'FeatureCollection', features }));
console.log('Mapa guardado:', counts);
if (!counts.building) console.warn('ATENCIÓN: no se encontraron edificios. Revisá --center y --half.');

// ---------- Lugares candidatos (opcional) ----------
if (args.pois) {
  const poiQuery = `[out:json][timeout:90];
(
  nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream|hospital|clinic|pharmacy|police|fire_station|fuel|bank|post_office|townhall|place_of_worship|library|school|marketplace)$"](${bbox});
  nwr["shop"~"^(bakery|butcher|supermarket|convenience|kiosk)$"](${bbox});
  nwr["tourism"~"^(hotel|hostel|guest_house|motel|apartment|chalet|camp_site|attraction|museum|viewpoint|information|artwork)$"](${bbox});
  nwr["historic"](${bbox});
);
out center tags;`;
  console.log('Descargando lugares candidatos…');
  const poi = await overpass(poiQuery);
  const catOf = (t) => {
    if (/^(restaurant|cafe|bar|pub|fast_food|ice_cream)$/.test(t.amenity || '') || /^(bakery|butcher)$/.test(t.shop || '')) return 'comer';
    if (/^(hotel|hostel|guest_house|motel|apartment|chalet|camp_site)$/.test(t.tourism || '')) return 'dormir';
    if (/^(attraction|museum|viewpoint|artwork)$/.test(t.tourism || '') || t.historic || t.amenity === 'place_of_worship') return 'ver';
    return 'servicios';
  };
  const cands = poi.elements
    .map((e) => {
      const t = e.tags || {};
      const lat = e.lat ?? e.center?.lat;
      const lng = e.lon ?? e.center?.lon;
      if (!t.name || lat == null) return null;
      const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
      return {
        id: `osm-${e.type[0]}${e.id}`,
        name: t.name,
        category: catOf(t),
        lat: r6(lat),
        lng: r6(lng),
        address: street || '',
        hours: t.opening_hours || '',
        phone: t.phone || t['contact:phone'] || '',
        web: t.website || t['contact:website'] || '',
        description: '',
        localTip: '',
        source: 'OpenStreetMap (revisar y completar)',
        updated: meta.date,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  await writeFile(new URL('places.candidates.json', dataDir), JSON.stringify(cands, null, 2) + '\n');
  console.log(`${cands.length} lugares candidatos en data/places.candidates.json`);
  console.log('Revisalos, completá descripción y "dato de local", y pasá los que sirvan a data/places.json.');
}

// ---------- Contenido de ejemplo ----------
if (meta.dataSource === 'demo' && !args['keep-demo']) {
  const empty = (name, v) => writeFile(new URL(name, dataDir), JSON.stringify(v, null, 2) + '\n');
  await Promise.all([
    empty('places.json', []),
    empty('tours.json', []),
    empty('landmarks.json', { items: [] }),
    empty('casonas.json', { items: [] }),
    empty('mascots.json', { items: [] }),
  ]);
  meta.demoContent = false;
  console.log('Se borró el contenido de ejemplo (sus coordenadas no coinciden con el pueblo real).');
}
meta.dataSource = 'osm';
meta.osmFetchedAt = new Date().toISOString().slice(0, 10);
await writeFile(metaUrl, JSON.stringify(meta, null, 2) + '\n');
console.log('Listo. Probalo con: npm run serve');
