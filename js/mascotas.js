// Guiños propios del pueblo: animales y vehículos animados (perros, caballos, un auto).
// Se definen en data/mascots.json. Con `model` se usa un .glb propio (queda estático).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { v3, mat, box, cyl } from './scene-utils.js';
import { toLocal } from './geo.js';
import { buildPath, sample } from './route.js';
import { mulberry32, lerpAngle } from './util.js';
import { REDUCED_MOTION } from './config.js';

function dog(color) {
  const g = new THREE.Group();
  const m = mat(new THREE.Color(color));
  g.add(box(0.6, 0.6, 1.5, m, 0, 0.55, 0));
  const head = box(0.5, 0.5, 0.55, m, 0, 0.95, 0.95);
  g.add(head);
  g.add(box(0.2, 0.2, 0.3, mat(0x222222), 0, 0.95, 1.3));
  const tail = box(0.14, 0.14, 0.6, m, 0, 1.0, -0.95);
  tail.rotation.x = -0.6;
  g.add(tail);
  for (const [x, z] of [[-0.2, -0.55], [0.2, -0.55], [-0.2, 0.55], [0.2, 0.55]]) g.add(box(0.14, 0.55, 0.14, m, x, 0, z));
  g.userData.tail = tail;
  return g;
}

function horse(color) {
  const g = new THREE.Group();
  const m = mat(new THREE.Color(color));
  g.add(box(0.9, 1.0, 2.4, m, 0, 1.2, 0));
  const neck = box(0.45, 1.3, 0.55, m, 0, 1.7, 1.25);
  neck.rotation.x = 0.5;
  g.add(neck);
  const head = box(0.4, 0.45, 0.95, m, 0, 2.55, 1.85);
  head.rotation.x = 0.35;
  g.add(head);
  g.add(box(0.12, 0.7, 0.25, mat(0x2a1d14), 0, 2.4, 1.0));
  for (const [x, z] of [[-0.3, -0.9], [0.3, -0.9], [-0.3, 0.9], [0.3, 0.9]]) g.add(box(0.2, 1.3, 0.2, m, x, 0, z));
  g.userData.head = head;
  return g;
}

function car(color) {
  const g = new THREE.Group();
  g.add(box(1.8, 0.75, 4.2, mat(new THREE.Color(color), { roughness: 0.4, metalness: 0.3 }), 0, 0.45, 0));
  g.add(box(1.6, 0.7, 2.1, mat(0x9fc4d8, { roughness: 0.2 }), 0, 1.15, -0.2));
  for (const [x, z] of [[-0.95, -1.3], [0.95, -1.3], [-0.95, 1.3], [0.95, 1.3]]) {
    const w = cyl(0.42, 0.3, mat(0x1b1b1b), x, 0, z, 0.42, 12);
    w.rotation.z = Math.PI / 2;
    w.position.y = 0.42;
    g.add(w);
  }
  return g;
}

const MAKERS = { perro: dog, caballo: horse, auto: car };

export async function initMascotas(scene, data) {
  const rand = mulberry32(77);
  const loader = new GLTFLoader();
  const group = new THREE.Group();
  group.name = 'mascotas';
  const actors = [];

  for (const it of data.items || []) {
    let obj = null;
    let isModel = false;
    if (it.model) {
      try {
        obj = (await loader.loadAsync(it.model)).scene;
        obj.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        isModel = true;
      } catch {
        obj = null;
      }
    }
    if (!obj && MAKERS[it.type]) obj = MAKERS[it.type](it.color || '#b98a5e');
    if (!obj) continue;
    obj.scale.setScalar(it.scale || 1); // en una maqueta se exagera el tamaño para que se vean
    obj.name = `mascota:${it.id}`;
    group.add(obj);

    if (it.type === 'auto' && Array.isArray(it.loop) && it.loop.length > 1) {
      const path = buildPath(it.loop.map(([lng, lat]) => toLocal(lng, lat)));
      actors.push({ kind: 'auto', obj, path, d: 0, speed: it.speed || 8 });
      const s = sample(path, 0);
      obj.position.set(s.x, 0, s.z);
    } else {
      const home = v3(it.lng, it.lat);
      obj.position.copy(home);
      obj.rotation.y = rand() * Math.PI * 2;
      actors.push({ kind: it.type, obj, home, radius: it.radius || 30, target: home.clone(), wait: rand() * 3, heading: obj.rotation.y, isModel, t: rand() * 10 });
    }
  }
  scene.add(group);

  const tmp = new THREE.Vector3();
  return {
    update(dt) {
      if (REDUCED_MOTION) return;
      for (const a of actors) {
        if (a.kind === 'auto') {
          a.d = (a.d + a.speed * dt) % a.path.len;
          const s = sample(a.path, a.d);
          a.obj.position.set(s.x - s.tz * 3, 0, s.z + s.tx * 3);
          a.obj.rotation.y = Math.atan2(s.tx, s.tz);
          continue;
        }
        a.t += dt;
        if (a.wait > 0) {
          a.wait -= dt;
          if (a.kind === 'caballo' && a.obj.userData.head) a.obj.userData.head.rotation.x = 0.35 + Math.sin(a.t * 1.3) * 0.25;
          if (a.kind === 'perro' && a.obj.userData.tail) a.obj.userData.tail.rotation.z = Math.sin(a.t * 14) * 0.5;
          continue;
        }
        tmp.subVectors(a.target, a.obj.position);
        const dist = tmp.length();
        if (dist < 1) {
          const ang = rand() * Math.PI * 2;
          const r = rand() * a.radius;
          a.target.set(a.home.x + Math.cos(ang) * r, 0, a.home.z + Math.sin(ang) * r);
          a.wait = 2 + rand() * (a.kind === 'caballo' ? 8 : 4);
          continue;
        }
        const speed = a.kind === 'perro' ? 3.4 : 1.4;
        tmp.normalize();
        a.heading = lerpAngle(a.heading, Math.atan2(tmp.x, tmp.z), Math.min(1, dt * 4));
        a.obj.rotation.y = a.heading;
        a.obj.position.x += Math.sin(a.heading) * speed * dt;
        a.obj.position.z += Math.cos(a.heading) * speed * dt;
        if (a.kind === 'perro' && a.obj.userData.tail) a.obj.userData.tail.rotation.z = Math.sin(a.t * 18) * 0.6;
      }
    },
  };
}
