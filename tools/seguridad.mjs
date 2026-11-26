// Revisa la seguridad básica del sitio estático: npm run seguridad
//  - CSP presente y sin hosts desconocidos
//  - enlaces target=_blank con rel="noopener"
//  - claves/secretos pegados por error en archivos
//  - archivos privados que se publicarían con `git add .`
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const raiz = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PERMITIDOS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'gc.zgo.at', 'goatcounter.com', 'api.open-meteo.com', 'open-meteo.com', 'wa.me', 'www.google.com', 'google.com', 'maps.google.com', 'tile.openstreetmap.org', 'openstreetmap.org', 'server.arcgisonline.com', 's2maps.eu', 'nawelm187.github.io', 'github.com', 'farmaciasdeturnohoy.site', 'www.smn.gob.ar', 'smn.gob.ar', 'www.w3.org', 'overpass-api.de', 'schema.org', 'ogp.me', 'maps.app.goo.gl', 'www.openstreetmap.org', 'www.instagram.com', 'www.facebook.com', 'wa.me', 'www.youtube.com', 'youtu.be', 'fontawesome.com', 'unpkg.com', 'gsap.com', 'greensock.com'];
const SECRETOS = [/AKIA[0-9A-Z]{16}/, /ghp_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{30,}/, /sk-[A-Za-z0-9]{32,}/, /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, /AIza[0-9A-Za-z_-]{35}/, /xox[bp]-[A-Za-z0-9-]{20,}/];
const SALTAR = new Set(['node_modules', '.git', 'data', 'respaldos', 'models', 'textures', 'img', 'icons', 'qr']);
const TEXTO = new Set(['.js', '.mjs', '.html', '.css', '.json', '.md', '.txt', '.yml', '.yaml', '.webmanifest']);

let problemas = 0, avisos = 0;
const mal = (m) => { problemas++; console.log('❌ ' + m); };
const aviso = (m) => { avisos++; console.log('⚠️  ' + m); };

async function* archivos(dir) {
  for (const n of await readdir(dir)) {
    if (SALTAR.has(n)) continue;
    const p = join(dir, n);
    const s = await stat(p);
    if (s.isDirectory()) yield* archivos(p);
    else yield p;
  }
}

const index = await readFile(join(raiz, 'index.html'), 'utf8');
const csp = index.match(/Content-Security-Policy"\s+content="([^"]+)"/);
if (!csp) mal('index.html no tiene Content-Security-Policy.');
else {
  if (/object-src 'none'/.test(csp[1]) === false) mal("La CSP no bloquea object-src.");
  if (/default-src 'self'/.test(csp[1]) === false) mal("La CSP no tiene default-src 'self'.");
  for (const h of csp[1].match(/https:\/\/[a-z0-9.*-]+/gi) || []) {
    const host = h.replace('https://', '');
    if (!PERMITIDOS.some((x) => host === x || host.endsWith('.' + x))) mal(`La CSP permite un host desconocido: ${host}`);
  }
}

let n = 0;
for await (const f of archivos(raiz)) {
  if (!TEXTO.has(extname(f))) continue;
  n++;
  const t = await readFile(f, 'utf8');
  const rel = f.slice(raiz.length);
  for (const re of SECRETOS) if (re.test(t)) mal(`Posible clave secreta en ${rel}`);
  if (extname(f) === '.html' || extname(f) === '.js') {
    for (const m of t.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) if (!/rel="[^"]*noopener/.test(m[0])) aviso(`Enlace target=_blank sin rel="noopener" en ${rel}`);
    for (const m of t.matchAll(/(?:src|href)=["'](http:\/\/[^"']+)/g)) if (!/localhost|w3\.org/.test(m[1])) aviso(`Enlace sin https en ${rel}: ${m[1]}`);
  }
}

for (const priv of ['fuentes/sugerencias.txt', 'fuentes/perdidos.txt', 'fuentes/opiniones.txt']) {
  try {
    await stat(join(raiz, priv));
    const g = await readFile(join(raiz, '.gitignore'), 'utf8').catch(() => '');
    if (!g.includes(priv)) aviso(`${priv} se publica con «git add .». Si tiene teléfonos de vecinos que no querés mostrar, agregalo a .gitignore.`);
  } catch {}
}

console.log(`\nRevisé ${n} archivos. ${problemas} problema(s), ${avisos} aviso(s).`);
console.log(problemas ? 'Corregí lo marcado con ❌ antes de publicar.' : '✅ Sin problemas graves.');
process.exit(problemas ? 1 : 0);
