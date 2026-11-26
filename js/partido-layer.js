// Vista territorial liviana del partido. El casco urbano conserva su maqueta 3D detallada;
// fuera de ella se muestra el perímetro, caminos principales y POI en coordenadas reales.
import * as THREE from 'three';
import { toLocal } from './geo.js';

const polygonList = (geometry) => {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
};

function makeShape(poly) {
  if (!poly?.[0]?.length) return null;
  const point = ([lng, lat]) => {
    const p = toLocal(lng, lat);
    return new THREE.Vector2(p.x, -p.z);
  };
  const outer = poly[0].map(point);
  if (outer.length < 4) return null;
  const shape = new THREE.Shape(outer);
  for (const ring of poly.slice(1)) {
    if (ring.length < 4) continue;
    shape.holes.push(new THREE.Path(ring.map(point)));
  }
  return shape;
}

export function initPartidoLayer(scene, boundary, roads, controls) {
  const group = new THREE.Group();
  group.name = 'partido-overview';
  scene.add(group);
  let maxRadius = 2400;

  const features = boundary?.features || [];
  // El relleno queda apenas por encima del suelo y es translúcido para no tapar
  // la textura detallada del casco urbano que ya dibuja world.js.
  const fillMaterial = new THREE.MeshBasicMaterial({
    color: 0x526352, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide,
  });
  const borderMaterial = new THREE.LineBasicMaterial({ color: 0xb4bd9b, transparent: true, opacity: 0.9 });
  for (const feature of features) {
    for (const poly of polygonList(feature.geometry)) {
      const shape = makeShape(poly);
      if (shape) {
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), fillMaterial);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.035;
        mesh.receiveShadow = false;
        group.add(mesh);
      }
      for (const ring of poly) {
        const points = ring.map(([lng, lat]) => {
          const p = toLocal(lng, lat);
          maxRadius = Math.max(maxRadius, Math.hypot(p.x, p.z));
          return new THREE.Vector3(p.x, 0.09, p.z);
        });
        if (points.length > 2) {
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), borderMaterial);
          group.add(line);
        }
      }
    }
  }

  const roadMaterial = new THREE.LineBasicMaterial({ color: 0x7e806b, transparent: true, opacity: 0.58 });
  let roadCount = 0;
  for (const feature of roads?.features || []) {
    if (feature.geometry?.type !== 'LineString') continue;
    const coords = feature.geometry.coordinates || [];
    if (coords.length < 2) continue;
    const points = coords.map(([lng, lat]) => {
      const p = toLocal(lng, lat);
      maxRadius = Math.max(maxRadius, Math.hypot(p.x, p.z));
      return new THREE.Vector3(p.x, 0.065, p.z);
    });
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), roadMaterial));
    roadCount++;
  }

  // Permite alejarse hasta ver el perímetro completo. No cambia el acercamiento inicial al centro.
  if (controls) controls.maxDistance = Math.max(2400, Math.min(65000, maxRadius * 2.6));
  return { group, maxRadius, roadCount, featureCount: features.length };
}
