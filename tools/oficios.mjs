// Oficios y servicios (plomero, electricista, remís, gasista…) → data/oficios.json
//
//   fuentes/oficios.txt   una línea por persona o servicio:
//     Rubro | Nombre | Teléfono | Zona (opcional) | Nota (opcional)
//     Plomero | Juan Pérez | 5493364123456 | Centro | Urgencias las 24 h
//
//   ⚠️ Pedile permiso a cada persona antes de publicar su teléfono: la guía es pública.
//   Para WhatsApp poné el número con 549 + código de área + número, sin 0 ni 15.
// Después:  npm run oficios
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const F = new URL('fuentes/oficios.txt', root);
if (!existsSync(F)) {
  await writeFile(F, '# Oficios y servicios. Una línea por persona:\n#   Rubro | Nombre | Teléfono | Zona (opcional) | Nota (opcional)\n#   Plomero | Juan Pérez | 5493364123456 | Centro | Urgencias las 24 h\n# Pedile permiso a cada persona antes de publicar su teléfono.\n');
  console.log('Creé fuentes/oficios.txt con un ejemplo comentado. Cargá los oficios y volvé a correr: npm run oficios');
}
const lines = (await readFile(F, 'utf8')).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const out = [];
for (const l of lines) {
  const [rubro = '', nombre = '', telefono = '', zona = '', nota = ''] = l.split('|').map((x) => x.trim());
  if (!rubro || !nombre || telefono.replace(/\D/g, '').length < 6) { console.log(`  ✗ "${l.slice(0, 60)}": hace falta rubro, nombre y un teléfono válido`); continue; }
  out.push({ rubro, nombre, telefono, ...(zona ? { zona } : {}), ...(nota ? { nota } : {}) });
}
await mkdir(new URL('data/', root), { recursive: true });
await writeFile(new URL('data/oficios.json', root), JSON.stringify(out, null, 2) + '\n');
try {
  const mu = new URL('data/meta.json', root);
  const meta = JSON.parse(await readFile(mu, 'utf8'));
  meta.dataRev = Date.now().toString(36);
  await writeFile(mu, JSON.stringify(meta, null, 2) + '\n');
} catch { /* sin meta */ }
console.log(`${out.length} oficio(s) en data/oficios.json. Recordá: los teléfonos se publican en la web.`);
