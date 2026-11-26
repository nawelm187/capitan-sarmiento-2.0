// Núcleo del pueblo: suelo (textura dibujada en canvas), calles, verdes, agua y edificios extruidos.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toLocal } from './geo.js';
import { hash2 } from './util.js';
import { HEIGHT_FACTOR } from './config.js';
import { ChunkedBuildings } from './buildings.js';
import { roadWidth, makeGrid, onPavement, findMedians } from './roads.js';
import { buildRoadMeshes } from './road-mesh.js';

// Colores de pueblo bonaerense: revoques claros, ocres, rosados y celestes; techos de teja, chapa y losa.
const WALLS = [0xe9dcc4, 0xdccaa6, 0xd3dae0, 0xe6c8bc, 0xcdd6bd, 0xe2d2b0, 0xf2eee4, 0xd9b99b, 0xc9d6df, 0xe8c9c2, 0xd8d2c0, 0xbfc7b0, 0xf0e2b8, 0xcfb7a0].map((c) => new THREE.Color(c));
const ROOFS = [0xb5523b, 0x9c4a3a, 0x8a8f94, 0xa65f45, 0x6f7479, 0xc0603f, 0x7a4a3c, 0x5f7a6a, 0x9a9a96].map((c) => new THREE.Color(c));

// Edificios especiales: se resaltan los edificios REALES (misma forma que en el pueblo) con techo y paredes de color propio.
const SPECIAL = {
  escuela: [0xf1e2bd, 0xe8a23a],
  hospital: [0xffffff, 0xf2f4f5],
  bomberos: [0xe9d2c8, 0xc9382c],
  policia: [0xdde3ee, 0x2f55a8],
  municipalidad: [0xf3ead2, 0x2d80c4],
  cultura: [0xf0e0d8, 0x8d54b8],
  museo: [0xf3e6c6, 0xf0e2bd],
  banconacion: [0xefe4c9, 0xe2d7bc],
  biblioteca: [0xe4eadb, 0x3f8f67],
  iglesia: [0xa88f76, 0x8d8a82],
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
      waterLines.push({ name: f.properties.name || null, pts: g.coordinates.map(([lng, lat]) => toLocal(lng, lat)) });
    } else if (kind === 'water' && (g.type === 'Polygon' || g.type === 'MultiPolygon')) {
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      for (const p of polys) waters.push({ name: f.properties.name || null, pts: ringToLocal(p[0]) });
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
    // El resultado depende solo de los datos: se guarda para no recalcularlo en cada visita (ahorra segundos en celulares lentos).
    const cacheKey = `guia-align:${meta.dataRev || ''}:${roads.length}:${buildingFeatures.length}`;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch { /* sin almacenamiento */ }
    if (cached && Number.isFinite(cached.dx) && Number.isFinite(cached.dz)) {
      if (cached.dx || cached.dz) {
        alignShift = { x: cached.dx, z: cached.dz };
        console.info(`Calles alineadas con las casas (guardado): ${cached.dx} m este, ${cached.dz} m sur`);
        for (const r of [...roads, ...rails, ...waterLines]) for (const p of r.pts) { p.x += cached.dx; p.z += cached.dz; }
      }
    } else {
      const g0 = makeGrid(roads);
      const step = Math.max(1, Math.floor(buildingFeatures.length / (lowEnd ? 260 : 500)));
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
      const better = (s0, dx, dz, b) => s0 < b.s - 0.002 || (Math.abs(s0 - b.s) <= 0.002 && Math.hypot(dx, dz) < Math.hypot(b.dx, b.dz));
      const base = score(0, 0);
      let best = { dx: 0, dz: 0, s: base };
      if (base > 0.04) {
        const T = lowEnd ? 6 : 4;
        for (let dx = -32; dx <= 32; dx += T) {
          for (let dz = -32; dz <= 32; dz += T) {
            const s0 = score(dx, dz);
            if (better(s0, dx, dz, best)) best = { dx, dz, s: s0 };
          }
          await nextFrame(); // que la pantalla de carga siga animada
        }
        const c = { ...best };
        for (let dx = c.dx - T + 1; dx <= c.dx + T - 1; dx++) {
          for (let dz = c.dz - T + 1; dz <= c.dz + T - 1; dz++) {
            const s0 = score(dx, dz);
            if (better(s0, dx, dz, best)) best = { dx, dz, s: s0 };
          }
        }
        if (best.s < base * 0.75 && (best.dx || best.dz)) {
          alignShift = { x: best.dx, z: best.dz }; // las calles se corren a donde "miran" las casas
          for (const r of [...roads, ...rails, ...waterLines]) for (const p of r.pts) { p.x += best.dx; p.z += best.dz; }
          console.info(`Calles alineadas con las casas: ${best.dx} m este, ${best.dz} m sur (casas sobre calles: ${(base * 100).toFixed(0)} % → ${(best.s * 100).toFixed(0)} %)`);
        }
      }
      try { localStorage.setItem(cacheKey, JSON.stringify({ dx: alignShift.x, dz: alignShift.z })); } catch { /* sin almacenamiento */ }
    }
  }

  // Una casa nunca está en medio de la calzada: si el contorno cae sobre una calle se saca.
  const roadGrid = makeGrid(roads);
  if (roads.length >= 80) {
    let dropped = 0;
    for (let i = buildingFeatures.length - 1; i >= 0; i--) {
      if (buildingFeatures[i].properties?.special || buildingFeatures[i].properties?.name) continue; // los edificios importantes nunca se sacan
      const r = ringOf(buildingFeatures[i]);
      if (!r) continue;
      const cx = r.reduce((a, p) => a + p.x, 0) / r.length;
      const cz = r.reduce((a, p) => a + p.z, 0) / r.length;
      // Solo si el CENTRO de la casa está claramente en medio de la calzada (no si una esquina roza la calle).
      if (onPavement(roadGrid, roads, cx, cz, -4.2)) {
        buildingFeatures.splice(i, 1);
        dropped++;
      }
    }
    if (dropped) console.info('Casas sacadas de la calzada:', dropped);
  }

  console.info(`Edificios en los datos: ${buildingFeatures.length} (con modelo propio que reemplaza al real: ${skipRects.length})`);
  // ---- Edificios ----
  // Se agrupan en celdas de 400 m (un mesh por celda): la cámara y las sombras descartan lo que no se ve.
  // Se arman en tandas chicas para que la pantalla de carga siga animada.
  const buildingMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  const buildings = new THREE.Group();
  buildings.name = 'buildings';
  let chunksOk = false;
  const detailMeshes = [];
  const detailMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const detailState = { enabled: true, range: lowEnd ? 300 : 620 };
  let buildingCenters = new Float32Array(0);
  if (buildingFeatures.length) {
    try {
      const chunked = new ChunkedBuildings({ half, factor: HEIGHT_FACTOR, detail: lowEnd ? 1 : 2, triangulate: (c, h) => THREE.ShapeUtils.triangulateShape(
          c.map((p) => new THREE.Vector2(p.x, p.y)), // three.js exige Vector2 (con .equals), no objetos simples
          h.map((r) => r.map((p) => new THREE.Vector2(p.x, p.y))),
        ) });
      let t0 = performance.now();
      let failed = 0;
      const failedFeats = [];
      let firstErr = null;
      for (let i = 0; i < buildingFeatures.length; i++) {
        const f = buildingFeatures[i];
        const g = f.geometry;
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        for (const rings of polys) {
          try {
            const sp = SPECIAL_COLORS[f.properties.special];
            chunked.add(rings.map(ringToLocal), Number(f.properties.h), sp ? sp[0] : WALLS, sp ? sp[1] : ROOFS, hash2, { special: Boolean(sp), wallColor: f.properties.wc, roofColor: f.properties.rc });
          } catch (err) {
            // un edificio con geometría rara no debe frenar el resto, pero se cuenta para poder avisarlo
            failed++;
            failedFeats.push(f);
            if (!firstErr) firstErr = err;
          }
        }
        if (performance.now() - t0 > 18) {
          onProgress((i + 1) / buildingFeatures.length);
          await nextFrame();
          t0 = performance.now();
        }
      }
      if (failed) console.warn(`Edificios que no se pudieron dibujar: ${failed} de ${buildingFeatures.length}`, firstErr);
      if (failedFeats.length) {
        // Red de seguridad: lo que el método rápido no pudo se dibuja con el método clásico (así nunca falta un edificio).
        const geos = [];
        for (const f of failedFeats) {
          try { geos.push(...buildingGeometry(f, HEIGHT_FACTOR)); } catch { /* geometría imposible */ }
        }
        if (geos.length) {
          const extra = new THREE.Mesh(mergeGeometries(geos, false), buildingMat);
          extra.castShadow = true;
          extra.receiveShadow = true;
          buildings.add(extra);
          for (const g of geos) g.dispose();
          console.warn(`Rescatados con el método clásico: ${geos.length}`);
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
        if (c.detail) {
          // Ventanas, puertas y molduras: otra malla por celda que solo se muestra cuando la cámara está cerca.
          const dg = new THREE.BufferGeometry();
          dg.setAttribute('position', new THREE.BufferAttribute(c.detail.position, 3));
          dg.setAttribute('normal', new THREE.BufferAttribute(c.detail.normal, 3));
          dg.setAttribute('color', new THREE.BufferAttribute(c.detail.color, 3));
          // Esfera que envuelve la celda (calculada a mano para no depender de nada más).
          const pa = c.detail.position;
          let mnx = 1e9, mny = 1e9, mnz = 1e9, mxx = -1e9, mxy = -1e9, mxz = -1e9;
          for (let i = 0; i < pa.length; i += 3) {
            if (pa[i] < mnx) mnx = pa[i]; if (pa[i] > mxx) mxx = pa[i];
            if (pa[i + 1] < mny) mny = pa[i + 1]; if (pa[i + 1] > mxy) mxy = pa[i + 1];
            if (pa[i + 2] < mnz) mnz = pa[i + 2]; if (pa[i + 2] > mxz) mxz = pa[i + 2];
          }
          dg.computeBoundingSphere();
          const dm = new THREE.Mesh(dg, detailMat);
          dm.userData.bs = { x: (mnx + mxx) / 2, y: (mny + mxy) / 2, z: (mnz + mxz) / 2, r: Math.hypot(mxx - mnx, mxy - mny, mxz - mnz) / 2 };
          dm.matrixAutoUpdate = false;
          dm.visible = false;
          buildings.add(dm);
          detailMeshes.push(dm);
        }
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
  // Mapa normal (hasta ~2,4 km de radio): una sola textura de alta resolución.
  // Mapa grande (todo el partido): una textura general de baja resolución para todo el terreno, más "baldosas" de alta
  // resolución solo donde hay edificios (el pueblo, La Luisa, el balneario), así las calles se siguen viendo nítidas.
  const BIG = half > 2400;
  const mkTexture = (x0, z0, extent, size, minLine) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const k = size / extent;
    const px = (p) => [(p.x - x0) * k, (p.z - z0) * k];
    ctx.fillStyle = '#7d8b5e';
    ctx.fillRect(0, 0, size, size);
    const trace = (pts) => {
      ctx.beginPath();
      pts.forEach((p, i) => {
        const [x, y] = px(p);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
    };
    const fillPoly = (pts, color) => { ctx.fillStyle = color; trace(pts); ctx.closePath(); ctx.fill(); };
    const strokeLine = (pts, color, widthM) => { ctx.strokeStyle = color; ctx.lineWidth = Math.max(minLine, widthM * k); trace(pts); ctx.stroke(); };
    return { cv, ctx, k, fillPoly, strokeLine };
  };
  const paint = (T, only) => {
    const { ctx, k, fillPoly, strokeLine } = T;
    const ok = only || (() => true);
    greens.filter(ok).forEach((g) => fillPoly(g.pts, '#93ab70'));
    waters.filter(ok).forEach((w) => fillPoly(w.pts, '#5f93b4'));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    waterLines.filter(ok).forEach((w) => strokeLine(w.pts, '#5f93b4', 5));
    roads.filter(ok).forEach((r) => strokeLine(r.pts, '#cbc7bd', roadWidth(r) + 4.6)); // vereda
    roads.filter(ok).forEach((r) => strokeLine(r.pts, '#b0ada5', roadWidth(r))); // calzada (cemento)
    rails.filter(ok).forEach((r) => {
      strokeLine(r.pts, '#6b655c', 3.2);
      ctx.setLineDash([2.5 * k, 3 * k]);
      strokeLine(r.pts, '#cfc7b5', 4.6);
      ctx.setLineDash([]);
    });
  };
  const mkTex = (cv) => {
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = lowEnd ? 4 : 8;
    return tex;
  };

  let ground;
  if (!BIG) {
    const T = mkTexture(-half, -half, EXT, SIZE, 1);
    paint(T);
    ground = new THREE.Mesh(new THREE.PlaneGeometry(EXT, EXT), new THREE.MeshStandardMaterial({ map: mkTex(T.cv), roughness: 1, metalness: 0 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground';
    scene.add(ground);
  } else {
    // 1) terreno general
    const Tf = mkTexture(-half, -half, EXT, lowEnd ? 2048 : 4096, 1);
    paint(Tf);
    ground = new THREE.Mesh(new THREE.PlaneGeometry(EXT, EXT), new THREE.MeshStandardMaterial({ map: mkTex(Tf.cv), roughness: 1, metalness: 0 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.04;
    ground.receiveShadow = true;
    ground.name = 'ground';
    scene.add(ground);
    // 2) baldosas de alta resolución (1 km de lado) donde hay edificios
    const TILE = 1000;
    const TS = lowEnd ? 512 : 1024;
    const counts = new Map();
    for (const f of buildingFeatures) {
      const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates?.[0]?.[0];
      if (!ring?.length) continue;
      const c = toLocal(ring[0][0], ring[0][1]);
      const key = `${Math.floor(c.x / TILE)},${Math.floor(c.z / TILE)}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const bboxHit = (pts, x0, z0) => {
      let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
      for (const p of pts) { if (p.x < a) a = p.x; if (p.x > b) b = p.x; if (p.z < c) c = p.z; if (p.z > d) d = p.z; }
      return b >= x0 - 12 && a <= x0 + TILE + 12 && d >= z0 - 12 && c <= z0 + TILE + 12;
    };
    let tiles = 0;
    for (const [key, n] of counts) {
      if (n < 6 || tiles >= 60) continue;
      const [ix, iz] = key.split(',').map(Number);
      const x0 = ix * TILE;
      const z0 = iz * TILE;
      const T = mkTexture(x0, z0, TILE, TS, 1);
      paint(T, (o) => bboxHit(o.pts, x0, z0));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(TILE, TILE), new THREE.MeshStandardMaterial({ map: mkTex(T.cv), roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x0 + TILE / 2, 0, z0 + TILE / 2);
      m.receiveShadow = true;
      m.name = 'ground-tile';
      scene.add(m);
      tiles++;
    }
    console.info(`Mapa grande: ${tiles} baldosas de alta resolución`);
  }

  // Muestra el detalle (ventanas, puertas) solo en las celdas cercanas a la cámara.
  const updateDetail = (camPos) => {
    for (const m of detailMeshes) {
      const bs = m.userData.bs;
      m.visible = detailState.enabled && Math.hypot(camPos.x - bs.x, camPos.y - bs.y, camPos.z - bs.z) - bs.r < detailState.range;
    }
  };
  const world = { updateDetail, detailState, EXT, half, roads, rails, greens, waters, waterLines, ground, buildings, buildingCenters, medians, roadGrid, alignShift };
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
