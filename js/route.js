// Geometría de recorridos sobre el plano (x, z). Puro, sin three.

/** Prepara una polilínea [{x,z}] con longitudes acumuladas. */
export function buildPath(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  }
  return { pts, cum, len: cum[cum.length - 1] };
}

/** Punto y tangente unitaria a distancia d (en metros) de una polilínea. */
export function sample(path, d) {
  const { pts, cum, len } = path;
  if (pts.length < 2 || len === 0) return { x: pts[0]?.x ?? 0, z: pts[0]?.z ?? 0, tx: 1, tz: 0 };
  const dd = Math.min(len, Math.max(0, d));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < dd) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const t = (dd - cum[i - 1]) / seg;
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    tx: (b.x - a.x) / seg,
    tz: (b.z - a.z) / seg,
  };
}

/** Camino "en L" entre dos puntos (sigue calles en una grilla). */
export function manhattan(a, b) {
  if (Math.abs(a.x - b.x) < 1 || Math.abs(a.z - b.z) < 1) return [a, b];
  return [a, { x: b.x, z: a.z }, b];
}

/** Une varios tramos evitando puntos duplicados consecutivos. */
export function joinPaths(parts) {
  const out = [];
  for (const part of parts) {
    for (const p of part) {
      const last = out[out.length - 1];
      if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 0.01) out.push(p);
    }
  }
  return out;
}
