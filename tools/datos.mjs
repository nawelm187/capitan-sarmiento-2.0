// Completa teléfono, WhatsApp, horario y dirección de los lugares, y te muestra qué falta cargar.
//
//   npm run datos
//
// 1. Crea (o completa) fuentes/datos-lugares.txt con una línea por cada lugar al que le falta teléfono u horario.
// 2. Abrilo con el Bloc de notas, completá lo que sepas (podés dejar campos vacíos) y volvé a correr: npm run datos
//
//      Nombre del lugar | teléfono | whatsapp | horario | dirección
//      Farmacia Bava | 03764 123456 | 5493764123456 | Lun a Vie 8 a 12 y 16 a 20; Sáb 9 a 13 | Mármol 100
//
// El horario se escribe como se habla ("Lun a Sáb 8 a 20", "24 hs", "Dom cerrado"). Los campos vacíos no cambian nada.
// (Archivo tuyo: las actualizaciones no lo pisan; `npm run lugares` lo vuelve a aplicar solo.)
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { aFormatoOSM } from './horario.mjs';

const root = new URL('../', import.meta.url);
const soloAplicar = process.argv.includes('--aplicar');
const placesUrl = new URL('data/places.json', root);
const fileUrl = new URL('fuentes/datos-lugares.txt', root);
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const q = (s) => String(s || '').replace(/\|/g, '/').trim();

if (!existsSync(placesUrl)) { console.log('No hay data/places.json: corré primero npm run lugares'); process.exit(soloAplicar ? 0 : 1); }
const places = JSON.parse(await readFile(placesUrl, 'utf8'));
const HEAD = '# Teléfono, WhatsApp, horario y dirección de cada lugar. Completá lo que sepas y corré: npm run datos\n#   Nombre del lugar | teléfono | whatsapp | horario | dirección\n#   Horario como se habla: Lun a Vie 8 a 12 y 16 a 20; Sáb 9 a 13   (también: 24 hs · Dom cerrado)\n#   Si lo copiás de Google Maps también sirve: lunes: 8:30–12:30, 16:30–20:30; martes: 8:30–12:30; domingo: cerrado\n#   WhatsApp: código de país + 9 + código de área + número, sin espacios (5493764123456)\n#   Los campos vacíos no cambian nada.\n';
let text = existsSync(fileUrl) ? await readFile(fileUrl, 'utf8') : HEAD;
// Mensajes que te mandan los dueños (botón «Soy el dueño»): pegalos en fuentes/sugerencias.txt; se usan las líneas «DATOS: …»
const sugUrl = new URL('fuentes/sugerencias.txt', root);
const sugeridas = existsSync(sugUrl) ? (await readFile(sugUrl, 'utf8')).split(/\r?\n/).map((l) => l.trim()).filter((l) => /^DATOS:/i.test(l)).map((l) => l.replace(/^DATOS:\s*/i, '')) : [];

// ---------- 1. aplicar lo que escribiste ----------
const byName = new Map();
for (const p of places) { const k = norm(p.name); byName.set(k, [...(byName.get(k) || []), p]); }
let aplicados = 0;
const errores = [];
const listados = new Set();
for (const raw of [...text.split(/\r?\n/), ...sugeridas]) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const [name, phone = '', wa = '', horario = '', dir = ''] = line.split('|').map((x) => x.trim());
  listados.add(norm(name));
  let hit = byName.get(norm(name));
  if (!hit) { const c = places.filter((p) => norm(p.name).includes(norm(name)) && norm(name).length >= 5); if (c.length === 1) hit = c; }
  if (!hit?.length) { if (phone || wa || horario || dir) errores.push(`"${name}": no encontré un lugar con ese nombre`); continue; }
  let cambios = 0;
  for (const p of hit) {
    if (phone && p.phone !== phone) { p.phone = phone; cambios++; }
    if (wa) { const d = wa.replace(/\D/g, ''); if (d.length >= 10 && p.whatsapp !== d) { p.whatsapp = d; cambios++; } else if (d.length < 10) errores.push(`"${name}": el WhatsApp "${wa}" parece incompleto`); }
    if (horario) {
      const h = aFormatoOSM(horario);
      if (h === null) errores.push(`"${name}": no entendí el horario "${horario}" (probá: Lun a Vie 8 a 12 y 16 a 20; Sáb 9 a 13)`);
      else if (p.hours !== h) { p.hours = h; cambios++; }
    }
    if (dir && p.address !== dir) { p.address = dir; cambios++; }
  }
  if (cambios) aplicados++;
}
if (aplicados) await writeFile(placesUrl, JSON.stringify(places, null, 2) + '\n');

// ---------- 2. completar la lista de lo que falta ----------
const falta = places.filter((p) => !p.phone || !p.hours);
if (!soloAplicar) {
  const nuevos = falta.filter((p) => !listados.has(norm(p.name)));
  if (nuevos.length) {
    text = text.replace(/\s*$/, '\n') + nuevos.map((p) => `${q(p.name)} | ${q(p.phone)} | ${q(p.whatsapp)} | ${q(p.hours)} | ${q(p.address && !/a completar/i.test(p.address) ? p.address : '')}`).join('\n') + '\n';
    await writeFile(fileUrl, text);
  }
  const sin = (f) => places.filter((p) => !p[f]).length;
  console.log(`Lugares: ${places.length} · sin teléfono: ${sin('phone')} · sin horario: ${sin('hours')} · sin dirección: ${places.filter((p) => !p.address || /a completar/i.test(p.address)).length}`);
  if (sugeridas.length) console.log(`Mensajes de dueños leídos de fuentes/sugerencias.txt: ${sugeridas.length}`);
  console.log(`${aplicados} lugares actualizados con lo que escribiste${nuevos.length ? ` · agregué ${nuevos.length} lugares nuevos a fuentes/datos-lugares.txt para que los completes` : ''}.`);
  if (falta.length) console.log('Abrí fuentes/datos-lugares.txt con el Bloc de notas, completá lo que sepas y volvé a correr: npm run datos');
}
for (const e of errores) console.log('  ✗', e);
if (aplicados && !soloAplicar) {
  const meta = JSON.parse(await readFile(new URL('data/meta.json', root), 'utf8'));
  meta.dataRev = Date.now().toString(36);
  await writeFile(new URL('data/meta.json', root), JSON.stringify(meta, null, 2) + '\n');
  console.log('Listo. Probalo con npm run serve (y Ctrl+F5).');
}
