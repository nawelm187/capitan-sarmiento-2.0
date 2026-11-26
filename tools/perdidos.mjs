// Mascotas y objetos perdidos o encontrados → data/perdidos.json (la web los muestra en la pestaña «Perdidos»).
//
//   fuentes/perdidos.txt   una línea por aviso, separada con |
//     estado | tipo | nombre | descripción | zona | fecha | contacto | recompensa | info | foto
//     perdido | mascota | Toby | Perro marrón con collar rojo | Barrio Centro | 2026-11-20 | 5493364123456 | $50.000 | Es muy manso | toby.jpg
//
//   · estado: perdido o encontrado      · tipo: mascota u objeto
//   · fecha: AAAA-MM-DD (el aviso se borra solo a los 30 días)
//   · recompensa, info y foto son OPCIONALES (dejalos vacíos si no hay)
//   · foto: copiá la imagen a la carpeta fuentes/fotos/ y poné el nombre del archivo
//
// Después:  npm run perdidos      (es un archivo tuyo: las actualizaciones no lo pisan)
//
// Cuando alguien te manda el aviso por WhatsApp, la última línea («PERDIDO: …») se pega tal cual en el archivo.
import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const F = new URL('fuentes/perdidos.txt', root);
if (!existsSync(F)) {
  await writeFile(F, '# Mascotas y objetos perdidos o encontrados. Una línea por aviso:\n#   estado | tipo | nombre | descripción | zona | fecha | contacto | recompensa | info | foto\n#   perdido | mascota | Toby | Perro marrón con collar rojo | Barrio Centro | 2026-11-20 | 5493364123456 | $50.000 | Es muy manso | toby.jpg\n# (recompensa, info y foto son opcionales; el aviso se borra solo a los 30 días)\n');
  console.log('Creé fuentes/perdidos.txt con un ejemplo. Escribí tus avisos ahí y volvé a correr: npm run perdidos');
}
const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
const lines = (await readFile(F, 'utf8')).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const items = [];
let bad = 0;
await mkdir(new URL('img/perdidos/', root), { recursive: true });
for (const l of lines) {
  const l2 = l.replace(/^PERDIDO:\s*/i, '');
  const [estado = '', tipo = '', nombre = '', descripcion = '', zona = '', fecha = '', contacto = '', recompensa = '', info = '', foto = ''] = l2.split('|').map((x) => x.trim());
  const e = estado.toLowerCase(), t = tipo.toLowerCase();
  if (!['perdido', 'encontrado'].includes(e) || !['mascota', 'objeto'].includes(t) || !nombre) { bad++; console.log(`  ✗ "${l.slice(0, 70)}": el estado es perdido/encontrado, el tipo mascota/objeto y el nombre es obligatorio`); continue; }
  const f = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoy;
  if (fecha && f !== fecha) console.log(`  ! "${nombre}": fecha "${fecha}" no es AAAA-MM-DD, puse la de hoy.`);
  let photo = '';
  if (foto) {
    const src = new URL(`fuentes/fotos/${foto}`, root);
    if (/^[\w\- .()áéíóúñÁÉÍÓÚÑ]+\.(jpe?g|png|webp)$/i.test(foto) && existsSync(src)) {
      const name = `${f}-${nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}${foto.slice(foto.lastIndexOf('.')).toLowerCase()}`;
      await copyFile(src, new URL(`img/perdidos/${name}`, root));
      photo = `img/perdidos/${name}`;
      if ((await stat(src)).size > 500000) console.log(`  ! ${foto} pesa mucho; conviene achicarla.`);
    } else console.log(`  ! "${nombre}": no encuentro la foto "${foto}" en fuentes/fotos/`);
  }
  items.push({ id: `${f}-${items.length}`, estado: e, tipo: t, title: nombre, descripcion, zona, fecha: f, contacto, ...(recompensa ? { recompensa } : {}), ...(info ? { info } : {}), ...(photo ? { photo } : {}) });
}
const dias = (a) => Math.round((new Date(hoy + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
const vig = items.filter((x) => dias(x.fecha) <= 30);
await mkdir(new URL('data/', root), { recursive: true });
await writeFile(new URL('data/perdidos.json', root), JSON.stringify(vig, null, 2) + '\n');
try {
  const mu = new URL('data/meta.json', root);
  const meta = JSON.parse(await readFile(mu, 'utf8'));
  meta.dataRev = Date.now().toString(36);
  await writeFile(mu, JSON.stringify(meta, null, 2) + '\n');
} catch { /* sin meta */ }
console.log(`${vig.length} aviso(s) vigentes en data/perdidos.json` + (items.length > vig.length ? ` (${items.length - vig.length} con más de 30 días no se muestran)` : '') + (bad ? ` · ${bad} línea(s) con errores` : ''));
