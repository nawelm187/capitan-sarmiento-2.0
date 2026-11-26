// Pinta las casas con el color REAL de su techo, tomado de la imagen satelital (Esri World Imagery).
//
//   npm install            (una sola vez: baja jpeg-js, un decodificador de JPEG)
//   npm run colores        mira cada edificio de data/sarmiento-osm.geojson, baja las fotos satelitales y guarda el color del techo
//   npm run colores -- --solo-aplicar     no baja nada: vuelve a poner los colores ya guardados (útil después de npm run mapa)
//
//   Colores a mano (para la iglesia, la municipalidad, etc.): fuentes/colores-manual.txt
//     latitud, longitud | techo #aabbcc | pared #aabbcc      (cualquiera de los dos colores; el punto tiene que caer dentro del edificio)
//     -34.1712, -59.8431 | techo #8a3b2e | pared #f1e6c8
//   Los colores de OpenStreetMap (roof:colour / building:colour) se respetan siempre.
//
//   Se guarda una memoria en fuentes/colores-techos.json (es tuya: no se pisa al actualizar).
//   Las fotos son de Esri, Maxar, Earthstar Geographics: mantené el crédito en la guía.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const args = process.argv.slice(2);
const soloAplicar = args.includes('--solo-aplicar');
const plantilla = (args.find((a) => a.startsWith('--tiles=')) || '').slice(8) || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const Z = Number((args.find((a) => a.startsWith('--zoom=')) || '').slice(7)) || 19;

const GJ = new URL('data/sarmiento-osm.geojson', root);
if (!existsSync(GJ)) { console.log('No encuentro data/sarmiento-osm.geojson: corré primero npm run osm (o npm run mapa).'); process.exit(0); }
const gj = JSON.parse(await readFile(GJ, 'utf8'));
const MEM = new URL('fuentes/colores-techos.json', root);
const mem = existsSync(MEM) ? JSON.parse(await readFile(MEM, 'utf8')) : {};
const clave = (ring) => `${ring[0][0].toFixed(5)},${ring[0][1].toFixed(5)}`;
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const dentro = (x, y, ring) => { let d = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d; } return d; };
const edificios = [];
gj.features.forEach((f) => { if (f.properties?.kind !== 'building') return; const g = f.geometry; const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null; if (ring?.length >= 4) edificios.push({ f, ring }); });

// ---- Colores sacados de la foto satelital ----
const px = (lng, z) => ((lng + 180) / 360) * 2 ** z;
const py = (lat, z) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z; };
const tiles = new Map();
let jpeg = null;
async function tile(x, y) {
  const k = `${x}/${y}`;
  if (!tiles.has(k)) {
    tiles.set(k, (async () => {
      try {
        const r = await fetch(plantilla.replace('{z}', Z).replace('{x}', x).replace('{y}', y));
        if (!r.ok) return null;
        return jpeg.decode(Buffer.from(await r.arrayBuffer()), { useTArray: true, formatAsRGBA: true });
      } catch { return null; }
    })());
  }
  return tiles.get(k);
}
async function colorTecho(ring) {
  const xs = ring.map((p) => px(p[0], Z) * 256), ys = ring.map((p) => py(p[1], Z) * 256);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pts = ring.map((p, i) => [xs[i], ys[i]]);
  const w = x1 - x0, h = y1 - y0;
  const paso = Math.max(1, Math.sqrt((w * h) / 300));
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const muestras = [];
  for (let y = y0 + paso / 2; y < y1; y += paso) for (let x = x0 + paso / 2; x < x1; x += paso) {
    // Solo el centro del edificio (70 %): los bordes son paredes, sombras o el patio.
    const ex = cx + (x - cx) / 0.7, ey = cy + (y - cy) / 0.7;
    if (!dentro(ex, ey, pts)) continue;
    const t = await tile(Math.floor(x / 256), Math.floor(y / 256));
    if (!t) continue;
    const i = ((Math.floor(y % 256) * 256) + Math.floor(x % 256)) * 4;
    muestras.push([t.data[i], t.data[i + 1], t.data[i + 2]]);
  }
  if (muestras.length < 4) return null;
  const buenas = muestras.filter(([r, g, b]) => {
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    const verde = g > r * 1.08 && g > b * 1.08; // árboles que tapan el techo
    return l > 45 && !verde;
  });
  if (buenas.length < Math.max(4, muestras.length * 0.3)) return null;
  const med = (c) => { const v = buenas.map((m) => m[c]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  // Las fotos satelitales salen algo lavadas: un poco más de contraste y saturación.
  let [r, g, b] = [med(0), med(1), med(2)];
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  [r, g, b] = [r, g, b].map((v) => l + (v - l) * 1.18).map((v) => (v - 128) * 1.06 + 128);
  return hex(r, g, b);
}

let nuevos = 0, sinDato = 0;
if (!soloAplicar) {
  try { jpeg = (await import('jpeg-js')).default; } catch { console.log('Falta jpeg-js. Corré una vez:  npm install   y después  npm run colores'); process.exit(0); }
  const pend = edificios.filter((e) => !e.f.properties.rc && !(clave(e.ring) in mem));
  console.log(`${edificios.length} edificios; ${pend.length} sin color todavía. Bajando fotos satelitales…`);
  let n = 0;
  for (const e of pend) {
    const c = await colorTecho(e.ring);
    mem[clave(e.ring)] = c; // null = no se pudo (árboles, sombra); no se vuelve a intentar
    c ? nuevos++ : sinDato++;
    if (++n % 200 === 0) { console.log(`  ${n}/${pend.length}`); await writeFile(MEM, JSON.stringify(mem)); }
  }
  if (!tiles.size && pend.length) console.log('⚠ No se pudo bajar ninguna foto (¿sin internet o bloqueado?). Probá de nuevo más tarde.');
  await writeFile(MEM, JSON.stringify(mem));
}
// ---- A mano ----
const MAN = new URL('fuentes/colores-manual.txt', root);
if (!existsSync(MAN)) await writeFile(MAN, '# Colores a mano para edificios puntuales (iglesia, municipalidad, tu casa…):\n#   latitud, longitud | techo #aabbcc | pared #aabbcc\n#   -34.1712, -59.8431 | techo #8a3b2e | pared #f1e6c8\n# El punto tiene que caer dentro del edificio. Después: npm run colores -- --solo-aplicar\n');
const manual = [];
for (const l of (await readFile(MAN, 'utf8')).split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith('#'))) {
  const [ll, ...resto] = l.split('|').map((x) => x.trim());
  const m = ll.match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);
  const techo = resto.map((x) => x.match(/^techo\s+(#[0-9a-f]{6})$/i)).find(Boolean)?.[1];
  const pared = resto.map((x) => x.match(/^pared\s+(#[0-9a-f]{6})$/i)).find(Boolean)?.[1];
  if (!m || (!techo && !pared)) { console.log(`  ✗ no entendí: "${l.slice(0, 60)}"`); continue; }
  manual.push({ lat: +m[1], lng: +m[2], techo, pared });
}
let puestos = 0, manuales = 0;
for (const e of edificios) {
  const p = e.f.properties;
  const c = mem[clave(e.ring)];
  if (c && !p.rc) { p.rc = c; puestos++; }
}
for (const mn of manual) {
  const e = edificios.find((x) => dentro(mn.lng, mn.lat, x.ring));
  if (!e) { console.log(`  ✗ ${mn.lat}, ${mn.lng}: no cae dentro de ningún edificio`); continue; }
  if (mn.techo) e.f.properties.rc = mn.techo;
  if (mn.pared) e.f.properties.wc = mn.pared;
  manuales++;
}
await writeFile(GJ, JSON.stringify(gj));
try { const mu = new URL('data/meta.json', root); const meta = JSON.parse(await readFile(mu, 'utf8')); meta.dataRev = Date.now().toString(36); await writeFile(mu, JSON.stringify(meta, null, 2) + '\n'); } catch { /* sin meta */ }
console.log(`Listo: ${puestos} techos con color de la foto satelital (${nuevos} nuevos, ${sinDato} sin dato por árboles o sombra), ${manuales} a mano.`);
