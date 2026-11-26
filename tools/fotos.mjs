// Pone fotos a los lugares.
//
//   Fotos comunes → carpeta  fuentes/fotos/     (jpg, png o webp)
//   Fotos 360°    → carpeta  fuentes/fotos360/  (foto esférica "equirectangular": de la app Google Maps → Street View/Photo Sphere, o de una cámara 360)
//   El nombre del archivo tiene que parecerse al del lugar: "Panadería La Esquina.jpg", "plaza.jpg"…
//   Después corré:  npm run fotos
//
// Copia las fotos a img/lugares/ (o img/360/) y las asocia al lugar (campos "photo" y "pano" de data/places.json).
// Si tenés instalado "sharp" (npm i sharp) las achica solas a 1400 px (360°: 4096 px) para que la guía cargue rápido.
import { readFile, writeFile, readdir, mkdir, copyFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* sin sharp: se copian tal cual */ }

const places = JSON.parse(await readFile(new URL('data/places.json', root), 'utf8'));
let total = 0, hayCarpeta = false;

async function procesar(carpeta, salida, campo, ancho) {
  const dir = new URL(`fuentes/${carpeta}/`, root);
  let files = [];
  try { files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)); hayCarpeta = true; } catch { await mkdir(dir, { recursive: true }); }
  if (!files.length) return;
  await mkdir(new URL(`${salida}/`, root), { recursive: true });
  for (const f of files) {
    const base = norm(f.replace(/\.[^.]+$/, ''));
    const hit = places.find((p) => norm(p.id) === base) || places.find((p) => norm(p.name) === base) || places.find((p) => base.length > 3 && (norm(p.name).includes(base) || base.includes(norm(p.name))));
    if (!hit) { console.log(`  ✗ ${carpeta}/${f}: no encuentro ningún lugar con ese nombre`); continue; }
    const src = new URL(f, dir);
    const id = hit.id.replace(/[^\w-]/g, '_');
    let name = `${id}${extname(f).toLowerCase()}`;
    let nota = '';
    if (sharp) {
      try {
        name = `${id}.jpg`;
        await sharp(fileURLToPath(src)).rotate().resize({ width: ancho, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(fileURLToPath(new URL(`${salida}/${name}`, root)));
        nota = `  (achicada, ${Math.round((await stat(new URL(`${salida}/${name}`, root))).size / 1024)} KB)`;
      } catch (e) {
        name = `${id}${extname(f).toLowerCase()}`;
        await copyFile(src, new URL(`${salida}/${name}`, root));
        nota = '  (copiada sin achicar)';
      }
    } else {
      await copyFile(src, new URL(`${salida}/${name}`, root));
      if ((await stat(src)).size > 500000) nota = '  (pesa mucho: corré «npm i sharp» y volvé a correr npm run fotos para achicarla sola)';
    }
    hit[campo] = `${salida}/${name}`;
    console.log(`  ✓ ${carpeta}/${f} → ${hit.name}${nota}`);
    total++;
  }
}
await procesar('fotos', 'img/lugares', 'photo', 1400);
await procesar('fotos360', 'img/360', 'pano', 4096);
if (!total) {
  if (process.argv.includes('--silencioso')) process.exit(0);
  console.log(hayCarpeta ? 'No hay fotos nuevas.' : '');
  console.log('Copiá las fotos a fuentes/fotos/ (comunes) o fuentes/fotos360/ (360°) con el nombre del lugar y volvé a correr: npm run fotos');
  process.exit(0);
}
await writeFile(new URL('data/places.json', root), JSON.stringify(places, null, 2) + '\n');
const metaUrl = new URL('data/meta.json', root);
const meta = JSON.parse(await readFile(metaUrl, 'utf8'));
meta.dataRev = Date.now().toString(36);
await writeFile(metaUrl, JSON.stringify(meta, null, 2) + '\n');
console.log(`${total} foto(s) asociadas. Ahora: npm run serve  (Ctrl+F5)`);
