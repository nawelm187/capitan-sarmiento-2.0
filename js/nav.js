// Cámara guiada, recorridos paso a paso y dibujo de la ruta.
import * as THREE from 'three';
import { v3 } from './scene-utils.js';
import { toLocal } from './geo.js';
import { manhattan, joinPaths } from './route.js';
import { makeRouter } from './routing.js';
import { CAR_HW } from './roads.js';
import { emit } from './bus.js';
import { COLORS, REDUCED_MOTION } from './config.js';

const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

export function initNav(scene, camera, controls, places, tours, world = null) {
  // Los recorridos siguen las calles: autos por calles para autos; a pie también por veredas y peatonales.
  const WALK_HW = new Set([...CAR_HW, 'footway', 'path', 'pedestrian', 'track', 'steps', 'cycleway']);
  const routers = {};
  const routerFor = (mode) => {
    if (!world?.roads?.length) return null;
    const k = mode === 'car' ? 'car' : 'walk';
    return (routers[k] ||= makeRouter(world.roads, k === 'car' ? CAR_HW : WALK_HW));
  };
  const byId = new Map(places.map((p) => [p.id, p]));
  let anim = null;
  let tour = null;
  let step = 0;
  let routeMesh = null;

  const routeMat = new THREE.MeshStandardMaterial({
    color: COLORS.accent,
    emissive: COLORS.accent,
    emissiveIntensity: 0.55,
    roughness: 0.5,
  });

  function clearRoute() {
    if (!routeMesh) return;
    scene.remove(routeMesh);
    routeMesh.geometry.dispose();
    routeMesh = null;
  }

  function drawRoute(t) {
    clearRoute();
    let pts;
    if (Array.isArray(t.path) && t.path.length > 1) {
      pts = t.path.map(([lng, lat]) => toLocal(lng, lat));
    } else {
      const stops = t.stops.map((s) => byId.get(s.placeId)).filter(Boolean).map((p) => toLocal(p.lng, p.lat));
      if (stops.length < 2) return;
      const router = routerFor(t.mode);
      pts = joinPaths(stops.slice(1).map((s, i) => (router && router.route(stops[i], s)) || manhattan(stops[i], s)));
    }
    if (pts.length < 2) return;
    const curve = new THREE.CurvePath();
    for (let i = 1; i < pts.length; i++) {
      curve.add(new THREE.LineCurve3(new THREE.Vector3(pts[i - 1].x, 1.1, pts[i - 1].z), new THREE.Vector3(pts[i].x, 1.1, pts[i].z)));
    }
    const geo = new THREE.TubeGeometry(curve, Math.min(600, pts.length * 12), 1.3, 6, false);
    routeMesh = new THREE.Mesh(geo, routeMat);
    routeMesh.name = 'route';
    scene.add(routeMesh);
  }

  function flyTo(lng, lat, { dist = 170, pitch = 52, dur = 1.6, keepAzimuth = true } = {}) {
    const target = v3(lng, lat, 0);
    const phi = THREE.MathUtils.degToRad(pitch);
    const dir = camera.position.clone().sub(controls.target).setY(0);
    if (dir.lengthSq() < 1e-6 || !keepAzimuth) dir.set(0.55, 0, 0.83);
    dir.normalize();
    const to = target.clone().add(new THREE.Vector3(dir.x * dist * Math.cos(phi), dist * Math.sin(phi), dir.z * dist * Math.cos(phi)));
    if (REDUCED_MOTION) {
      camera.position.copy(to);
      controls.target.copy(target);
      anim = null;
      return;
    }
    anim = { t: 0, dur, fromP: camera.position.clone(), toP: to, fromT: controls.target.clone(), toT: target };
  }

  const api = {
    flyTo,
    focusPlace(id) {
      const p = byId.get(id);
      if (p) flyTo(p.lng, p.lat);
    },
    startTour(id) {
      const t = tours.find((x) => x.id === id);
      if (!t) return;
      tour = t;
      drawRoute(t);
      api.goStep(0);
    },
    stopTour() {
      tour = null;
      step = 0;
      clearRoute();
      emit('tour:stop');
    },
    goStep(i) {
      if (!tour) return;
      step = Math.max(0, Math.min(tour.stops.length - 1, i));
      const p = byId.get(tour.stops[step].placeId);
      if (p) flyTo(p.lng, p.lat, { dist: 130 });
      emit('tour:step', { tour, step, place: p || null });
    },
    next() {
      api.goStep(step + 1);
    },
    prev() {
      api.goStep(step - 1);
    },
    get tour() {
      return tour;
    },
    get step() {
      return step;
    },
    /** Reorienta la vista al norte (norte arriba, cámara al sur del objetivo). */
    resetNorth() {
      const tgt = controls.target.clone();
      const off = camera.position.clone().sub(tgt);
      const horiz = Math.hypot(off.x, off.z);
      const to = tgt.clone().add(new THREE.Vector3(0, off.y, horiz));
      if (REDUCED_MOTION) {
        camera.position.copy(to);
        return;
      }
      anim = { t: 0, dur: 0.9, fromP: camera.position.clone(), toP: to, fromT: tgt, toT: tgt };
    },
    cancel() {
      anim = null;
    },
    update(dt) {
      if (!anim) return;
      anim.t = Math.min(1, anim.t + dt / anim.dur);
      const k = ease(anim.t);
      camera.position.lerpVectors(anim.fromP, anim.toP, k);
      controls.target.lerpVectors(anim.fromT, anim.toT, k);
      if (anim.t >= 1) anim = null;
    },
  };
  return api;
}
