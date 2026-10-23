// Constantes del navegador (solo se importa desde módulos que corren en el browser).

export const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const LOW_END =
  (/Android|iPhone|iPad/i.test(navigator.userAgent) && (navigator.hardwareConcurrency || 4) <= 4) ||
  (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 2);

export const COLORS = {
  bg: 0x10151c,
  accent: 0xe0a53a,
  wall: 0xe9dcc4,
  roof: 0xb5523b,
  metal: 0xaab4bb,
  concrete: 0xc9c4b8,
  dark: 0x4a4f55,
};

// Las alturas de los edificios se exageran un poco, como en una maqueta.
export const HEIGHT_FACTOR = 1.6;
