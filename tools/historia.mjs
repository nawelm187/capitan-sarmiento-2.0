// Línea del tiempo del pueblo → data/historia.json
//
//   fuentes/historia.txt   una línea por hecho:
//     Año | Título | Texto | foto (opcional)
//     1902 | Llega el ferrocarril | Se inaugura la estación... | estacion-1902.jpg
//   Las fotos van en la carpeta fuentes/historia/ (jpg, png o webp, livianas). Se copian solas a img/historia/.
//
// Después:  npm run historia
import { readFile, writeFile, copyFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const F = new URL('fuentes/historia.txt', root);
await mkdir(new URL('fuentes/historia/', root), { recursive: true });
if (!existsSync(F)) {
  await writeFile(F, '# Línea del tiempo. Una línea por hecho:\n#   Año | Título | Texto | foto (opcional, está en fuentes/historia/)\n#   1902 | Llega el ferrocarril | Se inaugura la estación. | estacion-1902.jpg\n# Escribí solo hechos que puedas confirmar (archivo municipal, museo, vecinos mayores).\n');
  console.log('Creé fuentes/historia.txt con un ejemplo comentado. Cargá tus hechos y volvé a correr: npm run historia');
}
const slug = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const lines = (await readFile(F, 'utf8')).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const items = [];
await mkdir(new URL('img/historia/', root), { recursive: true });
for (const l of lines) {
  const [anio = '', titulo = '', texto = '', foto = ''] = l.split('|').map((x) => x.trim());
  if (!/^\d{3,4}$/.test(anio) || !titulo) { console.log(`  ✗ "${l.slice(0, 60)}": tiene que empezar con un año (ej. 1902) y tener título`); continue; }
  let photo = '';
  if (foto) {
    const src = new URL(`fuentes/historia/${foto}`, root);
    if (/^[\w\- .()áéíóúñÁÉÍÓÚÑ]+\.(jpe?g|png|webp)$/i.test(foto) && existsSync(src)) {
      const name = `${anio}-${slug(titulo)}${foto.slice(foto.lastIndexOf('.')).toLowerCase()}`;
      await copyFile(src, new URL(`img/historia/${name}`, root));
      photo = `img/historia/${name}`;
      if ((await stat(src)).size > 500000) console.log(`  ! ${foto} pesa mucho; conviene achicarla (npm run fotos).`);
    } else console.log(`  ! "${titulo}": no encuentro la foto "${foto}" en fuentes/historia/`);
  }
  items.push({ anio: Number(anio), titulo, ...(texto ? { texto } : {}), ...(photo ? { foto: photo } : {}) });
}
items.sort((a, b) => a.anio - b.anio);
await mkdir(new URL('data/', root), { recursive: true });
await writeFile(new URL('data/historia.json', root), JSON.stringify(items, null, 2) + '\n');
try {
  const mu = new URL('data/meta.json', root);
  const meta = JSON.parse(await readFile(mu, 'utf8'));
  meta.dataRev = Date.now().toString(36);
  await writeFile(mu, JSON.stringify(meta, null, 2) + '\n');
} catch { /* sin meta */ }
console.log(`${items.length} hecho(s) en data/historia.json`);
