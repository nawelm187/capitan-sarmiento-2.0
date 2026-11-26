// Arma códigos QR para imprimir (sin internet ni instalar nada).
//
//   npm run qr                          afiche con el QR de la guía  → qr/afiche-guia.html
//   npm run qr -- --lugares             una hoja con el QR de cada lugar (para pegar en cada comercio) → qr/lugares.html
//   npm run qr -- --lugar="Farmacia"    afiche de un comercio puntual → qr/afiche-<nombre>.html
//   npm run qr -- --url=https://...     usa otra dirección (por defecto la de index.html)
// Abrí el archivo con el navegador y tocá Ctrl+P para imprimir o guardar como PDF.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { qrSvg } from '../js/qr.js';

const root = new URL('../', import.meta.url);
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const flag = (k) => process.argv.includes(`--${k}`);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const html = await readFile(new URL('index.html', root), 'utf8');
const base = (arg('url') || html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || '').replace(/\/?$/, '/');
if (!base.startsWith('https://')) { console.error('No encontré la dirección pública. Usá: npm run qr -- --url=https://TU-USUARIO.github.io/guia-sarmiento/'); process.exit(1); }
const meta = existsSync(new URL('data/meta.json', root)) ? JSON.parse(await readFile(new URL('data/meta.json', root), 'utf8')) : {};
const town = meta.town || 'Capitán Sarmiento';
await mkdir(new URL('qr/', root), { recursive: true });
const slug = (t) => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const STYLE = `<style>
  @page { size: A4; margin: 12mm }
  body { margin: 0; font-family: system-ui, sans-serif; color: #0f1d33; }
  .afiche { text-align: center; padding: 18mm 10mm; page-break-after: always; }
  .afiche h1 { font-size: 40pt; margin: 0 0 4mm; line-height: 1.1; }
  .afiche p { font-size: 18pt; margin: 3mm 0; }
  .afiche svg { width: 120mm; height: 120mm; margin: 8mm auto; display: block; }
  .afiche small { font-size: 11pt; color: #444; word-break: break-all; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; padding: 4mm; }
  .card { border: 1px solid #bbb; border-radius: 4mm; padding: 4mm; text-align: center; break-inside: avoid; }
  .card svg { width: 100%; height: auto; }
  .card b { display: block; font-size: 11pt; margin-top: 2mm; }
  .card small { color: #555; font-size: 8pt; }
</style>`;
const afiche = (titulo, sub, url) => `<section class="afiche"><h1>${esc(titulo)}</h1><p>${esc(sub)}</p>${qrSvg(url, { label: `Código QR de ${titulo}` })}<p>📱 Abrí la cámara del celular y apuntá al código</p><small>${esc(url)}</small></section>`;
const page = (body) => `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Códigos QR · ${esc(town)}</title>${STYLE}<body>${body}</body></html>`;

if (flag('lugares') || arg('lugar')) {
  const places = JSON.parse(await readFile(new URL('data/places.json', root), 'utf8'));
  if (flag('lugares')) {
    const body = `<div class="grid">${places.map((p) => `<div class="card">${qrSvg(`${base}?lugar=${encodeURIComponent(p.id)}`, { label: p.name })}<b>${esc(p.name)}</b><small>Escaneá y mirá dónde estamos</small></div>`).join('')}</div>`;
    await writeFile(new URL('qr/lugares.html', root), page(body));
    console.log(`Listo: qr/lugares.html con ${places.length} códigos. Abrilo con el navegador e imprimilo (Ctrl+P).`);
  } else {
    const q = norm(arg('lugar'));
    const hit = places.filter((p) => norm(p.name).includes(q));
    if (hit.length !== 1) { console.error(hit.length ? `Hay ${hit.length} lugares con ese nombre: ${hit.slice(0, 6).map((p) => p.name).join(', ')}. Escribí más del nombre.` : 'No encontré ese lugar.'); process.exit(1); }
    const p = hit[0];
    await writeFile(new URL(`qr/afiche-${slug(p.name)}.html`, root), page(afiche(p.name, `Encontranos en la guía de ${town}`, `${base}?lugar=${encodeURIComponent(p.id)}`)));
    console.log(`Listo: qr/afiche-${slug(p.name)}.html. Abrilo con el navegador e imprimilo (Ctrl+P).`);
  }
} else {
  await writeFile(new URL('qr/afiche-guia.html', root), page(afiche(`Guía de ${town}`, 'Comercios, servicios, lugares para visitar y mapa 3D', base)));
  console.log('Listo: qr/afiche-guia.html. Abrilo con el navegador e imprimilo (Ctrl+P).');
}
