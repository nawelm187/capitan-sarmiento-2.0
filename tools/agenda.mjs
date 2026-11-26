// Novedades del pueblo y agenda de eventos → data/agenda.json (la web muestra la pestaña «Hoy» si hay algo).
//
//   fuentes/novedades.txt   AAAA-MM-DD | título | texto | link (opcional)
//   fuentes/agenda.txt      AAAA-MM-DD (o AAAA-MM-DD a AAAA-MM-DD) | hora (opcional) | título | lugar | texto
//   fuentes/avisos.txt      desde | hasta | tipo (ruta, clima u otro) | título | texto     ← avisos del camino y del tiempo (se ven arriba de todo)
//
// Después:  npm run agenda     (son archivos tuyos: las actualizaciones no los pisan)
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const EJ = {
  'fuentes/novedades.txt': '# Novedades del pueblo. Una línea por novedad:\n#   AAAA-MM-DD | título | texto | link (opcional)\n#   2026-11-25 | Corte de agua | Mañana de 8 a 12 en el barrio Centro. |\n',
  'fuentes/avisos.txt': '# Avisos que se muestran arriba de todo mientras estén vigentes (fechas AAAA-MM-DD):\n#   desde | hasta | tipo (ruta, clima u otro) | título | texto\n#   2026-11-24 | 2026-11-26 | ruta | Ruta 8 con desvío | Obras entre el km 150 y 153, circular con precaución.\n',
  'fuentes/agenda.txt': '# Eventos. Una línea por evento:\n#   AAAA-MM-DD (o AAAA-MM-DD a AAAA-MM-DD) | hora (opcional) | título | lugar | texto\n#   2026-12-05 | 21:00 | Baile en el club | Club Social | Entrada libre\n',
};
for (const [f, txt] of Object.entries(EJ)) if (!existsSync(new URL(f, root))) { await writeFile(new URL(f, root), txt); console.log(`Creé ${f} con un ejemplo.`); }

const rows = async (f) => (await readFile(new URL(f, root), 'utf8')).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split('|').map((x) => x.trim()));
const ISO = /^\d{4}-\d{2}-\d{2}$/;
let bad = 0;
const novedades = [];
for (const [date, title, text = '', link = ''] of await rows('fuentes/novedades.txt')) {
  if (!ISO.test(date || '') || !title) { bad++; console.log(`  ✗ novedades: "${[date, title].join(' | ')}" (fecha AAAA-MM-DD y título son obligatorios)`); continue; }
  novedades.push({ date, title, text, ...(/^https?:\/\//.test(link) ? { link } : {}) });
}
const eventos = [];
for (const [when, time = '', title, place = '', text = ''] of await rows('fuentes/agenda.txt')) {
  const m = /^(\d{4}-\d{2}-\d{2})(?:\s+a\s+(\d{4}-\d{2}-\d{2}))?$/.exec(when || '');
  if (!m || !title || (m[2] && m[2] < m[1])) { bad++; console.log(`  ✗ agenda: "${[when, time, title].join(' | ')}" (fecha AAAA-MM-DD, o "desde a hasta", y título)`); continue; }
  eventos.push({ from: m[1], to: m[2] || m[1], time, title, place, text });
}
const avisos = [];
for (const [from, to, tipo = 'otro', title, text = ''] of await rows('fuentes/avisos.txt')) {
  if (!ISO.test(from || '') || !ISO.test(to || '') || to < from || !title) { bad++; console.log(`  ✗ avisos: "${[from, to, title].join(' | ')}" (fechas AAAA-MM-DD, "hasta" no antes que "desde", y título)`); continue; }
  avisos.push({ from, to, tipo: ['ruta', 'clima'].includes(tipo.toLowerCase()) ? tipo.toLowerCase() : 'otro', title, text });
}
novedades.sort((a, b) => b.date.localeCompare(a.date));
eventos.sort((a, b) => a.from.localeCompare(b.from));
const next = JSON.stringify({ novedades, eventos, avisos }, null, 1) + '\n';
const prev = existsSync(new URL('data/agenda.json', root)) ? await readFile(new URL('data/agenda.json', root), 'utf8') : '';
if (prev !== next) {
  await writeFile(new URL('data/agenda.json', root), next);
  const meta = JSON.parse(await readFile(new URL('data/meta.json', root), 'utf8'));
  meta.dataRev = Date.now().toString(36);
  await writeFile(new URL('data/meta.json', root), JSON.stringify(meta, null, 2) + '\n');
}
console.log(`Novedades: ${novedades.length} · eventos: ${eventos.length} · avisos: ${avisos.length}${bad ? ` · con error: ${bad}` : ''}${prev === next ? ' (sin cambios)' : ''}. Probalo con npm run serve.`);
