// Buscador de calles y direcciones (módulo puro, sin DOM ni three).
//   "Mármol"            → la calle
//   "Mármol 536"        → número aproximado (se calcula con los lugares que ya tienen dirección en esa calle)
//   "Mármol y Planes"   → la esquina (también "esquina", "e/", "con", "&")
// Las calles vienen de OpenStreetMap (world.roads: {name, pts:[{x,z}]} en metros locales).

export const norm = (t) =>
  String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.,]/g, ' ')
    .replace(/\b(avenida|avda|av|calle|boulevard|bulevar|bv|ruta|diagonal|diag|pasaje|pje)\b/g, ' ').replace(/\s+/g, ' ').trim();

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const polyLen = (pts) => pts.slice(1).reduce((s, p, i) => s + dist(p, pts[i]), 0);
function pointAt(pts, d) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const L = dist(pts[i], pts[i - 1]);
    if (acc + L >= d || i === pts.length - 1) {
      const t = L ? Math.min(1, Math.max(0, (d - acc) / L)) : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * t };
    }
    acc += L;
  }
  return pts[0];
}

/** Agrupa las calles con nombre: Map(nombre normalizado → {name, lines:[pts[]], len}). */
export function buildStreetIndex(roads) {
  const idx = new Map();
  for (const r of roads || []) {
    if (!r.name || !r.pts || r.pts.length < 2) continue;
    const key = norm(r.name);
    if (!key) continue;
    const e = idx.get(key) || { name: r.name, key, lines: [], len: 0 };
    e.lines.push(r.pts);
    e.len += polyLen(r.pts);
    idx.set(key, e);
  }
  return idx;
}

function segIntersect(a, b, c, d) {
  const r = { x: b.x - a.x, z: b.z - a.z }, s = { x: d.x - c.x, z: d.z - c.z };
  const den = r.x * s.z - r.z * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.z - (c.z - a.z) * s.x) / den;
  const u = ((c.x - a.x) * r.z - (c.z - a.z) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + r.x * t, z: a.z + r.z * t } : null;
}
function distPointSeg(p, a, b) {
  const l2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2;
  const t = l2 ? Math.min(1, Math.max(0, ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / l2)) : 0;
  return Math.hypot(p.x - (a.x + (b.x - a.x) * t), p.z - (a.z + (b.z - a.z) * t));
}

/** Esquina de dos calles (o el punto donde más se acercan, hasta 40 m). */
export function intersection(A, B) {
  let best = null;
  for (const la of A.lines) for (const lb of B.lines) {
    for (let i = 1; i < la.length; i++) for (let j = 1; j < lb.length; j++) {
      const hit = segIntersect(la[i - 1], la[i], lb[j - 1], lb[j]);
      if (hit) return hit;
      for (const [p, a, b] of [[la[i - 1], lb[j - 1], lb[j]], [la[i], lb[j - 1], lb[j]], [lb[j - 1], la[i - 1], la[i]], [lb[j], la[i - 1], la[i]]]) {
        const d = distPointSeg(p, a, b);
        if (d < 40 && (!best || d < best.d)) best = { d, x: p.x, z: p.z };
      }
    }
  }
  return best ? { x: best.x, z: best.z } : null;
}

/** Punto medio de la calle (de su tramo más largo). */
export function streetCenter(e) {
  const main = [...e.lines].sort((a, b) => polyLen(b) - polyLen(a))[0];
  return pointAt(main, polyLen(main) / 2);
}

function matchStreets(idx, text, limit = 4) {
  const q = norm(text);
  if (!q) return [];
  const words = q.split(' ');
  const out = [];
  for (const e of idx.values()) {
    if (e.key === q) out.push({ e, score: 3 });
    else if (words.every((w) => e.key.split(' ').some((k) => k.startsWith(w)))) out.push({ e, score: 2 });
    else if (q.length >= 4 && e.key.includes(q)) out.push({ e, score: 1 });
  }
  return out.sort((a, b) => b.score - a.score || b.e.len - a.e.len).slice(0, limit).map((x) => x.e);
}

/** Lugares con dirección "Calle 123": [{n, x, z}] de la calle indicada. */
function numbered(e, places, toLocal) {
  const pts = [];
  for (const p of places || []) {
    const m = /^(.+?)\s+(\d{1,5})\b/.exec(String(p.address || '').replace(/^(av\.?|avenida|calle)\s+/i, '').trim());
    if (!m || norm(m[1]) !== e.key) continue;
    const l = toLocal(p.lng, p.lat);
    pts.push({ n: Number(m[2]), x: l.x, z: l.z });
  }
  return pts.sort((a, b) => a.n - b.n);
}
function atNumber(known, n) {
  if (known.length === 1) return { x: known[0].x, z: known[0].z, exact: known[0].n === n };
  let lo = known[0], hi = known[known.length - 1];
  if (n <= lo.n) return { x: lo.x, z: lo.z, exact: n === lo.n };
  if (n >= hi.n) return { x: hi.x, z: hi.z, exact: n === hi.n };
  for (let i = 1; i < known.length; i++) if (known[i].n >= n) { lo = known[i - 1]; hi = known[i]; break; }
  const t = (n - lo.n) / (hi.n - lo.n || 1);
  return { x: lo.x + (hi.x - lo.x) * t, z: lo.z + (hi.z - lo.z) * t, exact: false };
}

/**
 * Busca calles, esquinas y números. Devuelve [{title, sub, lat, lng, approx}] (máx. 5).
 * deps: { toLocal(lng,lat)→{x,z}, toLngLat(x,z)→{lng,lat}, places }
 */
export function searchStreets(idx, text, deps) {
  const t = String(text || '').trim();
  if (t.length < 3 || !idx.size) return [];
  const res = [];
  const ll = (p) => deps.toLngLat(p.x, p.z);
  const pair = t.split(/\s+(?:y|e|esquina|esq\.?|con|&|e\/|entre)\s+/i);
  if (pair.length === 2) {
    for (const a of matchStreets(idx, pair[0], 2)) for (const b of matchStreets(idx, pair[1], 2)) {
      if (a === b) continue;
      const pt = intersection(a, b);
      if (pt) res.push({ title: `${a.name} y ${b.name}`, sub: 'Esquina', ...ll(pt), approx: false });
    }
    return res.slice(0, 5);
  }
  const mn = /^(.*?)[\s,]+(\d{1,5})$/.exec(t);
  if (mn) {
    for (const e of matchStreets(idx, mn[1], 2)) {
      const known = numbered(e, deps.places, deps.toLocal);
      const n = Number(mn[2]);
      if (known.length) {
        const pt = atNumber(known, n);
        res.push({ title: `${e.name} ${n}`, sub: pt.exact ? 'Dirección' : 'Dirección aproximada (calculada con los lugares de esa calle)', ...ll(pt), approx: !pt.exact });
      } else {
        res.push({ title: `${e.name} ${n}`, sub: 'No tengo la numeración de esta calle: te llevo al medio de la calle', ...ll(streetCenter(e)), approx: true });
      }
    }
    if (res.length) return res.slice(0, 5);
  }
  for (const e of matchStreets(idx, t, 5)) res.push({ title: e.name, sub: 'Calle', ...ll(streetCenter(e)), approx: false });
  return res;
}
