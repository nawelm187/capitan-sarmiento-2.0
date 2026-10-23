// Utilidades puras (sin DOM ni three): se usan en el navegador y en los scripts de /tools.

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Generador pseudoaleatorio determinístico (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash determinístico de dos números a [0,1). */
export function hash2(a, b) {
  let h = Math.imul(Math.floor(a * 1e5) | 0, 374761393) ^ Math.imul(Math.floor(b * 1e5) | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escapa texto para insertarlo en HTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Devuelve la URL solo si es http(s); si no, cadena vacía. */
export const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? String(u) : '');

/** Interpola ángulos por el camino más corto. */
export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export const pick = (rand, arr) => arr[Math.floor(rand() * arr.length) % arr.length];
