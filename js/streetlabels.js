// Nombres de calles, ríos y arroyos sobre el mapa (cartelitos HTML). Solo se muestran los que están cerca de donde mira la cámara,
// y solo cuando estás lo bastante cerca, para que el mapa no se llene de texto.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const len = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);

/** Puntos a lo largo de una línea, cada `every` metros (empezando a mitad del primer tramo). */
function along(pts, every) {
  const total = pts.slice(1).reduce((s, p, i) => s + len(pts[i], p), 0);
  if (total < 30) return [];
  const out = [];
  const n = Math.max(1, Math.round(total / every));
  for (let k = 0; k < n; k++) {
    let d = ((k + 0.5) / n) * total;
    for (let i = 1; i < pts.length; i++) {
      const L = len(pts[i - 1], pts[i]);
      if (d <= L || i === pts.length - 1) {
        const t = L ? Math.min(1, d / L) : 0;
        out.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * t });
        break;
      }
      d -= L;
    }
  }
  return out;
}

export function initStreetLabels(scene, { roads = [], waterLines = [], waters = [] } = {}) {
  const group = new THREE.Group();
  group.name = 'nombres-de-calles';
  scene.add(group);
  const items = []; // {x, z, y, w, obj, water}
  const seen = []; // para no repetir el mismo nombre muy cerca

  const add = (name, p, water) => {
    if (seen.some((s) => s.name === name && Math.hypot(s.x - p.x, s.z - p.z) < (water ? 250 : 90))) return;
    // en las esquinas se juntan varias calles: si ya hay un cartel de otra calle muy cerca, este no va
    if (!water && seen.some((s) => !s.water && s.name !== name && Math.hypot(s.x - p.x, s.z - p.z) < 42)) return;
    seen.push({ name, x: p.x, z: p.z, water });
    const el = document.createElement('div');
    el.className = water ? 'st-label st-label--water' : 'st-label';
    el.innerHTML = water ? `<span>〰 ${esc(name)}</span>` : `<span>${esc(name)}</span>`;
    const anchor = document.createElement('div');
    anchor.className = 'pin-anchor st-anchor';
    anchor.append(el);
    const obj = new CSS2DObject(anchor);
    const y = water ? 2 : 1.2;
    obj.position.set(p.x, y, p.z);
    obj.visible = false;
    group.add(obj);
    items.push({ x: p.x, z: p.z, y, w: name.length * 6.4 + (water ? 34 : 20), obj, water });
  };

  // las calles más largas primero: si hay que elegir, queda el nombre de la calle principal
  const named = roads.filter((r) => r.name).map((r) => ({ r, L: r.pts.slice(1).reduce((s, p, i) => s + len(r.pts[i], p), 0) })).sort((a, b) => b.L - a.L);
  for (const { r } of named) for (const p of along(r.pts, 220)) add(r.name, p, false);
  for (const w of waterLines) if (w.name) for (const p of along(w.pts, 320)) add(w.name, p, true);
  for (const w of waters) {
    if (!w.name || w.pts.length < 3) continue;
    add(w.name, { x: w.pts.reduce((s, p) => s + p.x, 0) / w.pts.length, z: w.pts.reduce((s, p) => s + p.z, 0) / w.pts.length }, true);
  }

  let on = true;
  let last = { x: 1e9, z: 1e9, lv: -1, dist: 0, cx: 0, cy: 0, cz: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
  const v = new THREE.Vector3();
  function update(target, dist, camera = null, W = 1280, H = 720, force = false) {
    // cerca: calles y agua · medio: solo agua · lejos: nada
    const lv = !on || dist > 1400 ? 2 : dist > 520 ? 1 : 0;
    const q = camera?.quaternion;
    const cam = camera ? camera.position : null;
    const quiet = !force && lv === last.lv && Math.hypot(target.x - last.x, target.z - last.z) < 35 && Math.abs(dist - last.dist) < dist * 0.06
      && (!camera || (Math.abs(q.x - last.qx) + Math.abs(q.y - last.qy) + Math.abs(q.z - last.qz) + Math.abs(q.w - last.qw) < 0.02 && Math.hypot(cam.x - last.cx, cam.y - last.cy, cam.z - last.cz) < Math.max(8, dist * 0.04)));
    if (quiet) return;
    last = { x: target.x, z: target.z, lv, dist, cx: cam?.x ?? 0, cy: cam?.y ?? 0, cz: cam?.z ?? 0, qx: q?.x ?? 0, qy: q?.y ?? 0, qz: q?.z ?? 0, qw: q?.w ?? 1 };
    const R = lv === 0 ? Math.max(260, Math.min(520, dist * 1.4)) : 1300;
    const cand = [];
    for (const it of items) {
      it.obj.visible = false;
      if (lv < 2 && (it.water || lv === 0)) { const d = Math.hypot(it.x - target.x, it.z - target.z); if (d < R) cand.push([it, d]); }
    }
    // el agua primero y después lo más cercano al centro de la pantalla
    cand.sort((a, b) => (b[0].water - a[0].water) || a[1] - b[1]);
    const boxes = [];
    let shown = 0;
    for (const [it] of cand) {
      if (shown >= 90) break;
      if (camera) {
        // no se pisan entre sí: si el cartel taparía a otro ya puesto, se oculta
        v.set(it.x, it.y, it.z).project(camera);
        if (v.z > 1 || Math.abs(v.x) > 1.08 || Math.abs(v.y) > 1.08) continue;
        const px = (v.x * 0.5 + 0.5) * W, py = (-v.y * 0.5 + 0.5) * H;
        const b = [px - it.w / 2 - 5, py - 12, px + it.w / 2 + 5, py + 12];
        if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
        boxes.push(b);
      }
      it.obj.visible = true;
      shown++;
    }
  }
  return {
    count: items.length,
    update,
    setEnabled(v2) { on = Boolean(v2); last.lv = -1; if (!on) for (const it of items) it.obj.visible = false; },
    get enabled() { return on; },
  };
}
