// Pega los pines de los lugares a su edificio real: un punto de OpenStreetMap o de Google Maps puede caer en la
// vereda, en la calle o unos metros corrido del edificio del mapa. Si está cerca de un edificio, se lo mueve adentro.
import { toLocal, toLngLat } from '../js/geo.js';

const r6 = (n) => Math.round(n * 1e6) / 1e6;
const inPoly = (x, z, pts) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
};

export function loadBuildings(gj) {
  const out = [];
  for (const f of gj?.features || []) {
    if (f.properties?.kind !== 'building') continue;
    const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates[0]?.[0] : null;
    if (!ring || ring.length < 4) continue;
    const pts = ring.map(([lng, lat]) => toLocal(lng, lat));
    let cx = 0, cz = 0, A = 0;
    for (let i = 0; i < pts.length; i++) {
      cx += pts[i].x;
      cz += pts[i].z;
      const q = pts[(i + 1) % pts.length];
      A += pts[i].x * q.z - q.x * pts[i].z;
    }
    cx /= pts.length;
    cz /= pts.length;
    const area = Math.abs(A) / 2;
    if (area < 20) continue;
    out.push({ pts, cx, cz, area, h: Number(f.properties.h) || 4, minx: Math.min(...pts.map((p) => p.x)), maxx: Math.max(...pts.map((p) => p.x)), minz: Math.min(...pts.map((p) => p.z)), maxz: Math.max(...pts.map((p) => p.z)) });
  }
  return out;
}

/** Devuelve { lat, lng, roofH, moved } con el punto ya dentro de su edificio (hasta `maxD` metros de distancia). */
export function snapPoint(buildings, lat, lng, maxD = 30) {
  const p = toLocal(lng, lat);
  let inside = null;
  let near = null;
  let nd = Infinity;
  for (const b of buildings) {
    if (p.x < b.minx - maxD || p.x > b.maxx + maxD || p.z < b.minz - maxD || p.z > b.maxz + maxD) continue;
    if (inPoly(p.x, p.z, b.pts)) {
      if (!inside || b.area > inside.area) inside = b;
      continue;
    }
    let d = Infinity;
    for (let i = 0; i < b.pts.length; i++) {
      const a = b.pts[i];
      const c = b.pts[(i + 1) % b.pts.length];
      const dx = c.x - a.x, dz = c.z - a.z;
      const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
      d = Math.min(d, Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t));
    }
    if (d < nd) { nd = d; near = b; }
  }
  const roof = (b) => Math.round(b.h * 1.6);
  if (inside) return { lat, lng, roofH: roof(inside), moved: false };
  if (near && nd <= maxD) {
    // al centro del edificio; si el centro cayera fuera (forma en L), al punto interior más cercano
    let x = near.cx;
    let z = near.cz;
    if (!inPoly(x, z, near.pts)) {
      let best = null;
      for (let k = 0; k < 24 && !best; k++) {
        const r = (k + 1) * 1.2;
        for (let a = 0; a < 12; a++) {
          const tx = near.cx + Math.cos((a / 12) * 6.283) * r;
          const tz = near.cz + Math.sin((a / 12) * 6.283) * r;
          if (inPoly(tx, tz, near.pts)) { best = { x: tx, z: tz }; break; }
        }
      }
      if (!best) return { lat, lng, roofH: 0, moved: false };
      x = best.x;
      z = best.z;
    }
    const ll = toLngLat(x, z);
    return { lat: r6(ll.lat), lng: r6(ll.lng), roofH: roof(near), moved: true };
  }
  return { lat, lng, roofH: 0, moved: false };
}

/** Mueve a su edificio los lugares que vienen de OpenStreetMap o de lugares-extra (no toca los que cargaste a mano). */
export function snapPlaces(places, gj) {
  const buildings = loadBuildings(gj);
  let moved = 0;
  for (const p of places) {
    if (!/^(osm-|extra-)/.test(String(p.id))) continue;
    if (p.snapped === false) continue; // se puede escribir "snapped": false en un lugar para que no se mueva
    const r = snapPoint(buildings, p.lat, p.lng, 30);
    if (r.moved) {
      p.lat = r.lat;
      p.lng = r.lng;
      moved++;
    }
    if (r.roofH && !p.roofH) p.roofH = r.roofH;
  }
  return moved;
}
