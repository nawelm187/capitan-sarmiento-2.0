// Proyección local (equirectangular) centrada en el pueblo.
// Ejes: x = este (metros), z = sur (metros). El norte apunta hacia -z.
// Puro: se puede importar desde Node (tools/) y desde el navegador.

let C = { lat: -34.1728, lng: -59.7886 };
let KX = 1;
let KY = 1;

function recompute() {
  const p = (C.lat * Math.PI) / 180;
  // Metros por grado (fórmulas estándar WGS84).
  KY = 111132.92 - 559.82 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p);
  KX = 111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p) + 0.118 * Math.cos(5 * p);
}
recompute();

export function setCenter(c) {
  C = { lat: Number(c.lat), lng: Number(c.lng) };
  recompute();
}
export const getCenter = () => ({ ...C });

/** lng/lat -> metros locales. */
export const toLocal = (lng, lat) => ({ x: (lng - C.lng) * KX, z: -(lat - C.lat) * KY });

/** metros locales -> lng/lat. */
export const toLngLat = (x, z) => ({ lng: C.lng + x / KX, lat: C.lat - z / KY });
