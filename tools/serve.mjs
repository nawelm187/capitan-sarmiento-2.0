// Servidor local sin dependencias (funciona igual en Windows, Mac y Linux).
//
//   npm run serve              -> http://localhost:8080
//   npm run serve -- 3000      -> otro puerto
//
// Solo sirve la carpeta del proyecto, en modo lectura.

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
  req.on('data', (c) => { b += c; if (b.length > 1e5) req.destroy(); });
  req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { reject(e); } });
});
const json = (res, code, obj) => res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(obj));
const isLocal = (req) => /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || '') && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '');

async function api(req, res, pathname) {
  if (!isLocal(req)) return json(res, 403, { error: 'Solo desde esta PC.' });
  if (pathname === '/api/pendientes' && req.method === 'GET') {
    const [pend, places] = await Promise.all([readJson('data/pendientes.json', []), readJson('data/places.json', [])]);
    return json(res, 200, { pendientes: pend, ubicados: places.filter((p) => String(p.id).startsWith('extra-')).length });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  const d = await body(req);
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
});
