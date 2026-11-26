// Barrios: zonas de color sobre el suelo con su nombre, que se prenden y apagan con el botón «Barrios».
// Los datos salen de data/barrios.json: [{ id, name, color?, approx?, polygon: [[lng, lat], ...] }]
// (se dibujan con la página http://localhost:8080/barrios o se bajan de OpenStreetMap con `npm run barrios`).
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { toLocal } from './geo.js';
import { esc } from './util.js';
import { emit } from './bus.js';

const PALETTE = ['#e07a5f', '#3d9970', '#4c8fd6', '#d9a441', '#9b6bc7', '#2aa5a0', '#c8567b', '#7a9a3a', '#d2733a', '#5d7bb5'];

export function initBarrios(scene, barrios = []) {
  const group = new THREE.Group();
  group.name = 'barrios';
  group.visible = false;
  scene.add(group);
  const info = new Map();
  const labels = []; // las etiquetas HTML no obedecen la visibilidad del grupo: se ocultan una por una

  barrios.forEach((b, i) => {
    const ring = (b.polygon || []).map(([lng, lat]) => toLocal(lng, lat));
    if (ring.length > 1 && ring[0].x === ring[ring.length - 1].x && ring[0].z === ring[ring.length - 1].z) ring.pop();
    if (ring.length < 3) return;
    const hex = /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : PALETTE[i % PALETTE.length];
    const color = new THREE.Color(hex);

    // relleno: se triangula en el plano (x, z) y queda apenas sobre el suelo
    const contour = ring.map((p) => new THREE.Vector2(p.x, p.z));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const pos = new Float32Array(ring.length * 3);
    ring.forEach((p, k) => pos.set([p.x, 0.45, p.z], k * 3));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(tris.flat());
    const fill = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: b.approx ? 0.16 : 0.26, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false,
    }));
    fill.renderOrder = 2;
    fill.matrixAutoUpdate = false;
    fill.updateMatrix();

    const lpos = new Float32Array(ring.length * 3);
    ring.forEach((p, k) => lpos.set([p.x, 0.7, p.z], k * 3));
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    const line = new THREE.LineLoop(
      lg,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, fog: false }),
    );
    line.renderOrder = 3;

    // nombre en el centro (promedio ponderado por área)
    let A = 0, cx = 0, cz = 0;
    for (let k = 0; k < ring.length; k++) {
      const p = ring[k], q = ring[(k + 1) % ring.length];
      const w = p.x * q.z - q.x * p.z;
      A += w;
      cx += (p.x + q.x) * w;
      cz += (p.z + q.z) * w;
    }
    if (Math.abs(A) < 1e-6) { cx = ring.reduce((s, p) => s + p.x, 0) / ring.length; cz = ring.reduce((s, p) => s + p.z, 0) / ring.length; } else { cx /= 3 * A; cz /= 3 * A; }
    const xs = ring.map((p) => p.x), zs = ring.map((p) => p.z);
    const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'barrio-label';
    el.style.setProperty('--b', hex);
    el.innerHTML = `<span>${esc(b.name)}</span>${b.approx ? '<small>aprox.</small>' : ''}`;
    el.setAttribute('aria-label', `Barrio ${b.name}: acercar`);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      emit('barrio:select', b.id || b.name);
    });
    const anchor = document.createElement('div');
    anchor.className = 'pin-anchor';
    anchor.append(el);
    const label = new CSS2DObject(anchor);
    label.position.set(cx, 3, cz);
    label.visible = false;
    anchor.style.display = 'none';
    labels.push({ label, anchor });

    group.add(fill, line, label);
    info.set(b.id || b.name, { name: b.name, x: cx, z: cz, size });
  });

  return {
    count: info.size,
    get visible() { return group.visible; },
    setVisible(on) {
      group.visible = Boolean(on) && info.size > 0;
      for (const { label, anchor } of labels) {
        label.visible = group.visible;
        anchor.style.display = group.visible ? '' : 'none';
      }
      return group.visible;
    },
    /** Centro y tamaño de un barrio (para acercar la cámara). */
    find: (id) => info.get(id) || null,
  };
}
