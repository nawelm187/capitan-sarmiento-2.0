// Elige dónde arranca la cámara al abrir la web.
//
//   npm run inicio -- museo              (arranca cerca del primer lugar cuyo nombre incluya "museo")
//   npm run inicio -- "banco nacion"
//   npm run inicio -- ninguno            (arranca en el punto del mapa, sin acercarse a un lugar)
//   npm run inicio                       (vuelve al automático: Banco Nación si existe)
import { readFile, writeFile } from 'node:fs/promises';

const dataDir = new URL('../data/', import.meta.url);
const meta = JSON.parse(await readFile(new URL('meta.json', dataDir), 'utf8'));
const places = JSON.parse(await readFile(new URL('places.json', dataDir), 'utf8').catch(() => '[]'));
const lm = JSON.parse(await readFile(new URL('landmarks.json', dataDir), 'utf8').catch(() => '{"items":[]}')).items || [];
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const arg = process.argv.slice(2).join(' ').trim();

if (!arg) {
  delete meta.startPlace;
  console.log('Inicio automático (Banco Nación si existe).');
} else if (norm(arg) === 'ninguno') {
  meta.startPlace = null;
  console.log('La cámara arranca en el punto del mapa, sin acercarse a ningún lugar.');
} else {
  const hit = [...places, ...lm].find((q) => norm(q.name).includes(norm(arg)));
  if (!hit) {
    console.log(`No encontré ningún lugar con "${arg}". Algunos nombres: ${places.slice(0, 8).map((q) => q.name).join(' · ')}`);
    process.exit(1);
  }
  meta.startPlace = arg;
  console.log(`La web va a arrancar cerca de: ${hit.name}`);
}
meta.dataRev = Date.now().toString(36);
await writeFile(new URL('meta.json', dataDir), JSON.stringify(meta, null, 2) + '\n');
console.log('Listo. Probalo con: npm run serve (y Ctrl+F5).');
