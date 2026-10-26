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

/**
 * Por defecto la maqueta corre en modo LIVIANO. Solo se usa la calidad alta en una PC (no celular)
 * con placa de video potente: NVIDIA/AMD dedicada, Apple Silicon o Intel Arc/Iris Xe, y 6+ núcleos.
 * Si no se puede saber qué placa es, se queda en liviano. `?calidad=alta` / `?calidad=baja` fuerzan una u otra.
 */
function strongPC() {
  try {
    if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) return false;
    if ((navigator.hardwareConcurrency || 0) < 6) return false;
    if (navigator.deviceMemory !== undefined && navigator.deviceMemory < 4) return false;
    const cv = document.createElement('canvas');
    const gl = cv.getContext('webgl') || cv.getContext('experimental-webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (/SwiftShader|llvmpipe|Software|Basic Render/i.test(name)) return false;
    return /NVIDIA|GeForce|RTX|GTX|Quadro|Radeon (RX|Pro W|VII|Vega (56|64))|Apple M\d|Apple GPU|Intel.{0,24}(Arc|Iris.{0,8}Xe)/i.test(name);
  } catch {
    return false;
  }
}

export const LOW_END = QUALITY === 'baja' || (QUALITY !== 'alta' && !strongPC());

export const COLORS = {
  bg: 0x0f1d33,
  accent: 0xe0572b,
  wall: 0xe9dcc4,
  roof: 0xb5523b,
  metal: 0xaab4bb,
  concrete: 0xc9c4b8,
  dark: 0x4a4f55,
};

// Las alturas de los edificios se exageran un poco, como en una maqueta.
export const HEIGHT_FACTOR = 1.6;
