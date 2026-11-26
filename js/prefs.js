// Preferencias de accesibilidad (se guardan en el navegador de cada persona). Sin DOM pesado ni three.
//   theme: auto (sigue al celular) · light · dark     text: 0 normal · 1 grande · 2 muy grande     contrast: alto contraste     calm: sin movimiento     simple: lista sin 3D     map2d: mapa liviano 2D     facil: modo fácil (letra muy grande, pocos botones)
const KEY = 'guia-accesibilidad';
export const DEFAULTS = { theme: 'auto', text: 0, contrast: false, calm: false, simple: false, map2d: false, facil: false };

export function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      return { theme: ['auto', 'light', 'dark'].includes(raw.theme) ? raw.theme : 'auto', text: [0, 1, 2].includes(raw.text) ? raw.text : 0, contrast: raw.contrast === true, calm: raw.calm === true, simple: raw.simple === true, map2d: raw.map2d === true, facil: raw.facil === true };
    }
  } catch { /* sin almacenamiento: valores por defecto */ }
  return { ...DEFAULTS };
}
export function savePrefs(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* no pasa nada */ }
}
/** Pone las clases en <html>; el CSS hace el resto. */
export function applyPrefs(p, el = document.documentElement) {
  el.classList.toggle('pref-text-1', p.text === 1);
  el.classList.toggle('pref-text-2', p.text === 2);
  el.classList.toggle('theme-dark', p.theme === 'dark');
  el.classList.toggle('theme-light', p.theme === 'light');
  el.classList.toggle('pref-contrast', !!p.contrast);
  el.classList.toggle('pref-calm', !!p.calm);
  el.classList.toggle('pref-facil', !!p.facil);
}
