// Aplica la actualización 1.1.0 sobre tu proyecto SIN pisar tus datos (data/):
//  - agrega los scripts nuevos a package.json (serve con Node, fill, buildings)
//  - cambia la pantalla de carga de index.html por el logo con progreso circular
//    (respeta lo demás de tu index.html, incluida la URL del sitio)
//  - importa los edificios reales de fuentes/edificios_capitan_sarmiento.geojson (si está)
//  - sube la versión a 1.1.0 y anota el cambio en CHANGELOG.md
//
//   node tools/apply-update.mjs        (se puede correr más de una vez)

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const rd = (p) => readFile(new URL(p, root), 'utf8');
const wr = (p, s) => writeFile(new URL(p, root), s);
const node = (...a) => execFileSync(process.execPath, a, { cwd: rootPath, stdio: 'inherit' });

// 1. package.json
const pkg = JSON.parse(await rd('package.json'));
pkg.scripts = { ...pkg.scripts, serve: 'node tools/serve.mjs', fill: 'node tools/fill-buildings.mjs', mapa: 'node tools/rebuild-map.mjs', buildings: 'node tools/import-buildings.mjs', lugares: 'node tools/lugares.mjs', recorridos: 'node tools/recorridos.mjs', guias: 'node tools/guias.mjs' };
await wr('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('✔ package.json: scripts serve (Node), fill y buildings');

// 2. Pantalla de carga en index.html
const SPLASH = `<div id="splash" role="status" aria-live="polite">
    <div class="splash__inner">
      <div class="splash__logo" id="splash-logo" aria-hidden="true">
        <img class="splash__img splash__img--base" src="img/logo-sarmiento.webp" alt="" width="560" height="560" decoding="async">
        <img class="splash__img splash__img--fill" src="img/logo-sarmiento.webp" alt="" width="560" height="560" decoding="async">
      </div>
      <h2 class="splash__title sr-only" id="splash-title">Capitán Sarmiento</h2>
      <p class="splash__msg" id="splash-msg">Armando la maqueta del pueblo…</p>
      <p class="splash__pct" id="splash-pct">0 %</p>
      <p class="splash__credit">Datos del mapa © colaboradores de OpenStreetMap</p>
    </div>
  </div>`;
let html = await rd('index.html');
if (html.includes('id="splash-logo"')) console.log('✔ index.html: ya tenía la pantalla de carga nueva');
else {
  const a = html.indexOf('<div id="splash"');
  const c = html.indexOf('splash__credit');
  const b = c < 0 ? -1 : html.indexOf('</div>', html.indexOf('</div>', c) + 6) + 6; // cierra splash__inner y splash
  if (a < 0 || b < 6) console.warn('⚠ index.html: no encontré la pantalla de carga; copiala a mano desde README.');
  else {
    await wr('index.html', html.slice(0, a) + SPLASH + html.slice(b));
    console.log('✔ index.html: pantalla de carga con el logo');
  }
}

// 3. ¿Las calles son reales o de ejemplo?
{
  let roads = 0;
  let far = 0;
  try {
    const gj = JSON.parse(await rd('data/sarmiento-osm.geojson'));
    const m0 = JSON.parse(await rd('data/meta.json'));
    for (const f of gj.features) {
      if (f.properties?.kind !== 'road') continue;
      roads++;
      const [lng, lat] = f.geometry.coordinates[0];
      if (Math.abs((lat - m0.center.lat) * 111000) > 800 || Math.abs((lng - m0.center.lng) * 92000) > 800) far++;
    }
  } catch { /* sin datos: se ignora */ }
  if (roads < 80 && !far) {
    console.warn('\n⚠ Tu data/ tiene las calles de EJEMPLO (solo ' + roads + ' calles en una grilla inventada), no las reales de Sarmiento.');
    console.warn('  Corré:  npm run mapa -- --center=-34.1728,-59.7886   (baja las calles reales y suma los edificios)');
    console.warn('  Ojo: los lugares de ejemplo (pines) se borran porque no están en el lugar real.\n');
  }
}

// 3b. Edificios reales
const src = 'fuentes/edificios_capitan_sarmiento.geojson';
if (existsSync(new URL(src, root))) {
  console.log('… importando edificios reales (puede tardar unos segundos)');
  node('tools/import-buildings.mjs', src, '--source=Overture Maps Foundation (Google Open Buildings)');
} else console.log('• No encontré ' + src + ': se omite la importación de edificios.');

// 4. Versión y changelog
const ver = (await rd('VERSION')).trim();
const [A, B] = ver.split('.').map(Number);
const metaNow = JSON.parse(await rd('data/meta.json'));
if (A === 1 && B >= 1 && metaNow.version !== ver) {
  // El zip completo ya trae VERSION y sw.js nuevos: solo falta que los datos lo sepan (renueva la caché de data/).
  metaNow.version = ver;
  metaNow.date = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
  await wr('data/meta.json', JSON.stringify(metaNow, null, 2) + '\n');
  console.log(`✔ data/meta.json: versión ${ver}`);
} else if (A === 1 && B < 1 || A < 1) {
  node('tools/bump-version.mjs', '1.1.0');
  let log = await rd('CHANGELOG.md');
  log = log.replace('- (completá qué cambió)', [
    '- Pantalla de carga con el logo de la ciudad que se colorea en círculo mientras carga.',
    '- Edificios reales de Capitán Sarmiento (Google Open Buildings vía Overture Maps).',
    '- `npm run serve` ahora usa Node (antes pedía `python3`, que no existe en Windows).',
    '- Nuevos `npm run fill` (casas aproximadas) y `npm run buildings` (importar huellas reales).',
    '- Íconos de la app e imagen para compartir con el logo.',
  ].join('\n'));
  await wr('CHANGELOG.md', log);
} else console.log(`• La versión ya es ${ver}; no se cambió.`);

// 5. Lugares y edificios especiales: si todavía no hay ninguno, avisa cómo cargarlos
try {
  const pl = JSON.parse(await rd('data/places.json'));
  if (!pl.length || pl.every((p) => p.demo)) console.log('\n⚠ data/places.json está vacío: por eso no aparecían los puntos de interés.\n  Corré:  npm run lugares   (baja los de OpenStreetMap y arma los edificios especiales)');
} catch { /* sin data/: lo resuelve npm run mapa */ }

console.log('\nListo. Revisá con: npm run check   y   npm run serve');
console.log('Después subí todo a GitHub (git add . / git commit -m "actualización" / git push).');
