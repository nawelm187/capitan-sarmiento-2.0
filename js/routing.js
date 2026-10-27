// Camino más corto por las calles reales (módulo puro, sin three).
// Arma un grafo con las calles que comparten vértices (así se cruzan en OSM) y busca con Dijkstra.
import { makeGrid } from './roads.js';

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(k, v) {
    const a = this.a;
    a.push([k, v]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * @param roads  [{hw, pts:[{x,z}]}]
 * @param allowed  Set de tipos de calle por los que se puede ir (CAR_HW para autos; todas para peatones)
 */
export function makeRouter(roads, allowed) {
  const list = roads.filter((r) => allowed.has(r.hw) && r.pts.length > 1);
  const keyOf = (p) => `${Math.round(p.x * 2)},${Math.round(p.z * 2)}`; // vértices a menos de 0,5 m son el mismo
  const ids = new Map();
  const nodes = [];
  const adj = [];
  const node = (p) => {
    const k = keyOf(p);
    let id = ids.get(k);
    if (id === undefined) {
      id = nodes.length;
      ids.set(k, id);
      nodes.push({ x: p.x, z: p.z });
      adj.push([]);
    }
    return id;
  };
  const ptNode = new Map(); // objeto punto -> id de nodo
  for (const r of list) {
    let prev = null;
    for (const p of r.pts) {
      const id = node(p);
      ptNode.set(p, id);
      if (prev !== null && prev !== id) {
        const w = Math.hypot(nodes[id].x - nodes[prev].x, nodes[id].z - nodes[prev].z);
        adj[prev].push({ to: id, w });
        adj[id].push({ to: prev, w });
      }
      prev = id;
    }
  }
  const grid = makeGrid(list);

  /** Punto más cercano sobre las calles permitidas: { x, z, a, b } (a y b = nodos del tramo). */
  function snap(p) {
    for (const rad of [40, 120, 400]) {
      let best = null;
      grid.near(p.x, p.z, rad, (seg) => {
        const dx = seg.b.x - seg.a.x;
        const dz = seg.b.z - seg.a.z;
        const l2 = dx * dx + dz * dz || 1;
        const t = Math.min(1, Math.max(0, ((p.x - seg.a.x) * dx + (p.z - seg.a.z) * dz) / l2));
        const x = seg.a.x + dx * t;
        const z = seg.a.z + dz * t;
        const d = Math.hypot(p.x - x, p.z - z);
        if (!best || d < best.d) best = { x, z, d, a: ptNode.get(seg.a), b: ptNode.get(seg.b) };
      });
      if (best) return best;
    }
    return null;
  }

  /** Lista de puntos {x,z} desde A hasta B por las calles; null si no hay camino. */
  function route(A, B) {
    const sa = snap(A);
    const sb = snap(B);
    if (!sa || !sb) return null;
    const S = nodes.length; // nodos virtuales
    const T = S + 1;
    const extra = new Map(); // id virtual -> aristas
    const pos = (id) => (id === S ? sa : id === T ? sb : nodes[id]);
    const link = (v, n, q) => {
      const w = Math.hypot(q.x - nodes[n].x, q.z - nodes[n].z);
      if (!extra.has(v)) extra.set(v, []);
      extra.get(v).push({ to: n, w });
      if (!extra.has(n)) extra.set(n, []);
      extra.get(n).push({ to: v, w });
    };
    link(S, sa.a, sa);
    if (sa.b !== sa.a) link(S, sa.b, sa);
    link(T, sb.a, sb);
    if (sb.b !== sb.a) link(T, sb.b, sb);
    if ((sa.a === sb.a && sa.b === sb.b) || (sa.a === sb.b && sa.b === sb.a)) {
      const w = Math.hypot(sa.x - sb.x, sa.z - sb.z);
      if (!extra.has(S)) extra.set(S, []);
      extra.get(S).push({ to: T, w });
      if (!extra.has(T)) extra.set(T, []);
      extra.get(T).push({ to: S, w });
    }
    const dist = new Map([[S, 0]]);
    const prev = new Map();
    const heap = new Heap();
    heap.push(0, S);
    while (heap.size) {
      const [d, u] = heap.pop();
      if (d > (dist.get(u) ?? Infinity)) continue;
      if (u === T) break;
      const edges = (u < S ? adj[u] : []).concat(extra.get(u) || []);
      for (const e of edges) {
        const nd = d + e.w;
        if (nd < (dist.get(e.to) ?? Infinity)) {
          dist.set(e.to, nd);
          prev.set(e.to, u);
          heap.push(nd, e.to);
        }
      }
    }
    if (!dist.has(T)) return null;
    const ids2 = [];
    for (let u = T; u !== undefined; u = prev.get(u)) ids2.push(u);
    ids2.reverse();
    const pts = ids2.map((id) => ({ x: pos(id).x, z: pos(id).z }));
    return [{ x: A.x, z: A.z }, ...pts, { x: B.x, z: B.z }];
  }

  return { route, snap, nodeCount: nodes.length };
}
