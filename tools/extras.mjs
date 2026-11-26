// Suma a data/places.json los lugares que escribas en fuentes/lugares-extra.txt (los que OpenStreetMap no tiene).
//
//   npm run extras
//
// Una línea por lugar:   Nombre | tipo | link de Google Maps (o "lat, lng")
// Las líneas que empiezan con # se ignoran. Si no sabés el link, dejá la ubicación vacía y se omite con un aviso.
// Tipos válidos: mirá js/kinds.js (restaurante, parrilla, pizzeria, cafe, heladeria, hotel, hospedaje, museo, atractivo, club, ferreteria, farmacia…).
// Se corre solo al final de `npm run lugares`. No pisa lo que ya editaste: un lugar existente solo se actualiza si cambia su ubicación.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { TYPES } from '../js/kinds.js';
import { setCenter, toLocal } from '../js/geo.js';
import { snapPlaces } from './snap-lib.mjs';

const dataDir = new URL('../data/', import.meta.url);
const file = new URL('../fuentes/lugares-extra.txt', import.meta.url);
if (!existsSync(file) && !existsSync(new URL('../fuentes/inventario-ampliado.txt', import.meta.url))) {
  console.log('• No hay fuentes/lugares-extra.txt: no hay lugares extra para sumar.');
  process.exit(0);
}
const meta = JSON.parse(await readFile(new URL('meta.json', dataDir), 'utf8'));
setCenter(meta.center);
const places = JSON.parse(await readFile(new URL('places.json', dataDir), 'utf8').catch(() => '[]'));
const r6 = (n) => Math.round(n * 1e6) / 1e6;
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const fromText = (s) => {
  let m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(s) || /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(s) || /[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/.exec(s) || /^\s*(-?\d{1,2}\.\d+)\s*[,; ]\s*(-?\d{1,3}\.\d+)\s*$/.exec(s);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
};
async function locate(spec) {
  const direct = fromText(spec);
  if (direct) return direct;
  if (!/^https?:\/\//.test(spec)) return null;
  try {
    // Los links cortos (maps.app.goo.gl) redirigen al link largo, que trae las coordenadas.
    const res = await fetch(spec, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 guia-sarmiento' } });
    const u = decodeURIComponent(res.url);
    return fromText(u) || fromText(await res.text());
  } catch {
    return null;
  }
}

// ---- Lectura de las dos listas ----
//   fuentes/lugares-extra.txt        lo que cargás vos (manda siempre)
//   fuentes/inventario-ampliado.txt  inventario de comercios y servicios (se evita repetir lo que el mapa ya tiene)
// Formato:  Nombre | tipo | link o "lat, lng" (puede ir vacío) | dirección (opcional) | estado (opcional, informativo)
const SOURCES = [
  { url: file, inv: false },
  { url: new URL('../fuentes/inventario-ampliado.txt', import.meta.url), inv: true },
  { url: new URL('../fuentes/geocodificados.txt', import.meta.url), inv: true },
  { url: new URL('../fuentes/puentes.txt', import.meta.url), inv: true },
  { url: new URL('../fuentes/puentes-manual.txt', import.meta.url), inv: true },
];
const rows = [];
for (const src of SOURCES) {
  if (!existsSync(src.url)) continue;
  for (const raw of (await readFile(src.url, 'utf8')).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [name, type, spec = '', address = '', status = ''] = line.split('|').map((x) => x.trim());
    rows.push({ name, type, spec, address, status, inv: src.inv, line });
  }
}
// Lugares que marcaste como "no existe / no va" desde la página de ubicar (fuentes/descartados.txt): se ignoran.
const descartados = new Set();
const descFile = new URL('../fuentes/descartados.txt', import.meta.url);
if (existsSync(descFile)) {
  for (const l of (await readFile(descFile, 'utf8')).split(/\r?\n/)) if (l.trim() && !l.startsWith('#')) descartados.add(slug(l.trim()));
}
for (let i = rows.length - 1; i >= 0; i--) if (descartados.has(slug(rows[i].name)) && rows[i].inv) rows.splice(i, 1);
const half = meta.osm?.halfSizeMeters ?? 2000;
const localOf = (pos) => toLocal(pos.lng, pos.lat);
const metersBetween = (a, b) => {
  const p = localOf(a);
  const q = localOf(b);
  return Math.hypot(p.x - q.x, p.z - q.z);
};
const nkey = (s) => slug(s).replace(/-/g, '');
// Tipos que existen una sola vez en el pueblo: si ya hay uno en el mapa, el del inventario es el mismo.
const UNIQUE = new Set(['banconacion', 'municipalidad', 'terminal', 'hospital', 'policia', 'bomberos', 'correo']);
// ¿Ya hay en el mapa un lugar que es este? (mismo nombre, o nombre contenido en el otro, o mismo tipo pegado)
function twin(row, pos) {
  const k = nkey(row.name);
  for (const p of places) {
    const pk = nkey(p.name);
    const sameName = pk === k || (Math.min(pk.length, k.length) >= 8 && (pk.includes(k) || k.includes(pk)));
    if (sameName && (!pos || metersBetween(p, pos) < 400)) return p;
    if (pos && p.icon === row.type && metersBetween(p, pos) < 60) return p;
  }
  if (!pos && UNIQUE.has(row.type)) return places.find((p) => p.icon === row.type) || null;
  return null;
}

let added = 0;
let dups = 0;
let skipped = 0;
const pendientes = [];
for (const row of rows) {
  const { name, type, spec, address, status, inv } = row;
  if (!name || !TYPES[type]) {
    console.warn(`⚠ Línea ignorada (tipo desconocido "${type}"): ${row.line}`);
    skipped++;
    continue;
  }
  const id = 'extra-' + slug(name);
  const old = places.find((p) => p.id === id);
  if (inv && old) continue; // ya lo cargaste vos o una corrida anterior: no se toca
  const pos = spec ? await locate(spec) : null;
  const verify = /verificar/i.test(status);
  if (!pos) {
    if (!old && !twin(row, null)) pendientes.push({ id, name, type, address, status, verify });
    continue;
  }
  const out = Math.abs(localOf(pos).x) > half || Math.abs(localOf(pos).z) > half;
  if (out) {
    if (!old) pendientes.push({ id, name, type, address, status: status || 'FUERA_DEL_MAPA', verify, outside: true });
    continue;
  }
  if (old) {
    Object.assign(old, { lat: r6(pos.lat), lng: r6(pos.lng), category: TYPES[type].cat, icon: type });
    if (address && !old.address) old.address = address;
  } else {
    const same = inv ? twin(row, pos) : null;
    if (same) {
      if (address && !same.address) same.address = address;
      dups++;
      continue;
    }
    places.push({
      id, name, category: TYPES[type].cat, icon: type, lat: r6(pos.lat), lng: r6(pos.lng),
      address, hours: '', phone: '', web: '',
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${r6(pos.lat)},${r6(pos.lng)}`,
      reviewsUrl: '', photo: '',
      description: inv ? `${TYPES[type].label}${address ? ` · ${address}` : ''}.` : `${TYPES[type].label}. Falta sumar la descripción.`,
      localTip: '',
      source: inv ? 'Inventario ampliado (OpenStreetMap vía Mapcarta, nov. 2026): verificar el punto' : 'Cargado a mano',
      updated: meta.date || new Date().toISOString().slice(0, 10),
    });
  }
  added++;
}
const dedupPend = [...new Map(pendientes.map((q) => [q.id, q])).values()].filter((q) => !places.some((p) => p.id === q.id));
const nOut = dedupPend.filter((q) => q.outside).length;
const nWait = dedupPend.filter((q) => !q.outside && !q.verify).length;
const nVerify = dedupPend.filter((q) => q.verify).length;
if (dedupPend.length) {
  console.log(`• Sin dibujar (${dedupPend.length}): ${nWait} sin ubicación todavía (pegá su link de Google Maps en fuentes/lugares-extra.txt para sumarlos)` + (nOut ? `, ${nOut} fuera del área del mapa (se agranda con: npm run mapa -- --half=5000)` : '') + (nVerify ? `, ${nVerify} por verificar si existen` : '') + '.');
}
if (dups) console.log(`• ${dups} del inventario ya estaban en el mapa: no se repiten.`);
try {
  setCenter(meta.center);
  const gj = JSON.parse(await readFile(new URL('sarmiento-osm.geojson', dataDir), 'utf8'));
  const n = snapPlaces(places, gj);
  if (n) console.log(`${n} lugares se acomodaron adentro de su edificio.`);
} catch { /* sin mapa: se deja la ubicación tal cual */ }
await writeFile(new URL('places.json', dataDir), JSON.stringify(places, null, 2) + '\n');
await writeFile(new URL('pendientes.json', dataDir), JSON.stringify(dedupPend, null, 1) + '\n');
meta.dataRev = Date.now().toString(36);
await writeFile(new URL('meta.json', dataDir), JSON.stringify(meta, null, 2) + '\n');
console.log(`Lugares extra: ${added} sumados o actualizados${skipped ? `, ${skipped} omitidos (ver avisos)` : ''}.`);
process.exitCode = 0;
