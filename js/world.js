// Núcleo del pueblo: suelo (textura dibujada en canvas), calles, verdes, agua y edificios extruidos.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toLocal } from './geo.js';
import { hash2 } from './util.js';
import { HEIGHT_FACTOR } from './config.js';

const WALLS = [0xe9dcc4, 0xdccaa6, 0xd3dae0, 0xe6c8bc, 0xcdd6bd, 0xe2d2b0].map((c) => new THREE.Color(c));
const ROOFS = [0xb5523b, 0x9c4a3a, 0x8a8f94, 0xa65f45, 0x6f7479].map((c) => new THREE.Color(c));

// Ancho de calle en metros según el tipo de OSM.
const ROAD_W = {
  motorway: 24, trunk: 22, primary: 16, secondary: 14, tertiary: 12, unclassified: 10,
  residential: 10, living_street: 8, service: 6, track: 5, path: 2.5, footway: 2.5, pedestrian: 6,
};

function ringToLocal(ring) {
  return ring.map(([lng, lat]) => toLocal(lng, lat));
}

function buildingGeometry(f, factor) {
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  const out = [];
  for (const rings of polys) {
    const outer = ringToLocal(rings[0]);
    if (outer.length < 4) continue;
    // Shape en (x, norte); luego rotateX(-90°) lo deja en (x, y=altura, z=sur).
    const shape = new THREE.Shape(outer.map((p) => new THREE.Vector2(p.x, -p.z)));
    for (let k = 1; k < rings.length; k++) {
      shape.holes.push(new THREE.Path(ringToLocal(rings[k]).map((p) => new THREE.Vector2(p.x, -p.z))));
    }
    const h = Math.max(2.5, (Number(f.properties.h) || 4) * factor);
    let geo;
    try {
      geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    } catch {
      continue;
    }
    geo.rotateX(-Math.PI / 2);

    const seed = hash2(outer[0].x, outer[0].z);
    const wall = WALLS[Math.floor(seed * WALLS.length) % WALLS.length];
    const roof = ROOFS[Math.floor(hash2(outer[0].z, outer[0].x) * ROOFS.length) % ROOFS.length];
    const n = geo.attributes.position.count;
    const nor = geo.attributes.normal;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const c = nor.getY(i) > 0.5 ? roof : wall;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.deleteAttribute('uv');
    out.push(geo);
  }
  return out;
}

export function buildWorld(scene, gj, meta, { lowEnd = false } = {}) {
  const half = meta.osm?.halfSizeMeters ?? 2000;
  const EXT = half * 2;
  const SIZE = lowEnd ? 2048 : 4096;
  const m2px = SIZE / EXT;

  const roads = [];
  const greens = [];
  const waters = [];
  const rails = [];
  const waterLines = [];
  const geos = [];

  for (const f of gj.features) {
    const { kind } = f.properties;
    const g = f.geometry;
    if (kind === 'building') geos.push(...buildingGeometry(f, HEIGHT_FACTOR));
    else if (kind === 'road' && g.type === 'LineString') {
      roads.push({ hw: f.properties.hw, pts: g.coordinates.map(([lng, lat]) => toLocal(lng, lat)) });
    } else if (kind === 'rail' && g.type === 'LineString') {
      rails.push({ pts: g.coordinates.map(([lng, lat]) => toLocal(lng, lat)) });
    } else if (kind === 'green' && (g.type === 'Polygon' || g.type === 'MultiPolygon')) {
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      for (const p of polys) greens.push({ pts: ringToLocal(p[0]) });
    } else if (kind === 'water' && g.type === 'LineString') {
      waterLines.push({ pts: g.coordinates.map(([lng, lat]) => toLocal(lng, lat)) });
    } else if (kind === 'water' && (g.type === 'Polygon' || g.type === 'MultiPolygon')) {
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      for (const p of polys) waters.push({ pts: ringToLocal(p[0]) });
    }
  }

  let buildings = null;
  if (geos.length) {
    buildings = new THREE.Mesh(
      mergeGeometries(geos, false),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }),
    );
    buildings.castShadow = true;
    buildings.receiveShadow = true;
    buildings.name = 'buildings';
    scene.add(buildings);
    for (const g of geos) g.dispose();
  }

  // ---- Suelo ----
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const ctx = cv.getContext('2d');
  const px = (p) => [(p.x / EXT + 0.5) * SIZE, (p.z / EXT + 0.5) * SIZE];
  ctx.fillStyle = '#7d8b5e';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const fillPoly = (pts, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = px(p);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  };
  const strokeLine = (pts, color, widthM) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, widthM * m2px);
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = px(p);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
  };

  greens.forEach((g) => fillPoly(g.pts, '#93ab70'));
  waters.forEach((w) => fillPoly(w.pts, '#5f93b4'));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  waterLines.forEach((w) => strokeLine(w.pts, '#5f93b4', 5));
  roads.forEach((r) => strokeLine(r.pts, '#a39d90', (ROAD_W[r.hw] || 8) + 1.6)); // borde
  roads.forEach((r) => strokeLine(r.pts, '#d9d4c8', ROAD_W[r.hw] || 8)); // calzada
  rails.forEach((r) => {
    strokeLine(r.pts, '#6b655c', 3.2);
    ctx.setLineDash([2.5 * m2px, 3 * m2px]);
    strokeLine(r.pts, '#cfc7b5', 4.6);
    ctx.setLineDash([]);
  });

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = lowEnd ? 4 : 8;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(EXT, EXT),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  return { EXT, half, roads, rails, greens, waters, ground, buildings };
}
