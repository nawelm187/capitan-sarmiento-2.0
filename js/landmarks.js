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

// Edificios importantes sobre el edificio REAL resaltado (modo "resaltar"): se arma la parte arquitectónica
// reconocible (torres, pórticos, relojes, cruces, cubiertas) encima del techo, con el tamaño del edificio real.
const M = {
  cream: () => mat(0xf1e8d2),
  white: () => mat(0xf7f3ea),
  dark: () => mat(0x2a2d33, { roughness: 0.7 }),
  gold: () => mat(0xe0b53a, { metalness: 0.55, roughness: 0.35 }),
  slate: () => mat(0x4f5a63, { roughness: 0.6 }),
  brick: () => mat(0x9a4b3a),
  glass: () => mat(0x9fc1d6, { roughness: 0.15, metalness: 0.2 }),
  clock: () => mat(0xfbf8ee, { emissive: 0xfff3c4, emissiveIntensity: 0.18 }),
};
const rim = (g, w, d, y, m, hgt = 0.9, t = 0.35) => {
  // parapeto / balaustrada que rodea el techo
  g.add(box(w, hgt, t, m, 0, y, d / 2 - t / 2));
  g.add(box(w, hgt, t, m, 0, y, -d / 2 + t / 2));
  g.add(box(t, hgt, d, m, w / 2 - t / 2, y, 0));
  g.add(box(t, hgt, d, m, -w / 2 + t / 2, y, 0));
};
const arches = (g, cx, cy, cz, n, gap, wd, ht, side, m) => {
  // ventanas/arcos oscuros sobre una cara de una torre: side = 'z+' | 'z-' | 'x+' | 'x-'
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * gap;
    const arch = box(wd, ht, 0.25, m, 0, 0, 0);
    arch.position.set(side[0] === 'x' ? cx : cx + o, cy, side[0] === 'x' ? cz + o : cz);
    if (side[0] === 'x') arch.rotation.y = Math.PI / 2;
    g.add(arch);
  }
};
const crossAt = (g, x, y, z, k = 1) => {
  g.add(box(0.25 * k, 3.2 * k, 0.25 * k, M.gold(), x, y, z));
  g.add(box(1.8 * k, 0.25 * k, 0.25 * k, M.gold(), x, y + 2.1 * k, z));
};
const clockFaces = (g, x, y, z, half, r = 1.5) => {
  for (const [dx, dz, ry] of [[0, half, 0], [0, -half, 0], [half, 0, Math.PI / 2], [-half, 0, Math.PI / 2]]) {
    const f = cyl(r, 0.25, M.clock(), 0, 0, 0, r, 20);
    f.rotation.x = Math.PI / 2;
    const hold = new THREE.Group();
    hold.add(f);
    hold.add(box(0.14, r * 0.8, 0.2, M.dark(), 0, 0.05, 0.1));
    hold.add(box(r * 0.55, 0.14, 0.2, M.dark(), r * 0.2, 0, 0.1));
    hold.position.set(x + dx, y, z + dz);
    hold.rotation.y = ry;
    g.add(hold);
  }
};
const flagAt = (g, x, y, z, color, h) => {
  const f = new THREE.Group();
  flag(f, 0, 0, color, h);
  f.position.set(x, y, z);
  g.add(f);
};
const colonnade = (g, w, y, zf, n, h, m) => {
  for (let i = 0; i < n; i++) g.add(cyl(0.5, h, m, -w / 2 + 1 + (i * (w - 2)) / (n - 1), y, zf, 0.5, 10));
};

// El frente del edificio (lado que da a la calle) lo calcula `npm run lugares` (it.fr: 0 +z, 1 +x, 2 -z, 3 -x del eje del edificio).
function emblema(it) {
  const q = (it.fr || (it.kind === 'iglesia' ? 1 : 0)) % 4;
  let W = clampN(it.ew || 24, 10, 70);
  let D = clampN(it.ed || 14, 8, 50);
  if (q % 2) [W, D] = [D, W];
  const inner = emblemaDe(it, W, D);
  if (it.solid) inner.add(solidBody(it, W, D));
  inner.rotation.y = [0, Math.PI / 2, Math.PI, -Math.PI / 2][q];
  const out = new THREE.Group();
  out.add(inner);
  return out;
}

const OCRE = () => mat(0xd9a21e, { roughness: 0.8 });
const BRICK2 = () => mat(0xa58b72, { roughness: 0.95 });
const GREENT = () => mat(0x4f9a5a, { roughness: 0.8 });
const IRON = () => mat(0x23262b, { roughness: 0.6, metalness: 0.4 });
const textPlane = (text, w, h, fg = '#2b2b2b', bg = null, font = 'bold 64px serif') => {
  let tex = null;
  try {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = Math.round((512 * h) / w);
    const c = cv.getContext('2d');
    if (bg) { c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height); }
    c.fillStyle = fg; c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, cv.width / 2, cv.height / 2, cv.width * 0.96);
    tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
  } catch { /* sin canvas: queda sin letras */ }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: !bg, opacity: tex ? 1 : 0, depthWrite: false }));
  return m;
};
// Ventana con marco: (x, y0) esquina inferior, ancho, alto, z de la fachada; arco de medio punto opcional.
const win = (g, x, y0, w, h, z, frameM, glassM, arch = false) => {
  g.add(box(w + 0.5, h + 0.4 + (arch ? w / 2 : 0), 0.18, frameM, x, y0 - 0.2, z));
  g.add(box(w, h, 0.22, glassM, x, y0, z + 0.04));
  if (arch) {
    const dsc = cyl(w / 2, 0.22, glassM, 0, 0, 0, w / 2, 14);
    dsc.rotation.x = Math.PI / 2;
    dsc.position.set(x, y0 + h, z + 0.04);
    g.add(dsc);
  }
};
const railing = (g, x, y, z, w, m, n = 9) => {
  g.add(box(w, 0.1, 0.1, m, x, y + 0.95, z));
  g.add(box(w, 0.08, 0.08, m, x, y + 0.1, z));
  for (let i = 0; i < n; i++) g.add(box(0.06, 0.95, 0.06, m, x - w / 2 + (i * w) / (n - 1), y + 0.1, z));
};
const lampPost = (g, x, z) => {
  g.add(cyl(0.12, 3.6, mat(0x2f4a3a, { metalness: 0.3 }), x, 0, z, 0.12, 8));
  for (const dx of [-0.5, 0.5]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), mat(0xfff1c4, { emissive: 0xffe6a8, emissiveIntensity: 0.6 }));
    b.position.set(x + dx, 3.8, z);
    g.add(b);
  }
  g.add(box(1.1, 0.1, 0.1, mat(0x2f4a3a), x, 3.6, z));
};
const palm = (g, x, z, h = 8) => {
  g.add(cyl(0.45, h, mat(0x7a6045), x, 0, z, 0.32, 8));
  for (let i = 0; i < 7; i++) {
    const f = cone(0.5, 4.2, mat(0x3f7a3a), 0, 0, 0, 4);
    f.scale.set(1, 1, 0.25);
    f.rotation.z = Math.PI / 2 + 0.5;
    const hold = new THREE.Group();
    hold.add(f);
    f.position.set(1.8, 0, 0);
    hold.position.set(x, h, z);
    hold.rotation.y = (i / 7) * Math.PI * 2;
    g.add(hold);
  }
};

// Cuerpo completo para edificios importantes que no están en la capa de edificios del mapa.
const SOLID_COL = { museo: [0xf3e6c6, 0xf0e2bd], banconacion: [0xefe4c9, 0xe2d7bc], iglesia: [0xa88f76, 0x8d8a82], municipalidad: [0xf3ead2, 0xe9e0c6], hospital: [0xffffff, 0xe8ecee], estacion: [0xe7dac2, 0x8a6a4a], cultura: [0xf0e0d8, 0xd9c3b8], biblioteca: [0xe4eadb, 0xcfd8c6] };
function solidBody(it, W, D) {
  const b = new THREE.Group();
  const y = Math.max(3, it.roofH || 6);
  const [wc, rc] = SOLID_COL[it.kind] || [0xeee3dc, 0xcfc6bd];
  b.add(box(W, y, D, mat(wc), 0, 0, 0));
  if (it.kind === 'iglesia') b.add(gable(W, 3.6, D + 0.8, mat(rc, { roughness: 0.7 }), 0, y, 0));
  else b.add(box(W + 0.3, 0.3, D + 0.3, mat(rc), 0, y, 0));
  return b;
}

function emblemaDe(it, W, D) {
  const g = new THREE.Group();
  const y = Math.max(3, it.roofH || 6);
  const k = it.kind;

  if (k === 'hospital') {
    const red = mat(0xd63a3a, { emissive: 0xd63a3a, emissiveIntensity: 0.3 });
    g.add(box(2.6, 0.4, 9, red, 0, y + 0.1, 0));
    g.add(box(9, 0.4, 2.6, red, 0, y + 0.1, 0));
    rim(g, W, D, y, M.white(), 0.7, 0.3);
    g.add(box(Math.min(10, W * 0.3), 3.4, Math.min(8, D * 0.5), M.white(), -W * 0.28, y, 0)); // caja de escalera
    g.add(box(Math.min(10, W * 0.3) + 0.6, 0.4, Math.min(8, D * 0.5) + 0.6, M.slate(), -W * 0.28, y + 3.4, 0));
    g.add(box(Math.min(16, W * 0.5), 0.45, 3.2, mat(0xd63a3a), 0, 3.1, D / 2 + 1.6)); // marquesina de guardia
    for (const x of [-1, 1]) g.add(cyl(0.22, 3.1, M.white(), x * Math.min(7, W * 0.22), 0, D / 2 + 2.8, 0.22, 8));
    g.add(cyl(0.12, 9, metal(), W * 0.4, y, -D * 0.3)); // antena
    return g;
  }
  if (k === 'iglesia') {
    // Iglesia con torre campanario en la esquina del frente (ladrillo visto y revoque blanco, arcos con ribete verde).
    const white = mat(0xf2efe6, { roughness: 0.9 });
    const zf = D / 2;
    const fh = y + 3; // el frente sobresale un poco por encima de la nave
    g.add(box(W + 0.4, fh, 0.9, white, 0, 0, zf - 0.2)); // lienzo blanco del frente
    g.add(box(W + 1.0, 0.7, 1.4, white, 0, fh, zf - 0.2)); // cornisa
    g.add(box(W * 0.7, 1.4, 1.0, white, W * 0.1, fh + 0.7, zf - 0.2)); // remate
    // pórtico: tres arcos con ribete verde
    const nArc = 3;
    const tw = Math.min(7.5, W * 0.4);
    for (let i = 0; i < nArc; i++) {
      const ax = -W / 2 + tw + 1.6 + ((i + 0.5) * (W - tw - 3.2)) / nArc;
      const aw = Math.min(2.6, (W - tw - 3.2) / nArc - 0.9);
      g.add(box(aw + 0.5, 3.4, 0.2, GREENT(), ax, 0, zf + 0.3));
      const rg = cyl((aw + 0.5) / 2, 0.2, GREENT(), 0, 0, 0, (aw + 0.5) / 2, 16);
      rg.rotation.x = Math.PI / 2;
      rg.position.set(ax, 3.4, zf + 0.3);
      g.add(rg);
      g.add(box(aw, 3.4, 0.24, M.dark(), ax, 0, zf + 0.36));
      const dk = cyl(aw / 2, 0.24, M.dark(), 0, 0, 0, aw / 2, 16);
      dk.rotation.x = Math.PI / 2;
      dk.position.set(ax, 3.4, zf + 0.36);
      g.add(dk);
      // paños de ladrillo y ventana alta sobre cada arco
      g.add(box(aw + 0.6, 4.2, 0.12, BRICK2(), ax, 5.0, zf + 0.3));
      g.add(box(aw * 0.45, 2.6, 0.16, M.dark(), ax, 5.7, zf + 0.38));
    }
    g.add(box(W, 0.35, 0.3, white, 0, 4.4, zf + 0.45)); // faja
    // torre: dos cuerpos de ladrillo con esquinas blancas, campanario con persianas, reloj y aguja verde-gris
    const tx = -W / 2 + tw / 2;
    const tz = zf - tw / 2 + 0.2;
    const body = (h0, h1, wd) => {
      g.add(box(wd, h1 - h0, wd, BRICK2(), tx, h0, tz));
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g.add(box(0.55, h1 - h0, 0.55, white, tx + sx * (wd / 2 - 0.2), h0, tz + sz * (wd / 2 - 0.2)));
    };
    const h1 = y + 7;
    const h2 = y + 14;
    body(fh - 0.5, h1, tw);
    g.add(box(tw + 0.9, 0.6, tw + 0.9, white, tx, h1, tz));
    body(h1 + 0.6, h2, tw * 0.86);
    for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, 0], [1, 0, Math.PI / 2], [-1, 0, Math.PI / 2]]) {
      const hold = new THREE.Group();
      hold.add(box(0.7, 1.6, 0.14, M.dark(), 0, h1 + 2, 0)); // ventanita
      hold.position.set(tx + dx * (tw * 0.43 + 0.05), 0, tz + dz * (tw * 0.43 + 0.05));
      hold.rotation.y = ry;
      g.add(hold);
    }
    g.add(box(tw * 0.86 + 0.9, 0.6, tw * 0.86 + 0.9, white, tx, h2, tz));
    const bw = tw * 0.78;
    g.add(box(bw, 4.4, bw, white, tx, h2 + 0.6, tz)); // campanario
    for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, 0], [1, 0, Math.PI / 2], [-1, 0, Math.PI / 2]]) {
      const hold = new THREE.Group();
      hold.add(box(bw * 0.5, 2.8, 0.12, M.dark(), 0, h2 + 1.3, 0));
      for (let j = 0; j < 5; j++) hold.add(box(bw * 0.5, 0.1, 0.16, mat(0xcfc9bb), 0, h2 + 1.5 + j * 0.5, 0));
      hold.position.set(tx + dx * (bw / 2 + 0.05), 0, tz + dz * (bw / 2 + 0.05));
      hold.rotation.y = ry;
      g.add(hold);
    }
    g.add(box(bw + 0.8, 0.5, bw + 0.8, white, tx, h2 + 5.0, tz));
    clockFaces(g, tx, h2 + 6.0, tz, bw * 0.36, 0.55);
    g.add(box(bw * 0.7, 1.5, bw * 0.7, white, tx, h2 + 5.5, tz));
    g.add(cone(bw * 0.62, 7.5, mat(0x6f8272, { roughness: 0.6 }), tx, h2 + 7.0, tz, 8).rotateY(Math.PI / 8));
    crossAt(g, tx, h2 + 14.2, tz, 0.9);
    // reja con pilares de ladrillo y capitel verde, al frente
    const fz = zf + 3.4;
    const nP = Math.max(3, Math.round(W / 3.2));
    for (let i = 0; i < nP; i++) {
      const px = -W / 2 + (i * W) / (nP - 1);
      g.add(box(0.8, 2.3, 0.8, BRICK2(), px, 0, fz));
      g.add(box(1.0, 0.25, 1.0, GREENT(), px, 2.3, fz));
      if (i < nP - 1) {
        const mx = px + W / (nP - 1) / 2;
        g.add(box(W / (nP - 1) - 0.8, 0.8, 0.4, BRICK2(), mx, 0, fz));
        railing(g, mx, 0.8, fz, W / (nP - 1) - 0.8, IRON(), 7);
      }
    }
    g.add(box(W * 0.62, 0.35, 0.3, mat(0x8d8a82), W * 0.1, y + 0.1, 0)); // cumbrera de la nave
    return g;
  }
  if (k === 'museo') {
    // Museo Histórico: casona italianizante de dos plantas, revoque crema con molduras ocre, balcón de hierro y frontón.
    const cream = mat(0xf3e6c6, { roughness: 0.9 });
    const oc = OCRE();
    const zf = D / 2;
    const gl = mat(0x2a3140, { roughness: 0.3, metalness: 0.2 });
    const mid = y * 0.5;
    // pilastras de esquina, cornisa y faja intermedia
    for (const sx of [-1, 1]) g.add(box(0.9, y + 0.6, 0.5, oc, sx * (W / 2 - 0.45), 0, zf + 0.15));
    g.add(box(W + 0.8, 0.6, 1.0, oc, 0, y - 0.9, zf + 0.2));
    g.add(box(W + 0.6, 0.9, 0.9, cream, 0, y - 0.3, zf + 0.15));
    g.add(box(W + 0.2, 0.7, 0.6, oc, 0, mid - 0.35, zf + 0.15));
    // parapeto y frontón central
    g.add(box(W + 0.4, 1.0, 0.5, cream, 0, y, zf));
    g.add(gable(W * 0.34, 1.9, 0.7, oc, 0, y + 0.6, zf + 0.1));
    g.add(gable(W * 0.28, 1.4, 0.8, cream, 0, y + 0.6, zf + 0.15));
    // planta alta: tres aberturas con marco ocre; la central da al balcón
    const wy = mid + 1.1;
    const wh = Math.min(2.6, y * 0.32);
    for (const x of [-W * 0.3, W * 0.3]) win(g, x, wy, 1.3, wh, zf + 0.12, oc, gl);
    win(g, 0, wy - 0.4, 1.5, wh + 0.4, zf + 0.12, oc, gl);
    g.add(box(3.4, 0.28, 1.2, oc, 0, mid, zf + 0.7)); // balcón
    railing(g, 0, mid + 0.28, zf + 1.2, 3.4, IRON(), 11);
    // planta baja: portal central con pilastras y arco, ventanas con arco a los lados
    const door = mat(0x1d1e22, { roughness: 0.5 });
    g.add(box(3.4, 3.9, 0.4, oc, 0, 0, zf + 0.12));
    g.add(box(2.2, 3.1, 0.3, door, 0, 0, zf + 0.3));
    const arc = cyl(1.1, 0.3, door, 0, 0, 0, 1.1, 16);
    arc.rotation.x = Math.PI / 2;
    arc.position.set(0, 3.1, zf + 0.3);
    g.add(arc);
    for (const x of [-W * 0.3, W * 0.3]) win(g, x, 0.9, 1.5, 1.9, zf + 0.12, oc, mat(0x35496a, { roughness: 0.3 }), true);
    // letrero MUSEO / HISTÓRICO sobre la faja
    for (const [txt, x] of [['MUSEO', -W * 0.3], ['HISTÓRICO', W * 0.3]]) {
      const t = textPlane(txt, 4.2, 0.9, '#3a2a14');
      t.position.set(x, mid - 1.0, zf + 0.62);
      g.add(t);
    }
    // farolas de dos globos, palmeras y banco al frente
    for (const sx of [-1, 1]) lampPost(g, sx * (W * 0.55), zf + 3.2);
    palm(g, -W * 0.72, zf + 4.2, 9);
    palm(g, W * 0.78, zf + 4.8, 8);
    g.add(box(1.8, 0.5, 0.5, mat(0x2f4a3a), -W * 0.2, 0, zf + 2.2));
    return g;
  }
  if (k === 'banconacion') {
    // Banco de la Nación Argentina: edificio clásico crema, zócalo, arcos, balcones, pórtico con frontón y banderas.
    const cream = mat(0xefe4c9, { roughness: 0.9 });
    const stone = mat(0xe2d6b8, { roughness: 0.95 });
    const zf = D / 2;
    const gl = mat(0x30394a, { roughness: 0.3, metalness: 0.2 });
    const blind = mat(0xd9d6cc, { roughness: 0.8 });
    const fl = Math.min(5.2, y * 0.5);
    g.add(box(W + 0.5, 1.3, 0.6, stone, 0, 0, zf + 0.1)); // zócalo
    g.add(box(W + 0.4, 0.5, 0.7, stone, 0, fl - 0.25, zf + 0.12)); // faja entre plantas
    // cornisa con modillones y balaustrada
    g.add(box(W + 1.0, 0.8, 1.1, stone, 0, y - 1.1, zf + 0.3));
    const nm = Math.floor(W / 1.1);
    for (let i = 0; i < nm; i++) g.add(box(0.4, 0.5, 0.4, cream, -W / 2 + 0.6 + (i * (W - 1.2)) / Math.max(1, nm - 1), y - 1.7, zf + 0.3));
    g.add(box(W + 0.6, 1.0, 0.5, cream, 0, y - 0.3, zf + 0.1));
    for (let i = 0; i <= 6; i++) g.add(box(0.7, 1.3, 0.7, stone, -W / 2 + (i * W) / 6, y - 0.3, zf + 0.1));
    // planta baja: ventanas con arco y persiana
    const nw = Math.max(3, Math.floor(W / 4.2));
    for (let i = 0; i < nw; i++) {
      const x = -W / 2 + ((i + 0.5) * W) / nw;
      if (Math.abs(x) < 2.6) continue; // lugar del portal
      win(g, x, 1.5, 1.5, 2.0, zf + 0.12, stone, blind, true);
      g.add(box(1.2, 1.0, 0.12, gl, x, 1.7, zf + 0.26));
      // planta alta: ventana con balcón de hierro
      win(g, x, fl + 1.0, 1.2, 2.2, zf + 0.12, stone, gl);
      railing(g, x, fl + 0.6, zf + 0.55, 1.8, IRON(), 8);
    }
    // portal central: pilastras, puerta, frontón con cartel, escalera y banderas
    g.add(box(0.9, fl + 1.6, 0.7, stone, -2.3, 0, zf + 0.25));
    g.add(box(0.9, fl + 1.6, 0.7, stone, 2.3, 0, zf + 0.25));
    g.add(box(4.6, 0.5, 0.9, stone, 0, fl + 1.6, zf + 0.3));
    g.add(gable(5.4, 1.4, 1.0, stone, 0, fl + 2.1, zf + 0.35));
    g.add(box(3.0, 3.8, 0.25, mat(0x3a2418, { roughness: 0.5 }), 0, 0.6, zf + 0.2));
    const t = textPlane('BANCO DE LA NACIÓN ARGENTINA', 3.6, 0.5, '#3a3a3a', '#f1e8d0', 'bold 44px serif');
    t.position.set(0, fl + 2.3, zf + 0.87);
    g.add(t);
    for (let i = 0; i < 3; i++) g.add(box(5.2 - i * 0.5, 0.25, 1.0 + i * 0.2, mat(0xd6d0c2), 0, i * 0.25, zf + 0.9 + (2 - i) * 0.0));
    win(g, 0, fl + 1.0, 1.4, 2.2, zf + 0.15, stone, gl);
    for (const sx of [-1, 1]) {
      const f = new THREE.Group();
      flag(f, 0, 0, 0x75aadb, 5.2);
      f.position.set(sx * 3.6, 0.4, zf + 1.1);
      g.add(f);
    }
    for (const sx of [-1, 1]) g.add(box(1.3, 1.3, 0.12, mat(0x1f55a5, { emissive: 0x1f55a5, emissiveIntensity: 0.25 }), sx * (W * 0.32), 3.7, zf + 0.7)); // carteles azules
    return g;
  }
  if (k === 'municipalidad') {
    // Palacio municipal: pórtico con columnas y frontón, torre de reloj central, balaustrada y mástiles.
    rim(g, W, D, y, M.white(), 0.9, 0.35);
    const pw = Math.min(W * 0.46, 22);
    colonnade(g, pw, 0, D / 2 + 1.2, 6, y, M.white());
    g.add(box(pw + 1.2, 0.8, 3.2, M.white(), 0, y, D / 2 + 1.0));
    g.add(gable(pw + 1.4, 3, 1.4, M.cream(), 0, y + 0.8, D / 2 + 1.7));
    g.add(box(pw + 1.4, 0.3, 3.4, mat(0xcfc7b3), 0, 0, D / 2 + 1.0)); // escalinata
    const tw = Math.min(6, D * 0.45);
    g.add(box(tw, 9, tw, M.cream(), 0, y, 0));
    g.add(box(tw + 0.9, 0.6, tw + 0.9, M.white(), 0, y + 9, 0));
    g.add(box(tw * 0.7, 3.2, tw * 0.7, M.cream(), 0, y + 9.6, 0));
    clockFaces(g, 0, y + 6.2, 0, tw / 2 + 0.05, Math.min(1.6, tw * 0.26));
    g.add(cone(tw * 0.6, 5.5, mat(0x2d80c4, { roughness: 0.55 }), 0, y + 12.8, 0, 4).rotateY(Math.PI / 4));
    g.add(cyl(0.12, 3, M.gold(), 0, y + 18.3, 0));
    for (const sx of [-1, 1]) flagAt(g, sx * (W * 0.38), y, D * 0.2, sx > 0 ? 0x75aadb : 0xf7f3ea, 8);
    return g;
  }
  if (k === 'estacion' || k === 'cultura') {
    // Estación ferroviaria (hoy Casa de la Cultura): andén techado con postes, reloj, chimeneas y frontón de entrada.
    g.add(box(W, 0.5, 6.5, mat(0xa65f45), 0, y * 0.72, D / 2 + 3.1)); // marquesina del andén
    for (let i = 0; i < Math.max(3, Math.floor(W / 7)); i++) {
      const x = -W / 2 + 2 + (i * (W - 4)) / Math.max(2, Math.floor(W / 7) - 1);
      g.add(cyl(0.2, y * 0.72, mat(0x2f4a3a, { metalness: 0.4 }), x, 0, D / 2 + 5.8, 0.2, 8));
    }
    g.add(box(W * 0.9, 0.35, 0.3, mat(0x2f4a3a), 0, y * 0.72 - 0.5, D / 2 + 6.2));
    g.add(gable(Math.min(8, D * 0.6), 2.4, 1.2, M.cream(), 0, y, D / 2 - 0.4));
    g.children[g.children.length - 1].rotation.y = 0;
    clockFaces(g, 0, y + 2.4, D / 2 - 0.2, 0.1, 1.1);
    for (const sx of [-1, 1]) {
      g.add(box(1.2, 3.4, 1.2, M.brick(), sx * W * 0.3, y, -D * 0.15));
      g.add(box(1.6, 0.3, 1.6, M.dark(), sx * W * 0.3, y + 3.4, -D * 0.15));
    }
    g.add(box(W * 0.8, 0.5, 0.3, M.cream(), 0, y, D / 2));
    for (const sx of [-1, 1]) {
      g.add(cyl(0.12, 4.2, M.dark(), sx * W * 0.45, 0, D / 2 + 7.3, 0.12, 6)); // faroles
      g.add(box(0.6, 0.5, 0.6, mat(0xffe6a8, { emissive: 0xffe6a8, emissiveIntensity: 0.6 }), sx * W * 0.45, 4.2, D / 2 + 7.3));
    }
    return g;
  }
  if (k === 'museo') {
    // Estilo colonial pampeano: cornisa con parapeto, frontón central y rejas de hierro en las ventanas.
    rim(g, W, D, y, mat(0xf1e8d2), 1.1, 0.4);
    g.add(box(Math.min(10, W * 0.3), 2.2, 0.5, mat(0xf7f3ea), 0, y, D / 2 - 0.2)); // frontón
    g.add(cyl(0.15, 2.4, M.dark(), 0, y + 2.2, D / 2 - 0.2, 0.15, 6));
    const n = Math.max(2, Math.floor(W / 5));
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + 2.5 + (i * (W - 5)) / Math.max(1, n - 1);
      for (let b = -1; b <= 1; b++) g.add(box(0.1, 2.1, 0.1, M.dark(), x + b * 0.55, 0.9, D / 2 + 0.35)); // rejas
      g.add(box(1.5, 0.12, 0.12, M.dark(), x, 1.6, D / 2 + 0.35));
    }
    g.add(box(4, 0.35, 1.8, mat(0x7b5a3a), 0, 3.4, D / 2 + 0.9)); // alero de la pulpería
    g.add(box(0.2, 1.2, 0.2, mat(0x7b5a3a), -1.8, 2.2, D / 2 + 1.6));
    g.add(box(0.2, 1.2, 0.2, mat(0x7b5a3a), 1.8, 2.2, D / 2 + 1.6));
    return g;
  }
  if (k === 'escuela') {
    rim(g, W, D, y, mat(0xe8a23a), 0.6, 0.3);
    g.add(box(Math.min(8, W * 0.3), 2.8, 1, mat(0xf1e2bd), 0, y, D / 2 - 0.4)); // frontis con el nombre
    g.add(box(Math.min(6, W * 0.22), 0.8, 0.2, mat(0x2d6fb0), 0, y + 1.4, D / 2 + 0.2));
    flagAt(g, -W * 0.38, y, 0, 0x75aadb, 8);
    g.add(box(1.4, 2.2, 1.4, mat(0xf1e2bd), W * 0.32, y, 0)); // campanario
    g.add(cone(1.1, 1.6, mat(0xb85a33), W * 0.32, y + 2.2, 0, 4).rotateY(Math.PI / 4));
    return g;
  }
  if (k === 'policia') {
    g.add(box(Math.min(5, W * 0.4), 0.9, 0.3, mat(0x2f55a8, { emissive: 0x2f55a8, emissiveIntensity: 0.5 }), 0, y + 0.1, D / 2));
    g.add(cyl(0.12, 8, metal(), W * 0.35, y, 0));
    for (const sx of [-1, 1]) g.add(box(0.5, 0.35, 0.5, mat(sx > 0 ? 0xd63a3a : 0x2f55a8, { emissive: sx > 0 ? 0xd63a3a : 0x2f55a8, emissiveIntensity: 0.8 }), sx * 0.6, y + 0.9, D / 2 - 0.5));
    return g;
  }
  if (k === 'bomberos') {
    g.add(box(Math.min(4.5, W * 0.3), 14, 4.5, mat(0xb83e34), W * 0.3, y, 0)); // torre de mangueras
    g.add(box(5.4, 0.9, 5.4, M.dark(), W * 0.3, y + 14, 0));
    g.add(box(Math.min(W * 0.7, 18), 0.5, 0.3, mat(0xf3efe6), 0, y, D / 2)); // cartel
    const door = Math.min(W * 0.2, 5);
    for (const sx of [-1, 0, 1]) g.add(box(door, 4.2, 0.2, mat(0xf3efe6), sx * door * 1.25 - W * 0.12, 0.2, D / 2 + 0.1));
    return g;
  }
  if (k === 'biblioteca') {
    g.add(box(Math.min(12, W * 0.5), 1.6, 0.3, mat(0x3f8f67), 0, y + 0.1, D / 2));
    g.add(box(4, 0.5, 3, mat(0xf7f3ea), 0, 3, D / 2 + 1.5));
    return g;
  }
  const c = { escuela: 0xe8a23a, edificio: 0xb07ad0 }[k] || 0xb07ad0;
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
