import * as THREE from 'three';
import { toLocal } from './geo.js';

/** lng/lat -> Vector3 en el mundo (y = altura). */
export const v3 = (lng, lat, y = 0) => {
  const p = toLocal(lng, lat);
  return new THREE.Vector3(p.x, y, p.z);
};

export const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...opts });

function finish(mesh, x, y, z) {
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Caja con la base en y. */
export function box(w, h, d, m, x = 0, y = 0, z = 0) {
  return finish(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y + h / 2, z);
}

/** Cilindro (o cono truncado) con la base en y. */
export function cyl(rBottom, h, m, x = 0, y = 0, z = 0, rTop = rBottom, seg = 14) {
  return finish(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), m), x, y + h / 2, z);
}

/** Cono con la base en y. */
export const cone = (r, h, m, x = 0, y = 0, z = 0, seg = 14) => cyl(r, h, m, x, y, z, 0, seg);

/** Techo a dos aguas: ancho w (eje x), alto h, largo len (eje z), base en y. */
export function gable(w, h, len, m, x = 0, y = 0, z = 0) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  return finish(new THREE.Mesh(g, m), x, y, z);
}
