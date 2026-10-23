// Casas destacadas (casonas históricas, edificios con carácter). Modelo procedural con ventanas;
// con `model` en data/casonas.json se usa un .glb propio.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { v3, mat, box, gable } from './scene-utils.js';
import { COLORS } from './config.js';

function casona(it) {
  const g = new THREE.Group();
  const w = it.w || 18;
  const d = it.d || 14;
  const h = it.h || 6;
  const wallM = mat(new THREE.Color(it.wall || '#e8d8b8'));
  const roofM = mat(new THREE.Color(it.roof || '#a8483a'));
  const dark = mat(COLORS.dark, { roughness: 0.6 });
  g.add(box(w, h, d, wallM, 0, 0, 0));
  g.add(gable(w + 1, 3.2, d + 1, roofM, 0, h, 0));
  // cornisa
  g.add(box(w + 0.8, 0.5, d + 0.8, mat(0xf3ead6), 0, h - 0.5, 0));
  // frente (+z): puerta y ventanas
  const n = Math.max(2, Math.round(w / 5));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w / n) * (i + 0.5);
    const isDoor = i === Math.floor(n / 2);
    const mh = isDoor ? 3.2 : 2.2;
    g.add(box(1.7, mh, 0.35, dark, x, isDoor ? 0 : 1.1, d / 2 + 0.05));
  }
  return g;
}

export async function initCasas(scene, data) {
  const group = new THREE.Group();
  group.name = 'casas-destacadas';
  const loader = new GLTFLoader();
  for (const it of data.items || []) {
    let obj = null;
    if (it.model) {
      try {
        obj = (await loader.loadAsync(it.model)).scene;
        obj.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        if (it.scale) obj.scale.setScalar(it.scale);
      } catch {
        obj = null;
      }
    }
    if (!obj) obj = casona(it);
    const p = v3(it.lng, it.lat);
    obj.position.set(p.x, 0, p.z);
    obj.rotation.y = THREE.MathUtils.degToRad(it.rotY || 0);
    obj.name = `casona:${it.id}`;
    group.add(obj);
  }
  scene.add(group);
  return group;
}
