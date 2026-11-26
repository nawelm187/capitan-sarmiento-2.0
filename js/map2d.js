// Mapa liviano en 2D (sin WebGL ni three.js): calles, casas, agua, barrios y lugares dibujados en un <canvas>.
// Sirve para celulares viejos, internet lenta o gente a la que el 3D la marea. Tiene la misma interfaz que la maqueta
// 3D (nav, labels, controls) para que el panel de la guía funcione igual.
import { toLocal, toLngLat } from './geo.js';
import { catInfo } from './icons.js';
import { defaultLayers, isVisible } from './layers.js';
import { makeRouter } from './routing.js';
import { CAR_HW, roadWidth } from './roads.js';
import { manhattan, joinPaths } from './route.js';
import { emit, on } from './bus.js';

const IMPORTANT = new Set(['iglesia', 'municipalidad', 'museo', 'cultura', 'biblioteca', 'escuela', 'hospital', 'bomberos', 'policia', 'estacion', 'plaza', 'monumento', 'hotel', 'hospedaje', 'camping', 'club', 'turismo', 'mirador', 'atractivo', 'tanque', 'silo', 'terminal', 'farmacia', 'combustible', 'banco', 'banconacion']);
const PALETTE = ['#e07a5f', '#3d9970', '#4c8fd6', '#d9a441', '#9b6bc7', '#2aa5a0', '#c8567b', '#7a9a3a', '#d2733a', '#5d7bb5'];
const MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary']);
const WALK_HW = new Set([...CAR_HW, 'footway', 'path', 'pedestrian', 'track', 'steps', 'cycleway']);
const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hit2 = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

/** Largo de una línea y punto + dirección a una distancia d de su inicio. */
function lineLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); return L; }
function pointAt(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    if (d <= L || i === pts.length - 1) {
      const t = L ? Math.min(1, d / L) : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * t, a: Math.atan2(pts[i].z - pts[i - 1].z, pts[i].x - pts[i - 1].x) };
    }
    d -= L;
  }
  return null;
}

export function initMap2D({ gj, places, barrios: barriosData = [], tours = [], meta, start = null, reducedMotion = false, lowEnd = false }) {
  document.body.classList.add('mode-2d');
  document.getElementById('gl')?.setAttribute('hidden', '');
  const cv = document.createElement('canvas');
  cv.id = 'map2d';
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', `Mapa de ${meta.town}. Tocá un punto para ver el lugar.`);
  document.body.prepend(cv);
  const ctx = cv.getContext('2d');

  // ---------- datos ----------
  const ring = (c) => c.map(([lng, lat]) => toLocal(lng, lat));
  const roads = [], rails = [], waters = [], waterLines = [], greens = [], blds = [];
  const bbox = (pts) => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z; } return { x0, x1, z0, z1 }; };
  for (const f of gj.features || []) {
    const k = f.properties?.kind, g = f.geometry;
    if (!g) continue;
    if (k === 'road' && g.type === 'LineString') roads.push({ hw: f.properties.hw, name: f.properties.name || null, pts: ring(g.coordinates) });
    else if (k === 'rail' && g.type === 'LineString') rails.push(ring(g.coordinates));
    else if (k === 'water' && g.type === 'LineString') waterLines.push({ name: f.properties.name || null, pts: ring(g.coordinates) });
    else if (k === 'water' && g.type === 'Polygon') { const pts = ring(g.coordinates[0]); waters.push({ pts, name: f.properties.name || null, ...bbox(pts) }); }
    else if (k === 'green' && g.type === 'Polygon') { const pts = ring(g.coordinates[0]); greens.push({ pts, ...bbox(pts) }); }
    else if (k === 'building') {
      const r = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null;
      if (r && r.length > 3) { const pts = ring(r); blds.push({ pts, ...bbox(pts) }); }
    }
  }
  for (const r of roads) { r.w = roadWidth(r); r.major = MAJOR.has(r.hw); r.len = lineLen(r.pts); }
  const byId = new Map(places.map((p) => [p.id, p]));
  const half = meta.osm?.halfSizeMeters ?? 2000;

  // ---------- vista ----------
  let W = 0, H = 0, dpr = 1;
  const view = { x: 0, z: 0, s: 0.4 };
  const minS = () => Math.max(0.02, (Math.min(W, H) || 600) / (half * 2.2));
  const MAX_S = 7;
  const toPx = (x, z) => [(x - view.x) * view.s + W / 2, (z - view.z) * view.s + H / 2];
  const toM = (px, py) => ({ x: (px - W / 2) / view.s + view.x, z: (py - H / 2) / view.s + view.z });
  const sFromDist = (d) => clamp(380 / d, minS(), MAX_S);
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, lowEnd ? 1.5 : 2);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    view.s = clamp(view.s, minS(), MAX_S);
    ask();
  }

  // ---------- estado de lo que se dibuja ----------
  let layers = defaultLayers();
  let extra = new Set();
  let activeId = null;
  let searchPin = null;
  let showCalles = true;
  let showBarrios = false;
  let route = null; // { pts, stops: [{x,z}] }
  let tour = null, step = 0;
  const barrios = barriosData.map((b, i) => {
    const pts = (b.polygon || []).map(([lng, lat]) => toLocal(lng, lat));
    if (pts.length > 1 && pts[0].x === pts[pts.length - 1].x && pts[0].z === pts[pts.length - 1].z) pts.pop();
    if (pts.length < 3) return null;
    const bb = bbox(pts);
    let A = 0, cx = 0, cz = 0;
    for (let k = 0; k < pts.length; k++) { const p = pts[k], q = pts[(k + 1) % pts.length]; const w = p.x * q.z - q.x * p.z; A += w; cx += (p.x + q.x) * w; cz += (p.z + q.z) * w; }
    if (Math.abs(A) < 1e-6) { cx = (bb.x0 + bb.x1) / 2; cz = (bb.z0 + bb.z1) / 2; } else { cx /= 3 * A; cz /= 3 * A; }
    return { id: b.id || b.name, name: b.name, approx: Boolean(b.approx), color: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : PALETTE[i % PALETTE.length], pts, cx, cz, size: Math.max(bb.x1 - bb.x0, bb.z1 - bb.z0) };
  }).filter(Boolean);

  let shown = []; // lugares que se ven ahora: { p, x, z }
  const recomputeShown = () => {
    shown = places.filter((p) => p.id === activeId || extra.has(p.id) || isVisible(p, layers)).map((p) => ({ p, ...toLocal(p.lng, p.lat) }));
  };
  recomputeShown();

  // ---------- dibujo ----------
  let queued = false;
  function ask() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; draw(); }); }

  function draw() {
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ece8dc'; ctx.fillRect(0, 0, W, H);
    const s = view.s;
    const vx0 = view.x - W / 2 / s - 30, vx1 = view.x + W / 2 / s + 30, vz0 = view.z - H / 2 / s - 30, vz1 = view.z + H / 2 / s + 30;
    const seen = (b) => b.x1 >= vx0 && b.x0 <= vx1 && b.z1 >= vz0 && b.z0 <= vz1;
    const path = (pts, close) => { ctx.beginPath(); for (let i = 0; i < pts.length; i++) { const [x, y] = toPx(pts[i].x, pts[i].z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } if (close) ctx.closePath(); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // verde y agua
    ctx.fillStyle = '#cfe2b6';
    for (const g of greens) if (seen(g)) { path(g.pts, true); ctx.fill(); }
    ctx.fillStyle = '#a9cfe6';
    for (const g of waters) if (seen(g)) { path(g.pts, true); ctx.fill(); }
    ctx.strokeStyle = '#a9cfe6'; ctx.lineWidth = Math.max(2, 6 * s);
    for (const w of waterLines) { path(w.pts, false); ctx.stroke(); }

    // casas (de lejos no se dibujan: no se distinguen y hacen perder tiempo)
    if (s >= 0.1) {
      ctx.beginPath();
      for (const b of blds) {
        if (!seen(b)) continue;
        for (let i = 0; i < b.pts.length; i++) { const [x, y] = toPx(b.pts[i].x, b.pts[i].z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.closePath();
      }
      ctx.fillStyle = s >= 0.7 ? '#d9cdb6' : '#cfc3ac'; ctx.fill();
      if (s >= 1.1) { ctx.strokeStyle = '#b9ad95'; ctx.lineWidth = 1; ctx.stroke(); }
    }

    // calles: de lejos solo las principales
    const list = s < 0.12 ? roads.filter((r) => r.major) : roads;
    const vis = list.filter((r) => { let ok = false; for (const p of r.pts) if (p.x > vx0 && p.x < vx1 && p.z > vz0 && p.z < vz1) { ok = true; break; } return ok || r.len > 800; });
    for (const pass of [0, 1]) {
      for (const r of vis) {
        path(r.pts, false);
        const w = Math.max(r.major ? 2 : 1.2, r.w * s);
        ctx.strokeStyle = pass ? (r.major ? '#fff3c4' : '#ffffff') : '#bdb7a6';
        ctx.lineWidth = pass ? w : w + 2;
        ctx.stroke();
      }
    }
    ctx.setLineDash([8, 6]); ctx.strokeStyle = '#7d7d7d'; ctx.lineWidth = 2;
    for (const r of rails) { path(r, false); ctx.stroke(); }
    ctx.setLineDash([]);

    // barrios
    if (showBarrios) {
      for (const b of barrios) {
        path(b.pts, true);
        ctx.globalAlpha = b.approx ? 0.16 : 0.26; ctx.fillStyle = b.color; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = b.color; ctx.lineWidth = 2.5; if (b.approx) ctx.setLineDash([8, 5]); ctx.stroke(); ctx.setLineDash([]);
      }
    }

    const boxes = []; // textos ya puestos (para que no se pisen)
    const text = (str, x, y, { font = '600 12px system-ui, sans-serif', color = '#333', halo = 'rgba(255,255,255,.92)', angle = 0, priority = false } = {}) => {
      ctx.font = font;
      const w = ctx.measureText(str).width;
      const c = Math.abs(Math.cos(angle)), sn = Math.abs(Math.sin(angle));
      const bw = w * c + 14 * sn, bh = w * sn + 14 * c;
      const b = [x - bw / 2 - 3, y - bh / 2 - 2, x + bw / 2 + 3, y + bh / 2 + 2];
      if (b[2] < 0 || b[0] > W || b[3] < 0 || b[1] > H) return false;
      if (!priority && boxes.some((o) => hit2(b, o))) return false;
      boxes.push(b);
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3.5; ctx.strokeStyle = halo; ctx.strokeText(str, 0, 0); ctx.fillStyle = color; ctx.fillText(str, 0, 0);
      ctx.restore();
      return true;
    };

    if (showBarrios) for (const b of barrios) { const [x, y] = toPx(b.cx, b.cz); text(b.name.toUpperCase() + (b.approx ? ' (aprox.)' : ''), x, y, { font: '700 13px system-ui, sans-serif', color: '#1b2a3f', priority: true }); }

    // recorrido
    if (route) {
      path(route.pts, false); ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.stroke();
      path(route.pts, false); ctx.strokeStyle = '#e0572b'; ctx.lineWidth = 4.5; ctx.stroke();
    }

    // nombres de calles y ríos (girados siguiendo la calle, sin pisarse)
    if (showCalles && s >= 0.5) {
      const named = roads.filter((r) => r.name && r.len > 40).sort((a, b) => b.len - a.len);
      const seenNames = new Map();
      let n = 0;
      for (const r of named) {
        if (n > 120) break;
        const step = Math.max(160, 90 / s);
        for (let d = step / 2; d < r.len; d += step) {
          const p = pointAt(r.pts, d);
          if (!p || p.x < vx0 || p.x > vx1 || p.z < vz0 || p.z > vz1) continue;
          const key = r.name;
          const [x, y] = toPx(p.x, p.z);
          let a = p.a; if (a > Math.PI / 2) a -= Math.PI; else if (a < -Math.PI / 2) a += Math.PI;
          if (text(r.name, x, y, { font: `600 ${s > 1.6 ? 13 : 11}px system-ui, sans-serif`, color: '#444', angle: a })) { seenNames.set(key, (seenNames.get(key) || 0) + 1); n++; }
          if ((seenNames.get(key) || 0) >= 3) break;
        }
      }
      for (const w of waterLines) {
        if (!w.name) continue;
        const p = pointAt(w.pts, lineLen(w.pts) / 2);
        if (!p) continue;
        const [x, y] = toPx(p.x, p.z);
        let a = p.a; if (a > Math.PI / 2) a -= Math.PI; else if (a < -Math.PI / 2) a += Math.PI;
        text('〰 ' + w.name, x, y, { font: 'italic 600 12px system-ui, sans-serif', color: '#1d5d86', angle: a });
      }
    }

    // lugares
    const showAll = s >= 0.35;
    const pins = [];
    for (const it of shown) {
      const on = it.p.id === activeId;
      const imp = !it.p.icon || IMPORTANT.has(it.p.icon) || Boolean(it.p.roofH);
      if (!(on || extra.has(it.p.id) || showAll || imp || shown.length < 60)) continue;
      const [x, y] = toPx(it.x, it.z);
      if (x < -20 || y < -30 || x > W + 20 || y > H + 20) continue;
      pins.push({ ...it, x, y, on, imp });
    }
    pins.sort((a, b) => (a.on - b.on) || (a.imp - b.imp)); // lo activo queda arriba de todo
    for (const pn of pins) {
      const info = catInfo(pn.p.category);
      const r = pn.on ? 11 : s < 0.25 ? 5 : 8;
      ctx.beginPath(); ctx.arc(pn.x, pn.y, r + 2, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(pn.x, pn.y, r, 0, 7); ctx.fillStyle = info.color; ctx.fill();
      if (r >= 8) { ctx.beginPath(); ctx.arc(pn.x, pn.y, 2.6, 0, 7); ctx.fillStyle = info.ink || '#fff'; ctx.fill(); }
      pn.r = r;
    }
    for (const pn of pins.slice().reverse()) {
      if (pn.on || s >= 0.8 || (s >= 0.4 && pn.imp)) text(pn.p.name, pn.x, pn.y - pn.r - 9, { font: `${pn.on ? 700 : 600} 12px system-ui, sans-serif`, color: '#1b2a3f', priority: pn.on });
    }
    hitList = pins;

    // paradas del recorrido numeradas
    if (route) {
      route.stops.forEach((st, i) => {
        const [x, y] = toPx(st.x, st.z);
        ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fillStyle = i === step ? '#e0572b' : '#1b3a5c'; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), x, y + 0.5);
      });
    }

    // pin del buscador
    if (searchPin) {
      const [x, y] = toPx(searchPin.x, searchPin.z);
      ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fillStyle = '#d93025'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
      text(searchPin.title, x, y - 22, { font: '700 12px system-ui, sans-serif', color: '#8a1c14', priority: true });
    }
    // escala
    const m = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find((v) => v * s >= 70) || 5000;
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(10, H - 30, m * s + 16, 20);
    ctx.fillStyle = '#222'; ctx.fillRect(18, H - 14, m * s, 2); ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(m >= 1000 ? `${m / 1000} km` : `${m} m`, 18, H - 18);
  }
  let hitList = [];

  // ---------- movimientos animados ----------
  let anim = null;
  function fly(x, z, s, dur = 1.1) {
    s = clamp(s, minS(), MAX_S);
    if (reducedMotion) { Object.assign(view, { x, z, s }); anim = null; ask(); return; }
    anim = { t: 0, dur, from: { ...view }, to: { x, z, s } };
    requestAnimationFrame(tick);
  }
  let last = 0;
  function tick(now) {
    if (!anim) return;
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    anim.t = Math.min(1, anim.t + dt / anim.dur);
    const k = ease(anim.t);
    view.x = anim.from.x + (anim.to.x - anim.from.x) * k;
    view.z = anim.from.z + (anim.to.z - anim.from.z) * k;
    // el zoom se interpola en escala logarítmica (se siente parejo)
    view.s = Math.exp(Math.log(anim.from.s) + (Math.log(anim.to.s) - Math.log(anim.from.s)) * k);
    draw();
    if (anim.t >= 1) { anim = null; last = 0; return; }
    requestAnimationFrame(tick);
  }
  const zoomAt = (f, px = W / 2, py = H / 2) => {
    anim = null;
    const before = toM(px, py);
    view.s = clamp(view.s * f, minS(), MAX_S);
    const after = toM(px, py);
    view.x += before.x - after.x; view.z += before.z - after.z;
    ask();
  };

  // ---------- gestos: arrastrar, pellizcar, rueda, doble toque ----------
  const ptrs = new Map();
  let drag = null, pinch = null, moved = false;
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    anim = null;
    if (ptrs.size === 1) { drag = { x: e.clientX, y: e.clientY, vx: view.x, vz: view.z }; moved = false; }
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s: view.s }; drag = null; moved = true; }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const before = toM(mx, my);
      view.s = clamp(pinch.s * (d / pinch.d), minS(), MAX_S);
      const after = toM(mx, my);
      view.x += before.x - after.x; view.z += before.z - after.z;
      ask();
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    moved = true;
    view.x = drag.vx - dx / view.s; view.z = drag.vz - dy / view.s;
    ask();
  });
  const up = (e) => {
    const was = ptrs.has(e.pointerId);
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (!was) return;
    if (!moved && e.type === 'pointerup') tap(e.clientX, e.clientY);
    if (ptrs.size === 0) drag = null;
    else if (ptrs.size === 1) { const [x, y] = [...ptrs.values()][0]; drag = { x, y, vx: view.x, vz: view.z }; moved = true; }
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY); }, { passive: false });
  cv.addEventListener('dblclick', (e) => zoomAt(2, e.clientX, e.clientY));
  function tap(px, py) {
    let best = null, bd = 22;
    for (const pn of hitList) { const d = Math.hypot(pn.x - px, pn.y - py); if (d < bd) { bd = d; best = pn; } }
    if (best) emit('place:select', best.p.id);
  }
  addEventListener('resize', resize);

  // ---------- recorrido ----------
  const routers = {};
  const routerFor = (mode) => { const k = mode === 'car' ? 'car' : 'walk'; return (routers[k] ||= makeRouter(roads, k === 'car' ? CAR_HW : WALK_HW)); };
  function buildRoute(t) {
    let pts;
    const stopsP = t.stops.map((s) => byId.get(s.placeId)).filter(Boolean).map((p) => toLocal(p.lng, p.lat));
    if (Array.isArray(t.path) && t.path.length > 1) pts = t.path.map(([lng, lat]) => toLocal(lng, lat));
    else if (stopsP.length > 1) { const rt = routerFor(t.mode); pts = joinPaths(stopsP.slice(1).map((s, i) => (rt && rt.route(stopsP[i], s)) || manhattan(stopsP[i], s))); }
    return pts && pts.length > 1 ? { pts, stops: stopsP } : null;
  }
  const fitPts = (pts, pad = 1.35) => {
    const b = bbox(pts);
    const size = Math.max(b.x1 - b.x0, b.z1 - b.z0, 120);
    return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, s: Math.min(W, H * 0.8) / (size * pad) };
  };

  const goStep = (i) => {
    if (!tour) return;
    step = clamp(i, 0, tour.stops.length - 1);
    const p = byId.get(tour.stops[step].placeId) || null;
    if (p) { const q = toLocal(p.lng, p.lat); fly(q.x, q.z, sFromDist(130)); }
    emit('tour:step', { tour, step, place: p });
    ask();
  };
  const nav = {
    flyTo(lng, lat, { dist = 170 } = {}) { const q = toLocal(lng, lat); fly(q.x, q.z, sFromDist(dist)); },
    focusPlace(id) { const p = byId.get(id); if (p) nav.flyTo(p.lng, p.lat); },
    startTour(id) {
      const t = tours.find((x) => x.id === id);
      if (!t) return;
      tour = t; route = buildRoute(t);
      if (route) { const f = fitPts(route.pts); fly(f.x, f.z, f.s, 1.2); }
      step = 0;
      emit('tour:step', { tour, step: 0, place: byId.get(t.stops[0]?.placeId) || null });
      ask();
    },
    stopTour() { tour = null; step = 0; route = null; emit('tour:stop'); ask(); },
    goStep, next: () => goStep(step + 1), prev: () => goStep(step - 1),
    get tour() { return tour; },
    get step() { return step; },
    resetNorth() {}, cancel() { anim = null; }, update() {},
  };

  const labels = {
    setLayers(set) { layers = new Set(set); recomputeShown(); ask(); },
    setSearchPin(h) { searchPin = h ? { title: h.title, ...toLocal(h.lng, h.lat) } : null; ask(); },
    setExtra(ids) { extra = new Set(ids || []); recomputeShown(); ask(); },
    highlight(id) { activeId = id && byId.has(id) ? id : null; recomputeShown(); ask(); },
    count: () => shown.length,
    update() {},
  };

  const controls = {
    zoomBy(factor) { zoomAt(1 / factor); },
    getAzimuthalAngle: () => 0,
    minDistance: 0, maxDistance: 1e9,
  };

  on('calles:toggle', () => { showCalles = !showCalles; emit('calles:state', showCalles); ask(); });
  on('barrios:toggle', () => { showBarrios = !showBarrios && barrios.length > 0; emit('barrios:state', showBarrios); ask(); });
  on('barrio:select', (id) => {
    const b = barrios.find((x) => x.id === id);
    if (!b) return;
    fly(b.cx, b.cz, Math.min(W, H) / (b.size * 1.25), 1.1);
  });

  // ---------- arranque ----------
  resize();
  const st = start ? toLocal(start.lng, start.lat) : { x: 0, z: 0 };
  view.x = st.x; view.z = st.z; view.s = sFromDist(900);
  ask();

  return { nav, labels, controls, roads, barriosCount: barrios.length };
}
