// Arranque del mapa liviano 2D (sin three.js). Carga los datos y conecta la guía con el mapa plano.
import { setCenter } from './geo.js';
import { loadPrefs, applyPrefs } from './prefs.js';
import { loadIconFont } from './icons.js';
import { buildStreetIndex } from './streets.js';
import { initMap2D } from './map2d.js';
import { initUI } from './ui.js';

const $ = (id) => document.getElementById(id);
const splash = $('splash');
const setMsg = (t) => { const el = $('splash-msg'); if (el) el.textContent = t; };
const early = window.__early;
async function getJSON(url, bust) {
  const pre = early?.[url];
  if (pre) { delete early[url]; return pre; }
  const res = await fetch(bust ? `${url}?v=${encodeURIComponent(bust)}` : url, { cache: bust ? 'default' : 'no-cache' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}
const optional = (p, fallback) => p.catch(() => fallback);
const progress = (p) => {
  $('splash-logo')?.style.setProperty('--p', String(p));
  const el = $('splash-pct'); if (el) el.textContent = `${Math.round(p)} %`;
};
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

async function main() {
  const prefs = loadPrefs();
  applyPrefs(prefs);
  const meta = await getJSON('data/meta.json');
  const v = meta.version + (meta.dataRev ? '.' + meta.dataRev : '');
  setCenter(meta.center);
  const titleEl = $('splash-title') || splash.querySelector('.splash__title');
  if (titleEl) titleEl.textContent = `${meta.title?.[0] ?? meta.town} ${meta.title?.[1] ?? ''}`.trim();
  document.title = `${meta.name} · ${meta.town}`;
  progress(10); setMsg('Descargando datos…');
  const [gj, places, tours, guides, landmarks, pending, barriosData, turnos, agenda, perdidos, opiniones, historia, oficios, populares, rural] = await Promise.all([
    getJSON('data/sarmiento-osm.geojson', v),
    getJSON('data/places.json', v),
    getJSON('data/tours.json', v),
    optional(getJSON('data/guides.json', v), []),
    optional(getJSON('data/landmarks.json', v), { items: [] }),
    optional(getJSON('data/pendientes.json', v), []),
    optional(getJSON('data/barrios.json', v), []),
    optional(getJSON('data/turnos.json', v), []),
    optional(getJSON('data/agenda.json', v), { novedades: [], eventos: [] }),
    optional(getJSON('data/perdidos.json', v), []),
    optional(getJSON('data/opiniones.json', v), []),
    optional(getJSON('data/historia.json', v), []),
    optional(getJSON('data/oficios.json', v), []),
    optional(getJSON('data/populares.json', v), []),
    optional(getJSON('data/rural.json', v), { caminos: [], semanal: [] }),
  ]);
  loadIconFont(places);
  progress(70); setMsg('Armando el mapa…'); await nextFrame();

  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const wanted = norm(meta.startPlace || '');
  const spots = [...places, ...(landmarks.items || [])].filter((q) => Number.isFinite(q.lat) && Number.isFinite(q.lng));
  const start = (wanted ? spots.find((q) => norm(q.name).includes(wanted) || norm(q.id) === wanted) : meta.startPlace === undefined ? spots.find((q) => q.icon === 'banconacion' || q.kind === 'banconacion') : null) || meta.focus || null;

  const m2 = initMap2D({ gj, places, barrios: barriosData, tours, meta, start, reducedMotion: prefs.calm, lowEnd: true });
  initUI({ meta, places, pending, turnos, agenda, perdidos, opiniones, historia, oficios, populares, rural, streets: buildStreetIndex(m2.roads), tours, guides, nav: m2.nav, labels: m2.labels, controls: m2.controls, hasGL: true, hasBarrios: m2.barriosCount > 0, hasCalles: true });
  progress(100);
  setTimeout(() => splash.classList.add('hide'), 300);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
main().catch((err) => { console.error(err); setMsg('No se pudo cargar la guía. Revisá tu conexión y volvé a intentar.'); });
