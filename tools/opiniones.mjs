// Opiniones con estrellas → data/opiniones.json (la web muestra el promedio y los comentarios).
//
//   fuentes/opiniones.txt   una línea por opinión APROBADA por vos:
//     Nombre del lugar | estrellas (1 a 5) | comentario | nombre de quien opina (opcional)
//     Panadería La Esquina | 5 | Las facturas son lo mejor | Marta
//
// Cuando alguien opina desde la guía, te llega por WhatsApp con una última línea «OPINION: …»:
// si te parece bien, la pegás tal cual en el archivo. Después:  npm run opiniones
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const F = new URL('fuentes/opiniones.txt', root);
if (!existsSync(F)) {
  await writeFile(F, '# Opiniones aprobadas. Una línea por opinión:\n#   Nombre del lugar | estrellas (1 a 5) | comentario | nombre (opcional)\n#   Panadería La Esquina | 5 | Las facturas son lo mejor | Marta\n');
  console.log('Creé fuentes/opiniones.txt con un ejemplo. Pegá ahí las opiniones aprobadas y volvé a correr: npm run opiniones');
}
const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const places = JSON.parse(await readFile(new URL('data/places.json', root), 'utf8'));
const lines = (await readFile(F, 'utf8')).split(/\r?\n/).map((l) => l.trim().replace(/^OPINION:\s*/i, '')).filter((l) => l && !l.startsWith('#'));
const out = [];
for (const l of lines) {
  const [lugar = '', est = '', comentario = '', nombre = ''] = l.split('|').map((x) => x.trim());
  const e = Number(est.replace(',', '.'));
  const hit = places.find((p) => norm(p.name) === norm(lugar)) || places.find((p) => norm(lugar).length > 3 && norm(p.name).includes(norm(lugar)));
  if (!hit) { console.log(`  ✗ "${lugar}": no encuentro ese lugar`); continue; }
  if (!(e >= 1 && e <= 5)) { console.log(`  ✗ "${lugar}": las estrellas tienen que ser de 1 a 5`); continue; }
  out.push({ placeId: hit.id, estrellas: Math.round(e), ...(comentario ? { comentario } : {}), ...(nombre ? { nombre } : {}) });
}
await writeFile(new URL('data/opiniones.json', root), JSON.stringify(out, null, 2) + '\n');
try {
  const mu = new URL('data/meta.json', root);
  const meta = JSON.parse(await readFile(mu, 'utf8'));
  meta.dataRev = Date.now().toString(36);
  await writeFile(mu, JSON.stringify(meta, null, 2) + '\n');
} catch { /* sin meta */ }
console.log(`${out.length} opinión(es) publicadas en data/opiniones.json`);
