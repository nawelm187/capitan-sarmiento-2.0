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

const dataDir = new URL('../data/', import.meta.url);
const file = new URL('../fuentes/lugares-extra.txt', import.meta.url);
if (!existsSync(file)) {
  console.log('• No hay fuentes/lugares-extra.txt: no hay lugares extra para sumar.');
  process.exit(0);
}
const meta = JSON.parse(await readFile(new URL('meta.json', dataDir), 'utf8'));
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

let added = 0;
const pending = [];
let skipped = 0;
for (const raw of (await readFile(file, 'utf8')).split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const [name, type, spec = ''] = line.split('|').map((x) => x.trim());
  if (!name || !TYPES[type]) {
    console.warn(`⚠ Línea ignorada (tipo desconocido "${type}"): ${line}`);
    skipped++;
    continue;
  }
  const id = 'extra-' + slug(name);
  const pos = spec ? await locate(spec) : null;
  const old = places.find((p) => p.id === id);
  if (!pos) {
    if (!old) pending.push(name);
    continue;
  }
  if (old) {
    Object.assign(old, { lat: r6(pos.lat), lng: r6(pos.lng), category: TYPES[type].cat, icon: type });
  } else {
    places.push({
      id, name, category: TYPES[type].cat, icon: type, lat: r6(pos.lat), lng: r6(pos.lng),
      address: '', hours: '', phone: '', web: '',
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${r6(pos.lat)},${r6(pos.lng)}`,
      reviewsUrl: '', photo: '',
      description: `${TYPES[type].label}. Falta sumar la descripción.`,
      localTip: '', source: 'Cargado a mano', updated: meta.date || new Date().toISOString().slice(0, 10),
    });
  }
  added++;
}
if (pending.length) console.log(`• Sin ubicación todavía (${pending.length}): pegá el link de Google Maps en fuentes/lugares-extra.txt para sumarlos.`);
await writeFile(new URL('places.json', dataDir), JSON.stringify(places, null, 2) + '\n');
meta.dataRev = Date.now().toString(36);
await writeFile(new URL('meta.json', dataDir), JSON.stringify(meta, null, 2) + '\n');
console.log(`Lugares extra: ${added} sumados o actualizados${skipped ? `, ${skipped} omitidos (ver avisos)` : ''}.`);
