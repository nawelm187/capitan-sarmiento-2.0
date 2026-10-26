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
const dc = (p) => Math.hypot(p.x, p.z);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const byType = (...ts) => P.filter((p) => ts.includes(p.icon));

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
const stops = (l) => l.map((p) => ({ placeId: p.id, note: note(p), tip: '' }));

const tours = [];
function add(id, title, mode, intro, list) {
  if (list.length < 2) return;
  const m = pathLen(list);
  const speed = mode === 'walk' ? 75 : 450; // metros por minuto
  const dur = Math.max(10, Math.round(m / speed + list.length * (mode === 'walk' ? 6 : 4)));
  tours.push({ id, title, mode, durationMin: Math.round(dur / 5) * 5 || 10, intro, stops: stops(list) });
}

// 1) Centro a pie: lo más emblemático cerca del centro
{
  const emblem = byType('plaza', 'iglesia', 'municipalidad', 'museo', 'cultura', 'biblioteca', 'monumento', 'estacion', 'mirador', 'atractivo', 'turismo').filter((p) => dc(p) < 1500);
  const pick = emblem.sort((a, b) => dc(a) - dc(b)).slice(0, 8);
  if (pick.length >= 2) add('auto-centro', 'Paseo por el centro', 'walk', 'Un paseo a pie por los lugares más emblemáticos del centro del pueblo.', order(pick, pick.find((p) => p.icon === 'plaza')));
}
// 2) Para comer y tomar algo
{
  const pick = P.filter((p) => p.category === 'comer' && dc(p) < 1300).sort((a, b) => dc(a) - dc(b)).slice(0, 8);
  add('auto-comer', 'Para comer y tomar algo', 'walk', 'De la panadería al café y la parrilla: lugares para comer y tomar algo, uno cerca del otro.', order(pick));
}
// 3) De compras (variado: un comercio de cada tipo)
{
  const seen = new Set();
  const pick = [];
  for (const p of P.filter((x) => x.category === 'compras' && dc(x) < 1000).sort((a, b) => dc(a) - dc(b))) {
    if (seen.has(p.icon)) continue;
    seen.add(p.icon);
    pick.push(p);
    if (pick.length === 8) break;
  }
  add('auto-compras', 'De compras por el centro', 'walk', 'Ferreterías, supermercados, ropa y más: un comercio de cada rubro, en orden para ir caminando.', order(pick));
}
// 4) Vuelta al pueblo en auto
{
  const cand = byType('plaza', 'iglesia', 'museo', 'cultura', 'estacion', 'club', 'monumento', 'tanque', 'silo', 'mirador', 'atractivo', 'camping').filter((p) => dc(p) < 3500);
  const sorted = cand.sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  const step = Math.max(1, sorted.length / 9);
  const pick = [];
  for (let i = 0; i < sorted.length && pick.length < 9; i += step) pick.push(sorted[Math.floor(i)]);
  add('auto-vuelta', 'Vuelta al pueblo', 'car', 'Un recorrido en auto que da toda la vuelta: de los lugares del centro a los de las afueras.', [...new Set(pick)]);
}
// 5) Servicios útiles en auto
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
