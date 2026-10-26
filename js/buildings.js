// Construye los edificios directamente en arreglos tipados, agrupados en celdas del mapa.
// Es más rápido y liviano que ExtrudeGeometry: no genera la tapa de abajo (nunca se ve) ni UV.
// No importa three: la triangulación del techo se recibe como función (`triangulate`).
// Cada celda termina siendo un mesh, así la cámara y las sombras descartan las celdas que no se ven.

const area2 = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.z - q.x * p.z;
  }
  return a / 2;
};

/** Saca el punto final si repite al primero y los puntos repetidos seguidos. */
function clean(pts) {
  const out = [];
  for (const p of pts) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) return [];
    const l = out[out.length - 1];
    if (!l || Math.abs(l.x - p.x) > 1e-6 || Math.abs(l.z - p.z) > 1e-6) out.push(p);
  }
  if (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6) out.pop();
  }
  return out;
}

export class ChunkedBuildings {
  constructor({ half, factor = 1, triangulate, cell = 400 }) {
    this.half = half;
    this.factor = factor;
    this.triangulate = triangulate;
    this.cell = cell;
    this.chunks = new Map();
    this.count = 0;
    this.centers = []; // x, z, altura de cada edificio (para las luces de noche)
  }

  /**
   * @param rings  [anillo exterior, ...agujeros], cada uno una lista de {x, z} en metros
   * @param hRaw   altura en metros (sin exagerar); si falta se usa 4
   * @param WALLS  colores de pared (objetos con r, g, b)
   * @param ROOFS  colores de techo
   * @param hash2  función hash determinística (x, z) -> [0, 1)
   */
  add(rings, hRaw, WALLS, ROOFS, hash2) {
    const outer = clean(rings[0] || []);
    if (outer.length < 3) return;
    const holes = rings.slice(1).map(clean).filter((r) => r.length >= 3);
    const h = Math.max(2.5, (Number(hRaw) || 4) * this.factor);

    const seed = hash2(outer[0].x, outer[0].z);
    const wall = WALLS[Math.floor(seed * WALLS.length) % WALLS.length];
    const roof = ROOFS[Math.floor(hash2(outer[0].z, outer[0].x) * ROOFS.length) % ROOFS.length];

    const key = `${Math.floor((outer[0].x + this.half) / this.cell)},${Math.floor((outer[0].z + this.half) / this.cell)}`;
    let ch = this.chunks.get(key);
    if (!ch) this.chunks.set(key, (ch = { pos: [], nor: [], col: [] }));
    const { pos, nor, col } = ch;

    // ---- Techo ----
    const all = outer.concat(...holes);
    const faces = this.triangulate(
      outer.map((p) => ({ x: p.x, y: p.z })),
      holes.map((r) => r.map((p) => ({ x: p.x, y: p.z }))),
    );
    for (const f of faces) {
      let [a, b, c] = f.map((i) => all[i]);
      if (!a || !b || !c) continue;
      // Que mire siempre hacia arriba, sin depender de cómo ordene los vértices el triangulador.
      const cy = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
      if (Math.abs(cy) < 1e-9) continue;
      if (cy < 0) [b, c] = [c, b];
      for (const p of [a, b, c]) {
        pos.push(p.x, h, p.z);
        nor.push(0, 1, 0);
        col.push(roof.r, roof.g, roof.b);
      }
    }

    // ---- Paredes ----
    const walls = (ring, isHole) => {
      const s = area2(ring) > 0 ? 1 : -1;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        if (len < 1e-6) continue;
        // Normal hacia afuera del edificio (en un agujero, hacia adentro del agujero).
        const k = (isHole ? -s : s) / len;
        const nx = dz * k;
        const nz = -dx * k;
        // El primer triángulo (a0, b0, b1) tiene normal ∝ (-dz, 0, dx): si no coincide, se invierte el orden.
        const flip = -dz * nx + dx * nz < 0;
        const quad = flip
          ? [[a, 0], [b, h], [b, 0], [a, 0], [a, h], [b, h]]
          : [[a, 0], [b, 0], [b, h], [a, 0], [b, h], [a, h]];
        for (const [p, y] of quad) {
          pos.push(p.x, y, p.z);
          nor.push(nx, 0, nz);
          col.push(wall.r, wall.g, wall.b);
        }
      }
    };
    walls(outer, false);
    for (const r of holes) walls(r, true);
    let sx = 0;
    let sz = 0;
    for (const p of outer) {
      sx += p.x;
      sz += p.z;
    }
    this.centers.push(sx / outer.length, sz / outer.length, h);
    this.count++;
  }

  /** @returns {{position: Float32Array, normal: Float32Array, color: Float32Array}[]} */
  finish() {
    const out = [];
    for (const { pos, nor, col } of this.chunks.values()) {
      if (!pos.length) continue;
      out.push({ position: Float32Array.from(pos), normal: Float32Array.from(nor), color: Float32Array.from(col) });
    }
    this.chunks.clear();
    return out;
  }
}
