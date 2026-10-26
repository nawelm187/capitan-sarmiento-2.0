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

const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
const dims = (it, dw, dd) => [clampN(it.w || dw, 10, 70), clampN(it.d || dd, 8, 50)];
const pad = (w, d, color) => box(w + 1, 0.3, d + 1, mat(color, { roughness: 0.8, emissive: color, emissiveIntensity: 0.12 }), 0, 0, 0);
const flag = (g, x, z, color, h = 14) => {
  g.add(cyl(0.12, h, metal(), x, 0, z));
  g.add(box(2.4, 1.5, 0.08, mat(color, { emissive: color, emissiveIntensity: 0.2 }), x + 1.3, h - 1.6, z));
};

// Cada tipo de edificio especial tiene una silueta propia que se reconoce desde arriba.
// Orientación: el eje x del modelo es el lado largo del edificio. Colores de la base ("pad") por tipo.
const BUILDERS = {
  plaza(it) {
    const g = new THREE.Group();
    const [w, d] = dims(it, 90, 90);
    const rand = mulberry32(5);
    g.add(box(w, 0.25, 5, conc(), 0, 0, 0));
    g.add(box(5, 0.25, d, conc(), 0, 0, 0));
    g.add(cyl(9, 0.4, conc(), 0, 0, 0, 9, 28));
    g.add(cyl(6.4, 0.5, mat(0x5f93b4, { roughness: 0.2 }), 0, 0, 0, 6.4, 28));
    g.add(cyl(1.1, 5, conc(), 0, 0.4, 0, 0.6));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      tree(g, sx * w * 0.32, sz * d * 0.32, 1.1, rand);
      tree(g, sx * w * 0.18, sz * d * 0.4, 0.9, rand);
      g.add(box(4, 0.7, 1.2, mat(0x7a5a3a), sx * 12, 0.25, sz * 12));
    }
    return g;
  },
  // Iglesia: planta en cruz, torre con aguja y cruz dorada.
  iglesia(it) {
    const g = new THREE.Group();
    const [w, d] = dims(it, 36, 22);
    const nave = Math.min(16, d * 0.55);
    const roofM = mat(0x8a3f33);
    g.add(pad(w, d, 0xe6d7a3));
    g.add(box(w, 11, nave, wall(), 0, 0.3, 0));
    g.add(gable(nave + 1, 5, w + 0.6, roofM, 0, 11.3, 0).rotateY(Math.PI / 2));
    const tw = Math.min(9, w * 0.3);
    g.add(box(tw, 11, d, wall(), w * 0.08, 0.3, 0)); // crucero
    g.add(gable(tw + 1, 4.2, d + 0.6, roofM, w * 0.08, 11.3, 0));
    g.add(box(8, 27, 8, wall(), -w / 2 + 3, 0.3, 0)); // torre
    g.add(cone(6, 11, mat(0x4f5a63), -w / 2 + 3, 27.3, 0, 4).rotateY(Math.PI / 4));
    g.add(cyl(0.18, 5, mat(0xe0b53a, { metalness: 0.5, roughness: 0.4 }), -w / 2 + 3, 38.3, 0));
    g.add(box(2.6, 0.2, 0.2, mat(0xe0b53a, { metalness: 0.5, roughness: 0.4 }), -w / 2 + 3, 41, 0));
    g.add(box(0.6, 6, 4, mat(COLORS.dark), -w / 2 - 0.1, 0.3, 0)); // portal
    return g;
  },
  // Municipalidad: bloque ancho con torre de reloj y bandera.
  municipalidad(it) {
    const g = new THREE.Group();
    const [w, d] = dims(it, 44, 22);
    g.add(pad(w, d, 0x7fb4de));
    g.add(box(w, 10, d, mat(0xeadfc6), 0, 0.3, 0));
    g.add(box(w + 1, 0.8, d + 1, mat(0xf6f1e3), 0, 10.3, 0));
    g.add(box(7, 19, 7, mat(0xeadfc6), 0, 10.3, 0));
    g.add(box(5.2, 5.2, 0.4, mat(0xfaf6e8), 0, 22, 3.55)); // reloj
    g.add(box(5.2, 5.2, 0.4, mat(0xfaf6e8), 0, 22, -3.55));
    g.add(cone(5.4, 7, mat(0x5f6f7c), 0, 29.3, 0, 4).rotateY(Math.PI / 4));
    flag(g, w / 2 - 4, d / 2 - 2, 0x75aadb, 16);
    for (let i = -3; i <= 3; i++) g.add(cyl(0.45, 6, mat(0xf6f1e3), i * (w / 8), 0.3, d / 2 + 0.7, 0.45, 8));
    return g;
  },
  // Casa de la cultura: rotonda con cúpula y dos alas.
  cultura(it) {
    const g = new THREE.Group();
    const [w, d] = dims(it, 40, 24);
    const r = Math.min(d * 0.36, 9);
    g.add(pad(w, d, 0xb78ad8));
    g.add(box(w, 7, d * 0.55, mat(0xf0dfc5), 0, 0.3, 0));
    g.add(gable(d * 0.55 + 1, 2.4, w + 0.6, mat(0xa7503c), 0, 7.3, 0).rotateY(Math.PI / 2));
    g.add(cyl(r, 12, mat(0xf6ead2), 0, 0.3, 0, r, 24));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x9a63c4, { roughness: 0.5, metalness: 0.2 }));
    dome.position.set(0, 12.3, 0);
    dome.castShadow = true;
    g.add(dome);
    g.add(cyl(0.3, 4, metal(), 0, 12.3 + r, 0));
    return g;
  },
  // Museo: frente clásico con frontón y columnata.
  museo(it) {
    const g = new THREE.Group();
    const [w, d] = dims(it, 36, 22);
    g.add(pad(w, d, 0xe8b04a));
    g.add(box(w, 9, d * 0.8, mat(0xe7dcc2), 0, 0.3, -d * 0.1));
    g.add(box(w + 1, 0.7, d * 0.8 + 1, mat(0xf5efe0), 0, 9.3, -d * 0.1));
    g.add(gable(Math.min(w * 0.6, 22), 4, 1.2, mat(0xf3ecda), 0, 10, d * 0.3 + 0.4));
    const n = 6;
    const cw = Math.min(w * 0.6, 22);
    for (let i = 0; i < n; i++) g.add(cyl(0.55, 9, mat(0xf6f1e3), -cw / 2 + 1 + (i * (cw - 2)) / (n - 1), 0.3, d * 0.3 + 0.8, 0.55, 10));
    g.add(box(cw + 1, 0.6, 2.4, conc(), 0, 0.3, d * 0.3 + 0.8));
    g.add(box(w * 0.5, 0.2, d * 0.35, mat(0x7fa3a8), 0, 9.9, -d * 0.18)); // lucernario
    return g;
  },
  // Biblioteca: dos techos en V como un libro abierto.
  biblioteca(it) {
    const g = new THREE.Group();
    const [w, d] = dims(it, 28, 18);
    g.add(pad(w, d, 0x6dc08f));
    g.add(box(w, 6, d, mat(0xe9e0cc), 0, 0.3, 0));
    const a = gable(d / 2 + 0.6, 3.6, w + 0.6, mat(0x3f8f67), 0, 6.3, -d / 4).rotateY(Math.PI / 2);
    const b = gable(d / 2 + 0.6, 3.6, w + 0.6, mat(0x3f8f67), 0, 6.3, d / 4).rotateY(Math.PI / 2);
    g.add(a, b);
    return g;
  },
  // Escuela: planta en U con patio y bandera.
  escuela(it) {
    const g = new THREE.Group();
    const [w, d] = dims(it, 40, 30);
    const t = Math.min(10, d * 0.32);
    g.add(pad(w, d, 0xf0a04b));
    g.add(box(w, 6, t, mat(0xf0e2c0), 0, 0.3, -d / 2 + t / 2));
    g.add(box(t, 6, d, mat(0xf0e2c0), -w / 2 + t / 2, 0.3, 0));
    g.add(box(t, 6, d, mat(0xf0e2c0), w / 2 - t / 2, 0.3, 0));
    g.add(box(w, 0.7, t + 0.8, mat(0xd8693f), 0, 6.3, -d / 2 + t / 2));
    g.add(box(t + 0.8, 0.7, d, mat(0xd8693f), -w / 2 + t / 2, 6.3, 0));
    g.add(box(t + 0.8, 0.7, d, mat(0xd8693f), w / 2 - t / 2, 6.3, 0));
    flag(g, 0, d / 2 - 6, 0x75aadb, 12);
    return g;
  },
  // Hospital: bloque blanco con cruz roja en el techo.
  hospital(it) {
    const g = new THREE.Group();
    const [w, d] = dims(it, 40, 22);
    g.add(pad(w, d, 0xf26b6b));
    g.add(box(w, 9, d, mat(0xf4f4f1), 0, 0.3, 0));
    g.add(box(w * 0.6, 4, d * 0.6, mat(0xe8ecee), 0, 9.3, 0));
    const red = mat(0xd63a3a, { emissive: 0xd63a3a, emissiveIntensity: 0.25 });
    g.add(box(2, 0.3, 8, red, 0, 13.3, 0));
    g.add(box(8, 0.3, 2, red, 0, 13.3, 0));
    return g;
  },
  bomberos(it) {
    const g = new THREE.Group();
    const [w, d] = dims(it, 28, 18);
    g.add(pad(w, d, 0xe05a4a));
    g.add(box(w, 7, d, mat(0xc9483c), 0, 0.3, 0));
    for (let i = -1; i <= 1; i += 2) g.add(box(w * 0.28, 5, 0.5, mat(0xf3efe6), i * w * 0.24, 0.3, d / 2 + 0.2));
    g.add(box(4.5, 20, 4.5, mat(0xb83e34), w / 2 - 4, 0.3, 0));
    g.add(box(5.5, 1, 5.5, mat(0x3d3f44), w / 2 - 4, 20.3, 0));
    return g;
  },
  policia(it) {
    const g = new THREE.Group();
    const [w, d] = dims(it, 22, 14);
    g.add(pad(w, d, 0x4d6fb0));
    g.add(box(w, 5, d, mat(0xd9dde3), 0, 0.3, 0));
    g.add(box(w + 0.8, 0.6, d + 0.8, mat(0x3a58a0), 0, 5.3, 0));
    g.add(box(4, 1.2, 0.3, mat(0x4d7fe0, { emissive: 0x4d7fe0, emissiveIntensity: 0.5 }), 0, 6, d / 2));
    return g;
  },
  estacion(it) {
    const g = new THREE.Group();
    const [w, d] = dims(it, 46, 12);
    g.add(pad(w, d + 10, 0xb99a6a));
    g.add(box(w, 7, d, wall(), 0, 0.3, 0));
    g.add(gable(d + 2, 4.2, w + 2, roof(), 0, 7.3, 0).rotateY(Math.PI / 2));
    g.add(box(w + 10, 0.6, 7, conc(), 0, 0.3, d / 2 + 7)); // andén
    for (const x of [-0.36, -0.12, 0.12, 0.36]) g.add(cyl(0.3, 4.5, metal(), x * w, 0.9, d / 2 + 9));
    g.add(box(w, 0.5, 8, roof(), 0, 5.6, d / 2 + 7));
    return g;
  },
  monumento(it) {
    const g = new THREE.Group();
    g.add(pad(10, 10, 0xc9c4b8));
    g.add(box(4, 1, 4, conc(), 0, 0.3, 0));
    g.add(box(2.6, 3, 2.6, conc(), 0, 1.3, 0));
    g.add(cyl(0.5, 3, mat(0x5d7a63, { metalness: 0.35, roughness: 0.55 }), 0, 4.3, 0, 0.3, 8));
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), mat(0x5d7a63, { metalness: 0.35, roughness: 0.55 }));
    h.position.set(0, 7.9, 0);
    g.add(h);
    return g;
  },
  // Cualquier otro edificio notable: cuerpo con techo violeta bien visible.
  edificio(it) {
    const g = new THREE.Group();
    const [w, d] = dims(it, 20, 14);
    g.add(pad(w, d, 0xd19ae8));
    g.add(box(w, 7, d, wall(), 0, 0.3, 0));
    g.add(box(w + 0.8, 0.8, d + 0.8, mat(0x9a63c4), 0, 7.3, 0));
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

// Marca sobre un edificio real resaltado (modo "resaltar"): se ve desde lejos y no inventa la forma del edificio.
const EMBLEM_COLOR = { escuela: 0xe8a23a, bomberos: 0xc9382c, policia: 0x2f55a8, municipalidad: 0x2d80c4, cultura: 0x8d54b8, museo: 0xc98712, biblioteca: 0x3f8f67, iglesia: 0xd9cfae, estacion: 0x8a6a4a, edificio: 0xb07ad0 };
function emblema(it) {
  const g = new THREE.Group();
  const y = Math.max(3, it.roofH || 6);
  if (it.kind === 'hospital') {
    const red = mat(0xd63a3a, { emissive: 0xd63a3a, emissiveIntensity: 0.3 });
    g.add(box(3, 0.4, 11, red, 0, y + 0.1, 0));
    g.add(box(11, 0.4, 3, red, 0, y + 0.1, 0));
    return g;
  }
  const c = EMBLEM_COLOR[it.kind] || 0xb07ad0;
  if (it.kind === 'iglesia') {
    const gold = mat(0xe0b53a, { metalness: 0.5, roughness: 0.4 });
    g.add(cyl(0.2, 8, gold, 0, y, 0));
    g.add(box(4, 0.35, 0.35, gold, 0, y + 6, 0));
    return g;
  }
  g.add(cyl(0.16, 11, metal(), 0, y, 0));
  g.add(box(3.4, 2, 0.1, mat(c, { emissive: c, emissiveIntensity: 0.3 }), 1.8, y + 9, 0));
  return g;
}

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
    if (!obj) obj = it.mode === 'resaltar' ? emblema(it) : (BUILDERS[it.kind] || BUILDERS.edificio)(it);
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
