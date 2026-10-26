// Análisis de calles (módulo puro, sin three): ancho por calle, cruces, avenidas con cantero central
// y tramos de pintura (líneas centrales, bordes, sendas peatonales).
// Las coordenadas son locales (x este, z sur), en metros.

export const ROAD_W = {
  motorway: 24, trunk: 22, primary: 16, secondary: 14, tertiary: 12, unclassified: 10,
  residential: 10, living_street: 8, service: 6, track: 5, path: 2.5, footway: 2.5, pedestrian: 6,
};
/** Calles por las que andan autos (se dibujan como calzada de cemento). */
export const CAR_HW = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service']);
const AVENUE_HW = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential']);
const SOLID_CENTER = new Set(['trunk', 'primary', 'secondary']);
const EDGE_LINES = new Set(['trunk', 'primary', 'secondary', 'tertiary']);

export const roadWidth = (r) => r.w ?? ROAD_W[r.hw] ?? 8;

export const polyLength = (pts) => {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return L;
};

/** Punto y tangente a distancia d desde el inicio. */
export function at(pts, cum, d) {
  let i = 1;
  while (i < pts.length - 1 && cum[i] < d) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const t = Math.min(1, Math.max(0, (d - cum[i - 1]) / seg));
  const tx = (b.x - a.x) / seg;
  const tz = (b.z - a.z) / seg;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, tx, tz };
}
const cumul = (pts) => {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return c;
};

/** Grilla espacial de segmentos de calles para consultas de cercanía. */
export function makeGrid(roads, cell = 40) {
  const map = new Map();
  const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;
  const add = (cx, cz, seg) => {
    const k = key(cx, cz);
    let l = map.get(k);
    if (!l) map.set(k, (l = []));
    l.push(seg);
  };
  roads.forEach((r, ri) => {
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1];
      const b = r.pts[i];
      const seg = { ri, a, b };
      const x0 = Math.floor(Math.min(a.x, b.x) / cell);
      const x1 = Math.floor(Math.max(a.x, b.x) / cell);
      const z0 = Math.floor(Math.min(a.z, b.z) / cell);
      const z1 = Math.floor(Math.max(a.z, b.z) / cell);
      for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) add(cx, cz, seg);
    }
  });
  const distSeg = (x, z, a, b) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    return { d: Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)), dx, dz, l: Math.sqrt(l2) };
  };
  return {
    /** Llama fn(seg, info) para cada segmento a menos de `rad` m de (x,z). */
    near(x, z, rad, fn) {
      const c0 = Math.floor((x - rad) / cell);
      const c1 = Math.floor((x + rad) / cell);
      const d0 = Math.floor((z - rad) / cell);
      const d1 = Math.floor((z + rad) / cell);
      const seen = new Set();
      for (let cx = c0; cx <= c1; cx++) {
        for (let cz = d0; cz <= d1; cz++) {
          const l = map.get(key(cx, cz));
          if (!l) continue;
          for (const s of l) {
            if (seen.has(s)) continue;
            seen.add(s);
            const info = distSeg(x, z, s.a, s.b);
            if (info.d <= rad) fn(s, info);
          }
        }
      }
    },
  };
}

function resample(pts, step) {
  const cum = cumul(pts);
  const L = cum[cum.length - 1];
  const n = Math.max(1, Math.round(L / step));
  const out = [];
  for (let i = 0; i <= n; i++) out.push(at(pts, cum, (L * i) / n));
  return out;
}

/**
 * Detecta avenidas con cantero: dos calles con el mismo nombre, en sentido opuesto y separadas
 * entre 8 y 40 m. Devuelve los cánteros [{pts:[{x,z}], w:[ancho por punto]}] y deja `w` más angosto
 * en cada una de las dos calzadas (marca `paired`).
 */
export function findMedians(roads, grid) {
  const groups = new Map();
  roads.forEach((r, i) => {
    if (!r.name || !AVENUE_HW.has(r.hw) || r.pts.length < 2) return;
    const k = r.name.trim().toLowerCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  });
  const medians = [];
  const bbox = (r) => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of r.pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    return { x0, x1, z0, z1 };
  };
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    for (let ia = 0; ia < ids.length; ia++) {
      for (let ib = ia + 1; ib < ids.length; ib++) {
        const A = roads[ids[ia]];
        const B = roads[ids[ib]];
        const ba = bbox(A);
        const bb = bbox(B);
        if (ba.x1 + 45 < bb.x0 || bb.x1 + 45 < ba.x0 || ba.z1 + 45 < bb.z0 || bb.z1 + 45 < ba.z0) continue;
        const wc = Math.min(8, Math.max(6, ROAD_W[A.hw] * 0.6));
        const samples = resample(A.pts, 6);
        const run = [];
        const flush = () => {
          if (run.length >= 5) {
            medians.push({ pts: run.map((s) => ({ x: s.x, z: s.z })), w: run.map((s) => s.w) });
            A.paired = B.paired = true;
            A.w = B.w = wc;
          }
          run.length = 0;
        };
        for (const s of samples) {
          let best = null;
          grid.near(s.x, s.z, 40, (seg, info) => {
            if (seg.ri !== ids[ib]) return;
            const dot = (info.dx * s.tx + info.dz * s.tz) / info.l;
            if (dot < -0.8 && (!best || info.d < best.d)) best = { d: info.d, ax: seg.a, bx: seg.b };
          });
          let ok = false;
          if (best && best.d >= 8 && best.d <= 40) {
            const wm = best.d - wc;
            if (wm >= 2.5) {
              // punto medio entre las dos calzadas
              const dx = best.bx.x - best.ax.x;
              const dz = best.bx.z - best.ax.z;
              const l2 = dx * dx + dz * dz || 1;
              const t = Math.min(1, Math.max(0, ((s.x - best.ax.x) * dx + (s.z - best.ax.z) * dz) / l2));
              const qx = best.ax.x + dx * t;
              const qz = best.ax.z + dz * t;
              const mx = (s.x + qx) / 2;
              const mz = (s.z + qz) / 2;
              // no tapar las calles que cruzan el cantero
              let cross = false;
              grid.near(mx, mz, 14, (seg, info) => {
                const ri = seg.ri;
                if (ri === ids[ia] || ri === ids[ib]) return;
                if (CAR_HW.has(roads[ri].hw) && info.d < roadWidth(roads[ri]) / 2 + wm / 2 + 1.5) cross = true;
              });
              if (!cross) {
                run.push({ x: mx, z: mz, w: wm });
                ok = true;
              }
            }
          }
          if (!ok) flush();
        }
        flush();
      }
    }
  }
  return medians;
}

/** Cruces: puntos donde se juntan 2 o más calles (vértices compartidos). */
export function findJunctions(roads) {
  const cnt = new Map();
  const key = (p) => `${Math.round(p.x)},${Math.round(p.z)}`;
  roads.forEach((r, ri) => {
    if (!CAR_HW.has(r.hw)) return;
    r.pts.forEach((p) => {
      const k = key(p);
      const e = cnt.get(k) || { x: p.x, z: p.z, roads: new Set() };
      e.roads.add(ri);
      cnt.set(k, e);
    });
  });
  const out = new Map();
  for (const [k, e] of cnt) if (e.roads.size >= 2) out.set(k, { x: e.x, z: e.z, roads: [...e.roads] });
  return { map: out, key };
}

/** Tramos [s0,s1] de la calle libres de cruces (con margen según el ancho). */
function freeRanges(r, cum, junc) {
  const L = cum[cum.length - 1];
  const cuts = [];
  r.pts.forEach((p, i) => {
    const j = junc.map.get(junc.key(p));
    if (!j) return;
    let wmax = 0;
    for (const ri of j.roads) wmax = Math.max(wmax, roadWidth(junc.roads[ri]));
    const m = wmax / 2 + 1.6;
    cuts.push([cum[i] - m, cum[i] + m]);
  });
  cuts.sort((a, b) => a[0] - b[0]);
  const out = [];
  let s = 0;
  for (const [a, b] of cuts) {
    if (a > s) out.push([s, a]);
    s = Math.max(s, b);
  }
  if (s < L) out.push([s, L]);
  return out.filter(([a, b]) => b - a > 1.5);
}

/**
 * Pintura de calles. Devuelve listas de tiras {pts:[{x,z}], w} para cada color y senda peatonal
 * {x,z,tx,tz,w} (centro, dirección de la calle y ancho de la calzada).
 */
export function paintRoads(roads) {
  const junc = findJunctions(roads);
  junc.roads = roads;
  const white = [];
  const yellow = [];
  const zebras = [];
  roads.forEach((r) => {
    if (!CAR_HW.has(r.hw) || r.pts.length < 2) return;
    const w = roadWidth(r);
    const cum = cumul(r.pts);
    const ranges = freeRanges(r, cum, junc);
    const strip = (s0, s1, off, width, list) => {
      const pts = [];
      const n = Math.max(1, Math.ceil((s1 - s0) / 8));
      for (let i = 0; i <= n; i++) {
        const p = at(r.pts, cum, s0 + ((s1 - s0) * i) / n);
        pts.push({ x: p.x - p.tz * off, z: p.z + p.tx * off });
      }
      list.push({ pts, w: width });
    };
    for (const [s0, s1] of ranges) {
      if (r.paired) {
        strip(s0, s1, w / 2 - 0.45, 0.14, white);
        strip(s0, s1, -(w / 2 - 0.45), 0.14, white);
      } else if (SOLID_CENTER.has(r.hw) && w >= 12) {
        strip(s0, s1, 0.16, 0.13, yellow);
        strip(s0, s1, -0.16, 0.13, yellow);
      } else if (w >= 9) {
        for (let d = s0; d + 2.5 <= s1; d += 7) strip(d, d + 2.5, 0, 0.13, white);
      }
      if (EDGE_LINES.has(r.hw) && !r.paired) {
        strip(s0, s1, w / 2 - 0.4, 0.12, white);
        strip(s0, s1, -(w / 2 - 0.4), 0.12, white);
      }
    }
    // sendas peatonales en los cruces de calles importantes
    if (['primary', 'secondary', 'tertiary', 'trunk'].includes(r.hw) || r.paired) {
      r.pts.forEach((p, i) => {
        const j = junc.map.get(junc.key(p));
        if (!j || j.roads.length < 2) return;
        let wmax = 0;
        for (const ri of j.roads) if (roads[ri] !== r) wmax = Math.max(wmax, roadWidth(roads[ri]));
        const d = wmax / 2 + 2.6;
        for (const sgn of [-1, 1]) {
          const ds = cum[i] + sgn * d;
          if (ds < 1 || ds > cum[cum.length - 1] - 1) continue;
          const q = at(r.pts, cum, ds);
          zebras.push({ x: q.x, z: q.z, tx: q.tx, tz: q.tz, w: Math.min(w, 16) });
        }
      });
    }
  });
  return { white, yellow, zebras };
}

/** ¿Está (x,z) sobre alguna calzada o cantero? (para no plantar árboles en el medio de la calle). */
export function onPavement(grid, roads, x, z, margin = 0.8) {
  let hit = false;
  grid.near(x, z, 14, (seg, info) => {
    const r = roads[seg.ri];
    if (CAR_HW.has(r.hw) && info.d < roadWidth(r) / 2 + margin) hit = true;
  });
  return hit;
}
