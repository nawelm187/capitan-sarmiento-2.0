// Vida ambiental: peatones que caminan por las calles y pájaros que dan vueltas.
// Todo con InstancedMesh (un draw call por tipo).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildPath, sample } from './route.js';
import { makeRouter } from './routing.js';
import { CAR_HW, roadWidth } from './roads.js';
import { mulberry32 } from './util.js';
import { REDUCED_MOTION } from './config.js';

export function initLife(scene, world, { lowEnd = false } = {}) {
  const rand = mulberry32(31);
  const parts = [];
  let setPeds = null; // ajusta cuántos peatones se ven
  let pedMax = 0;
  let load = 0; // 0 normal · 1 liviano · 2 mínimo (lo sube main.js si la maqueta va lenta)
  let capFrac = 1; // fracción de vehículos permitidos
  let hideAll = null;

  // ---- Peatones ----
  const lines = world.roads.filter((r) => r.pts.length > 1 && ['residential', 'primary', 'secondary', 'tertiary', 'pedestrian', 'living_street', 'footway'].includes(r.hw));
  if (lines.length) {
    const count = lowEnd ? 40 : 90;
    const mesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.7, 1.5, 3, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), count);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    const palette = [0xf2c879, 0xe8795a, 0x6aa7e8, 0xf0efe6, 0x7ccfa0, 0xc79bd6].map((c) => new THREE.Color(c));
    const agents = Array.from({ length: count }, (_, i) => {
      const line = lines[Math.floor(rand() * lines.length)];
      const path = buildPath(line.pts);
      mesh.setColorAt(i, palette[i % palette.length]);
      return { path, d: rand() * path.len, v: 0.9 + rand() * 0.9, dir: rand() < 0.5 ? 1 : -1, off: (rand() < 0.5 ? -1 : 1) * ((CAR_HW.has(line.hw) ? roadWidth(line) / 2 + 1.2 : 1) + rand() * 1.2) };
    });
    scene.add(mesh);
    const m = new THREE.Matrix4();
    let active = count;
    setPeds = (n) => { active = n; mesh.count = n; mesh.instanceMatrix.needsUpdate = true; };
    pedMax = count;
    const place = () => {
      agents.forEach((a, i) => {
        if (i >= active) return;
        const s = sample(a.path, a.d);
        m.makeTranslation(s.x - s.tz * a.off, 1.45, s.z + s.tx * a.off);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    place();
    parts.push((dt) => {
      for (let i = 0; i < active; i++) {
        const a = agents[i];
        a.d += a.v * a.dir * dt;
        if (a.d > a.path.len) {
          a.d = a.path.len;
          a.dir = -1;
        } else if (a.d < 0) {
          a.d = 0;
          a.dir = 1;
        }
      }
      place();
    });
  }


  // ---- Tránsito: aparecen de a poco, hacen un recorrido por las calles y desaparecen ----
  // Cada vehículo sale de un punto de una calle, busca el camino más corto por las calles hasta otro punto
  // (el mismo buscador que usan los recorridos, así nunca atraviesa casas) y se esfuma al llegar.
  const TRAFFIC_HW = new Set([...CAR_HW].filter((h) => h !== 'service'));
  const trafficRoads = world.roads.filter((r) => TRAFFIC_HW.has(r.hw) && r.pts.length > 1);
  if (trafficRoads.length > 20) {
    // Modelos chicos con color por vértice (la carrocería se tiñe con el color de cada instancia).
    const part = (g, x, y, z, rgb) => {
      g.translate(x, y, z);
      const n = g.getAttribute('position').count;
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.set(rgb, i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      g.deleteAttribute('uv');
      return g;
    };
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const W = (r, w) => new THREE.CylinderGeometry(r, r, w, 8).rotateX(Math.PI / 2);
    const BODY = [1, 1, 1];
    const GLASS = [0.16, 0.2, 0.26];
    const DARK = [0.08, 0.08, 0.09];
    const SC = 1.35; // un poco más grandes que en la realidad para que se vean desde arriba
    const sc = (g) => g.scale(SC, SC, SC);
    const models = {
      auto: {
        max: lowEnd ? 7 : 16, weight: 5, v: [7, 12], lane: 0.25,
        geo: sc(mergeGeometries([
          part(B(4.2, 0.8, 1.8), 0, 0.7, 0, BODY),
          part(B(2.2, 0.7, 1.6), -0.2, 1.4, 0, GLASS),
          part(B(2.0, 0.12, 1.5), -0.2, 1.78, 0, BODY),
          part(W(0.32, 1.9), 1.3, 0.32, 0, DARK),
          part(W(0.32, 1.9), -1.3, 0.32, 0, DARK),
        ])),
        colors: [0xd8d8d4, 0x8e949a, 0x1f2a3a, 0xb23a3a, 0x3d6aa8, 0xe0b53a, 0x2f2f33, 0x5a8a62],
        shadow: true,
      },
      colectivo: {
        max: lowEnd ? 2 : 4, weight: 1.3, v: [6, 9], lane: 0.25,
        geo: sc(mergeGeometries([
          part(B(10, 2.7, 2.5), 0, 1.9, 0, BODY),
          part(B(9.6, 0.8, 2.56), 0, 2.4, 0, GLASS),
          part(B(10.05, 0.35, 2.52), 0, 1.0, 0, [0.95, 0.95, 0.95]),
          part(W(0.5, 2.6), 3.2, 0.5, 0, DARK),
          part(W(0.5, 2.6), -3.0, 0.5, 0, DARK),
        ])),
        colors: [0xc0392b, 0x2a6fb0, 0xe0a020, 0x2f8f5b],
        shadow: true,
      },
      camion: {
        max: lowEnd ? 2 : 4, weight: 1, v: [5, 8], lane: 0.25,
        geo: sc(mergeGeometries([
          part(B(6.4, 2.6, 2.4), -1.2, 2.0, 0, BODY),
          part(B(2.0, 2.1, 2.3), 3.0, 1.5, 0, [0.85, 0.85, 0.85]),
          part(B(0.1, 0.9, 2.0), 4.05, 1.9, 0, GLASS),
          part(B(8.6, 0.4, 2.2), 0, 0.5, 0, DARK),
          part(W(0.5, 2.5), 3.0, 0.5, 0, DARK),
          part(W(0.5, 2.5), -1.0, 0.5, 0, DARK),
          part(W(0.5, 2.5), -3.0, 0.5, 0, DARK),
        ])),
        colors: [0xe8e3d4, 0x3d6aa8, 0xb23a3a, 0xe0b53a, 0x5a8a62],
        shadow: true,
      },
      moto: {
        max: lowEnd ? 4 : 8, weight: 2.2, v: [6, 10], lane: 0.2,
        geo: sc(mergeGeometries([
          part(B(1.8, 0.35, 0.4), 0, 0.75, 0, BODY),
          part(B(0.5, 0.9, 0.45), -0.1, 1.35, 0, [0.15, 0.15, 0.17]),
          part(B(0.4, 0.14, 0.7), 0.6, 1.25, 0, DARK),
          part(W(0.34, 0.2), 0.75, 0.34, 0, DARK),
          part(W(0.34, 0.2), -0.75, 0.34, 0, DARK),
        ])),
        colors: [0xc9483c, 0x2f2f33, 0x3d6aa8, 0xe0b53a, 0xe8e3d4],
        shadow: false,
      },
      bici: {
        max: lowEnd ? 3 : 7, weight: 1.6, v: [2.6, 4.2], lane: 0.42,
        geo: sc(mergeGeometries([
          part(B(1.5, 0.12, 0.12), 0, 0.85, 0, BODY),
          part(B(0.4, 1.0, 0.3), -0.1, 1.5, 0, [0.9, 0.55, 0.3]),
          part(W(0.36, 0.1), 0.7, 0.36, 0, DARK),
          part(W(0.36, 0.1), -0.7, 0.36, 0, DARK),
        ])),
        colors: [0x3d6aa8, 0xb23a3a, 0x5a8a62, 0xe0b53a, 0x2f2f33],
        shadow: false,
      },
    };

    // Puntos de partida y llegada: vértices de calles (las grandes pesan más).
    const verts = [];
    for (const r of trafficRoads) {
      const w = ['primary', 'secondary', 'trunk', 'tertiary'].includes(r.hw) ? 2 : 1;
      for (let i = 0; i < r.pts.length; i += 2) for (let k = 0; k < w; k++) verts.push(r.pts[i]);
    }
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    const kinds = Object.entries(models).map(([kind, spec]) => {
      const mesh = new THREE.InstancedMesh(spec.geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 }), spec.max);
      mesh.frustumCulled = false;
      mesh.castShadow = spec.shadow && !lowEnd;
      mesh.name = `transito:${kind}`;
      const col = new THREE.Color();
      const slots = Array.from({ length: spec.max }, (_, i) => {
        col.setHex(spec.colors[i % spec.colors.length]);
        mesh.setColorAt(i, col);
        mesh.setMatrixAt(i, hide);
        return null;
      });
      scene.add(mesh);
      return { kind, spec, mesh, slots, dirty: true, serial: 0 };
    });
    const totalW = kinds.reduce((a, k) => a + k.spec.weight, 0);

    let router = null; // se arma recién después de cargar, para no frenar el arranque
    let clock = 0;
    let nextSpawn = 2.5;
    let seedLeft = lowEnd ? 5 : 12; // se siembran de a uno por cuadro: calcular varios caminos juntos trabaría el arranque
    hideAll = () => {
      for (const k of kinds) {
        k.slots.fill(null);
        k.hidden = [];
        for (let i = 0; i < k.slots.length; i++) k.mesh.setMatrixAt(i, hide);
        k.mesh.instanceMatrix.needsUpdate = true;
      }
    };
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();

    const pickStart = (focus) => {
      for (let t = 0; t < 40; t++) {
        const p = verts[Math.floor(rand() * verts.length)];
        if (!focus || Math.hypot(p.x - focus.x, p.z - focus.z) < 650) return p;
      }
      return verts[Math.floor(rand() * verts.length)];
    };
    const pickEnd = (a) => {
      for (let t = 0; t < 40; t++) {
        const p = verts[Math.floor(rand() * verts.length)];
        const d = Math.hypot(p.x - a.x, p.z - a.z);
        if (d > 250 && d < 1100) return p;
      }
      return null;
    };
    const spawn = (focus, scatter) => {
      if (!router) return;
      // Qué tipo: al azar, pero solo si todavía hay lugar de ese tipo.
      let t = rand() * totalW;
      let k = kinds[0];
      for (const c of kinds) {
        t -= c.spec.weight;
        if (t <= 0) { k = c; break; }
      }
      const cap = Math.ceil(k.spec.max * capFrac);
      const free = k.slots.indexOf(null);
      if (free < 0 || free >= cap || k.slots.filter(Boolean).length >= cap) return;
      const a = pickStart(focus);
      const b = pickEnd(a);
      if (!b) return;
      const pts = router.route(a, b);
      if (!pts || pts.length < 2) return;
      const path = buildPath(pts);
      if (path.len < 150) return;
      const sp = k.spec;
      k.slots[free] = { path, d: scatter ? rand() * path.len * 0.8 : 0, v: sp.v[0] + rand() * (sp.v[1] - sp.v[0]), side: free % 2 ? 0.25 : -0.15 };
      k.dirty = true;
    };

    const place = (k) => {
      let any = false;
      k.slots.forEach((v, i) => {
        if (!v) {
          if (k.hidden?.[i] !== true) {
            (k.hidden ||= [])[i] = true;
            k.mesh.setMatrixAt(i, hide);
            any = true;
          }
          return;
        }
        if (k.hidden) k.hidden[i] = false;
        const s = sample(v.path, v.d);
        const a = sample(v.path, Math.max(0, v.d - 4));
        const c = sample(v.path, Math.min(v.path.len, v.d + 4));
        let tx = c.x - a.x;
        let tz = c.z - a.z;
        const l = Math.hypot(tx, tz) || 1;
        tx /= l;
        tz /= l;
        const off = k.kind === 'bici' ? 3.6 : k.kind === 'camion' || k.kind === 'colectivo' ? 2.4 : 2.2 + v.side;
        // mano derecha (Argentina)
        pos.set(s.x - tz * off, 0.12, s.z + tx * off);
        q.setFromAxisAngle(up, Math.atan2(-tz, tx));
        // aparece y desaparece achicándose, no de golpe
        const fade = Math.min(1, v.d / 10, (v.path.len - v.d) / 10);
        const f = Math.max(0.001, fade);
        scl.set(f, f, f);
        m.compose(pos, q, scl);
        k.mesh.setMatrixAt(i, m);
        any = true;
      });
      if (any || k.dirty) k.mesh.instanceMatrix.needsUpdate = true;
      k.dirty = false;
    };

    parts.push((dt, focus, far) => {
      clock += dt;
      if (!router) {
        if (clock < 3) return; // primero que cargue y se vea el pueblo
        router = makeRouter(world.roads, TRAFFIC_HW);
      }
      if (capFrac > 0 && !far) {
        if (seedLeft > 0) {
          seedLeft--;
          spawn(focus, true);
        } else {
          nextSpawn -= dt;
          if (nextSpawn <= 0) {
            spawn(focus, false);
            nextSpawn = (0.8 + rand() * 2.2) / Math.max(0.3, capFrac);
          }
        }
      }
      for (const k of kinds) {
        for (let i = 0; i < k.slots.length; i++) {
          const v = k.slots[i];
          if (!v) continue;
          v.d += v.v * dt;
          if (v.d >= v.path.len) k.slots[i] = null; // terminó su recorrido: desaparece
        }
        place(k);
      }
    });
  }

  // ---- Pájaros ----
  {
    const count = lowEnd ? 6 : 14;
    const geo = new THREE.ConeGeometry(0.9, 3, 4);
    geo.rotateX(Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x2b2f36 }), count);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const birds = Array.from({ length: count }, () => ({
      r: 120 + rand() * 520,
      a: rand() * Math.PI * 2,
      w: (0.04 + rand() * 0.05) * (rand() < 0.5 ? -1 : 1),
      y: 70 + rand() * 90,
      cx: (rand() - 0.5) * 500,
      cz: (rand() - 0.5) * 500,
    }));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const place = () => {
      birds.forEach((b, i) => {
        pos.set(b.cx + Math.cos(b.a) * b.r, b.y + Math.sin(b.a * 3) * 4, b.cz + Math.sin(b.a) * b.r);
        q.setFromAxisAngle(up, -b.a + (b.w > 0 ? Math.PI : 0));
        m.compose(pos, q, one);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    place();
    parts.push((dt) => {
      for (const b of birds) b.a += b.w * dt;
      place();
    });
  }

  let acc = 0;
  return {
    /** focus: punto {x,z} que mira la cámara (los vehículos nuevos aparecen cerca); dist: distancia de la cámara. */
    update(dt, focus, dist = 0) {
      if (REDUCED_MOTION) return;
      // En equipos lentos la vida se actualiza menos veces por segundo (se mueve igual, pero cuesta menos).
      acc += dt;
      const every = load >= 2 ? 1 / 10 : load === 1 ? 1 / 20 : lowEnd ? 1 / 30 : 0;
      if (acc < every) return;
      const step = Math.min(acc, 0.25);
      acc = 0;
      const far = dist > 1500; // mirando todo el pueblo de lejos no se ven: no se suman vehículos nuevos
      for (const f of parts) f(step, focus, far);
    },
    /** Nivel de carga: 0 normal, 1 liviano (la mitad de vehículos y peatones), 2 mínimo (sin vehículos). */
    setLoad(l) {
      if (l === load) return;
      load = l;
      capFrac = l >= 2 ? 0 : l === 1 ? 0.5 : 1;
      if (setPeds) setPeds(Math.ceil(pedMax * (l >= 2 ? 0.25 : l === 1 ? 0.5 : 1)));
      if (l >= 2 && hideAll) hideAll();
    },
  };
}
