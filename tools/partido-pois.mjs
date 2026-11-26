// Incorpora lugares de interés de TODO el Partido de Capitán Sarmiento.
// Fuentes: OpenStreetMap (relación administrativa 2455548) y datasets abiertos de PBA.
// Los datos se agregan a data/places.json sin borrar fichas ni textos editados a mano.
//
//   npm run partido-pois
//   node tools/partido-pois.mjs --area=3602455548
//
// La maqueta 3D detallada sigue teniendo su extensión local (meta.osm.halfSizeMeters).
// Este proceso amplía el DIRECTORIO geográfico al partido completo; no descarga casas/calles
// rurales para no convertir la escena detallada del casco urbano en una geometría inmanejable.

import { readFile, writeFile } from 'node:fs/promises';
import { setCenter, toLocal } from '../js/geo.js';
import { TYPES, classify } from '../js/kinds.js';

const dataDir = new URL('../data/', import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const i = a.indexOf('=');
  return i < 0 ? [a.replace(/^--/, ''), true] : [a.slice(2, i), a.slice(i + 1)];
}));
const readJSON = async (name, fallback) => {
  try { return JSON.parse(await readFile(new URL(name, dataDir), 'utf8')); }
  catch { return fallback; }
};
const r6 = (n) => Math.round(Number(n) * 1e6) / 1e6;
const today = new Date().toISOString().slice(0, 10);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/\s+/g, '-');
const IMPORTANT_UNNAMED = new Set([
  'hospital', 'clinica', 'farmacia', 'escuela', 'jardin', 'policia', 'bomberos', 'municipalidad',
  'banco', 'banconacion', 'cajero', 'correo', 'combustible', 'terminal', 'parada', 'iglesia', 'biblioteca',
]);
const PRIORITY_TYPES = new Set([
  'iglesia', 'municipalidad', 'museo', 'cultura', 'biblioteca', 'escuela', 'jardin', 'hospital', 'clinica',
  'farmacia', 'bomberos', 'policia', 'estacion', 'plaza', 'monumento', 'hotel', 'hospedaje', 'camping',
  'club', 'turismo', 'mirador', 'atractivo', 'terminal', 'banco', 'banconacion', 'cajero', 'combustible',
]);

const meta = await readJSON('meta.json', null);
if (!meta?.center) throw new Error('Falta data/meta.json. Primero descargá el mapa base desde Actions o ejecutá npm run mapa.');
setCenter(meta.center);
const places = await readJSON('places.json', []);
if (!Array.isArray(places)) throw new Error('data/places.json no contiene una lista JSON válida.');

async function overpass(query) {
  const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'user-agent': 'guia-sarmiento/1.6 (directorio local de lugares)',
          },
          body: 'data=' + encodeURIComponent(query),
          signal: AbortSignal.timeout(210000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (!Array.isArray(json.elements)) throw new Error('Respuesta Overpass sin elementos');
        return json.elements;
      } catch (error) {
        lastError = error;
        console.warn(`  ${endpoint}: ${error.message}`);
      }
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 4500 * (attempt + 1)));
  }
  throw lastError || new Error('No se pudo consultar Overpass.');
}

const area = args.area ? String(args.area) : null;
const RELATION_ID = 2455548;
let partyRings = [];
// Perímetro oficializado en OSM: se usa para armar una vista de contexto al alejar la cámara.
// La relación puede estar formada por varios tramos outer; se cosen sus extremos por coordenadas.
function samePoint(a, b) { return Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7; }
function stitchWays(members) {
  const pending = members.map((m) => (m.geometry || []).map((p) => [p.lon, p.lat])).filter((r) => r.length >= 2);
  const rings = [];
  while (pending.length) {
    const ring = pending.shift();
    let changed = true;
    while (changed && !samePoint(ring[0], ring[ring.length - 1])) {
      changed = false;
      const start = ring[0];
      const end = ring[ring.length - 1];
      const i = pending.findIndex((segment) =>
        samePoint(segment[0], end) || samePoint(segment[segment.length - 1], end) ||
        samePoint(segment[0], start) || samePoint(segment[segment.length - 1], start));
      if (i < 0) break;
      let segment = pending.splice(i, 1)[0];
      if (samePoint(segment[segment.length - 1], end)) segment.reverse();
      if (samePoint(segment[0], end)) {
        ring.push(...segment.slice(1));
      } else if (samePoint(segment[segment.length - 1], start)) {
        ring.unshift(...segment.slice(0, -1));
      } else if (samePoint(segment[0], start)) {
        segment.reverse();
        ring.unshift(...segment.slice(0, -1));
      }
      changed = true;
    }
    if (ring.length >= 4 && samePoint(ring[0], ring[ring.length - 1])) rings.push(ring);
  }
  return rings;
}
try {
  console.log('Descargando el límite administrativo del partido…');
  const boundaryElements = await overpass(`[out:json][timeout:90];rel(${RELATION_ID});out geom;`);
  const relation = boundaryElements.find((e) => e.type === 'relation' && e.id === RELATION_ID);
  const outerRings = stitchWays((relation?.members || []).filter((m) => m.role === 'outer'));
  partyRings = outerRings;
  if (outerRings.length) {
    const feature = {
      type: 'Feature',
      properties: { name: 'Partido de Capitán Sarmiento', osm_type: 'relation', osm_id: RELATION_ID, admin_level: relation.tags?.admin_level || '' },
      geometry: { type: 'MultiPolygon', coordinates: outerRings.map((ring) => [ring]) },
    };
    await writeFile(new URL('partido-boundary.geojson', dataDir), JSON.stringify({ type: 'FeatureCollection', features: [feature] }) + '\n');
    console.log(`  Perímetro guardado (${outerRings.length} anillos exteriores).`);
  } else console.warn('  OSM no devolvió anillos cerrados; la vista territorial no tendrá borde.');
} catch (error) {
  console.warn(`  No se pudo actualizar el perímetro del partido: ${error.message}`);
}

// Caminos interurbanos principales, dibujados a escala de contexto (no sustituyen la trama urbana detallada).
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const intersects = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
const insideParty = (lng, lat) => !partyRings.length || partyRings.some((ring) => pointInRing(lng, lat, ring));
const partyBounds = () => {
  const all = partyRings.flat();
  return {
    south: Math.min(...all.map((p) => p[1])),
    west: Math.min(...all.map((p) => p[0])),
    north: Math.max(...all.map((p) => p[1])),
    east: Math.max(...all.map((p) => p[0])),
  };
};
try {
  console.log('Descargando caminos principales del partido…');
  const areaClause = area ? `area(${area})->.district;` : `rel(${RELATION_ID})->.district_rel;.district_rel map_to_area -> .district;`;
  let roadElements = [];
  try {
    roadElements = await overpass(`[out:json][timeout:150];${areaClause}way(area.district)["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|track)$"];out geom;`);
  } catch (error) { console.warn(`  Consulta de caminos por área: ${error.message}`); }
  if (!roadElements.length && partyRings.length) {
    const { south, west, north, east } = partyBounds();
    const bbox = `${south},${west},${north},${east}`;
    try {
      const fallback = await overpass(`[out:json][timeout:150];way(${bbox})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|track)$"];out geom;`);
      roadElements = fallback.filter((e) => e.geometry?.some((p) => insideParty(Number(p.lon), Number(p.lat))));
      console.log(`  Consulta alternativa por perímetro: ${roadElements.length} caminos.`);
    } catch (error) { console.warn(`  Consulta de caminos por perímetro: ${error.message}`); }
  }
  const roadFeatures = roadElements.filter((e) => e.type === 'way' && e.geometry?.length >= 2).map((e) => ({
    type: 'Feature',
    properties: { highway: e.tags?.highway || '', name: e.tags?.name || '' },
    geometry: { type: 'LineString', coordinates: e.geometry.map((p) => [r6(p.lon), r6(p.lat)]) },
  }));
  await writeFile(new URL('partido-roads.geojson', dataDir), JSON.stringify({ type: 'FeatureCollection', features: roadFeatures }) + '\n');
  console.log(`  Caminos de contexto guardados: ${roadFeatures.length}.`);
} catch (error) {
  console.warn(`  No se pudieron actualizar los caminos de contexto: ${error.message}`);
}

// Los GeoJSON territoriales son opcionales: si Overpass falla en una primera ejecución,
// dejamos colecciones vacías válidas para que el mapa y el validador puedan continuar.
const emptyGeoJSON = { type: 'FeatureCollection', features: [] };
for (const filename of ['partido-boundary.geojson', 'partido-roads.geojson']) {
  if (!(await readJSON(filename, null))) {
    await writeFile(new URL(filename, dataDir), JSON.stringify(emptyGeoJSON) + '\n');
  }
}

const areaClause = area ? `area(${area})->.district;` : `rel(${RELATION_ID})->.district_rel;.district_rel map_to_area -> .district;`;
const selectorsFor = (scope) => `
  nwr(${scope})["amenity"];
  nwr(${scope})["shop"];
  nwr(${scope})["office"];
  nwr(${scope})["craft"];
  nwr(${scope})["tourism"];
  nwr(${scope})["leisure"];
  nwr(${scope})["historic"];
  nwr(${scope})["healthcare"];
  nwr(${scope})["emergency"];
  nwr(${scope})["education"];
  nwr(${scope})["public_transport"];
  nwr(${scope})["highway"="bus_stop"];
  nwr(${scope})["railway"~"^(station|halt|tram_stop)$"];
  nwr(${scope})["building"~"^(church|chapel|cathedral|train_station|civic|government|hospital|school|stadium)$"];
  nwr(${scope})["club"];
  nwr(${scope})["sport"];
  nwr(${scope})["man_made"~"^(water_tower|silo)$"];
  nwr(${scope})["landuse"="cemetery"];
  nwr(${scope})["natural"~"^(peak|spring|cave_entrance|rock)$"];
  nwr(${scope})["place"="square"];
`;
const query = `[out:json][timeout:180];${areaClause}(${selectorsFor('area.district')});out center tags;`;

console.log(`Buscando puntos OSM dentro del partido (relación ${RELATION_ID})…`);
let elements = [];
try { elements = await overpass(query); }
catch (error) { console.warn(`  OSM de lugares no respondió: ${error.message}`); }

// Si Overpass no tiene un área indexada para la relación, usamos su bounding box y
// filtramos localmente con el polígono real para no mezclar pueblos vecinos.
if (!elements.length && partyRings.length) {
  try {
    const all = partyRings.flat();
    const south = Math.min(...all.map((p) => p[1]));
    const west = Math.min(...all.map((p) => p[0]));
    const north = Math.max(...all.map((p) => p[1]));
    const east = Math.max(...all.map((p) => p[0]));
    const bbox = `${south},${west},${north},${east}`;
    const fallbackQuery = `[out:json][timeout:180];(${selectorsFor(bbox)});out center tags;`;
    const fallbackElements = await overpass(fallbackQuery);
    elements = fallbackElements.filter((el) => {
      const p = el.type === 'node' ? { lat: el.lat, lon: el.lon } : el.center;
      return p && insideParty(Number(p.lon), Number(p.lat));
    });
    console.log(`  Consulta alternativa por perímetro: ${elements.length} puntos dentro del partido.`);
  } catch (error) { console.warn(`  Tampoco respondió la consulta por perímetro: ${error.message}`); }
}
const candidates = [];
for (const element of elements) {
  const tags = element.tags || {};
  const type = classify(tags);
  if (!type || !TYPES[type]) continue;
  const center = element.type === 'node'
    ? { lat: element.lat, lon: element.lon }
    : element.center;
  if (!center || !Number.isFinite(Number(center.lat)) || !Number.isFinite(Number(center.lon))) continue;
  if (!insideParty(Number(center.lon), Number(center.lat))) continue;
  const named = String(tags.name || tags['name:es'] || '').trim();
  if (!named && !IMPORTANT_UNNAMED.has(type)) continue;
  const lat = r6(center.lat);
  const lng = r6(center.lon);
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const address = tags['addr:full'] || street || [tags['addr:place'], tags['addr:suburb']].filter(Boolean).join(', ');
  const label = TYPES[type].label;
  const name = named || `${label} sin nombre${address ? ` · ${address}` : ''}`;
  const id = `osm-${element.type[0]}${element.id}`;
  candidates.push({
    id, name, category: TYPES[type].cat, icon: type, lat, lng,
    address: address || '', hours: tags.opening_hours || '',
    phone: tags.phone || tags['contact:phone'] || '',
    web: /^https?:\/\//i.test(tags.website || tags['contact:website'] || '') ? (tags.website || tags['contact:website']) : '',
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    reviewsUrl: '', photo: '', description: '', localTip: '',
    source: 'OpenStreetMap (datos del partido; pendiente de verificación)',
    source_id: `${element.type}/${element.id}`, osmType: element.type, osmId: element.id,
    verified: false, last_checked: today,
    priority: PRIORITY_TYPES.has(type) ? 'high' : (named ? 'normal' : 'low'),
  });
}
console.log(`  OSM: ${elements.length} objetos consultados; ${candidates.length} puntos clasificados.`);

// Importa CSVs publicados por Datos Abiertos PBA cuando el recurso ofrece coordenadas y
// el campo de partido. Si cambian los nombres de columnas, se omite el recurso y se informa.
function parseCSV(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (c === '"') quoted = false;
      else value += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(value); value = ''; }
    else if (c === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += c;
  }
  if (value.length || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map((h) => h.replace(/^\uFEFF/, '').trim());
  return rows.filter((r) => r.some((v) => String(v).trim())).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}
const keyOf = (s) => norm(s).replace(/ /g, '_');
const firstField = (row, options) => {
  const keys = Object.keys(row);
  const key = keys.find((k) => options.includes(keyOf(k)));
  return key ? row[key] : '';
};
async function officialCsv(packageId, matcher) {
  try {
    const api = `https://catalogo.datos.gba.gov.ar/api/3/action/package_show?id=${encodeURIComponent(packageId)}`;
    const response = await fetch(api, { headers: { 'user-agent': 'guia-sarmiento/1.6' }, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`CKAN HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload.success) throw new Error('CKAN no devolvió el dataset');
    const csvs = (payload.result.resources || []).filter((r) => /csv/i.test(`${r.format || ''} ${r.mimetype || ''} ${r.name || ''} ${r.url || ''}`) && r.url);
    const resource = matcher(csvs);
    if (!resource) throw new Error('no se encontró recurso CSV apropiado');
    const csvResponse = await fetch(resource.url, { headers: { 'user-agent': 'guia-sarmiento/1.6' }, signal: AbortSignal.timeout(120000) });
    if (!csvResponse.ok) throw new Error(`descarga CSV HTTP ${csvResponse.status}`);
    const csv = await csvResponse.text();
    return { resource, rows: parseCSV(csv) };
  } catch (error) {
    console.warn(`  Fuente oficial ${packageId}: ${error.message}`);
    return null;
  }
}


// Evita que una descarga oficial con coordenadas proyectadas (metros) o campos intercambiados
// termine creando pines fuera de la región. Es un margen amplio alrededor del partido.
function validPartyCoordinate(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -35.2 && lat <= -33.2 && lng >= -61.0 && lng <= -58.5;
}

const officialCandidates = [];
const health = await officialCsv('establecimientos-salud', (list) =>
  list.find((r) => /2025/i.test(`${r.name || ''} ${r.description || ''}`)) || list[0]);
if (health?.rows.length) {
  const sample = health.rows[0];
  const latKey = Object.keys(sample).find((k) => ['lat', 'latitud', 'latitude'].includes(keyOf(k)));
  const lngKey = Object.keys(sample).find((k) => ['long', 'lon', 'lng', 'longitud', 'longitude'].includes(keyOf(k)));
  const partyKey = Object.keys(sample).find((k) => ['nde', 'partido', 'nombre_partido', 'nom_partido'].includes(keyOf(k)));
  if (latKey && lngKey && partyKey) {
    for (const row of health.rows) {
      if (!norm(row[partyKey]).includes('capitan sarmiento')) continue;
      const lat = Number(String(row[latKey]).replace(',', '.'));
      const lng = Number(String(row[lngKey]).replace(',', '.'));
      if (!validPartyCoordinate(lat, lng)) continue;
      const name = firstField(row, ['fna', 'nam', 'nor', 'nombre', 'nombre_establecimiento']) || 'Establecimiento de salud';
      const desc = `${row.cat || row.gna || 'Establecimiento de salud público'}${row.tes ? ` · ${row.tes}` : ''}`;
      const kind = /hospital/i.test(`${name} ${desc}`) ? 'hospital' : 'clinica';
      officialCandidates.push({
        id: `pba-salud-${slug(row.id || row.cnr || name)}`,
        name: String(name).trim(), category: TYPES[kind].cat, icon: kind, lat: r6(lat), lng: r6(lng),
        address: String(row.dom || ''), hours: '', phone: String(row.tel || ''), web: '',
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${r6(lat)},${r6(lng)}`,
        reviewsUrl: '', photo: '', description: desc, localTip: '',
        source: `Datos Abiertos PBA · Salud (${health.resource.name || 'CSV'})`,
        source_id: String(row.id || row.cnr || ''), verified: false, last_checked: today, priority: 'high',
      });
    }
    console.log(`  Salud PBA: ${officialCandidates.length} registros del partido.`);
  } else console.warn('  Salud PBA: el CSV cambió de esquema; faltan campos lat/long/nde, no se importó.');
}

const education = await officialCsv('establecimientos-educativos', (list) => list[0]);
if (education?.rows.length) {
  const sample = education.rows[0];
  const latKey = Object.keys(sample).find((k) => ['lat', 'latitud', 'latitude', 'y'].includes(keyOf(k)));
  const lngKey = Object.keys(sample).find((k) => ['long', 'lon', 'lng', 'longitud', 'longitude', 'x'].includes(keyOf(k)));
  const partyKey = Object.keys(sample).find((k) => ['partido', 'nombre_partido', 'nom_partido', 'municipio', 'nde'].includes(keyOf(k)));
  if (latKey && lngKey && partyKey) {
    let count = 0;
    for (const row of education.rows) {
      if (!norm(row[partyKey]).includes('capitan sarmiento')) continue;
      const lat = Number(String(row[latKey]).replace(',', '.'));
      const lng = Number(String(row[lngKey]).replace(',', '.'));
      if (!validPartyCoordinate(lat, lng)) continue;
      const name = firstField(row, ['nombre', 'nombre_establecimiento', 'establecimiento', 'nom_estab', 'nombre_escuela', 'fna']);
      if (!name) continue;
      const idValue = firstField(row, ['cueanexo', 'cue_anexo', 'cue', 'id', 'codigo', 'cod_establecimiento']) || `${name}-${lat}-${lng}`;
      const kind = /jardin|inicial/i.test(`${name} ${firstField(row, ['nivel', 'modalidad'])}`) ? 'jardin' : 'escuela';
      officialCandidates.push({
        id: `pba-educacion-${slug(idValue)}`, name: String(name).trim(), category: TYPES[kind].cat, icon: kind,
        lat: r6(lat), lng: r6(lng), address: firstField(row, ['domicilio', 'direccion', 'dom']),
        hours: '', phone: '', web: '', googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${r6(lat)},${r6(lng)}`,
        reviewsUrl: '', photo: '', description: firstField(row, ['nivel', 'modalidad']), localTip: '',
        source: `Datos Abiertos PBA · Educación (${education.resource.name || 'CSV'})`,
        source_id: String(idValue), verified: false, last_checked: today, priority: 'high',
      });
      count++;
    }
    console.log(`  Educación PBA: ${count} registros del partido.`);
  } else console.warn('  Educación PBA: el CSV no expone coordenadas y partido con nombres reconocibles; no se importó para evitar puntos mal ubicados.');
}

const metersBetween = (a, b) => {
  const p = toLocal(a.lng, a.lat), q = toLocal(b.lng, b.lat);
  return Math.hypot(p.x - q.x, p.z - q.z);
};
const byId = new Map(places.map((p) => [p.id, p]));
let added = 0, updated = 0, merged = 0;
for (const incoming of [...candidates, ...officialCandidates]) {
  const exact = byId.get(incoming.id);
  if (exact) {
    // Actualiza solo datos objetivos de ubicación/clasificación; conserva textos locales y ficha.
    Object.assign(exact, {
      category: incoming.category, icon: incoming.icon, lat: incoming.lat, lng: incoming.lng,
      source: incoming.source, source_id: incoming.source_id || exact.source_id,
      verified: exact.verified === true, last_checked: today, priority: incoming.priority,
    });
    if (!exact.address && incoming.address) exact.address = incoming.address;
    if (!exact.hours && incoming.hours) exact.hours = incoming.hours;
    if (!exact.phone && incoming.phone) exact.phone = incoming.phone;
    if (!exact.web && incoming.web) exact.web = incoming.web;
    updated++;
    continue;
  }
  const duplicate = places.find((p) => norm(p.name) === norm(incoming.name) && metersBetween(p, incoming) < 90);
  if (duplicate) {
    // Evita repetir lugares relevados a mano; añade datos de fuente cuando el campo estaba vacío.
    if (!duplicate.address && incoming.address) duplicate.address = incoming.address;
    if (!duplicate.hours && incoming.hours) duplicate.hours = incoming.hours;
    if (!duplicate.phone && incoming.phone) duplicate.phone = incoming.phone;
    if (!duplicate.web && incoming.web) duplicate.web = incoming.web;
    if (!duplicate.source_id) duplicate.source_id = incoming.source_id;
    merged++;
    continue;
  }
  places.push(incoming);
  byId.set(incoming.id, incoming);
  added++;
}

places.sort((a, b) => (a.category || '').localeCompare(b.category || '') || String(a.name || '').localeCompare(String(b.name || '')));
await writeFile(new URL('places.json', dataDir), JSON.stringify(places, null, 2) + '\n');
meta.dataRev = Date.now().toString(36);
meta.poisScope = 'partido-capitan-sarmiento';
meta.poisUpdatedAt = today;
meta.poisSources = ['OpenStreetMap relation 2455548 (ODbL)', 'Datos Abiertos PBA · Salud', 'Datos Abiertos PBA · Educación'];
await writeFile(new URL('meta.json', dataDir), JSON.stringify(meta, null, 2) + '\n');

const counts = Object.fromEntries([...new Set(places.map((p) => p.category))].sort().map((category) => [category, places.filter((p) => p.category === category).length]));
console.log(`\nDirectorio del partido actualizado: ${places.length} lugares.`);
console.log(`Agregados: ${added} · actualizados: ${updated} · fusionados con fichas existentes: ${merged}`);
console.log('Por categoría:', counts);
console.log('Nota: los nuevos puntos quedan como no verificados. Revisá las fichas y corregí ubicaciones/horarios antes de publicarlas como información confirmada.');
