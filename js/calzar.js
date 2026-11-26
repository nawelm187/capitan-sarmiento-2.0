// Calza los modelos de edificios importantes (iglesia, municipalidad, museo…) sobre el edificio REAL del mapa.
// Se usa al reubicar un lugar (tools/reubicar.mjs) y cada vez que se abre la guía (js/main.js), así un modelo
// nunca queda flotando al costado de su edificio. Módulo sin DOM: sirve en el navegador y en Node.
import { toLocal, toLngLat } from './geo.js';

const SIN_EDIFICIO = new Set(['plaza', 'monumento', 'tanque', 'silo', 'puente']);

/** Junta los edificios y las calles de un geojson (lng/lat) ya en metros locales. */
export function prepararCalzado(gj) {
  const edif = [];
  const vias = [];
  for (const f of gj?.features || []) {
    const k = f.properties?.kind, g = f.geometry;
    if (!g) continue;
    if (k === 'building') {
      const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null;
      if (!ring || ring.length < 4) continue;
      const pts = ring.map(([lng, lat]) => toLocal(lng, lat));
      let a = 0;
      for (let i = 0; i < pts.length - 1; i++) a += pts[i].x * pts[i + 1].z - pts[i + 1].x * pts[i].z;
      edif.push({ f, pts, area: Math.abs(a) / 2 });
    } else if (k === 'road' && /^(primary|secondary|tertiary|unclassified|residential|living_street|trunk)$/.test(f.properties.hw || '') && g.type === 'LineString') {
      vias.push(g.coordinates.map(([lng, lat]) => toLocal(lng, lat)));
    }
  }
  return { edif, vias, cambio: false };
}

const adentro = (x, z, pts) => { let d = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if (pts[i].z > z !== pts[j].z > z && x < ((pts[j].x - pts[i].x) * (z - pts[i].z)) / (pts[j].z - pts[i].z) + pts[i].x) d = !d; return d; };
function edificioEn(ctx, x, z) {
  const edif = ctx.edif;
  const dentro = edif.filter((e) => adentro(x, z, e.pts));
  if (dentro.length) return dentro.reduce((a, b) => (b.area > a.area ? b : a));
  let mejor = null, md = 25; // si cayó en la vereda: el edificio más cercano a menos de 25 m
  for (const e of edif) for (const p of e.pts) { const d = Math.hypot(p.x - x, p.z - z); if (d < md) { md = d; mejor = e; } }
  return mejor;
}
function rectOf(pts) {
  let best = 0, ang = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); if (l > best) { best = l; ang = Math.atan2(pts[i].z - pts[i - 1].z, pts[i].x - pts[i - 1].x); } }
  const c = Math.cos(ang), s = Math.sin(ang);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of pts) { const u = p.x * c + p.z * s, v = -p.x * s + p.z * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  let w = u1 - u0, d = v1 - v0, rot = -ang;
  if (d > w) { [w, d] = [d, w]; rot -= Math.PI / 2; }
  const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
  let deg = ((((rot * 180) / Math.PI) % 180) + 180) % 180; if (deg > 90) deg -= 180;
  const ll = toLngLat(um * c - vm * s, um * s + vm * c);
  return { lat: ll.lat, lng: ll.lng, w, d, rotY: Math.round(deg * 10) / 10 };
}
function frente(ctx, r, solo) {
  const vias = ctx.vias; // lado del edificio que mira a la calle más cercana
  const c0 = toLocal(r.lng, r.lat), th = (r.rotY * Math.PI) / 180;
  const ex = [Math.cos(th), -Math.sin(th)], ez = [Math.sin(th), Math.cos(th)];
  const lados = [[ez, r.d / 2], [ex, r.w / 2], [[-ez[0], -ez[1]], r.d / 2], [[-ex[0], -ex[1]], r.w / 2]];
  let best = 0, bd = Infinity;
  lados.forEach(([v, h], q) => {
    if (solo && !solo.includes(q)) return;
    const px = c0.x + v[0] * (h + 1), pz = c0.z + v[1] * (h + 1);
    let d = Infinity;
    for (const pl of vias) for (let i = 1; i < pl.length; i++) { const a = pl[i - 1], b = pl[i], dx = b.x - a.x, dz = b.z - a.z; const t = Math.min(1, Math.max(0, ((px - a.x) * dx + (pz - a.z) * dz) / (dx * dx + dz * dz || 1))); d = Math.min(d, Math.hypot(px - a.x - dx * t, pz - a.z - dz * t)); }
    if (d < bd) { bd = d; best = q; }
  });
  return best;
}
/** Vuelve a calzar el modelo `l` sobre el edificio que hay en (lat, lng); desmarca el edificio anterior. */
export function calzar(ctx, l, lat, lng, vieja) {
  const edif = ctx.edif;
  const kind = l.kind;
  if (vieja) for (const e of edif) { // el edificio viejo deja de estar «resaltado»
    if (e.f.properties.special !== kind) continue;
    const c = e.pts.reduce((a, p) => ({ x: a.x + p.x / e.pts.length, z: a.z + p.z / e.pts.length }), { x: 0, z: 0 });
    const v = toLocal(vieja.lng, vieja.lat);
    if (Math.hypot(c.x - v.x, c.z - v.z) < 40) { delete e.f.properties.special; ctx.cambio = true; }
  }
  const p = toLocal(lng, lat);
  const e = edificioEn(ctx, p.x, p.z);
  if (!e) { // no hay edificio ahí: se arma el edificio completo en el punto (así nunca queda un modelo flotando)
    l.lat = lat; l.lng = lng;
    if (l.mode === 'resaltar' && !l.solid) { l.solid = true; l.roofH = l.roofH || 8; l.ew = l.ew || 24; l.ed = l.ed || 14; }
    return false;
  }
  const r = rectOf(e.pts);
  e.f.properties.special = kind; ctx.cambio = true;
  l.lat = Math.round(r.lat * 1e6) / 1e6; l.lng = Math.round(r.lng * 1e6) / 1e6; l.rotY = r.rotY;
  if (l.mode === 'resaltar') {
    l.ew = Math.round(Math.min(r.w, 70) * 10) / 10; l.ed = Math.round(Math.min(r.d, 50) * 10) / 10;
    l.fr = frente(ctx, r, kind === 'iglesia' ? [1, 3] : null);
    if (!l.solid) l.roofH = Math.round((Number(e.f.properties.h) || 4) * 1.6);
    if (l.solid) delete l.solid; // ahora hay un edificio real debajo: se usa ese
  } else if (l.w) { l.w = Math.min(Math.round(r.w), 70); l.d = Math.min(Math.round(r.d), 50); }
  return true;
}


/** Al abrir la guía: todos los edificios importantes se calzan sobre el edificio real que tienen debajo. */
export function calzarTodos(gj, items) {
  const ctx = prepararCalzado(gj);
  let n = 0;
  for (const l of items || []) {
    if (!l || SIN_EDIFICIO.has(l.kind) || !Number.isFinite(l.lat) || !Number.isFinite(l.lng)) continue;
    if (l.mode !== 'resaltar' && !(l.w && l.d)) continue;
    if (calzar(ctx, l, l.lat, l.lng, null)) n++;
  }
  return n;
}
