// Hitos del pueblo. Cada "kind" tiene un modelo procedural simple; con `model: "models/x.glb"`
// en data/landmarks.json se usa un modelo propio en su lugar.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { v3, mat, box, cyl, cone, gable } from './scene-utils.js';
import { COLORS } from './config.js';
import { mulberry32 } from './util.js';

const wall = () => mat(COLORS.wall);
const roof = () => mat(COLORS.roof);
const metal = () => mat(COLORS.metal, { roughness: 0.5, metalness: 0.3 });
const conc = () => mat(COLORS.concrete);

function tree(g, x, z, s = 1, rand = Math.random) {
  g.add(cyl(0.5 * s, 4 * s, mat(0x6b4f35), x, 0, z));
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4 * s, 0), mat(new THREE.Color().setHSL(0.26 + rand() * 0.05, 0.4, 0.34)));
  c.position.set(x, 6.5 * s, z);
  c.castShadow = true;
  g.add(c);
}

const BUILDERS = {
  plaza(it) {
    const g = new THREE.Group();
    const [w, d] = it.size || [90, 90];
    const rand = mulberry32(5);
    // veredas diagonales y rotonda central
    g.add(box(w, 0.25, 5, conc(), 0, 0, 0));
    g.add(box(5, 0.25, d, conc(), 0, 0, 0));
    const ring = cyl(9, 0.4, conc(), 0, 0, 0, 9, 28);
    g.add(ring);
    const water = cyl(6.4, 0.5, mat(0x5f93b4, { roughness: 0.2 }), 0, 0, 0, 6.4, 28);
    g.add(water);
    g.add(cyl(1.1, 5, conc(), 0, 0.4, 0, 0.6));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      tree(g, sx * w * 0.32, sz * d * 0.32, 1.1, rand);
      tree(g, sx * w * 0.18, sz * d * 0.4, 0.9, rand);
      g.add(box(4, 0.7, 1.2, mat(0x7a5a3a), sx * 12, 0.25, sz * 12));
    }
    return g;
  },
  iglesia(it) {
    const g = new THREE.Group();
    g.add(box(16, 12, 34, wall(), 0, 0, 4));
    g.add(gable(17, 5.5, 34, roof(), 0, 12, 4));
    g.add(box(10, 28, 10, wall(), 0, 0, -16));
    g.add(cone(7.4, 12, roof(), 0, 28, -16, 4).rotateY(Math.PI / 4));
    g.add(cyl(0.18, 4, metal(), 0, 40, -16));
    g.add(box(2.6, 0.18, 0.18, metal(), 0, 42.6, -16));
    g.add(box(4, 6, 0.6, mat(COLORS.dark), 0, 0, -21.1)); // portal
    return g;
  },
  estacion(it) {
    const g = new THREE.Group();
    g.add(box(46, 7, 12, wall(), 0, 0, 0));
    g.add(gable(14, 4.2, 48, roof(), 0, 7, 0).rotateY(Math.PI / 2));
    g.add(box(60, 0.6, 7, conc(), 0, 0, 14)); // andén
    g.add(box(40, 0.25, 7, mat(COLORS.dark), 0, 0.6, 14).translateY(0)); // techo del andén (plano)
    for (const x of [-18, -6, 6, 18]) g.add(cyl(0.3, 4.5, metal(), x, 0.6, 16));
    g.add(box(46, 0.5, 8, roof(), 0, 5.2, 14));
    return g;
  },
  tanque(it) {
    const g = new THREE.Group();
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(cyl(0.7, 22, metal(), sx * 4.2, 0, sz * 4.2));
    g.add(cyl(8, 9, metal(), 0, 22, 0, 8, 24));
    g.add(cone(8.4, 3.5, metal(), 0, 31, 0, 24));
    return g;
  },
  silo(it) {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      g.add(cyl(6, 26, metal(), i * 13.5 - 20, 0, 0, 6, 20));
      g.add(cone(6.2, 4.5, metal(), i * 13.5 - 20, 26, 0, 20));
    }
    g.add(box(60, 5, 10, conc(), 0, 0, 12));
    g.add(box(4, 36, 4, conc(), -26, 0, -8));
    return g;
  },
};

export async function initLandmarks(scene, data) {
  const group = new THREE.Group();
  group.name = 'landmarks';
  const loader = new GLTFLoader();
  for (const it of data.items || []) {
    let obj = null;
    if (it.model) {
      try {
        const gltf = await loader.loadAsync(it.model);
        obj = gltf.scene;
        obj.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        if (it.scale) obj.scale.setScalar(it.scale);
      } catch {
        obj = null; // si el modelo falla, usa el procedural
      }
    }
    if (!obj && BUILDERS[it.kind]) obj = BUILDERS[it.kind](it);
    if (!obj) continue;
    const p = v3(it.lng, it.lat);
    obj.position.set(p.x, 0, p.z);
    obj.rotation.y = THREE.MathUtils.degToRad(it.rotY || 0);
    obj.name = `landmark:${it.id}`;
    group.add(obj);
  }
  scene.add(group);
  return group;
}
