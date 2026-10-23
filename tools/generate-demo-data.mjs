// Genera un pueblo de DEMOSTRACIÓN (grilla de calles + edificios) y contenido de ejemplo,
// para que el sitio funcione antes de bajar el mapa real de OpenStreetMap.
//
//   node tools/generate-demo-data.mjs
//
// Escribe en /data: sarmiento-osm.geojson, places.json, tours.json, guides.json,
// landmarks.json, casonas.json, mascots.json. Ojo: pisa esos archivos.
// Para el mapa real usá tools/fetch-osm.mjs (solo reemplaza el geojson).

import { readFile, writeFile } from 'node:fs/promises';
import { setCenter, toLngLat } from '../js/geo.js';
import { mulberry32, pick } from '../js/util.js';

const dataDir = new URL('../data/', import.meta.url);
const meta = JSON.parse(await readFile(new URL('meta.json', dataDir), 'utf8'));
setCenter(meta.center);

const rand = mulberry32(20261022);
const r6 = (n) => Math.round(n * 1e6) / 1e6;
const ll = (x, z) => {
  const p = toLngLat(x, z);
  return [r6(p.lng), r6(p.lat)];
};

// ---- Grilla -----------------------------------------------------------------
const P = 110; // paso entre calles (m)
const S = 12; // ancho de calle (m)
const B = P - S; // lado de manzana (m)
const N = 8;
const RAIL_LINE = 6; // la vía corre entre las filas 6 y 7 (z = 6.5 * P)

const noise = new Map();
const key = (i, j) => `${i},${j}`;
for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) noise.set(key(i, j), rand());

const special = {
  plaza: [0, 0],
  iglesia: [0, -1],
  casonas: [1, -1],
  tanque: [-2, 3],
  parque: [-3, 2],
  estacion: [0, 6],
};
const specialKeys = new Set(Object.values(special).map(([i, j]) => key(i, j)));
const included = (i, j) =>
  specialKeys.has(key(i, j)) || Math.hypot(i, j) <= 5.4 + (noise.get(key(i, j)) ?? 1) * 1.6;

const features = [];
const bbox = (i, j) => {
  const cx = i * P;
  const cz = j * P;
  return [cx - B / 2, cz - B / 2, cx + B / 2, cz + B / 2];
};
const rect = (x0, z0, x1, z1) =>
  [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
    [x0, z0],
  ].map(([x, z]) => ll(x, z));

// ---- Edificios --------------------------------------------------------------
const skipBuildings = new Set([special.plaza, special.iglesia, special.casonas, special.tanque, special.parque, special.estacion].map(([i, j]) => key(i, j)));
let buildingCount = 0;
for (let i = -N; i <= N; i++) {
  for (let j = -N; j <= N; j++) {
    if (!included(i, j) || skipBuildings.has(key(i, j))) continue;
    const [x0, z0, x1, z1] = bbox(i, j);
    const dist = Math.hypot(i, j);
    let x = x0;
    while (x < x1 - 8) {
      let w = Math.min(x1 - x, 10 + rand() * 8);
      if (x1 - x - w < 8) w = x1 - x;
      for (const side of [0, 1]) {
        if (rand() < 0.84) {
          const depth = 12 + rand() * 16;
          const bw = Math.max(6, w - (1.5 + rand() * 2));
          const bx0 = x + (w - bw) / 2;
          const inset = 1 + rand() * 1.5;
          const bz0 = side === 0 ? z0 + inset : z1 - inset - depth;
          const levels = dist < 2.5 ? pick(rand, [1, 2, 2, 3, 3]) : pick(rand, [1, 1, 1, 2, 2, 3]);
          features.push({
            type: 'Feature',
            properties: { kind: 'building', h: Math.round((3.2 * levels + rand() * 0.6) * 10) / 10, hw: null, name: null },
            geometry: { type: 'Polygon', coordinates: [rect(bx0, bz0, bx0 + bw, bz0 + depth)] },
          });
          buildingCount++;
        }
      }
      x += w;
    }
  }
}

// ---- Verdes y agua ----------------------------------------------------------
const green = (i, j, inset = 4) => {
  const [x0, z0, x1, z1] = bbox(i, j);
  features.push({
    type: 'Feature',
    properties: { kind: 'green', h: 0, hw: null, name: null },
    geometry: { type: 'Polygon', coordinates: [rect(x0 + inset, z0 + inset, x1 - inset, z1 - inset)] },
  });
};
green(...special.plaza, 0);
green(...special.parque, 6);

const lagoon = [];
for (let a = 0; a < 28; a++) {
  const t = (a / 28) * Math.PI * 2;
  lagoon.push(ll(-900 + Math.cos(t) * 130, 330 + Math.sin(t) * 75));
}
lagoon.push(lagoon[0]);
features.push({ type: 'Feature', properties: { kind: 'water', h: 0, hw: null, name: null }, geometry: { type: 'Polygon', coordinates: [lagoon] } });

// ---- Calles -----------------------------------------------------------------
const AVENUE_V = -1; // línea vertical x = (-1 + 0.5) * P
const AVENUE_H = -1;
function runs(test, from, to) {
  const out = [];
  let start = null;
  for (let k = from; k <= to; k++) {
    if (test(k)) {
      if (start === null) start = k;
    } else if (start !== null) {
      out.push([start, k - 1]);
      start = null;
    }
  }
  if (start !== null) out.push([start, to]);
  return out;
}
for (let k = -N - 1; k <= N; k++) {
  // calles verticales (x fijo)
  for (const [a, b] of runs((j) => included(k, j) || included(k + 1, j), -N, N)) {
    features.push({
      type: 'Feature',
      properties: { kind: 'road', h: 0, hw: k === AVENUE_V ? 'primary' : 'residential', name: null },
      geometry: { type: 'LineString', coordinates: [ll((k + 0.5) * P, (a - 0.5) * P), ll((k + 0.5) * P, (b + 0.5) * P)] },
    });
  }
  // calles horizontales (z fijo), salvo la línea de la vía
  if (k === RAIL_LINE) continue;
  for (const [a, b] of runs((i) => included(i, k) || included(i, k + 1), -N, N)) {
    features.push({
      type: 'Feature',
      properties: { kind: 'road', h: 0, hw: k === AVENUE_H ? 'primary' : 'residential', name: null },
      geometry: { type: 'LineString', coordinates: [ll((a - 0.5) * P, (k + 0.5) * P), ll((b + 0.5) * P, (k + 0.5) * P)] },
    });
  }
}
// Vía del tren
features.push({
  type: 'Feature',
  properties: { kind: 'rail', h: 0, hw: null, name: null },
  geometry: { type: 'LineString', coordinates: [ll(-1700, (RAIL_LINE + 0.5) * P), ll(-600, (RAIL_LINE + 0.5) * P), ll(600, (RAIL_LINE + 0.5) * P), ll(1700, (RAIL_LINE + 0.5) * P)] },
});

await writeFile(new URL('sarmiento-osm.geojson', dataDir), JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`geojson: ${features.length} elementos (${buildingCount} edificios)`);

// ---- Contenido de ejemplo ---------------------------------------------------
const at = (x, z) => {
  const p = toLngLat(x, z);
  return { lat: r6(p.lat), lng: r6(p.lng) };
};
const today = meta.date;
const demo = (o) => ({ demo: true, address: 'Dirección a completar', hours: 'Horario a completar', phone: '', web: '', googleMapsUrl: '', reviewsUrl: '', photo: '', source: 'Contenido de ejemplo', updated: today, ...o });

const places = [
  demo({ id: 'plaza-principal', name: 'Plaza principal (ejemplo)', category: 'ver', ...at(0, 0), description: 'Lugar de ejemplo. Reemplazalo por la plaza real del pueblo: qué la hace especial y qué se puede hacer ahí.', localTip: 'Dato de local de ejemplo: contá cuál es la mejor hora para ir.' }),
  demo({ id: 'iglesia', name: 'Iglesia (ejemplo)', category: 'ver', ...at(0, -110), description: 'Lugar de ejemplo. Describí el edificio, su historia y los horarios de visita.', localTip: 'Dato de local de ejemplo.' }),
  demo({ id: 'estacion', name: 'Estación de tren (ejemplo)', category: 'ver', ...at(0, 695), description: 'Lugar de ejemplo. Contá la historia de la estación y qué hay hoy.', localTip: 'Dato de local de ejemplo.' }),
  demo({ id: 'tanque-agua', name: 'Tanque de agua (ejemplo)', category: 'ver', ...at(-220, 330), description: 'Lugar de ejemplo. Un hito visible desde lejos: sirve para orientarse.', localTip: 'Dato de local de ejemplo.' }),
  demo({ id: 'laguna', name: 'Laguna (ejemplo)', category: 'ver', ...at(-900, 330), description: 'Lugar de ejemplo. Un paseo en auto o bici para ver el atardecer.', localTip: 'Dato de local de ejemplo: llevá repelente en verano.' }),
  demo({ id: 'cafe', name: 'Café (ejemplo)', category: 'comer', ...at(110, 0), description: 'Lugar de ejemplo. Qué se toma, qué se come y cómo es el ambiente.', localTip: 'Dato de local de ejemplo.' }),
  demo({ id: 'panaderia', name: 'Panadería (ejemplo)', category: 'comer', ...at(220, -110), description: 'Lugar de ejemplo. Lo que no hay que dejar de probar.', localTip: 'Dato de local de ejemplo: ir temprano.' }),
  demo({ id: 'parrilla', name: 'Parrilla (ejemplo)', category: 'comer', ...at(-110, 110), description: 'Lugar de ejemplo. Platos recomendados y rango de precios.', localTip: 'Dato de local de ejemplo.' }),
  demo({ id: 'hotel', name: 'Hotel (ejemplo)', category: 'dormir', ...at(110, -110), description: 'Lugar de ejemplo. Tipo de habitaciones, servicios y cómo reservar.', localTip: 'Dato de local de ejemplo.' }),
  demo({ id: 'cabanas', name: 'Cabañas (ejemplo)', category: 'dormir', ...at(-840, 260), description: 'Lugar de ejemplo. Alojamiento tranquilo cerca de la laguna.', localTip: 'Dato de local de ejemplo.' }),
  demo({ id: 'hospital', name: 'Hospital (ejemplo)', category: 'servicios', ...at(330, 220), description: 'Lugar de ejemplo. Guardia y teléfonos útiles.', localTip: 'Dato de local de ejemplo.' }),
  demo({ id: 'estacion-servicio', name: 'Estación de servicio (ejemplo)', category: 'servicios', ...at(-55, 440), description: 'Lugar de ejemplo. Combustible y servicios sobre la avenida.', localTip: 'Dato de local de ejemplo.' }),
  demo({ id: 'turismo', name: 'Oficina de turismo (ejemplo)', category: 'servicios', ...at(60, 60), description: 'Lugar de ejemplo. Mapas, información y horarios.', localTip: 'Dato de local de ejemplo.' }),
];
await writeFile(new URL('places.json', dataDir), JSON.stringify(places, null, 2) + '\n');

const tours = [
  {
    id: 'centro-a-pie',
    title: 'Paseo por el centro (ejemplo)',
    mode: 'walk',
    durationMin: 45,
    intro: 'Recorrido de ejemplo: reemplazalo por un paseo real, parada por parada.',
    stops: [
      { placeId: 'turismo', note: 'Empezá acá: pedí un mapa y consejos del día.', tip: '' },
      { placeId: 'plaza-principal', note: 'Dale una vuelta a la plaza.', tip: 'Mejor a la tarde.' },
      { placeId: 'iglesia', note: 'Mirá la fachada y la torre.', tip: '' },
      { placeId: 'cafe', note: 'Un descanso con algo rico.', tip: '' },
    ],
  },
  {
    id: 'comer-a-pie',
    title: 'Para comer (ejemplo)',
    mode: 'walk',
    durationMin: 60,
    intro: 'Recorrido de ejemplo para ir de un lugar de comida a otro caminando.',
    stops: [
      { placeId: 'panaderia', note: 'Desayuno o merienda.', tip: '' },
      { placeId: 'cafe', note: 'Segundo café.', tip: '' },
      { placeId: 'parrilla', note: 'Almuerzo o cena.', tip: '' },
    ],
  },
  {
    id: 'hitos-en-auto',
    title: 'Hitos del pueblo en auto (ejemplo)',
    mode: 'car',
    durationMin: 30,
    intro: 'Recorrido de ejemplo para ver los puntos más altos y los bordes del pueblo.',
    stops: [
      { placeId: 'plaza-principal', note: 'Punto de partida.', tip: '' },
      { placeId: 'tanque-agua', note: 'El hito que se ve desde lejos.', tip: '' },
      { placeId: 'estacion', note: 'Cruzá hacia el sur hasta la estación.', tip: '' },
      { placeId: 'laguna', note: 'Cerrá el día en la laguna.', tip: 'Ideal para el atardecer.' },
    ],
  },
];
await writeFile(new URL('tours.json', dataDir), JSON.stringify(tours, null, 2) + '\n');

await writeFile(new URL('guides.json', dataDir), JSON.stringify([], null, 2) + '\n');

const landmarks = {
  items: [
    { id: 'plaza', name: 'Plaza principal (ejemplo)', kind: 'plaza', ...at(0, 0), size: [92, 92], demo: true },
    { id: 'iglesia', name: 'Iglesia (ejemplo)', kind: 'iglesia', ...at(0, -110), rotY: 0, demo: true },
    { id: 'estacion', name: 'Estación (ejemplo)', kind: 'estacion', ...at(0, 695), rotY: 90, demo: true },
    { id: 'tanque', name: 'Tanque de agua (ejemplo)', kind: 'tanque', ...at(-220, 330), demo: true },
    { id: 'silo', name: 'Silos (ejemplo)', kind: 'silo', ...at(190, 745), demo: true },
  ],
};
await writeFile(new URL('landmarks.json', dataDir), JSON.stringify(landmarks, null, 2) + '\n');

const casonas = {
  items: [
    { id: 'casona-1', name: 'Casona de ejemplo 1', ...at(80, -75), w: 20, d: 14, h: 6, rotY: 0, wall: '#e8d8b8', roof: '#a8483a' },
    { id: 'casona-2', name: 'Casona de ejemplo 2', ...at(110, -75), w: 20, d: 14, h: 6.5, rotY: 0, wall: '#d9c3a0', roof: '#7d4a3a' },
    { id: 'casona-3', name: 'Casona de ejemplo 3', ...at(140, -75), w: 20, d: 14, h: 6, rotY: 0, wall: '#e6c9bd', roof: '#8a3f35' },
  ],
};
await writeFile(new URL('casonas.json', dataDir), JSON.stringify(casonas, null, 2) + '\n');

// Auto de ejemplo: da vueltas a una manzana
const loopCorners = [
  [0.5 * P, 0.5 * P],
  [1.5 * P, 0.5 * P],
  [1.5 * P, 1.5 * P],
  [0.5 * P, 1.5 * P],
  [0.5 * P, 0.5 * P],
].map(([x, z]) => ll(x, z));
const mascots = {
  items: [
    { id: 'perro-1', type: 'perro', name: 'Perro de ejemplo', ...at(30, 30), radius: 35, scale: 2.6, color: '#b98a5e', demo: true },
    { id: 'caballo-1', type: 'caballo', name: 'Caballo de ejemplo', ...at(-760, 380), radius: 40, scale: 3, color: '#7a4b2a', demo: true },
    { id: 'caballo-2', type: 'caballo', name: 'Caballo de ejemplo', ...at(-790, 400), radius: 40, scale: 3, color: '#d8c7a8', demo: true },
    { id: 'auto-1', type: 'auto', name: 'Auto de ejemplo', loop: loopCorners, speed: 8, scale: 1.8, color: '#c8372d', demo: true },
  ],
};
await writeFile(new URL('mascots.json', dataDir), JSON.stringify(mascots, null, 2) + '\n');
console.log('contenido de ejemplo escrito en /data');
