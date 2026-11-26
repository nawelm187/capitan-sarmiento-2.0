// Arma la FARMACIA DE TURNO a partir de fuentes/turnos.txt y la guarda en data/turnos.json.
//
// En fuentes/turnos.txt escribí una línea por período (fechas AAAA-MM-DD):
//   desde | hasta | nombre de la farmacia | nota (opcional)
//   2026-11-23 | 2026-11-29 | Farmacia Del Pueblo | de 8 a 8
//
// El nombre alcanza con que sea parte del nombre en el mapa (sin importar tildes ni mayúsculas).
// Después:  npm run turnos     y la web muestra la farmacia de turno de HOY arriba de la lista.
//
// AUTOMÁTICO:  npm run turnos -- --web   lee la farmacia de turno de https://farmaciasdeturnohoy.site/capitan-sarmiento/farmacias-de-turno
//   (necesita internet; lo que escribas a mano en fuentes/turnos.txt tiene prioridad). Si la página cambia y no se entiende,
//   guarda la página en fuentes/turnos-pagina.txt para poder ajustar el lector.
//   Con GitHub Actions (.github/workflows/turnos.yml) esto corre solo todos los días.
// (Archivo tuyo: las actualizaciones no lo pisan.)

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const src = new URL('fuentes/turnos.txt', root);
const WEB = process.argv.includes('--web');
if (!existsSync(src) && !WEB) {
  await writeFile(src, '# Farmacia de turno. Una línea por período:\n#   desde | hasta | nombre de la farmacia | nota (opcional)\n#   2026-11-23 | 2026-11-29 | Farmacia Del Pueblo | de 8 a 8\n');
  console.log('Creé fuentes/turnos.txt. Completalo con las fechas y farmacias, y volvé a correr: npm run turnos');
  process.exit(0);
}
const places = JSON.parse(await readFile(new URL('data/places.json', root), 'utf8'));
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const farm = places.filter((p) => p.icon === 'farmacia' || /farmacia/i.test(p.name));
const out = [];
let bad = 0;
for (const raw of (existsSync(src) ? await readFile(src, 'utf8') : '').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const [from, to, name, note = ''] = line.split('|').map((x) => x.trim());
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(from || '') && /^\d{4}-\d{2}-\d{2}$/.test(to || '') && from <= to;
  const hit = name && (farm.find((p) => norm(p.name) === norm(name)) || farm.find((p) => norm(p.name).includes(norm(name))) || places.find((p) => norm(p.name).includes(norm(name))));
  if (!ok || !hit) {
    bad++;
    console.log(`  ✗ "${line}": ${!ok ? 'fechas mal escritas (usá AAAA-MM-DD y "desde" antes que "hasta")' : `no encontré ningún lugar que se llame así. Farmacias cargadas: ${farm.map((p) => p.name).join(' · ') || '(ninguna todavía)'}`}`);
    continue;
  }
  out.push({ from, to, placeId: hit.id, ...(note ? { note } : {}) });
}
const manual = out.length;

// ---------- Lectura automática de la web ----------
const URL_WEB = 'https://farmaciasdeturnohoy.site/capitan-sarmiento/farmacias-de-turno';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const todayAR = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export function htmlToText(html) {
  return String(html)
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|br|ul|ol|table)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}
const NAME = /Farmacia\s+(?:(?:de\s+la|del|de|la|el)\s+)?[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.'’-]*/;
const STOP = /\b(Direcci[oó]n|Tel[eé]fono|Llamar|Ver|C[oó]mo|Horario|Turno|Mapa|Pr[oó]ximos?|Hoy|Ma[nñ]ana|Av\.?|Avenida|Calle)\b.*$/;
const cleanName = (t) => t.replace(STOP, '').replace(/[\s,.;:–-]+$/, '').trim();
/** Devuelve [{from, name, address?}] en orden: el de hoy y los próximos turnos. Exportada para pruebas. */
export function parseTurnosWeb(text, hoy = todayAR(), known = []) {
  const normK = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const kn = known.map((k) => ({ k, n: normK(k) })).sort((a, b) => b.n.length - a.n.length);
  // Busca en la línea el nombre de una farmacia ya cargada (más seguro); si no, usa el patrón general.
  const findName = (l) => {
    const nl = normK(l);
    for (const { k, n } of kn) { const at = nl.indexOf(n); if (at >= 0) return { text: k, index: at, len: n.length }; }
    const m = NAME.exec(l);
    return m ? { text: cleanName(m[0]), index: m.index, len: m[0].length } : null;
  };
  const lines = text.split('\n');
  const res = [];
  // 1) el de hoy: primera línea con nombre de farmacia que no sea el título
  const iHoy = lines.findIndex((l) => /Farmacia\s+de\s+turno\s+hoy/i.test(l));
  const iProx = lines.findIndex((l) => /Pr[oó]ximos\s+Turnos/i.test(l));
  for (let i = Math.max(iHoy, 0) + 1; i < (iProx > 0 ? iProx : lines.length); i++) {
    if (/Farmacia\s+de\s+turno/i.test(lines[i])) continue;
    const m = findName(lines[i]);
    if (m) { res.push({ from: hoy, name: m.text }); break; }
  }
  // 2) próximos: cada fecha ("21 de noviembre", "21/11") con la primera farmacia que aparece antes de la fecha siguiente
  if (iProx >= 0) {
    const block = lines.slice(iProx + 1);
    const dateRe = new RegExp(`(\\d{1,2})\\s+de\\s+(${MESES.join('|')})|(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?`, 'i');
    const year0 = Number(hoy.slice(0, 4));
    let cur = null;
    for (const l of block) {
      if (/^(preguntas|horarios|sobre|¿)/i.test(l) && cur) break;
      const d = dateRe.exec(l);
      if (d) {
        const day = Number(d[1] || d[3]);
        const mi = d[2] ? MESES.indexOf(d[2].toLowerCase()) : -1;
        const mon = d[2] ? (mi <= 8 ? mi + 1 : mi) : Number(d[4]);
        if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
          let year = d[5] ? Number(d[5].length === 2 ? '20' + d[5] : d[5]) : year0;
          let iso = `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          if (!d[5] && iso < addDays(hoy, -200)) iso = `${year + 1}-${iso.slice(5)}`;
          cur = { from: iso };
          res.push(cur);
        }
      }
      const n = findName(l);
      if (n && cur && !cur.name) { cur.name = n.text; const a = /((?:Av\.?|Avenida|Calle|Ruta)?\s*[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ. ]*\s\d{1,5})/.exec(l.slice(n.index + n.len)); if (a) cur.address = a[1].trim(); }
      else if (cur && cur.name && !cur.address) { const a = /^((?:Av\.?|Avenida|Calle|Ruta)?\s*[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ. ]*\s\d{1,5})\b/.exec(l); if (a) cur.address = a[1].trim(); }
    }
  }
  const seen = new Set();
  return res.filter((r) => r.name && !seen.has(r.from) && seen.add(r.from)).sort((a, b) => a.from.localeCompare(b.from));
}

if (WEB) {
  try {
    const r = await fetch(URL_WEB, { headers: { 'user-agent': 'Mozilla/5.0 guia-sarmiento (proyecto sin fines de lucro)' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = htmlToText(await r.text());
    const rows = parseTurnosWeb(text, todayAR(), farm.map((p) => p.name));
    if (!rows.length) {
      await writeFile(new URL('fuentes/turnos-pagina.txt', root), text);
      console.log('  ✗ No pude entender la página de turnos (cambió su formato). La guardé en fuentes/turnos-pagina.txt: mandámela para ajustar el lector.');
    } else {
      // Cada turno dura desde su fecha hasta el día antes del siguiente turno listado (los fines de semana pueden compartir turno).
      const web = rows.map((q, i) => ({ q, to: i + 1 < rows.length ? addDays(rows[i + 1].from, -1) : q.from }));
      let n = 0;
      for (const { q, to } of web) {
        if (out.slice(0, manual).some((m) => m.from <= to && q.from <= m.to)) continue; // lo escrito a mano manda
        const key = norm(q.name).replace(/^farmacia\s+/, '');
        const hit = farm.find((p) => norm(p.name).includes(key));
        out.push({ from: q.from, to, ...(hit ? { placeId: hit.id } : { name: q.name, ...(q.address ? { address: q.address } : {}) }), note: 'de 8:30 a 8:30', web: true });
        n++;
        if (!hit) console.log(`  · "${q.name}" no está entre los lugares cargados: se muestra por nombre, sin botón de mapa. Sumala (nombre y dirección) para que aparezca.`);
      }
      console.log(`  Leí de la web: ${web.map(({ q }) => `${q.from.slice(5)} ${q.name}`).join(' · ')}`);
    }
  } catch (e) {
    console.log(`  ✗ No pude leer la web de turnos (${e.message}). Se mantiene lo que ya había.`);
    const old = existsSync(new URL('data/turnos.json', root)) ? JSON.parse(await readFile(new URL('data/turnos.json', root), 'utf8')) : [];
    for (const o of old) if (o.web) out.push(o);
  }
}

out.sort((a, b) => a.from.localeCompare(b.from));
const prev = existsSync(new URL('data/turnos.json', root)) ? await readFile(new URL('data/turnos.json', root), 'utf8') : '';
const next = JSON.stringify(out, null, 1) + '\n';
if (prev !== next) {
  await writeFile(new URL('data/turnos.json', root), next);
  const meta = JSON.parse(await readFile(new URL('data/meta.json', root), 'utf8'));
  meta.dataRev = Date.now().toString(36);
  await writeFile(new URL('data/meta.json', root), JSON.stringify(meta, null, 2) + '\n');
}
console.log(`Períodos de turno guardados: ${out.length}${bad ? ` · con error: ${bad}` : ''}${prev === next ? ' (sin cambios)' : ''}. Probalo con npm run serve.`);
