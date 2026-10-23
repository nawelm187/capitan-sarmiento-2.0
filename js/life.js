// Vida ambiental: peatones que caminan por las calles y pájaros que dan vueltas.
// Todo con InstancedMesh (un draw call por tipo).
import * as THREE from 'three';
import { buildPath, sample } from './route.js';
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
      return { path, d: rand() * path.len, v: 0.9 + rand() * 0.9, dir: rand() < 0.5 ? 1 : -1, off: (rand() < 0.5 ? -1 : 1) * (4 + rand() * 1.5) };
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
