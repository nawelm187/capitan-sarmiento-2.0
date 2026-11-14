// Busca la ubicación de los lugares "sin dibujar" por su dirección, con Nominatim (el buscador de OpenStreetMap).
//
//   npm run geocodificar
//
// Criterio estricto (así no se inventan ubicaciones): solo se acepta un resultado si OpenStreetMap tiene
// esa CASA con ese número exacto, dentro del área del mapa. Calles sin número, esquinas ("X y Y"), "s/n",
// rutas con km y resultados que son solo la calle se descartan y el lugar queda pendiente.
// Lo encontrado se guarda en fuentes/geocodificados.txt (se puede borrar una línea si un pin queda mal) y se
// vuelve a armar el mapa. Necesita internet. Respeta el límite de Nominatim: 1 consulta por segundo.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setCenter, toLngLat } from '../js/geo.js';

const dataDir = new URL('../data/', import.meta.url);
const outFile = new URL('../fuentes/geocodificados.txt', import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).map((a) => [a.replace(/^--/, '').split('=')[0], a.includes('=') ? a.split('=')[1] : true]));

const meta = JSON.parse(await readFile(new URL('meta.json', dataDir), 'utf8'));
setCenter(meta.center);
const half = meta.osm?.halfSizeMeters ?? 2000;
const sw = toLngLat(-half, half);
const ne = toLngLat(half, -half);
const viewbox = `${sw.lng},${ne.lat},${ne.lng},${sw.lat}`; // izquierda, arriba, derecha, abajo
const pend = JSON.parse(await readFile(new URL('pendientes.json', dataDir), 'utf8').catch(() => '[]'));
const done = existsSync(outFile) ? await readFile(outFile, 'utf8') : '';

const expand = (s) => s
  .replace(/\bAv\.?\s/gi, 'Avenida ').replace(/\bPte\.?\s/gi, 'Presidente ').replace(/\bBv\.?\s/gi, 'Bulevar ')
  .replace(/\bGral\.?\s/gi, 'General ').replace(/\bDomingo F\.\s/gi, 'Domingo Faustino ').replace(/\bL\. N\.\s/gi, 'Leandro N. ')
  .replace(/\bJ\. D\.\s/gi, 'Juan Domingo ').replace(/\bA\.\s(?=[A-Z])/g, 'A. ');
// "Av. Roque Sáenz Peña 598" → { calle, numero }; null si no hay una casa concreta
function parse(address) {
  const a = String(address || '').split(/;|\/|\(/)[0].trim();
  if (!a || /\bs\/n\b|\bkm\b|\bRN\b|\bruta\b|\besquina\b|\bcruce\b|\bcentro\b|\bentre\b|\bzona\b| y /i.test(a)) return null;
  const m = /^(.*?)[\s,]+(\d{1,5})$/.exec(a);
  return m ? { calle: expand(m[1].trim()), numero: m[2] } : null;
}
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const todo = pend.filter((q) => !q.outside && !q.verify && q.address && !done.includes(`\n${q.name} |`) && parse(q.address));
console.log(`Direcciones para probar: ${todo.length} (de ${pend.length} lugares sin dibujar). Tarda ~${Math.ceil(todo.length * 1.2 / 60)} min.`);
if (!todo.length) process.exit(0);

let found = 0;
const lines = [];
for (const q of todo) {
  const { calle, numero } = parse(q.address);
  const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
    format: 'jsonv2', addressdetails: '1', limit: '5', countrycodes: 'ar', bounded: '1', viewbox,
    street: `${numero} ${calle}`, city: meta.town || 'Capitán Sarmiento', state: 'Buenos Aires',
  });
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'guia-sarmiento/1.0 (proyecto personal sin fines de lucro)', 'accept-language': 'es' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const hits = await res.json();
    const hit = hits.find((h) => String(h.address?.house_number || '').trim() === numero && norm(h.address?.road || '').includes(norm(calle).split(' ').slice(-1)[0]));
    if (hit && Number.isFinite(Number(hit.lat))) {
      const lat = Math.round(Number(hit.lat) * 1e6) / 1e6;
      const lng = Math.round(Number(hit.lon) * 1e6) / 1e6;
      lines.push(`${q.name} | ${q.type} | ${lat}, ${lng} | ${q.address} | GEOCODIFICADO por dirección (OpenStreetMap): verificar el pin`);
      found++;
      console.log(`  ✔ ${q.name}  →  ${lat}, ${lng}`);
    } else console.log(`  · ${q.name}: OpenStreetMap no tiene esa casa (${q.address})`);
  } catch (e) {
    console.warn(`  ⚠ ${q.name}: ${e.message}`);
    if (/429|403/.test(e.message)) {
      console.warn('Nominatim pidió frenar. Esperá unos minutos y volvé a correr: lo ya encontrado se conserva.');
      break;
    }
  }
  await sleep(Number(process.env.SLEEP ?? 1200));
}
if (lines.length) {
  if (!existsSync(outFile)) await writeFile(outFile, '# Ubicaciones encontradas por dirección con OpenStreetMap (npm run geocodificar). Borrá una línea si su pin queda mal.\n');
  await appendFile(outFile, lines.join('\n') + '\n');
}
console.log(`\nEncontrados: ${found} de ${todo.length}. El resto sigue pendiente (se carga con el link de Google Maps en fuentes/lugares-extra.txt).`);
if (found && !args['sin-lugares']) {
  console.log('\nArmando el mapa con las ubicaciones nuevas…');
  execFileSync(process.execPath, [fileURLToPath(new URL('./lugares.mjs', import.meta.url))], { stdio: 'inherit' });
}
