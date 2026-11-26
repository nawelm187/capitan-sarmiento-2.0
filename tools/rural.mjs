// Caminos rurales + actividades de todas las semanas → data/rural.json
//
//   fuentes/caminos.txt   Camino | estado | fecha (AAAA-MM-DD, opcional) | nota (opcional)
//                         Camino a Pearson | con barro | 2026-11-20 | Después de la lluvia del martes
//                         Estados: transitable, con barro, cortado
//   fuentes/semanal.txt   Día | hora | Actividad | Lugar (opcional) | nota (opcional)
//                         Martes y jueves | 19:00 | Taller de folklore | Casa de la Cultura | Gratis
//                         Días: lunes, «lunes y miércoles», «lunes a viernes», todos
//
// Después:  npm run rural
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { diasDeTexto, estadoCamino } from '../js/rural.js';

const root = new URL('../', import.meta.url);
const EJ = {
  'fuentes/caminos.txt': '# Estado de los caminos rurales. Una línea por camino:\n#   Camino | estado | fecha AAAA-MM-DD (opcional) | nota (opcional)\n#   Camino a Pearson | con barro | 2026-11-20 | Después de la lluvia\n# Estados: transitable, con barro, cortado. Actualizalo cada vez que cambie y corré: npm run rural\n',
  'fuentes/semanal.txt': '# Actividades que se repiten todas las semanas:\n#   Día | hora | Actividad | Lugar (opcional) | nota (opcional)\n#   Martes y jueves | 19:00 | Taller de folklore | Casa de la Cultura | Gratis\n# Días: lunes, "lunes y miércoles", "lunes a viernes", todos\n',
};
for (const [f, txt] of Object.entries(EJ)) if (!existsSync(new URL(f, root))) { await writeFile(new URL(f, root), txt); console.log(`Creé ${f} con un ejemplo comentado.`); }
const leer = async (f) => (await readFile(new URL(f, root), 'utf8')).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split('|').map((x) => x.trim()));

const caminos = [];
for (const [nombre = '', estado = '', fecha = '', nota = ''] of await leer('fuentes/caminos.txt')) {
  if (!nombre || !estado) { console.log(`  ✗ camino sin nombre o estado: "${nombre}"`); continue; }
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) { console.log(`  ✗ ${nombre}: la fecha tiene que ser AAAA-MM-DD`); continue; }
  caminos.push({ nombre, estado: { transitable: 'transitable', barro: 'con barro', cortado: 'cortado' }[estadoCamino(estado)], ...(fecha ? { fecha } : {}), ...(nota ? { nota } : {}) });
}
const semanal = [];
for (const [dia = '', hora = '', titulo = '', lugar = '', nota = ''] of await leer('fuentes/semanal.txt')) {
  if (!titulo || !diasDeTexto(dia).length) { console.log(`  ✗ "${dia} | ${titulo}": no entendí el día o falta la actividad`); continue; }
  semanal.push({ dia, hora, titulo, ...(lugar ? { lugar } : {}), ...(nota ? { nota } : {}) });
}
await mkdir(new URL('data/', root), { recursive: true });
await writeFile(new URL('data/rural.json', root), JSON.stringify({ caminos, semanal }, null, 2) + '\n');
try {
  const mu = new URL('data/meta.json', root); const meta = JSON.parse(await readFile(mu, 'utf8'));
  meta.dataRev = Date.now().toString(36); await writeFile(mu, JSON.stringify(meta, null, 2) + '\n');
} catch { /* sin meta */ }
console.log(`${caminos.length} camino(s) y ${semanal.length} actividad(es) semanales en data/rural.json.`);
