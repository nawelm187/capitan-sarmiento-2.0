// Instalar la guía como app (pantalla de inicio). Sin DOM: solo lógica.
// index.html guarda el aviso `beforeinstallprompt` en window.__bip apenas llega (puede llegar antes de que cargue la guía).
let deferred = (typeof window !== 'undefined' && window.__bip) || null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', () => { deferred = null; });
}
export const instalada = () => Boolean(typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) || (typeof navigator !== 'undefined' && navigator.standalone === true);
export const plataforma = (ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') => (/iPad|iPhone|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : 'pc');
export const puedeInstalarDirecto = () => Boolean(deferred);
/** Muestra el cartel de instalación del navegador (si lo permite). Devuelve 'accepted', 'dismissed' o 'manual'. */
export async function instalar() {
  if (!deferred) return 'manual';
  const d = deferred;
  deferred = null;
  d.prompt();
  try { return (await d.userChoice).outcome; } catch { return 'dismissed'; }
}
export function pasos(plat) {
  if (plat === 'ios') return ['Abrí la guía en <b>Safari</b>.', 'Tocá el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba).', 'Elegí <b>Agregar a pantalla de inicio</b> y después <b>Agregar</b>.'];
  if (plat === 'android') return ['Abrí la guía en <b>Chrome</b>.', 'Tocá los <b>tres puntitos</b> de arriba a la derecha.', 'Elegí <b>Instalar aplicación</b> o <b>Agregar a la pantalla principal</b>.'];
  return ['Abrí la guía en <b>Chrome</b> o <b>Edge</b>.', 'Buscá el ícono de instalar (una pantalla con una flecha) en la barra de direcciones, a la derecha.', 'Tocá <b>Instalar</b>. Se abre como una aplicación más.'];
}
