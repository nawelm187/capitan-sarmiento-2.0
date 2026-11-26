// Servidor local sin dependencias (funciona igual en Windows, Mac y Linux).
//
//   npm run serve              -> http://localhost:8080
//   npm run serve -- 3000      -> otro puerto
//
// Solo sirve la carpeta del proyecto, en modo lectura.

import { analizar, TIPOS as TIPOS_REV } from './revisar-lib.mjs';
import { execFile } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { appendFile, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 8080;

// ---- Ayudante para ubicar los lugares pendientes (solo desde esta PC): http://localhost:8080/ubicar ----
const FUENTES = path.join(ROOT, 'fuentes');
const clean = (s, max = 160) => String(s ?? '').replace(/[\r\n|]+/g, ' ').trim().slice(0, max);
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const runNode = (script, args = [], timeout = 120000) => new Promise((resolve) => {
  execFile(process.execPath, [path.join(ROOT, 'tools', script), ...args], { cwd: ROOT, timeout, maxBuffer: 4e6 }, (err, out, errOut) => resolve({ ok: !err, out: String(out) + String(errOut) }));
});
const readJson = async (rel, fallback) => JSON.parse(await readFile(path.join(ROOT, rel), 'utf8').catch(() => JSON.stringify(fallback)));
const body = (req) => new Promise((resolve, reject) => {
  let b = '';
  req.on('data', (c) => { b += c; if (b.length > 3e6) req.destroy(); });
  req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { reject(e); } });
});
const json = (res, code, obj) => res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(obj));
const isLocal = (req) => /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || '') && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '');

async function api(req, res, pathname) {
  if (!isLocal(req)) return json(res, 403, { error: 'Solo desde esta PC.' });
  if (pathname === '/api/barrios' && req.method === 'GET') return json(res, 200, await readJson('data/barrios.json', []));
  if (pathname === '/api/pendientes' && req.method === 'GET') {
    const [pend, places] = await Promise.all([readJson('data/pendientes.json', []), readJson('data/places.json', [])]);
    return json(res, 200, { pendientes: pend, ubicados: places.filter((p) => String(p.id).startsWith('extra-')).length });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  const d = await body(req);
  if (pathname === '/api/barrios') {
    const list = Array.isArray(d.barrios) ? d.barrios : null;
    if (!list || list.length > 200) return json(res, 400, { error: 'Datos inválidos.' });
    const num = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
    const out = [];
    for (const b of list) {
      const polygon = (b.polygon || []).filter((p) => Array.isArray(p) && num(p[0], -180, 180) && num(p[1], -90, 90)).map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);
      const name = clean(b.name, 60);
      if (!name || polygon.length < 3 || polygon.length > 2000) continue;
      const item = { id: slug(name) || 'barrio', name, polygon };
      if (/^#[0-9a-f]{6}$/i.test(b.color || '')) item.color = b.color;
      if (b.approx) item.approx = true;
      out.push(item);
    }
    const seen = new Set();
    for (const b of out) { let id = b.id, n = 2; while (seen.has(id)) id = `${b.id}-${n++}`; b.id = id; seen.add(id); }
    await writeFile(path.join(ROOT, 'data', 'barrios.json'), JSON.stringify(out, null, 1) + '\n');
    const mp = path.join(ROOT, 'data', 'meta.json');
    const meta = JSON.parse(await readFile(mp, 'utf8'));
    meta.dataRev = Date.now().toString(36);
    await writeFile(mp, JSON.stringify(meta, null, 2) + '\n');
    return json(res, 200, { ok: true, count: out.length });
  }
  if (pathname === '/api/ubicar') {
    const { TYPES: KINDS } = await import('../js/kinds.js');
    const name = clean(d.name, 120);
    const type = clean(d.type, 40);
    const spec = clean(d.spec, 600);
    if (!name || !KINDS[type] || !spec) return json(res, 400, { error: 'Faltan datos.' });
    const file = path.join(FUENTES, 'lugares-extra.txt');
    const before = existsSync(file) ? await readFile(file, 'utf8') : '';
    const line = `${name} | ${type} | ${spec} | ${clean(d.address)}`;
    const lines = before.split(/\r?\n/);
    // si ya había una línea con ese nombre y sin ubicación, se completa en vez de repetirla
    const i = lines.findIndex((l) => !l.startsWith('#') && slug(l.split('|')[0]) === slug(name) && !(l.split('|')[2] || '').trim());
    if (i >= 0) lines[i] = line; else lines.push(line);
    await writeFile(file, lines.join('\n').replace(/\n*$/, '\n'));
    const r = await runNode('extras.mjs');
    const places = await readJson('data/places.json', []);
    const hit = places.find((p) => p.id === 'extra-' + slug(name));
    if (!hit) { await writeFile(file, before); return json(res, 422, { error: 'No pude sacar la ubicación de ese link. Probá con el link largo de Google Maps o con "lat, lng" (clic derecho sobre el punto → copiar coordenadas).', log: r.out.slice(-400) }); }
    return json(res, 200, { ok: true, lat: hit.lat, lng: hit.lng, moved: /acomod/.test(r.out) });
  }
  if (pathname === '/api/descartar') {
    const name = clean(d.name, 120);
    if (!name) return json(res, 400, { error: 'Falta el nombre.' });
    const file = path.join(FUENTES, 'descartados.txt');
    if (!existsSync(file)) await writeFile(file, '# Lugares que marcaste como "no existe / no va" (se ignoran). Borrá una línea para recuperarlos.\n');
    await appendFile(file, name + '\n');
    await runNode('extras.mjs');
    return json(res, 200, { ok: true });
  }
  if (pathname === '/api/reubicar') {
    const idOk = (x) => /^[\w.:-]{1,80}$/.test(String(x ?? ''));
    const mover = (Array.isArray(d.mover) ? d.mover : []).filter((m) => idOk(m.id) && Math.abs(+m.lat) <= 90 && Math.abs(+m.lng) <= 180 && Number.isFinite(+m.lat) && Number.isFinite(+m.lng)).slice(0, 500);
    const eliminar = (Array.isArray(d.eliminar) ? d.eliminar : []).filter((m) => idOk(m.id)).slice(0, 500);
    const merge = async (name, header, nuevos, fmt) => {
      const file = path.join(FUENTES, name);
      const viejas = existsSync(file) ? (await readFile(file, 'utf8')).split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#')) : [];
      const ids = new Set(nuevos.map((n) => n.id));
      const quedan = viejas.filter((l) => !ids.has(l.split('|')[0].trim()));
      await writeFile(file, header + '\n' + [...quedan, ...nuevos.map(fmt)].join('\n') + '\n');
    };
    await merge('reubicados.txt', '# Lugares que moviste de lugar (id | latitud, longitud | nombre). Borrá una línea para que vuelva a su lugar original.', mover, (m) => `${m.id} | ${(+m.lat).toFixed(6)}, ${(+m.lng).toFixed(6)} | ${clean(m.name, 80)}`);
    await merge('eliminados.txt', '# Lugares que eliminaste de la guía (id | nombre). Borrá una línea para recuperarlos con npm run lugares.', eliminar, (m) => `${m.id} | ${clean(m.name, 80)}`);
    const r = await runNode('reubicar.mjs');
    return json(res, r.ok ? 200 : 500, r.ok ? { ok: true, movidos: mover.length, eliminados: eliminar.length } : { error: r.out.slice(-400) });
  }
  if (pathname === '/api/revisar') {
    const texto = String(d.texto ?? '').slice(0, 200000);
    const items = analizar(texto);
    if (d.accion !== 'aprobar') return json(res, 200, { items });
    const quiero = new Set((Array.isArray(d.indices) ? d.indices : []).map(Number));
    const hechos = []; const tools = new Set();
    for (const [i, it] of items.entries()) {
      if (!quiero.has(i) || !it.valido) continue;
      const cfg = TIPOS_REV[it.tipo];
      const file = path.join(ROOT, cfg.archivo);
      const viejo = existsSync(file) ? await readFile(file, 'utf8') : '';
      if (viejo.split(/\r?\n/).some((l) => l.trim() === it.escribir)) { hechos.push({ i, ya: true }); continue; }
      const extra = it.tipo === 'ERROR' ? `# ${new Date().toISOString().slice(0, 10)}\n` : '';
      await writeFile(file, viejo + (viejo && !viejo.endsWith('\n') ? '\n' : '') + extra + it.escribir + '\n');
      hechos.push({ i, ya: false });
      if (cfg.tool) tools.add(cfg.tool);
    }
    for (const t of tools) await runNode(t, t === 'datos.mjs' ? ['--aplicar'] : []);
    return json(res, 200, { ok: true, hechos, ejecutados: [...tools] });
  }
  if (pathname === '/api/armar') {
    const r = await runNode('lugares.mjs', [], 580000);
    return json(res, r.ok ? 200 : 500, r.ok ? { ok: true } : { error: r.out.slice(-600) });
  }
  return json(res, 404, { error: 'No existe' });
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (rel.startsWith('/api/')) {
      try { return await api(req, res, rel); } catch (e) { return json(res, 500, { error: String(e.message || e) }); }
    }
    if (rel === '/ubicar' || rel === '/ubicar/') rel = '/tools/ubicar.html';
    if (rel === '/revisar' || rel === '/revisar/') rel = '/tools/revisar.html';
    if (rel === '/reubicar' || rel === '/reubicar/') rel = '/tools/reubicar.html';
    if (rel === '/barrios' || rel === '/barrios/') rel = '/tools/barrios.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end('Prohibido');
      return;
    }
    const s = await stat(file);
    if (!s.isFile()) throw new Error('no es un archivo');
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': s.size,
      'cache-control': 'no-cache', // en desarrollo siempre se ve lo último
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('No encontrado');
  }
});

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `El puerto ${PORT} está ocupado. Probá: npm run serve -- 3000` : e.message);
  process.exit(1);
});
server.listen(PORT, () => {
  console.log(`Guía Sarmiento en http://localhost:${PORT}  (Ctrl+C para cortar)`);
  console.log(`Para ubicar los lugares pendientes con un paso a paso: http://localhost:${PORT}/ubicar`);
  console.log(`Para dibujar los barrios sobre el mapa: http://localhost:${PORT}/barrios`);
  console.log(`Para revisar mensajes que te mandan (opiniones, perdidos, datos): http://localhost:${PORT}/revisar`);
  console.log(`Para mover o eliminar lugares mal ubicados: http://localhost:${PORT}/reubicar`);
});
