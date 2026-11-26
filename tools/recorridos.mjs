// Arma recorridos automáticos (a pie y en auto) con los lugares de data/places.json y los deja en data/tours.json.
//
//   npm run recorridos          (se corre solo al final de `npm run lugares`)
//
// Solo toca los recorridos "auto-…": los que escribas a mano (con otro id) se conservan.
// Sirven de punto de partida: podés editar data/tours.json y poner tus propias notas y tips.

import { readFile, writeFile } from 'node:fs/promises';
import { setCenter, toLocal } from '../js/geo.js';
import { TYPES } from '../js/kinds.js';

const dataDir = new URL('../data/', import.meta.url);
const rd = async (n, f) => {
  try {
    return JSON.parse(await readFile(new URL(n, dataDir), 'utf8'));
  } catch {
    return f;
  }
};
const meta = await rd('meta.json', null);
const places = await rd('places.json', []);
if (!meta) throw new Error('No encuentro data/meta.json');
setCenter(meta.center);

const P = places
  .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  .map((p) => ({ ...p, ...toLocal(p.lng, p.lat) }));

// Punto de referencia: el centro del PUEBLO (Banco Nación o plaza, si no meta.focus), no el centro del mapa:
// el mapa grande mueve el centro lejos del pueblo y por eso los recorridos a pie quedaban vacíos.
const bn = P.find((p) => p.icon === 'banconacion') || P.find((p) => p.icon === 'plaza');
const home = bn ? { x: bn.x, z: bn.z } : meta.focus ? toLocal(meta.focus.lng, meta.focus.lat) : { x: 0, z: 0 };
const dc = (p) => Math.hypot(p.x - home.x, p.z - home.z);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const byType = (...ts) => P.filter((p) => ts.includes(p.icon));
/** Los que están a menos de r metros del centro; si hay menos de `min`, los `min` más cercanos. */
const near = (list, r, min = 2) => {
  const s = [...list].sort((a, b) => dc(a) - dc(b));
  const ok = s.filter((p) => dc(p) < r);
  return ok.length >= min ? ok : s.slice(0, min);
};

/** Ordena por vecino más cercano a partir del primero. */
function order(list, start) {
  const left = [...list];
  const out = [];
  let cur = start || left.sort((a, b) => dc(a) - dc(b))[0];
  left.splice(left.indexOf(cur), 1);
  out.push(cur);
  while (left.length) {
    left.sort((a, b) => d2(a, cur) - d2(b, cur));
    cur = left.shift();
    out.push(cur);
  }
  return out;
}
const pathLen = (l) => l.slice(1).reduce((s, p, i) => s + d2(p, l[i]) * 1.25, 0); // *1.25: las calles no son rectas
const note = (p) => `${TYPES[p.icon]?.label || 'Lugar'}${p.address ? ' · ' + p.address : ''}`;
const TIPS = {
  plaza: 'Buen lugar para empezar: sentate un rato y mirá el movimiento del pueblo.',
  iglesia: 'Si está abierta, pasá a verla por dentro. Respetá los horarios de misa.',
  museo: 'Fijate los horarios antes de ir; suele abrir pocas horas.',
  cultura: 'Mirá la cartelera: suele haber talleres y muestras.',
  biblioteca: 'Consultá si se puede visitar fuera del horario de lectura.',
  estacion: 'Un clásico de los pueblos del ramal: ideal para fotos.',
  monumento: 'Sacá una foto y leé la placa: cuenta parte de la historia.',
  mirador: 'Mejor al atardecer.',
  puente: 'Cruzalo despacio y mirá el río desde arriba.',
  pesca: 'Llevá repelente y consultá si hace falta permiso de pesca.',
  panaderia: 'Probá las facturas del día.',
  heladeria: 'Cerrá el paseo con un helado.',
  cafe: 'Buen lugar para un descanso.',
  parrilla: 'Reservá si vas en fin de semana.',
};
const stops = (l) => l.map((p) => ({ placeId: p.id, note: note(p), tip: TIPS[p.icon] || '' }));

const tours = [];
function add(id, title, mode, intro, list) {
  list = [...new Set(list.filter(Boolean))];
  if (list.length < 2) return;
  const m = pathLen(list);
  const speed = mode === 'walk' ? 75 : 450; // metros por minuto
  const dur = Math.max(10, Math.round(m / speed + list.length * (mode === 'walk' ? 6 : 4)));
  tours.push({ id, title, mode, durationMin: Math.round(dur / 5) * 5 || 10, intro, stops: stops(list) });
}
const startAt = (list, ...ts) => list.find((p) => ts.includes(p.icon));

// ---- A PIE ----
{
  const emblem = byType('plaza', 'iglesia', 'municipalidad', 'museo', 'cultura', 'biblioteca', 'monumento', 'estacion', 'mirador', 'atractivo', 'turismo', 'cine');
  const pick = near(emblem, 1500, 3).slice(0, 8);
  add('auto-centro', 'Paseo por el centro', 'walk', 'Primera vez en Capitán Sarmiento: la plaza, la iglesia y los lugares más emblemáticos, uno cerca del otro.', order(pick, startAt(pick, 'plaza')));
}
{
  const pick = near(byType('plaza', 'iglesia', 'museo', 'cultura', 'biblioteca', 'estacion', 'monumento', 'cine', 'municipalidad'), 2200, 3).slice(0, 8);
  add('auto-historia', 'Historia y cultura', 'walk', 'Museo, biblioteca, estación e iglesia: un paseo tranquilo para conocer la historia del pueblo.', order(pick, startAt(pick, 'museo', 'cultura', 'plaza')));
}
{
  const pick = near(P.filter((p) => p.category === 'comer'), 1300, 3).slice(0, 8);
  add('auto-comer', 'Para comer y tomar algo', 'walk', 'De la panadería al café y la parrilla: lugares para comer y tomar algo, uno cerca del otro.', order(pick));
}
{
  const pick = near(byType('cafe', 'heladeria', 'panaderia', 'bar'), 1500, 3).slice(0, 6);
  add('auto-merienda', 'Café, dulces y merienda', 'walk', 'Para una tarde tranquila: café, panadería y helado.', order(pick));
}
{
  const seen = new Set();
  const pick = [];
  for (const p of near(P.filter((x) => x.category === 'compras'), 1000, 3)) {
    if (seen.has(p.icon)) continue;
    seen.add(p.icon);
    pick.push(p);
    if (pick.length === 8) break;
  }
  add('auto-compras', 'De compras por el centro', 'walk', 'Ferreterías, supermercados, ropa y más: un comercio de cada rubro, en orden para ir caminando.', order(pick));
}

// ---- EN AUTO ----
{
  const cand = near(byType('plaza', 'iglesia', 'museo', 'cultura', 'estacion', 'club', 'monumento', 'tanque', 'silo', 'mirador', 'atractivo', 'camping'), 3500, 4);
  const sorted = cand.sort((a, b) => Math.atan2(a.z - home.z, a.x - home.x) - Math.atan2(b.z - home.z, b.x - home.x));
  const step = Math.max(1, sorted.length / 9);
  const pick = [];
  for (let i = 0; i < sorted.length && pick.length < 9; i += step) pick.push(sorted[Math.floor(i)]);
  add('auto-vuelta', 'Vuelta al pueblo', 'car', 'Un recorrido en auto que da toda la vuelta: de los lugares del centro a los de las afueras.', pick);
}
{
  const pick = near(byType('puente', 'pesca', 'mirador', 'camping', 'estancia'), 12000, 2).slice(0, 8);
  add('auto-rio', 'Río, puentes y pesca', 'car', 'Los puentes, los lugares de pesca y los rincones al aire libre: salí con mate y cámara.', order(pick));
}
{
  const want = ['hospital', 'farmacia', 'policia', 'bomberos', 'municipalidad', 'combustible', 'banco', 'correo', 'terminal', 'estacion'];
  const pick = want.map((t) => byType(t).sort((a, b) => dc(a) - dc(b))[0]).filter(Boolean);
  add('auto-servicios', 'Servicios útiles', 'car', 'Hospital, farmacia, policía, bomberos, estación de servicio y más, por si los necesitás.', order(pick));
}

// Se conservan los recorridos tuyos (otro id) mientras todas sus paradas existan.
const ids = new Set(places.map((p) => p.id));
const mine = (await rd('tours.json', [])).filter((t) => !String(t.id).startsWith('auto-') && !t.demo && t.stops?.every((s) => ids.has(s.placeId)));
await writeFile(new URL('tours.json', dataDir), JSON.stringify([...tours, ...mine], null, 2) + '\n');
meta.dataRev = Date.now().toString(36);
await writeFile(new URL('meta.json', dataDir), JSON.stringify(meta, null, 2) + '\n');
console.log(`${tours.length} recorridos automáticos en data/tours.json` + (mine.length ? ` (+ ${mine.length} tuyos)` : ''));
for (const t of tours) console.log(`  ${t.mode === 'walk' ? 'a pie' : 'en auto'} · ${t.title}: ${t.stops.length} paradas, ${t.durationMin} min`);
