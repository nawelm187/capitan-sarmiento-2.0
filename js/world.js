// Núcleo del pueblo: suelo (textura dibujada en canvas), calles, verdes, agua y edificios extruidos.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toLocal } from './geo.js';
import { hash2 } from './util.js';
import { HEIGHT_FACTOR } from './config.js';
import { ChunkedBuildings } from './buildings.js';
import { roadWidth, makeGrid, onPavement, findMedians } from './roads.js';
import { buildRoadMeshes } from './road-mesh.js';

const WALLS = [0xe9dcc4, 0xdccaa6, 0xd3dae0, 0xe6c8bc, 0xcdd6bd, 0xe2d2b0].map((c) => new THREE.Color(c));
const ROOFS = [0xb5523b, 0x9c4a3a, 0x8a8f94, 0xa65f45, 0x6f7479].map((c) => new THREE.Color(c));

// Edificios especiales: se resaltan los edificios REALES (misma forma que en el pueblo) con techo y paredes de color propio.
const SPECIAL = {
  escuela: [0xf1e2bd, 0xe8a23a],
  hospital: [0xffffff, 0xf2f4f5],
  bomberos: [0xe9d2c8, 0xc9382c],
  policia: [0xdde3ee, 0x2f55a8],
  municipalidad: [0xf3ead2, 0x2d80c4],
  cultura: [0xf0e0d8, 0x8d54b8],
  museo: [0xf1e6c8, 0xc98712],
  biblioteca: [0xe4eadb, 0x3f8f67],
  iglesia: [0xefe6d0, 0xd9cfae],
  estacion: [0xe7dac2, 0x8a6a4a],
  edificio: [0xeee3dc, 0xb07ad0],
};
const SPECIAL_COLORS = Object.fromEntries(Object.entries(SPECIAL).map(([k, [w, r]]) => [k, [[new THREE.Color(w)], [new THREE.Color(r)]]]));

function ringToLocal(ring) {
  return ring.map(([lng, lat]) => toLocal(lng, lat));
}

// Método original (ExtrudeGeometry, un solo mesh). Se usa solo si el método rápido falla.
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

const nextFrame = () =>
  new Promise((resolve) => {
    // setTimeout de respaldo: si la pestaña está en segundo plano, requestAnimationFrame se pausa.
    const t = setTimeout(resolve, 60);
    requestAnimationFrame(() => {
      clearTimeout(t);
      resolve();
    });
  });

export async function buildWorld(scene, gj, meta, { lowEnd = false, onProgress = () => {}, skipRects = [] } = {}) {
  const half = meta.osm?.halfSizeMeters ?? 2000;
  const EXT = half * 2;
  const SIZE = lowEnd ? 2048 : 4096;
  const m2px = SIZE / EXT;

  const roads = [];
  const greens = [];
  const waters = [];
  const rails = [];
  const waterLines = [];
  const buildingFeatures = [];

  for (const f of gj.features) {
    const { kind } = f.properties;
    const g = f.geometry;
    if (kind === 'building') buildingFeatures.push(f);
    else if (kind === 'road' && g.type === 'LineString') {
      roads.push({ hw: f.properties.hw, name: f.properties.name || null, pts: g.coordinates.map(([lng, lat]) => toLocal(lng, lat)) });
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

  // Los edificios que están bajo un edificio especial (iglesia, museo…) se sacan: lo reemplaza el modelo propio.
  if (skipRects.length) {
    const inside = (x, z) =>
      skipRects.some((r) => {
        const dx = x - r.x;
        const dz = z - r.z;
        const c = Math.cos(r.rot);
        const sn = Math.sin(r.rot);
        // rotation.y = rot  →  eje local x = (cos, -sin)
        const lx = dx * c - dz * sn;
        const lz = dx * sn + dz * c;
        return Math.abs(lx) <= r.w / 2 + 1.5 && Math.abs(lz) <= r.d / 2 + 1.5;
      });
    for (let i = buildingFeatures.length - 1; i >= 0; i--) {
      const g = buildingFeatures[i].geometry;
      const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null;
      if (!ring || ring.length < 3) continue;
      let cx = 0;
      let cz = 0;
      for (const [lng, lat] of ring) {
        const p = toLocal(lng, lat);
        cx += p.x;
        cz += p.z;
      }
      if (inside(cx / ring.length, cz / ring.length)) buildingFeatures.splice(i, 1);
    }
  }

  // Las calles (OpenStreetMap) y las casas (otra fuente) a veces vienen corridas unos metros entre sí.
  // Se busca el corrimiento que menos casas deja sobre el asfalto y se corren las CALLES (así los pines siguen pegados a sus casas).
  const ringOf = (f) => {
    const g = f.geometry;
    const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null;
    return ring && ring.length >= 3 ? ring.map(([lng, lat]) => toLocal(lng, lat)) : null;
  };
  let alignShift = { x: 0, z: 0 };
  if (roads.length >= 80 && buildingFeatures.length > 200) {
    const g0 = makeGrid(roads);
    const step = Math.max(1, Math.floor(buildingFeatures.length / 500));
    const cs = []; // casas de muestra: esquinas y centro
    for (let i = 0; i < buildingFeatures.length; i += step) {
      const r = ringOf(buildingFeatures[i]);
      if (!r) continue;
      cs.push({ c: [r.reduce((a, p) => a + p.x, 0) / r.length, r.reduce((a, p) => a + p.z, 0) / r.length], v: r.map((p) => [p.x, p.z]) });
    }
    // Un corrimiento (dx,dz) de las calles; se mide qué parte de las casas quedarían sobre el asfalto.
    const score = (dx, dz) => {
      let n = 0;
      for (const h of cs) {
        if (onPavement(g0, roads, h.c[0] - dx, h.c[1] - dz, 0.3) || h.v.some(([x, z]) => onPavement(g0, roads, x - dx, z - dz, -1.2))) n++;
      }
      return n / cs.length;
    };
    const base = score(0, 0);
    let best = { dx: 0, dz: 0, s: base };
    if (base > 0.04) {
      for (let dx = -32; dx <= 32; dx += 4) for (let dz = -32; dz <= 32; dz += 4) {
        const s = score(dx, dz);
        if (s < best.s - 0.002 || (Math.abs(s - best.s) <= 0.002 && Math.hypot(dx, dz) < Math.hypot(best.dx, best.dz))) best = { dx, dz, s };
      }
      const c = { ...best };
      for (let dx = c.dx - 3; dx <= c.dx + 3; dx++) for (let dz = c.dz - 3; dz <= c.dz + 3; dz++) {
        const s = score(dx, dz);
        if (s < best.s - 0.002 || (Math.abs(s - best.s) <= 0.002 && Math.hypot(dx, dz) < Math.hypot(best.dx, best.dz))) best = { dx, dz, s };
      }
      if (best.s < base * 0.75 && (best.dx || best.dz)) {
        alignShift = { x: best.dx, z: best.dz }; // las calles se corren a donde "miran" las casas
        for (const r of [...roads, ...rails, ...waterLines]) for (const p of r.pts) { p.x += best.dx; p.z += best.dz; }
        console.info(`Calles alineadas con las casas: ${best.dx} m este, ${best.dz} m sur (casas sobre calles: ${(base * 100).toFixed(0)} % → ${(best.s * 100).toFixed(0)} %)`);
      }
    }
  }

  // Una casa nunca está en medio de la calzada: si el contorno cae sobre una calle se saca.
  const roadGrid = makeGrid(roads);
  if (roads.length >= 80) {
    let dropped = 0;
    for (let i = buildingFeatures.length - 1; i >= 0; i--) {
      const r = ringOf(buildingFeatures[i]);
      if (!r) continue;
      const cx = r.reduce((a, p) => a + p.x, 0) / r.length;
      const cz = r.reduce((a, p) => a + p.z, 0) / r.length;
      if (onPavement(roadGrid, roads, cx, cz, 0.3) || r.some((p) => onPavement(roadGrid, roads, p.x, p.z, -1.2))) {
        buildingFeatures.splice(i, 1);
        dropped++;
      }
    }
    if (dropped) console.info('Casas sacadas de la calzada:', dropped);
  }

  // ---- Edificios ----
  // Se agrupan en celdas de 400 m (un mesh por celda): la cámara y las sombras descartan lo que no se ve.
  // Se arman en tandas chicas para que la pantalla de carga siga animada.
  const buildingMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  const buildings = new THREE.Group();
  buildings.name = 'buildings';
  let chunksOk = false;
  let buildingCenters = new Float32Array(0);
  if (buildingFeatures.length) {
    try {
      const chunked = new ChunkedBuildings({ half, factor: HEIGHT_FACTOR, triangulate: (c, h) => THREE.ShapeUtils.triangulateShape(c, h) });
      let t0 = performance.now();
      for (let i = 0; i < buildingFeatures.length; i++) {
        const f = buildingFeatures[i];
        const g = f.geometry;
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        for (const rings of polys) {
          try {
            const sp = SPECIAL_COLORS[f.properties.special];
            chunked.add(rings.map(ringToLocal), Number(f.properties.h), sp ? sp[0] : WALLS, sp ? sp[1] : ROOFS, hash2);
          } catch {
            /* un edificio con geometría rara no debe frenar el resto */
          }
        }
        if (performance.now() - t0 > 18) {
          onProgress((i + 1) / buildingFeatures.length);
          await nextFrame();
          t0 = performance.now();
        }
      }
      for (const c of chunked.finish()) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(c.position, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(c.normal, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(c.color, 3));
        geo.computeBoundingSphere();
        geo.computeBoundingBox();
        const mesh = new THREE.Mesh(geo, buildingMat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false; // estático
        buildings.add(mesh);
      }
      chunksOk = buildings.children.length > 0;
      buildingCenters = Float32Array.from(chunked.centers);
    } catch (e) {
      console.warn('Edificios: método rápido falló, uso el método clásico.', e);
      for (const m of buildings.children) m.geometry.dispose();
      buildings.clear();
    }
    if (!chunksOk) {
      const geos = [];
      for (const f of buildingFeatures) geos.push(...buildingGeometry(f, HEIGHT_FACTOR));
      if (geos.length) {
        const mesh = new THREE.Mesh(mergeGeometries(geos, false), buildingMat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        buildings.add(mesh);
        for (const g of geos) g.dispose();
      }
    }
    scene.add(buildings);
  }
  onProgress(1);

  // ---- Calles: cruces y avenidas con cantero ----
  const medians = findMedians(roads, roadGrid);

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
  roads.forEach((r) => strokeLine(r.pts, '#cbc7bd', roadWidth(r) + 4.6)); // vereda
  roads.forEach((r) => strokeLine(r.pts, '#b0ada5', roadWidth(r))); // calzada (cemento)
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

  const world = { EXT, half, roads, rails, greens, waters, ground, buildings, buildingCenters, medians, roadGrid, alignShift };
  try {
    const rm = buildRoadMeshes(scene, world, { lowEnd });
    world.medianTrees = rm.treeSpots;
    world.statues = rm.statueSpots;
    world.roadMaterial = rm.roadMaterial;
  } catch (e) {
    console.warn('No se pudieron armar las calles 3D (se ve el suelo dibujado):', e);
    world.medianTrees = [];
    world.statues = [];
  }
  return world;
}
