// Fotos 360° con Pannellum (gratis, MIT: https://pannellum.org). Se baja solo cuando alguien toca «Ver en 360°».
const BASE = (typeof window !== 'undefined' && window.__PANNELLUM_BASE) || 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/';
let loading = null;

export const panoOk = (u) => typeof u === 'string' && /^img\/360\/[\w\-.]+\.(jpe?g|png|webp)$/i.test(u);

function cargar() {
  return (loading ||= new Promise((resolve, reject) => {
    if (window.pannellum) return resolve(window.pannellum);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = BASE + 'pannellum.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = BASE + 'pannellum.js';
    s.onload = () => (window.pannellum ? resolve(window.pannellum) : reject(new Error('sin pannellum')));
    s.onerror = () => { loading = null; reject(new Error('no se pudo cargar')); };
    document.head.appendChild(s);
  }));
}

/** Muestra la foto 360° dentro de `el` (un div con id). Devuelve true si anduvo. */
export async function verPanorama(el, url, titulo = '') {
  if (!panoOk(url)) return false;
  try {
    const p = await cargar();
    p.viewer(el.id, { type: 'equirectangular', panorama: url, autoLoad: true, autoRotate: -2, compass: false, showFullscreenCtrl: true, title: titulo, hfov: 100, strings: { loadButtonLabel: 'Tocá para cargar', loadingLabel: 'Cargando…', bylineLabel: '' } });
    return true;
  } catch {
    return false;
  }
}
