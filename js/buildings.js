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

/** Saca los vértices casi alineados (un contorno de 5 puntos con uno de más sigue siendo un rectángulo). */
function simplify(pts) {
  const out = pts.slice();
  for (let i = 0; i < out.length && out.length > 3; ) {
    const a = out[(i + out.length - 1) % out.length];
    const b = out[i];
    const c = out[(i + 1) % out.length];
    const cr = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
    const l = Math.hypot(b.x - a.x, b.z - a.z) * Math.hypot(c.x - b.x, c.z - b.z) || 1;
    if (Math.abs(cr / l) < 0.06) out.splice(i, 1);
    else i++;
  }
  return out;
}

/** ¿Los cuatro ángulos son casi rectos? */
function isRect(q) {
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    const ux = b.x - a.x, uz = b.z - a.z, vx = c.x - b.x, vz = c.z - b.z;
    const l = Math.hypot(ux, uz) * Math.hypot(vx, vz);
    if (!l || Math.abs(ux * vx + uz * vz) / l > 0.2) return false;
  }
  return true;
}

/** ¿El punto está dentro del contorno? */
function inside(ring, x, z) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
}

export class ChunkedBuildings {
  constructor({ half, factor = 1, triangulate, cell = 400, detail = 2 }) {
    this.detail = detail; // 0 sin detalle · 1 ventanas y puertas · 2 además zócalo, cornisa y postigos
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
   * @param opts   { special: true } en edificios resaltados (techo plano y sin detalles que tapen el color)
   */
  add(rings, hRaw, WALLS, ROOFS, hash2, opts = {}) {
    const outer = clean(rings[0] || []);
    if (outer.length < 3) return;
    const holes = rings.slice(1).map(clean).filter((r) => r.length >= 3);
    const h = Math.max(2.5, (Number(hRaw) || 4) * this.factor);

    const x0 = outer[0].x;
    const z0 = outer[0].z;
    const seed = hash2(x0, z0);
    const wall0 = WALLS[Math.floor(seed * WALLS.length) % WALLS.length];
    const roof0 = ROOFS[Math.floor(hash2(z0, x0) * ROOFS.length) % ROOFS.length];
    const r3 = hash2(x0 * 1.7 + 3.1, z0 * 0.9 + 7.3);
    const r4 = hash2(z0 * 2.3 + 1.9, x0 * 1.3 + 5.7);
    // Variación suave de brillo: que no parezcan todas pintadas con el mismo tarro.
    const jit = 0.93 + r3 * 0.12;
    const wall = { r: Math.min(1, wall0.r * jit), g: Math.min(1, wall0.g * jit), b: Math.min(1, wall0.b * jit) };
    const roofJ = 0.9 + r4 * 0.16;
    const roof = { r: Math.min(1, roof0.r * roofJ), g: Math.min(1, roof0.g * roofJ), b: Math.min(1, roof0.b * roofJ) };

    const key = `${Math.floor((outer[0].x + this.half) / this.cell)},${Math.floor((outer[0].z + this.half) / this.cell)}`;
    let ch = this.chunks.get(key);
    if (!ch) this.chunks.set(key, (ch = { pos: [], nor: [], col: [], d: { pos: [], nor: [], col: [] } }));
    const { pos, nor, col } = ch;
    const D = ch.d;

    const area = Math.abs(area2(outer));
    let cx = 0;
    let cz = 0;
    for (const p of outer) {
      cx += p.x;
      cz += p.z;
    }
    cx /= outer.length;
    cz /= outer.length;

    // Un triángulo con la normal calculada; `up` = tiene que mirar hacia arriba, si no, hacia afuera del edificio.
    const tri = (a, b, c, color, up, tgt = ch) => {
      let ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
      let vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-9) return;
      nx /= l; ny /= l; nz /= l;
      const flip = up ? ny < 0 : nx * ((a.x + b.x + c.x) / 3 - cx) + nz * ((a.z + b.z + c.z) / 3 - cz) < 0;
      if (flip) {
        [b, c] = [c, b];
        nx = -nx; ny = -ny; nz = -nz;
      }
      for (const p of [a, b, c]) {
        tgt.pos.push(p.x, p.y, p.z);
        tgt.nor.push(nx, ny, nz);
        tgt.col.push(color.r, color.g, color.b);
      }
    };
    const P = (x, y, z) => ({ x, y, z });
    // Caja alineada con el eje de la casa (para chimeneas, tanques): centro, medidas y color.
    const box = (bx, bz, y0, y1, hx, hz, color, top, tgt = ch) => {
      const c4 = [P(bx - hx, y0, bz - hz), P(bx + hx, y0, bz - hz), P(bx + hx, y0, bz + hz), P(bx - hx, y0, bz + hz)];
      const t4 = c4.map((q) => P(q.x, y1, q.z));
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const nx2 = (i === 0 ? 0 : i === 1 ? 1 : i === 2 ? 0 : -1);
        const nz2 = (i === 0 ? -1 : i === 1 ? 0 : i === 2 ? 1 : 0);
        const sh = 1 - 0.08 * (i % 2);
        const cc = { r: color.r * sh, g: color.g * sh, b: color.b * sh };
        // normal fija hacia afuera de la caja
        for (const [a2, b2, c2] of [[c4[i], c4[j], t4[j]], [c4[i], t4[j], t4[i]]]) {
          const ux = b2.x - a2.x, uy = b2.y - a2.y, uz = b2.z - a2.z;
          const vx = c2.x - a2.x, vy = c2.y - a2.y, vz = c2.z - a2.z;
          let ax = uy * vz - uz * vy, ay = uz * vx - ux * vz, az = ux * vy - uy * vx;
          const l2 = Math.hypot(ax, ay, az) || 1;
          ax /= l2; ay /= l2; az /= l2;
          const ok = ax * nx2 + az * nz2 > 0;
          const pts = ok ? [a2, b2, c2] : [a2, c2, b2];
          const sg = ok ? 1 : -1;
          for (const q of pts) {
            tgt.pos.push(q.x, q.y, q.z);
            tgt.nor.push(ax * sg, ay * sg, az * sg);
            tgt.col.push(cc.r, cc.g, cc.b);
          }
        }
      }
      if (top) {
        const tc = top;
        for (const q of [t4[0], t4[2], t4[1], t4[0], t4[3], t4[2]]) {
          tgt.pos.push(q.x, q.y, q.z);
          tgt.nor.push(0, 1, 0);
          tgt.col.push(tc.r, tc.g, tc.b);
        }
      }
    };

    // ---- Forma del techo ----
    // Casas chicas y rectangulares: techo a dos aguas. Lo demás: techo plano con parapeto. Los especiales, siempre plano.
    let pitched = false;
    let ring4 = null;
    if (!opts.special && !holes.length && this.detail > 0) {
      const q = simplify(outer);
      if (q.length === 4 && isRect(q) && area >= 28 && area <= 380 && h <= 9 && r3 < 0.72) {
        pitched = true;
        ring4 = q;
      }
    }
    const parapet = !pitched && !opts.special && area > 45 && this.detail > 0 ? 0.45 : 0;
    const hw = h + parapet; // altura de las paredes (el parapeto sobresale del techo plano)

    if (pitched) {
      let [p0, p1, p2, p3] = ring4;
      const e0 = Math.hypot(p1.x - p0.x, p1.z - p0.z);
      const e1 = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      if (e0 < e1) [p0, p1, p2, p3] = [p1, p2, p3, p0]; // el lado largo queda siempre primero
      const lo = Math.min(e0, e1);
      const rh = Math.min(3.2, Math.max(1.3, lo * 0.3));
      const m30 = P((p3.x + p0.x) / 2, h + rh, (p3.z + p0.z) / 2);
      const m12 = P((p1.x + p2.x) / 2, h + rh, (p1.z + p2.z) / 2);
      // Aleros: el techo sobresale de las paredes (da sombra y se lee como techo de verdad).
      const mx = (p0.x + p1.x + p2.x + p3.x) / 4;
      const mz = (p0.z + p1.z + p2.z + p3.z) / 4;
      const grow = (p, k) => { const l = Math.hypot(p.x - mx, p.z - mz) || 1; return { x: p.x + ((p.x - mx) / l) * k, z: p.z + ((p.z - mz) / l) * k }; };
      const ov = this.detail >= 2 ? 0.55 : 0;
      [p0, p1, p2, p3] = [grow(p0, ov), grow(p1, ov), grow(p2, ov), grow(p3, ov)];
      const A = P(p0.x, h - ov * 0.35, p0.z), B = P(p1.x, h - ov * 0.35, p1.z), C = P(p2.x, h - ov * 0.35, p2.z), Dd = P(p3.x, h - ov * 0.35, p3.z);
      const side = { r: roof.r * 0.96, g: roof.g * 0.96, b: roof.b * 0.96 };
      tri(A, B, m12, roof, true);
      tri(A, m12, m30, roof, true);
      tri(C, Dd, m30, side, true);
      tri(C, m30, m12, side, true);
      tri(B, C, m12, wall, false); // frontones
      tri(Dd, A, m30, wall, false);
      // Chimenea en algunos techos
      if (this.detail >= 2 && r4 > 0.55) {
        const t = 0.35 + r3 * 0.3;
        const kx = mx + (m30.x - mx) * 0.0 + (m12.x - m30.x) * (r3 - 0.5) * 0.5;
        const kz = mz + (m12.z - m30.z) * (r3 - 0.5) * 0.5;
        box(kx, kz, h + rh * 0.5, h + rh + 1.1, t, t, { r: 0.62, g: 0.4, b: 0.34 }, { r: 0.25, g: 0.23, b: 0.23 });
      }
    } else {
      const all = outer.concat(...holes);
      const faces = this.triangulate(
        outer.map((p) => ({ x: p.x, y: p.z })),
        holes.map((r) => r.map((p) => ({ x: p.x, y: p.z }))),
      );
      const flat = opts.special || !parapet ? roof : { r: roof.r * 0.82 + 0.1, g: roof.g * 0.82 + 0.1, b: roof.b * 0.82 + 0.1 };
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
          col.push(flat.r, flat.g, flat.b);
        }
      }
      // Tanque de agua sobre algunos techos planos (muy de acá).
      if (!opts.special && this.detail > 0 && area > 40 && h < 14 && r4 < 0.28 && inside(outer, cx, cz)) {
        const t = 0.7;
        const y0 = h;
        const y1 = h + 1.5;
        const tc = { r: 0.78, g: 0.79, b: 0.82 };
        const c4 = [P(cx - t, y0, cz - t), P(cx + t, y0, cz - t), P(cx + t, y0, cz + t), P(cx - t, y0, cz + t)];
        const t4 = c4.map((q) => P(q.x, y1, q.z));
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          tri(c4[i], c4[j], t4[j], tc, false);
          tri(c4[i], t4[j], t4[i], tc, false);
        }
        tri(t4[0], t4[1], t4[2], { r: 0.66, g: 0.67, b: 0.7 }, true);
        tri(t4[0], t4[2], t4[3], { r: 0.66, g: 0.67, b: 0.7 }, true);
      }
    }

    // ---- Paredes ----
    // Pared más larga de la casa: ahí va la puerta.
    let doorEdge = -1;
    {
      let best = 0;
      for (let i = 0; i < outer.length; i++) {
        const a = outer[i];
        const b = outer[(i + 1) % outer.length];
        const L = Math.hypot(b.x - a.x, b.z - a.z);
        if (L > best) {
          best = L;
          doorEdge = i;
        }
      }
    }
    const detailOn = this.detail > 0 && !opts.special && area >= 20 && h >= 2.8;
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
          ? [[a, 0], [b, hw], [b, 0], [a, 0], [a, hw], [b, hw]]
          : [[a, 0], [b, 0], [b, hw], [a, 0], [b, hw], [a, hw]];
        for (const [p, y] of quad) {
          pos.push(p.x, y, p.z);
          nor.push(nx, 0, nz);
          col.push(wall.r, wall.g, wall.b);
        }
        if (detailOn && !isHole && len >= 3.4) this.detailWall(D, { a, dx, dz, len, nx, nz, flip, h, wall, seedA: r3, seedB: r4, door: i === doorEdge, idx: i });
      }
    };
    walls(outer, false);
    for (const r of holes) walls(r, true);
    this.centers.push(cx, cz, h);
    this.count++;
  }

  /** Ventanas, puerta, zócalo, cornisa y postigos de una pared: van en una malla aparte que solo se ve de cerca. */
  detailWall(D, w) {
    const { a, dx, dz, len, nx, nz, flip, h, wall, door, idx } = w;
    const tx = dx / len;
    const tz = dz / len;
    const put = (t0, t1, y0, y1, off, c) => {
      const ax = a.x + tx * t0 + nx * off;
      const az = a.z + tz * t0 + nz * off;
      const bx = a.x + tx * t1 + nx * off;
      const bz = a.z + tz * t1 + nz * off;
      const q = flip
        ? [[ax, az, y0], [bx, bz, y1], [bx, bz, y0], [ax, az, y0], [ax, az, y1], [bx, bz, y1]]
        : [[ax, az, y0], [bx, bz, y0], [bx, bz, y1], [ax, az, y0], [bx, bz, y1], [ax, az, y1]];
      for (const [x, z, y] of q) {
        D.pos.push(x, y, z);
        D.nor.push(nx, 0, nz);
        D.col.push(c[0], c[1], c[2]);
      }
    };
    const full = this.detail >= 2;
    const floors = Math.max(1, Math.min(full ? 3 : 2, Math.round(h / 3)));
    const fh = h / floors;
    const n = Math.min(full ? 5 : 3, Math.floor((len - 1.0) / 3.0));
    const glass = [[0.17, 0.23, 0.31], [0.21, 0.28, 0.35], [0.13, 0.18, 0.23]][Math.floor(w.seedA * 3) % 3];
    const shutter = [[0.26, 0.46, 0.3], [0.45, 0.3, 0.2], [0.3, 0.36, 0.5]][Math.floor(w.seedB * 3) % 3];
    const withShutters = full && h < 8 && w.seedB > 0.65;
    if (full) {
      // zócalo (franja oscura abajo) y cornisa (franja clara arriba)
      const dk = [wall.r * 0.72, wall.g * 0.72, wall.b * 0.72];
      put(0, len, 0, 0.75, 0.04, dk);
      if (h >= 5.5) put(0, len, h - 0.4, h, 0.14, [Math.min(1, wall.r * 1.06), Math.min(1, wall.g * 1.06), Math.min(1, wall.b * 1.06)]);
    }
    const frame = [Math.min(1, wall.r * 1.08 + 0.05), Math.min(1, wall.g * 1.08 + 0.05), Math.min(1, wall.b * 1.08 + 0.05)];
    const doorCols = [[0.34, 0.22, 0.14], [0.2, 0.35, 0.28], [0.55, 0.2, 0.18], [0.22, 0.28, 0.45], [0.16, 0.16, 0.18]];
    const doorC = doorCols[Math.floor(w.seedB * 17) % doorCols.length];
    const awning = full && door && h < 7 && w.seedA > 0.4;
    const awC = [[0.8, 0.25, 0.2], [0.2, 0.45, 0.55], [0.9, 0.75, 0.3], [0.25, 0.5, 0.3]][Math.floor(w.seedA * 13) % 4];
    const doorAt = door ? Math.floor(((w.seedA * 7.7) % 1) * Math.max(1, n)) : -1;
    for (let i = 0; i < n; i++) {
      const c = ((i + 0.5) * len) / n;
      for (let f = 0; f < floors; f++) {
        const y0 = f * fh;
        if (f === 0 && i === doorAt) {
          // puerta
          put(c - 0.62, c + 0.62, 0, Math.min(2.35, fh * 0.82), 0.05, frame);
          put(c - 0.5, c + 0.5, 0, Math.min(2.2, fh * 0.8), 0.08, doorC);
          if (awning) {
            // toldo sobre la puerta (una chapa inclinada hacia afuera)
            const y1 = Math.min(2.6, fh * 0.9);
            const q0 = [a.x + tx * (c - 1.3) + nx * 0.05, a.z + tz * (c - 1.3) + nz * 0.05];
            const q1 = [a.x + tx * (c + 1.3) + nx * 0.05, a.z + tz * (c + 1.3) + nz * 0.05];
            const q2 = [a.x + tx * (c + 1.3) + nx * 1.1, a.z + tz * (c + 1.3) + nz * 1.1];
            const q3 = [a.x + tx * (c - 1.3) + nx * 1.1, a.z + tz * (c - 1.3) + nz * 1.1];
            const V = (q, y) => ({ x: q[0], y, z: q[1] });
            const ca = { r: awC[0], g: awC[1], b: awC[2] };
            for (const [p1, p2, p3] of [[V(q0, y1), V(q1, y1), V(q2, y1 - 0.45)], [V(q0, y1), V(q2, y1 - 0.45), V(q3, y1 - 0.45)]]) {
              const ux = p2.x - p1.x, uy = p2.y - p1.y, uz = p2.z - p1.z;
              const vx = p3.x - p1.x, vy = p3.y - p1.y, vz = p3.z - p1.z;
              let ax = uy * vz - uz * vy, ay = uz * vx - ux * vz, az = ux * vy - uy * vx;
              const l = Math.hypot(ax, ay, az) || 1;
              ax /= l; ay /= l; az /= l;
              const sg = ay >= 0 ? 1 : -1;
              const pts = sg > 0 ? [p1, p2, p3] : [p1, p3, p2];
              for (const q of pts) { D.pos.push(q.x, q.y, q.z); D.nor.push(ax * sg, ay * sg, az * sg); D.col.push(ca.r, ca.g, ca.b); }
            }
          }
          continue;
        }
        if (n === 1 && f === 0 && door) continue;
        const wy0 = y0 + fh * 0.32;
        const wy1 = wy0 + Math.min(1.35, fh * 0.45);
        if (full) put(c - 0.68, c + 0.68, wy0 - 0.12, wy1 + 0.12, 0.05, frame); // marco claro
        put(c - 0.55, c + 0.55, wy0, wy1, 0.08, glass);
        if (full && f > 0 && w.seedA > 0.5) put(c - 0.9, c + 0.9, y0 - 0.06, y0 + 0.14, 0.45, [wall.r * 0.9, wall.g * 0.9, wall.b * 0.9]); // balcón
        if (withShutters) {
          put(c - 0.95, c - 0.58, wy0, wy1, 0.07, shutter);
          put(c + 0.58, c + 0.95, wy0, wy1, 0.07, shutter);
        }
      }
    }
  }

  /** @returns {{position: Float32Array, normal: Float32Array, color: Float32Array, detail: object|null}[]} */
  finish() {
    const out = [];
    for (const { pos, nor, col, d } of this.chunks.values()) {
      if (!pos.length) continue;
      out.push({
        position: Float32Array.from(pos),
        normal: Float32Array.from(nor),
        color: Float32Array.from(col),
        detail: d && d.pos.length ? { position: Float32Array.from(d.pos), normal: Float32Array.from(d.nor), color: Float32Array.from(d.col) } : null,
      });
    }
    this.chunks.clear();
    return out;
  }
}
