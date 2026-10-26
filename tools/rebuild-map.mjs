// Arma el mapa completo de una sola vez: baja las calles reales de OpenStreetMap y después suma
// los edificios reales de fuentes/edificios_capitan_sarmiento.geojson.
//
//   npm run mapa                                   (usa el centro guardado en data/meta.json)
//   npm run mapa -- --center=-34.1728,-59.7886     (fija el centro)
//   npm run mapa -- --pois                         (además guarda lugares candidatos)
//
// Todo lo que le pases se reenvía a `npm run osm` (ver tools/fetch-osm.mjs).
// Siempre corré este comando (y no solo `npm run osm`): bajar el mapa borra los edificios importados.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = (...a) => execFileSync(process.execPath, a, { cwd: root, stdio: 'inherit' });
const extra = process.argv.slice(2);

console.log('1/4  Bajando calles reales de OpenStreetMap…');
try {
  run('tools/fetch-osm.mjs', ...extra);
} catch {
  console.error('\nNo se pudo bajar el mapa (probablemente un problema de internet o de Overpass). Esperá un minuto y volvé a correr: npm run mapa');
  process.exit(1);
}

const src = 'fuentes/edificios_capitan_sarmiento.geojson';
if (existsSync(root + src)) {
  console.log('\n2/4  Sumando los edificios reales…');
  run('tools/import-buildings.mjs', src, '--source=Overture Maps Foundation (Google Open Buildings)');
} else {
  console.log(`\n2/4  No encontré ${src}: el mapa queda con los edificios de OpenStreetMap solamente (npm run fill agrega casas aproximadas).`);
}

console.log('\n3/4  Bajando lugares y edificios especiales (iglesias, museo, municipalidad…)…');
try {
  run('tools/lugares.mjs');
} catch {
  console.warn('No se pudieron bajar los lugares (se puede reintentar con: npm run lugares).');
}

console.log('\n4/4  Revisando…');
try {
  run('tools/check.mjs');
} catch {
  console.warn('npm run check informó errores: revisalos arriba.');
}
console.log('\nListo. Probalo con: npm run serve   y si se ve bien: npm run bump -- patch   y subí los cambios.');
