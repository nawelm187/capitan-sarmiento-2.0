// Agrega un guía de turismo a data/guides.json (pestaña "Guías").
//
//   npm run guias -- --nombre="María Gómez" --contacto="+5491123456789" --idiomas=es,en --notas="Recorridos a pie por el centro" --consentimiento
//   npm run guias -- --lista                (muestra los que hay)
//   npm run guias -- --quitar="María Gómez"
//
// "contacto" puede ser un teléfono (abre WhatsApp), un mail o una página web.
// --consentimiento es obligatorio: confirma que el guía te autorizó POR ESCRITO a publicar sus datos de contacto
// (el sitio es público; Ley 25.326 de Protección de Datos Personales).

import { readFile, writeFile } from 'node:fs/promises';

const dataDir = new URL('../data/', import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const i = a.indexOf('=');
  return i < 0 ? [a.replace(/^--/, ''), true] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)];
}));
let guides = [];
try {
  guides = JSON.parse(await readFile(new URL('guides.json', dataDir), 'utf8'));
} catch { /* todavía no hay */ }

if (args.lista) {
  console.log(guides.length ? guides.map((g) => `- ${g.name} (${(g.languages || []).join(', ')}) ${g.contact || ''}`).join('\n') : 'No hay guías cargados.');
  process.exit(0);
}
if (args.quitar) {
  const before = guides.length;
  guides = guides.filter((g) => g.name !== args.quitar);
  console.log(before === guides.length ? 'No encontré ese nombre (tiene que ser igual).' : 'Listo, quitado.');
} else {
  if (!args.nombre || !args.contacto) {
    console.error('Uso: npm run guias -- --nombre="María Gómez" --contacto="+5491123456789" --idiomas=es,en --notas="Recorridos a pie"');
    process.exit(1);
  }
  if (!args.consentimiento) {
    console.error('Falta --consentimiento: agregalo SOLO si el guía te autorizó por escrito a publicar su nombre y contacto.');
    process.exit(1);
  }
  guides = guides.filter((g) => g.name !== args.nombre);
  guides.push({
    consent: true,
    name: String(args.nombre),
    contact: String(args.contacto),
    languages: String(args.idiomas || 'es').split(',').map((x) => x.trim()).filter(Boolean),
    notes: String(args.notas || ''),
  });
  console.log(`Listo: ${args.nombre} agregado/a.`);
}
await writeFile(new URL('guides.json', dataDir), JSON.stringify(guides, null, 2) + '\n');
try {
  const meta = JSON.parse(await readFile(new URL('meta.json', dataDir), 'utf8'));
  meta.dataRev = Date.now().toString(36);
  await writeFile(new URL('meta.json', dataDir), JSON.stringify(meta, null, 2) + '\n');
} catch { /* sin meta */ }
