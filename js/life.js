// Vida ambiental: peatones que caminan por las calles y pájaros que dan vueltas.
// Todo con InstancedMesh (un draw call por tipo).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildPath, sample } from './route.js';
import { CAR_HW, roadWidth } from './roads.js';
import { mulberry32 } from './util.js';
import { REDUCED_MOTION } from './config.js';

export function initLife(scene, world, { lowEnd = false } = {}) {
  const rand = mulberry32(31);
  const parts = [];

  // ---- Peatones ----
  const lines = world.roads.filter((r) => r.pts.length > 1 && ['residential', 'primary', 'secondary', 'tertiary', 'pedestrian', 'living_street', 'footway'].includes(r.hw));
  if (lines.length) {
    const count = lowEnd ? 40 : 90;
    const mesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.7, 1.5, 3, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), count);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    const palette = [0xf2c879, 0xe8795a, 0x6aa7e8, 0xf0efe6, 0x7ccfa0, 0xc79bd6].map((c) => new THREE.Color(c));
    const agents = Array.from({ length: count }, (_, i) => {
      const line = lines[Math.floor(rand() * lines.length)];
      const path = buildPath(line.pts);
      mesh.setColorAt(i, palette[i % palette.length]);
      return { path, d: rand() * path.len, v: 0.9 + rand() * 0.9, dir: rand() < 0.5 ? 1 : -1, off: (rand() < 0.5 ? -1 : 1) * ((CAR_HW.has(line.hw) ? roadWidth(line) / 2 + 1.2 : 1) + rand() * 1.2) };
    });
    scene.add(mesh);
    const m = new THREE.Matrix4();
    const place = () => {
      agents.forEach((a, i) => {
        const s = sample(a.path, a.d);
        m.makeTranslation(s.x - s.tz * a.off, 1.45, s.z + s.tx * a.off);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    place();
    parts.push((dt) => {
      for (const a of agents) {
        a.d += a.v * a.dir * dt;
        if (a.d > a.path.len) {
          a.d = a.path.len;
          a.dir = -1;
        } else if (a.d < 0) {
          a.d = 0;
          a.dir = 1;
        }
      }
      place();
    });
  }


  // ---- Tránsito: autos, camiones, motos y bicis ----
  const roadsForCars = world.roads.filter((r) => CAR_HW.has(r.hw) && r.hw !== 'service' && r.pts.length > 1);
  const paths = roadsForCars.map((r) => ({ r, path: buildPath(r.pts) })).filter((x) => x.path.len > 40);
  if (paths.length) {
    // Índice de vértices para pasar de una calle a otra al llegar al final.
    const vkey = (p) => `${Math.round(p.x)},${Math.round(p.z)}`;
    const vindex = new Map();
    paths.forEach((pp, pi) => {
      pp.path.pts.forEach((p, i) => {
        const k = vkey(p);
        if (!vindex.has(k)) vindex.set(k, []);
        vindex.get(k).push({ pi, i });
      });
    });
    const weights = paths.map((x) => Math.min(x.path.len, 400) * (['primary', 'secondary', 'trunk', 'tertiary'].includes(x.r.hw) ? 2.2 : 1));
    const wsum = weights.reduce((a, b) => a + b, 0);
    const pickRoad = () => {
      let t = rand() * wsum;
      for (let i = 0; i < weights.length; i++) {
        t -= weights[i];
        if (t <= 0) return i;
      }
      return weights.length - 1;
    };

    // Modelos chicos con color por vértice (la carrocería se tiñe con el color de cada instancia).
    const part = (g, x, y, z, rgb) => {
      g.translate(x, y, z);
      const n = g.getAttribute('position').count;
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.set(rgb, i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      g.deleteAttribute('uv');
      return g;
    };
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const W = (r, w) => new THREE.CylinderGeometry(r, r, w, 8).rotateX(Math.PI / 2);
    const BODY = [1, 1, 1];
    const GLASS = [0.16, 0.2, 0.26];
    const DARK = [0.08, 0.08, 0.09];
    const SC = 1.35; // un poco más grandes que en la realidad para que se vean desde arriba
    const sc = (g) => g.scale(SC, SC, SC);
    const models = {
      auto: {
        n: lowEnd ? 26 : 64,
        v: [7, 12],
        geo: sc(mergeGeometries([
          part(B(4.2, 0.8, 1.8), 0, 0.7, 0, BODY),
          part(B(2.2, 0.7, 1.6), -0.2, 1.4, 0, GLASS),
          part(B(2.0, 0.12, 1.5), -0.2, 1.78, 0, BODY),
          part(W(0.32, 1.9), 1.3, 0.32, 0, DARK),
          part(W(0.32, 1.9), -1.3, 0.32, 0, DARK),
        ])),
        colors: [0xd8d8d4, 0x8e949a, 0x1f2a3a, 0xb23a3a, 0x3d6aa8, 0xe0b53a, 0x2f2f33, 0x5a8a62],
        shadow: true,
      },
      camion: {
        n: lowEnd ? 4 : 9,
        v: [5, 8],
        geo: sc(mergeGeometries([
          part(B(6.4, 2.6, 2.4), -1.2, 2.0, 0, BODY),
          part(B(2.0, 2.1, 2.3), 3.0, 1.5, 0, [0.85, 0.85, 0.85]),
          part(B(0.1, 0.9, 2.0), 4.05, 1.9, 0, GLASS),
          part(B(8.6, 0.4, 2.2), 0, 0.5, 0, DARK),
          part(W(0.5, 2.5), 3.0, 0.5, 0, DARK),
          part(W(0.5, 2.5), -1.0, 0.5, 0, DARK),
          part(W(0.5, 2.5), -3.0, 0.5, 0, DARK),
        ])),
        colors: [0xe8e3d4, 0x3d6aa8, 0xb23a3a, 0xe0b53a, 0x5a8a62],
        shadow: true,
      },
      moto: {
        n: lowEnd ? 10 : 26,
        v: [6, 10],
        geo: sc(mergeGeometries([
          part(B(1.8, 0.35, 0.4), 0, 0.75, 0, BODY),
          part(B(0.5, 0.9, 0.45), -0.1, 1.35, 0, [0.15, 0.15, 0.17]),
          part(B(0.4, 0.14, 0.7), 0.6, 1.25, 0, DARK),
          part(W(0.34, 0.2), 0.75, 0.34, 0, DARK),
          part(W(0.34, 0.2), -0.75, 0.34, 0, DARK),
        ])),
        colors: [0xc9483c, 0x2f2f33, 0x3d6aa8, 0xe0b53a, 0xe8e3d4],
        shadow: false,
      },
      bici: {
        n: lowEnd ? 8 : 24,
        v: [2.6, 4.2],
        geo: sc(mergeGeometries([
          part(B(1.5, 0.12, 0.12), 0, 0.85, 0, BODY),
          part(B(0.4, 1.0, 0.3), -0.1, 1.5, 0, [0.9, 0.55, 0.3]),
          part(W(0.36, 0.1), 0.7, 0.36, 0, DARK),
          part(W(0.36, 0.1), -0.7, 0.36, 0, DARK),
        ])),
        colors: [0x3d6aa8, 0xb23a3a, 0x5a8a62, 0xe0b53a, 0x2f2f33],
        shadow: false,
      },
    };

    const m = new THREE.Matrix4();
    const turn = (v) => {
      // Al llegar al final, sigue por otra calle que se junte ahí; si no hay, da la vuelta.
      const pp = paths[v.pi];
      const endPt = v.dir > 0 ? pp.path.pts[pp.path.pts.length - 1] : pp.path.pts[0];
      const opts = (vindex.get(vkey(endPt)) || []).filter((o) => o.pi !== v.pi);
      if (!opts.length) {
        v.dir = -v.dir;
        return;
      }
      const o = opts[Math.floor(rand() * opts.length)];
      const np = paths[o.pi].path;
      v.pi = o.pi;
      v.d = np.cum[o.i];
      if (v.d <= 0.5) v.dir = 1;
      else if (v.d >= np.len - 0.5) v.dir = -1;
      else v.dir = rand() < 0.5 ? 1 : -1;
    };

    for (const [kind, spec] of Object.entries(models)) {
      const n = spec.n;
      const mesh = new THREE.InstancedMesh(spec.geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 }), n);
      mesh.frustumCulled = false;
      mesh.castShadow = spec.shadow && !lowEnd;
      mesh.name = `transito:${kind}`;
      const col = new THREE.Color();
      const vs = Array.from({ length: n }, (_, i) => {
        const pi = pickRoad();
        col.setHex(spec.colors[i % spec.colors.length]);
        mesh.setColorAt(i, col);
        return { pi, d: rand() * paths[pi].path.len, dir: rand() < 0.5 ? 1 : -1, v: spec.v[0] + rand() * (spec.v[1] - spec.v[0]) };
      });
      scene.add(mesh);
      const place = () => {
        vs.forEach((v, i) => {
          const pp = paths[v.pi];
          const s = sample(pp.path, v.d);
          const tx = s.tx * v.dir;
          const tz = s.tz * v.dir;
          const w = roadWidth(pp.r);
          const lane = kind === 'bici' ? w / 2 - 1.1 : kind === 'camion' ? w / 4 : w / 4 + (i % 2 ? 0.3 : -0.2);
          // mano derecha (Argentina)
          const x = s.x - tz * lane;
          const z = s.z + tx * lane;
          m.makeRotationY(Math.atan2(-tz, tx));
          m.setPosition(x, 0.12, z);
          mesh.setMatrixAt(i, m);
        });
        mesh.instanceMatrix.needsUpdate = true;
      };
      place();
      parts.push((dt) => {
        for (const v of vs) {
          const pp = paths[v.pi].path;
          v.d += v.v * v.dir * dt;
          if (v.d >= pp.len) {
            v.d = pp.len;
            turn(v);
          } else if (v.d <= 0) {
            v.d = 0;
            turn(v);
          }
        }
        place();
      });
    }
  }

  // ---- Pájaros ----
  {
    const count = lowEnd ? 6 : 14;
    const geo = new THREE.ConeGeometry(0.9, 3, 4);
    geo.rotateX(Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x2b2f36 }), count);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const birds = Array.from({ length: count }, () => ({
      r: 120 + rand() * 520,
      a: rand() * Math.PI * 2,
      w: (0.04 + rand() * 0.05) * (rand() < 0.5 ? -1 : 1),
      y: 70 + rand() * 90,
      cx: (rand() - 0.5) * 500,
      cz: (rand() - 0.5) * 500,
    }));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const place = () => {
      birds.forEach((b, i) => {
        pos.set(b.cx + Math.cos(b.a) * b.r, b.y + Math.sin(b.a * 3) * 4, b.cz + Math.sin(b.a) * b.r);
        q.setFromAxisAngle(up, -b.a + (b.w > 0 ? Math.PI : 0));
        m.compose(pos, q, one);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    place();
    parts.push((dt) => {
      for (const b of birds) b.a += b.w * dt;
      place();
    });
  }

  return {
    update(dt) {
      if (REDUCED_MOTION) return;
      for (const f of parts) f(dt);
    },
  };
}
