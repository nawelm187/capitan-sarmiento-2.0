// Validación del proyecto (sin dependencias). Corre con:  npm run check
// Revisa sintaxis, imports, JSON, referencias entre datos, rutas relativas (GitHub Pages),
// versiones y archivos del service worker. Sale con código 1 si hay errores.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const readText = (p) => readFile(path.join(ROOT, p), 'utf8');
const readJSON = async (p) => {
  try {
    return JSON.parse(await readText(p));
  } catch (e) {
    err(`${p}: JSON inválido (${e.message})`);
    return null;
  }
};

// ---------- 1. JavaScript: sintaxis e imports ----------
const jsDir = path.join(ROOT, 'js');
const jsFiles = (await readdir(jsDir)).filter((f) => f.endsWith('.js')).map((f) => path.join(jsDir, f));
const toolFiles = (await readdir(path.join(ROOT, 'tools'))).filter((f) => f.endsWith('.mjs')).map((f) => path.join(ROOT, 'tools', f));
for (const f of [...jsFiles, ...toolFiles, path.join(ROOT, 'sw.js')]) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    err(`${rel(f)}: error de sintaxis\n${String(e.stderr).split('\n').slice(0, 4).join('\n')}`);
  }
}

function exportsOf(src) {
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) m[1].split(',').forEach((s) => names.add(s.trim().split(/\s+as\s+/).pop()));
  return names;
}
const sources = new Map();
for (const f of [...jsFiles, ...toolFiles]) sources.set(f, await readFile(f, 'utf8'));
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

for (const [file, raw] of sources) {
  if (file.endsWith('check.mjs')) continue; // este archivo contiene los patrones que busca
  const src = stripComments(raw);
  for (const m of src.matchAll(/import\s+(?:([\w*$\s,{}]+?)\s+from\s+)?['"]([^'"]+)['"]/g)) {
    const [, clause, spec] = m;
    if (!spec.startsWith('.')) {
      if (!/^three(\/addons\/.*)?$/.test(spec) && !/^node:/.test(spec) && spec !== 'osmtogeojson') err(`${rel(file)}: import desconocido "${spec}"`);
      continue;
    }
    const target = path.resolve(path.dirname(file), spec);
    if (!existsSync(target)) {
      err(`${rel(file)}: import "${spec}" no existe`);
      continue;
    }
    const named = clause?.match(/\{([^}]*)\}/)?.[1];
    if (named && sources.has(target)) {
      const have = exportsOf(sources.get(target));
      for (const n of named.split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
        if (!have.has(n)) err(`${rel(file)}: "${n}" no se exporta desde ${spec}`);
      }
    }
  }
  // GitHub Pages sirve el sitio en una subcarpeta: nada de rutas que empiecen con "/"
  if (/fetch\(\s*['"`]\//.test(src) || /import\([`'"]\//.test(src)) err(`${rel(file)}: ruta absoluta "/..." (usá rutas relativas)`);
}

// ---------- 2. HTML, manifest y service worker ----------
const html = await readText('index.html');
for (const m of html.matchAll(/(?:src|href|content)="([^"#]+)"/g)) {
  const u = m[1];
  if (/^(https?:|data:|mailto:|tel:)/.test(u) || !/\.(js|css|png|jpg|webmanifest|json|svg|ico)$/.test(u)) continue;
  if (u.startsWith('/')) err(`index.html: ruta absoluta "${u}"`);
  else if (!existsSync(path.join(ROOT, u))) err(`index.html: falta el archivo "${u}"`);
}
const manifest = await readJSON('manifest.webmanifest');
for (const ic of manifest?.icons ?? []) if (!existsSync(path.join(ROOT, ic.src))) err(`manifest: falta ${ic.src}`);
if (manifest && (manifest.start_url?.startsWith('/') || manifest.scope?.startsWith('/'))) err('manifest: start_url/scope deben ser relativos ("./")');

const sw = await readText('sw.js');
const coreList = sw.match(/const CORE_FILES = \[([\s\S]*?)\];/)?.[1] ?? '';
for (const m of coreList.matchAll(/'([^']+)'/g)) {
  if (m[1] !== './' && !existsSync(path.join(ROOT, m[1]))) err(`sw.js: CORE_FILES incluye "${m[1]}" que no existe`);
}
for (const f of jsFiles) {
  if (!coreList.includes(`'js/${path.basename(f)}'`)) warn(`sw.js: js/${path.basename(f)} no está en CORE_FILES (no se guardará para uso sin conexión)`);
}

// ---------- 3. Versiones ----------
const ver = (await readText('VERSION')).trim();
const pkgVer = (await readJSON('package.json'))?.version;
const meta = await readJSON('data/meta.json');
const swVer = sw.match(/const VERSION = '([^']*)'/)?.[1];
for (const [n, v] of [['package.json', pkgVer], ['data/meta.json', meta?.version], ['sw.js', swVer]]) {
  if (v !== ver) err(`versión: ${n} dice "${v}" pero VERSION dice "${ver}" (usá npm run bump)`);
}

// ---------- 4. Datos ----------
const places = (await readJSON('data/places.json')) ?? [];
const tours = (await readJSON('data/tours.json')) ?? [];
const guides = (await readJSON('data/guides.json')) ?? [];
const landmarks = (await readJSON('data/landmarks.json')) ?? { items: [] };
const casonas = (await readJSON('data/casonas.json')) ?? { items: [] };
const mascots = (await readJSON('data/mascots.json')) ?? { items: [] };
const gj = await readJSON('data/sarmiento-osm.geojson');

const CATS = new Set(['comer', 'dormir', 'ver', 'servicios']);
const half = meta?.osm?.halfSizeMeters ?? 2000;
const { setCenter, toLocal, toLngLat } = await import(pathToFileURL(path.join(ROOT, 'js/geo.js')).href);
const { buildPath, sample } = await import(pathToFileURL(path.join(ROOT, 'js/route.js')).href);
const { mulberry32 } = await import(pathToFileURL(path.join(ROOT, 'js/util.js')).href);
if (meta?.center) setCenter(meta.center);

const ids = new Set();
for (const p of places) {
  if (!p.id) err(`places.json: lugar sin id (${p.name})`);
  else if (ids.has(p.id)) err(`places.json: id repetido "${p.id}"`);
  ids.add(p.id);
  if (!p.name) err(`places.json: "${p.id}" sin nombre`);
  if (!CATS.has(p.category)) err(`places.json: "${p.id}" categoría inválida "${p.category}"`);
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) err(`places.json: "${p.id}" sin lat/lng numéricos`);
  else {
    const l = toLocal(p.lng, p.lat);
    if (Math.abs(l.x) > half || Math.abs(l.z) > half) warn(`places.json: "${p.id}" está fuera del mapa (${Math.round(l.x)}, ${Math.round(l.z)} m)`);
  }
  for (const k of ['web', 'reviewsUrl', 'googleMapsUrl']) if (p[k] && !/^https?:\/\//.test(p[k])) err(`places.json: "${p.id}".${k} debe empezar con http(s)://`);
}
const tourIds = new Set();
for (const t of tours) {
  if (tourIds.has(t.id)) err(`tours.json: id repetido "${t.id}"`);
  tourIds.add(t.id);
  if (!['walk', 'car'].includes(t.mode)) err(`tours.json: "${t.id}" mode debe ser walk o car`);
  if (!Array.isArray(t.stops) || t.stops.length < 2) err(`tours.json: "${t.id}" necesita al menos 2 paradas`);
  for (const s of t.stops ?? []) if (!ids.has(s.placeId)) err(`tours.json: "${t.id}" usa el lugar inexistente "${s.placeId}"`);
}
guides.forEach((g, i) => {
  if (!g.name) err(`guides.json[${i}]: falta name`);
  if (g.consent !== true) err(`guides.json[${i}] (${g.name}): falta "consent": true. No publiques datos de contacto sin consentimiento por escrito.`);
});
const KINDS = new Set(['plaza', 'iglesia', 'estacion', 'tanque', 'silo']);
for (const it of landmarks.items) {
  if (!it.model && !KINDS.has(it.kind)) err(`landmarks.json: "${it.id}" kind desconocido "${it.kind}" (y no tiene model)`);
  if (!Number.isFinite(it.lat) || !Number.isFinite(it.lng)) err(`landmarks.json: "${it.id}" sin lat/lng`);
  if (it.model && !existsSync(path.join(ROOT, it.model))) err(`landmarks.json: falta el modelo ${it.model}`);
}
for (const it of casonas.items) {
  if (!Number.isFinite(it.lat) || !Number.isFinite(it.lng)) err(`casonas.json: "${it.id}" sin lat/lng`);
  if (it.model && !existsSync(path.join(ROOT, it.model))) err(`casonas.json: falta el modelo ${it.model}`);
}
for (const it of mascots.items) {
  if (!['perro', 'caballo', 'auto'].includes(it.type)) err(`mascots.json: "${it.id}" type desconocido "${it.type}"`);
  if (it.model && !existsSync(path.join(ROOT, it.model))) err(`mascots.json: falta el modelo ${it.model}`);
}
if (gj) {
  if (gj.type !== 'FeatureCollection' || !Array.isArray(gj.features)) err('sarmiento-osm.geojson: no es un FeatureCollection');
  else {
    const c = {};
    for (const f of gj.features) c[f.properties?.kind] = (c[f.properties?.kind] || 0) + 1;
    if (!c.building) warn('sarmiento-osm.geojson: no tiene edificios');
    if (!c.road) warn('sarmiento-osm.geojson: no tiene calles');
  }
}
if (meta?.demoContent) warn('data/meta.json: demoContent=true. Todavía hay contenido de ejemplo; cuando lo reemplaces poné demoContent=false.');
const mapBytes = existsSync(path.join(ROOT, 'data/sarmiento-osm.geojson')) ? (await readText('data/sarmiento-osm.geojson')).length : 0;
if (mapBytes > 8e6) warn(`sarmiento-osm.geojson pesa ${(mapBytes / 1e6).toFixed(1)} MB: reducí --half para que cargue rápido en celulares.`);

// ---------- 5. Pruebas de lógica pura ----------
const test = (name, ok, detail = '') => {
  if (!ok) err(`prueba "${name}" falló ${detail}`);
};
{
  const p = toLngLat(123.4, -567.8);
  const q = toLocal(p.lng, p.lat);
  test('geo: ida y vuelta', Math.abs(q.x - 123.4) < 1e-6 && Math.abs(q.z + 567.8) < 1e-6, JSON.stringify(q));
  const east = toLocal(meta.center.lng + 0.001, meta.center.lat);
  const north = toLocal(meta.center.lng, meta.center.lat + 0.001);
  test('geo: este = +x, norte = -z', east.x > 0 && Math.abs(east.z) < 1e-9 && north.z < 0 && Math.abs(north.x) < 1e-9);
  test('geo: 0.001° de latitud ≈ 111 m', Math.abs(-north.z - 110.9) < 1.5, String(-north.z));

  const path1 = buildPath([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }]);
  test('route: largo', Math.abs(path1.len - 20) < 1e-9);
  const s = sample(path1, 15);
  test('route: sample', Math.abs(s.x - 10) < 1e-9 && Math.abs(s.z - 5) < 1e-9 && s.tz === 1);
  const s0 = sample(path1, -5);
  const s1 = sample(path1, 999);
  test('route: límites', s0.x === 0 && s1.z === 10);

  const a = mulberry32(5);
  const b = mulberry32(5);
  test('util: mulberry32 determinístico', a() === b() && a() === b());
}

// ---------- Resultado ----------
for (const w of warnings) console.log(`⚠  ${w}`);
for (const e of errors) console.log(`✗  ${e}`);
console.log(`\n${errors.length ? 'FALLÓ' : 'OK'}: ${errors.length} errores, ${warnings.length} avisos · ${jsFiles.length} módulos JS · ${places.length} lugares · ${tours.length} recorridos`);
process.exit(errors.length ? 1 : 0);
