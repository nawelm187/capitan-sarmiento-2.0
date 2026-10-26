// Calles en 3D: calzada de cemento con juntas, veredas, pintura (líneas, bordes, sendas peatonales)
// y cánteros centrales de avenidas con árboles y estatuas. Se dibujan como cintas de geometría fina
// sobre el suelo para que se vean nítidas desde cerca (la textura del suelo no alcanza para eso).
import * as THREE from 'three';
import { CAR_HW, roadWidth, paintRoads } from './roads.js';
import { mulberry32 } from './util.js';

const TILE = 5; // metros por losa de cemento

function concreteTexture(size) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  c.fillStyle = '#b4b1a9';
  c.fillRect(0, 0, size, size);
  const rand = mulberry32(7);
  const img = c.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 22;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n * 0.9;
  }
  c.putImageData(img, 0, 0);
  // manchas suaves
  for (let i = 0; i < 26; i++) {
    c.fillStyle = `rgba(${rand() < 0.5 ? '90,86,78' : '225,222,212'},${0.05 + rand() * 0.07})`;
    c.beginPath();
    c.ellipse(rand() * size, rand() * size, size * (0.05 + rand() * 0.12), size * (0.03 + rand() * 0.08), rand() * 3, 0, 7);
    c.fill();
  }
  // juntas entre losas (en los bordes, así repiten bien)
  c.fillStyle = 'rgba(70,66,60,0.55)';
  const j = Math.max(2, size / 90);
  c.fillRect(0, 0, size, j);
  c.fillRect(0, 0, j, size);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Acumula cintas (tiras con ancho) en un mismo buffer. */
class Ribbons {
  constructor() {
    this.pos = [];
    this.uv = [];
    this.idx = [];
  }
  /** pts [{x,z}], widths número o array por punto, y = altura, uvScale>0 para coordenadas en metros/uvScale. */
  add(pts, widths, y, uvScale = 0) {
    const n = pts.length;
    if (n < 2) return;
    const base = this.pos.length / 3;
    const nx = new Array(n);
    const nz = new Array(n);
    const seg = [];
    for (let i = 1; i < n; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dz = pts[i].z - pts[i - 1].z;
      const l = Math.hypot(dx, dz) || 1;
      seg.push({ x: -dz / l, z: dx / l, l });
    }
    for (let i = 0; i < n; i++) {
      const a = seg[Math.max(0, i - 1)];
      const b = seg[Math.min(seg.length - 1, i)];
      let x = a.x + b.x;
      let z = a.z + b.z;
      const l = Math.hypot(x, z);
      if (l < 1e-4) { x = a.x; z = a.z; } else { x /= l; z /= l; }
      const k = Math.min(1.6, 1 / Math.max(0.62, x * a.x + z * a.z)); // esquina en inglete, limitada
      nx[i] = x * k;
      nz[i] = z * k;
    }
    let s = 0;
    for (let i = 0; i < n; i++) {
      if (i) s += seg[i - 1].l;
      const hw = (Array.isArray(widths) ? widths[i] : widths) / 2;
      this.pos.push(pts[i].x + nx[i] * hw, y, pts[i].z + nz[i] * hw, pts[i].x - nx[i] * hw, y, pts[i].z - nz[i] * hw);
      if (uvScale) this.uv.push(hw / uvScale + 0, s / uvScale, -hw / uvScale, s / uvScale);
      else this.uv.push(0, 0, 0, 0);
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2;
      this.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  /** Rectángulo orientado (para sendas peatonales). */
  quad(cx, cz, tx, tz, len, wid, y) {
    const base = this.pos.length / 3;
    const nx = -tz;
    const nz = tx;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      this.pos.push(cx + tx * (len / 2) * a + nx * (wid / 2) * b, y, cz + tz * (len / 2) * a + nz * (wid / 2) * b);
      this.uv.push(0, 0);
    }
    this.idx.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
  }
  mesh(material, name) {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx.length > 65000 || this.pos.length / 3 > 65000 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeVertexNormals();
    // Todas las caras miran hacia arriba (y+): se corrige el sentido si hizo falta.
    const nrm = g.getAttribute('normal');
    if (nrm.count && nrm.getY(0) < 0) {
      const ix = g.index.array;
      for (let i = 0; i < ix.length; i += 3) {
        const t = ix[i + 1];
        ix[i + 1] = ix[i + 2];
        ix[i + 2] = t;
      }
      g.index.needsUpdate = true;
      g.computeVertexNormals();
    }
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    m.name = name;
    return m;
  }
}

const layer = (color, off, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -off, polygonOffsetUnits: -off, side: THREE.DoubleSide, ...extra });

/**
 * Arma calles, veredas, pintura y cánteros. `world` ya trae roads, medians y grid.
 * Devuelve los puntos para árboles y estatuas del cantero.
 */
export function buildRoadMeshes(scene, world, { lowEnd = false } = {}) {
  const group = new THREE.Group();
  group.name = 'roads';
  const side = new Ribbons();
  const road = new Ribbons();
  for (const r of world.roads) {
    if (!CAR_HW.has(r.hw) || r.pts.length < 2) continue;
    const w = roadWidth(r);
    side.add(r.pts, w + 4.6, 0.03);
    road.add(r.pts, w, 0.05 + w * 0.0004, TILE);
  }
  const conc = concreteTexture(lowEnd ? 128 : 256);
  const roadMat = layer(0xffffff, 2, { map: conc });
  const sm = side.mesh(layer('#cbc7bd', 1), 'veredas');
  const rm = road.mesh(roadMat, 'calzadas');
  if (sm) group.add(sm);
  if (rm) group.add(rm);

  // Cánteros: cordón + pasto
  const curb = new Ribbons();
  const grass = new Ribbons();
  for (const m of world.medians) {
    curb.add(m.pts, m.w, 0.09);
    grass.add(m.pts, m.w.map((x) => Math.max(0.5, x - 0.7)), 0.11);
  }
  for (const [rib, mat, nm] of [[curb, layer('#d6d2c8', 3), 'cantero-cordon'], [grass, layer('#7aa05c', 4), 'cantero-pasto']]) {
    const m = rib.mesh(mat, nm);
    if (m) group.add(m);
  }

  // Pintura
  const paint = paintRoads(world.roads);
  const white = new Ribbons();
  const yellow = new Ribbons();
  for (const s of paint.white) white.add(s.pts, s.w, 0.12);
  for (const s of paint.yellow) yellow.add(s.pts, s.w, 0.12);
  for (const z of paint.zebras) {
    const n = Math.floor(z.w / 1.1);
    const nx = -z.tz;
    const nz = z.tx;
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * 1.1;
      white.quad(z.x + nx * o, z.z + nz * o, z.tx, z.tz, 3, 0.55, 0.12);
    }
  }
  const wm = white.mesh(layer('#f3f0e6', 5), 'pintura-blanca');
  const ym = yellow.mesh(layer('#e3b93b', 5), 'pintura-amarilla');
  if (wm) group.add(wm);
  if (ym) group.add(ym);

  // Árboles y estatuas del cantero
  const rand = mulberry32(31);
  const treeSpots = [];
  const statueSpots = [];
  for (const m of world.medians) {
    let acc = 6 + rand() * 6;
    let sAcc = 40 + rand() * 30;
    for (let i = 1; i < m.pts.length; i++) {
      const a = m.pts[i - 1];
      const b = m.pts[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      for (let d = 0; d < len; d += 1) {
        acc -= 1;
        sAcc -= 1;
        const t = d / len;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        if (sAcc <= 0 && m.w[i] >= 3.2) {
          statueSpots.push({ x, z, ry: Math.atan2(b.x - a.x, b.z - a.z) });
          sAcc = 90 + rand() * 40;
          acc = Math.max(acc, 10);
        } else if (acc <= 0) {
          treeSpots.push([x, z, 0.55 + rand() * 0.25]);
          acc = 12 + rand() * 6;
        }
      }
    }
  }
  if (statueSpots.length) {
    const n = statueSpots.length;
    const ped = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 1.6, 1.5).translate(0, 0.8, 0), new THREE.MeshStandardMaterial({ color: '#b9b4a8', roughness: 0.9 }), n);
    const body = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.4, 2, 8).translate(0, 2.6, 0), new THREE.MeshStandardMaterial({ color: '#5d7a63', roughness: 0.55, metalness: 0.35 }), n);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 8, 6).translate(0, 3.85, 0), body.material, n);
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    statueSpots.forEach((s, i) => {
      mtx.compose(new THREE.Vector3(s.x, 0.1, s.z), q.setFromAxisAngle(up, s.ry), new THREE.Vector3(1, 1, 1));
      ped.setMatrixAt(i, mtx);
      body.setMatrixAt(i, mtx);
      head.setMatrixAt(i, mtx);
    });
    for (const m of [ped, body, head]) {
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
  }
  scene.add(group);
  return { treeSpots, statueSpots, group, roadMaterial: roadMat };
}
