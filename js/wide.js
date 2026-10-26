// Entorno lejano: campo alrededor del pueblo (con satélite opcional) y árboles.
import * as THREE from 'three';
import { mulberry32 } from './util.js';
import { mat } from './scene-utils.js';
import { onPavement, roadWidth, CAR_HW } from './roads.js';

function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export async function buildWide(scene, world, meta, { lowEnd = false } = {}) {
  const WIDE = meta.wideExtentMeters ?? 9000;
  let map = null;

  if (meta.satellite?.file) {
    try {
      map = await new THREE.TextureLoader().loadAsync(meta.satellite.file);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 4;
    } catch {
      map = null; // sin satélite: se usa el patchwork de campos
    }
  }

  if (!map) {
    // Patchwork de lotes de campo (verdes y amarillos), determinístico.
    const S = 1024;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const rand = mulberry32(7);
    ctx.fillStyle = '#8a9a62';
    ctx.fillRect(0, 0, S, S);
    const tones = ['#8a9a62', '#98a869', '#a9b072', '#b7ad72', '#7d8f5a', '#a0a366', '#c0b57a'];
    const cell = 64;
    for (let y = 0; y < S; y += cell) {
      for (let x = 0; x < S; x += cell) {
        ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      }
    }
    map = new THREE.CanvasTexture(cv);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(WIDE / 600, WIDE / 600);
    map.anisotropy = 4;
  }

  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(WIDE, WIDE),
    new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0 }),
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.4; // debajo del suelo del pueblo (evita z-fighting)
  outer.receiveShadow = true;
  outer.name = 'wide-ground';
  scene.add(outer);

  // ---- Árboles instanciados ----
  const rand = mulberry32(99);
  const spots = [];
  // 1) dentro de los espacios verdes del pueblo
  for (const g of world.greens) {
    const xs = g.pts.map((p) => p.x);
    const zs = g.pts.map((p) => p.z);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const area = (x1 - x0) * (z1 - z0);
    const n = Math.min(60, Math.round(area / 900));
    for (let t = 0, k = 0; k < n && t < n * 8; t++) {
      const x = x0 + rand() * (x1 - x0);
      const z = z0 + rand() * (z1 - z0);
      if (pointInPoly(x, z, g.pts)) {
        spots.push([x, z, 0.8 + rand() * 0.6]);
        k++;
      }
    }
  }
  // 2) a lo largo de las calles (veredas)
  for (const r of world.roads) {
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1];
      const b = r.pts[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 1) continue;
      const nx = -(b.z - a.z) / len;
      const nz = (b.x - a.x) / len;
      for (let d = 12; d < len; d += 22 + rand() * 10) {
        if (rand() < 0.5) continue;
        const side = rand() < 0.5 ? -1 : 1;
        const off = ((CAR_HW.has(r.hw) ? roadWidth(r) / 2 : 3) + 2.3) * side; // sobre la vereda
        const tx = a.x + ((b.x - a.x) * d) / len + nx * off;
        const tz = a.z + ((b.z - a.z) * d) / len + nz * off;
        if (world.roadGrid && onPavement(world.roadGrid, world.roads, tx, tz, 0.6)) continue; // nunca en medio de una calle
        spots.push([tx, tz, 0.6 + rand() * 0.4]);
      }
    }
  }
  // 2b) cánteros de las avenidas
  for (const t of world.medianTrees || []) spots.push(t);
  // 3) montes y cortinas en el campo
  const nField = lowEnd ? 120 : 320;
  for (let i = 0; i < nField; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = world.half * 0.55 + rand() * (WIDE / 2 - world.half * 0.6);
    spots.push([Math.cos(ang) * rad, Math.sin(ang) * rad, 1.2 + rand() * 1.3]);
  }

  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 4, 6);
  trunkGeo.translate(0, 2, 0);
  const crownGeo = new THREE.IcosahedronGeometry(3.4, 0);
  crownGeo.translate(0, 7, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, mat(0x6b4f35), spots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, mat(0xffffff), spots.length);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  spots.forEach(([x, z, s], i) => {
    m.makeScale(s, s, s).setPosition(x, 0, z);
    trunks.setMatrixAt(i, m);
    crowns.setMatrixAt(i, m);
    col.setHSL(0.24 + rand() * 0.07, 0.38 + rand() * 0.15, 0.3 + rand() * 0.12);
    crowns.setColorAt(i, col);
  });
  for (const mesh of [trunks, crowns]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  return { outer, treeCount: spots.length };
}

