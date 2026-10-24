// Constantes del navegador (solo se importa desde módulos que corren en el browser).

export const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** ?calidad=baja fuerza el modo liviano; ?calidad=alta lo desactiva y no baja la calidad solo. */
export const QUALITY = (() => {
  try {
    const q = new URLSearchParams(location.search).get('calidad');
    return q === 'baja' || q === 'alta' ? q : null;
  } catch {
    return null;
  }
})();

/** Placas de video integradas viejas o por software: la maqueta tiene que ir en modo liviano. */
function weakGPU() {
  try {
    const cv = document.createElement('canvas');
    const gl = cv.getContext('webgl') || cv.getContext('experimental-webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|Software|Basic Render|Intel.{0,24}(HD|UHD) Graphics|Intel\(R\) Graphics|GMA|Mali-[T4]|PowerVR|Adreno.{0,8}[23]\d\d/i.test(name);
  } catch {
    return false;
  }
}

export const LOW_END =
  QUALITY === 'baja' ||
  (QUALITY !== 'alta' &&
    ((/Android|iPhone|iPad/i.test(navigator.userAgent) && (navigator.hardwareConcurrency || 4) <= 4) ||
      (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 2) ||
      (navigator.hardwareConcurrency || 8) <= 2 ||
      weakGPU()));

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
