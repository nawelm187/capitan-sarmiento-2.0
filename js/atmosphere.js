// Ciclo del día y clima en tiempo real sobre la maqueta:
//  - el sol sale, cruza el cielo y se pone según la fecha y la hora reales de Capitán Sarmiento;
//  - de noche oscurece, aparecen estrellas, luces de calles y de casas;
//  - el clima viene de Open-Meteo (nublado, lluvia, tormenta, niebla, nieve) y se refleja en luz, cielo, niebla,
//    lluvia animada, charcos (suelo mojado) y relámpagos.
// Para probar sin esperar: ?hora=22  ?hora=6:30  ?clima=lluvia|lluviafuerte|tormenta|nublado|niebla|nieve|despejado
//
// Los números del aspecto (colores, intensidades, niebla) están en sky-model.js; acá solo se aplican.
import { roadWidth } from './roads.js';
import * as THREE from 'three';
import { mulberry32, hash2 } from './util.js';
import { sunPosition, todayAtHour, localHour } from './sun.js';
import { skyModel, smooth, clamp } from './sky-model.js';
import { CLEAR, PRESETS, fetchWeather, cachedWeather } from './weather.js';

const SRGB = THREE.SRGBColorSpace;
const rad = Math.PI / 180;

// Altura de calle -> distancia del poste al eje (metros)
const LAMP_SIDE = { primary: 9.5, secondary: 8.5, tertiary: 7.5, unclassified: 6.8, residential: 6.8, living_street: 6 };

// Horas que recorre el botón del clima al tocarlo (null = hora real)
const SIM_HOURS = [null, 6.3, 13, 19.2, 23];

function glowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = SRGB;
  return t;
}

/** Textura de nubes (ruido suave) para las sombras de nubes sobre el suelo. */
function cloudTexture() {
  const N = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const img = g.createImageData(N, N);
  const lat = (x, y, f) => {
    // ruido de valor periódico (se repite sin cortes)
    const P = 8 * f;
    const fx = (x / N) * P;
    const fy = (y / N) * P;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const h = (i, j) => hash2(((i % P) + P) % P + f * 31, ((j % P) + P) % P + f * 17);
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = h(x0, y0) + (h(x0 + 1, y0) - h(x0, y0)) * sx;
    const b = h(x0, y0 + 1) + (h(x0 + 1, y0 + 1) - h(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const n = lat(x, y, 1) * 0.55 + lat(x, y, 2) * 0.3 + lat(x, y, 4) * 0.15;
      const a = smooth(0.42, 0.68, n);
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(a * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function initAtmosphere({ scene, renderer, sun, hemi, world, meta, lowEnd = false }) {
  const lat = meta.center.lat;
  const lng = meta.center.lng;
  const rand = mulberry32(2026);
  const q = new URLSearchParams(location.search);

  // ---------- Luna ----------
  const moon = new THREE.DirectionalLight(0x8ca8ff, 0);
  moon.castShadow = false;
  scene.add(moon, moon.target);

  // ---------- Estado ----------
  let hourOverride = null;
  const h = q.get('hora');
  if (h) {
    const [hh, mm = '0'] = h.split(':');
    const v = Number(hh) + Number(mm) / 60;
    if (Number.isFinite(v) && v >= 0 && v < 24) hourOverride = v;
  }
  let simIdx = 0;
  const preset = PRESETS[(q.get('clima') || '').toLowerCase()] || null;
  const target = { ...CLEAR, ...(preset || cachedWeather() || {}) }; // clima al que se quiere llegar
  const cur = { cloud: target.cloud, rain: target.rain, snow: target.snow, fog: target.fog, storm: target.storm ? 1 : 0, wind: target.wind };
  const info = { label: target.label, temp: target.temp, code: target.code };
  let live = !preset; // con ?clima= se usa ese clima y no se consulta el servicio
  let lastFetch = 0;

  const sunOffset = new THREE.Vector3(-420, 620, 260);
  const state = { elevation: 20, azimuth: 0, hour: 12, date: new Date(), lite: false, flash: 0, nextFlash: 6 };

  // ---------- Estrellas ----------
  const starGeo = new THREE.BufferGeometry();
  {
    const n = lowEnd ? 350 : 700;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const az = rand() * Math.PI * 2;
      const el = (0.04 + rand() * 0.96) * (Math.PI / 2);
      const R = 5600;
      p[i * 3] = Math.cos(az) * Math.cos(el) * R;
      p[i * 3 + 1] = Math.sin(el) * R;
      p[i * 3 + 2] = Math.sin(az) * Math.cos(el) * R;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 2.1, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  stars.frustumCulled = false;
  stars.visible = false;
  scene.add(stars);

  // ---------- Luces de calles y casas ----------
  const glow = glowTexture();
  const mkPoints = (arr, size, color) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ map: glow, color, size, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    pts.frustumCulled = false;
    pts.visible = false;
    scene.add(pts);
    return pts;
  };

  let lamps = null;
  let poolMesh = null;
  {
    const lines = (world.roads || []).filter((r) => LAMP_SIDE[r.hw] && r.pts.length > 1);
    let total = 0;
    for (const r of lines) for (let i = 1; i < r.pts.length; i++) total += Math.hypot(r.pts[i].x - r.pts[i - 1].x, r.pts[i].z - r.pts[i - 1].z);
    const cap = lowEnd ? 2500 : 6000;
    const spacing = Math.max(38, total / cap);
    const out = [];
    let side = 1;
    for (const r of lines) {
      const off = roadWidth(r) / 2 + 1.8; // sobre la vereda, también en avenidas con cantero
      let carry = spacing * 0.5;
      for (let i = 1; i < r.pts.length; i++) {
        const a = r.pts[i - 1];
        const b = r.pts[i];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len < 0.5) continue;
        const nx = -(b.z - a.z) / len;
        const nz = (b.x - a.x) / len;
        let d = carry;
        while (d < len) {
          side = -side;
          out.push(a.x + ((b.x - a.x) * d) / len + nx * off * side, 6.5, a.z + ((b.z - a.z) * d) / len + nz * off * side);
          d += spacing;
        }
        carry = d - len;
      }
    }
    if (out.length) {
      lamps = mkPoints(new Float32Array(out), lowEnd ? 9 : 8, 0xffd9a0);
      // Charcos de luz en el suelo: una mancha cálida bajo cada farol, así las calles se ven iluminadas de noche.
      const n = out.length / 3;
      const pc = document.createElement('canvas');
      pc.width = pc.height = 128;
      const pg = pc.getContext('2d');
      const grad = pg.createRadialGradient(64, 64, 2, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      grad.addColorStop(0.7, 'rgba(255,255,255,0.12)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      pg.fillStyle = grad;
      pg.fillRect(0, 0, 128, 128);
      const poolTex = new THREE.CanvasTexture(pc);
      poolTex.colorSpace = THREE.SRGBColorSpace;
      const poolGeo = new THREE.PlaneGeometry(1, 1);
      poolGeo.rotateX(-Math.PI / 2);
      poolMesh = new THREE.InstancedMesh(
        poolGeo,
        new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffb765, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }),
        n,
      );
      const pm = new THREE.Matrix4();
      const R = lowEnd ? 24 : 28;
      for (let i = 0; i < n; i++) {
        pm.makeScale(R, 1, R).setPosition(out[i * 3], 0.2, out[i * 3 + 2]);
        poolMesh.setMatrixAt(i, pm);
      }
      poolMesh.instanceMatrix.needsUpdate = true;
      poolMesh.frustumCulled = false;
      poolMesh.visible = false;
      poolMesh.renderOrder = 2;
      scene.add(poolMesh);
    }
  }

  let windows = null;
  {
    const c = world.buildingCenters || new Float32Array(0);
    const frac = lowEnd ? 0.16 : 0.3;
    const out = [];
    for (let i = 0; i < c.length; i += 3) {
      if (hash2(c[i] * 0.37, c[i + 1] * 0.51) > frac) continue;
      out.push(c[i], c[i + 2] + 1.4, c[i + 1]);
      if (out.length >= (lowEnd ? 1500 : 4500) * 3) break;
    }
    if (out.length) windows = mkPoints(new Float32Array(out), 4.2, 0xffc77a);
  }

  // ---------- Lluvia y nieve ----------
  const RAIN_N = lowEnd ? 900 : 2600;
  const SNOW_N = lowEnd ? 600 : 1500;
  const rainPos = new Float32Array(RAIN_N * 6);
  const rainSeed = new Float32Array(RAIN_N * 3); // x, y, z locales [-0.5, 0.5]
  for (let i = 0; i < RAIN_N; i++) rainSeed.set([rand() - 0.5, rand() - 0.5, rand() - 0.5], i * 3);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xc4d6ea, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  const snowPos = new Float32Array(SNOW_N * 3);
  const snowSeed = new Float32Array(SNOW_N * 3);
  for (let i = 0; i < SNOW_N; i++) snowSeed.set([rand() - 0.5, rand() - 0.5, rand() - 0.5], i * 3);
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
  snow.frustumCulled = false;
  snow.visible = false;
  scene.add(snow);

  // ---------- Sombras de nubes sobre el suelo ----------
  const cloudTex = cloudTexture();
  const EXT = (world.half || 2000) * 2;
  cloudTex.repeat.set(EXT / 900, EXT / 900);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0x0b1018, alphaMap: cloudTex, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const cloudShadow = new THREE.Mesh(new THREE.PlaneGeometry(EXT, EXT), cloudMat);
  cloudShadow.rotation.x = -Math.PI / 2;
  cloudShadow.position.y = 0.7;
  cloudShadow.visible = false;
  cloudShadow.renderOrder = 1;
  scene.add(cloudShadow);

  // ---------- Clima en vivo ----------
  async function refreshWeather() {
    if (!live) return;
    lastFetch = Date.now();
    const w = await fetchWeather(lat, lng);
    if (!w) return;
    Object.assign(target, w);
    info.label = w.label;
    info.temp = w.temp;
    info.code = w.code;
    notify();
  }
  refreshWeather();
  const timer = setInterval(refreshWeather, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastFetch > 10 * 60 * 1000) refreshWeather();
  });

  let onInfo = () => {};
  function notify() {
    onInfo(getInfo());
  }
  function getInfo() {
    return {
      label: info.label,
      temp: info.temp,
      night: state.elevation < -1,
      dusk: state.elevation >= -6 && state.elevation < 6,
      hour: state.hour,
      simulated: hourOverride !== null,
      rain: cur.rain,
      snow: cur.snow,
      fog: cur.fog,
      cloud: cur.cloud,
      storm: cur.storm > 0.5,
    };
  }

  const col = new THREE.Color();
  const lerp = (a, b, k) => a + (b - a) * k;

  function update(dt, camera, tgt) {
    // --- tiempo ---
    const now = new Date();
    state.date = hourOverride === null ? now : todayAtHour(hourOverride, now);
    state.hour = localHour(state.date);
    const sp = sunPosition(state.date, lat, lng);
    state.elevation = sp.elevation;
    state.azimuth = sp.azimuth;

    // --- clima: se acerca suavemente al valor real (~3 s) ---
    const k = 1 - Math.exp(-dt / 1.2);
    cur.cloud = lerp(cur.cloud, target.cloud, k);
    cur.rain = lerp(cur.rain, target.rain, k);
    cur.snow = lerp(cur.snow, target.snow, k);
    cur.fog = lerp(cur.fog, target.fog, k);
    cur.storm = lerp(cur.storm, target.storm ? 1 : 0, k);
    cur.wind = lerp(cur.wind, target.wind, k);

    // --- relámpagos ---
    if (cur.storm > 0.5) {
      state.nextFlash -= dt;
      if (state.nextFlash <= 0) {
        state.flash = 1;
        state.nextFlash = 5 + rand() * 9;
      }
    }
    state.flash = Math.max(0, state.flash - dt * 7);
    const flash = state.flash > 0.5 ? 1 : state.flash > 0.2 ? 0.45 : 0;

    const m = skyModel({ elevation: state.elevation, cloud: cur.cloud, rain: cur.rain, snow: cur.snow, fog: cur.fog, storm: cur.storm > 0.5 });

    // --- cielo y niebla ---
    const sky = flash ? [m.sky[0] + 0.35 * flash, m.sky[1] + 0.35 * flash, m.sky[2] + 0.4 * flash] : m.sky;
    scene.background.setRGB(sky[0], sky[1], sky[2], SRGB);
    scene.fog.color.copy(scene.background);
    scene.fog.near = m.fogNear;
    scene.fog.far = m.fogFar;

    // --- luces ---
    hemi.color.setRGB(m.hemiSky[0], m.hemiSky[1], m.hemiSky[2], SRGB);
    hemi.groundColor.setRGB(m.hemiGround[0], m.hemiGround[1], m.hemiGround[2], SRGB);
    hemi.intensity = m.hemiIntensity + flash * 1.6;
    sun.color.setRGB(m.sunColor[0], m.sunColor[1], m.sunColor[2], SRGB);
    sun.intensity = m.sunIntensity;
    const wantShadow = m.sunIntensity > 0.15 && !sun.userData.noShadow;
    if (sun.castShadow !== wantShadow) sun.castShadow = wantShadow;
    // dirección real del sol, pero sin bajar de 14° (con el sol rasante las sombras serían larguísimas)
    const elDir = Math.max(state.elevation, 14) * rad;
    const az = state.azimuth * rad;
    sunOffset.set(Math.sin(az) * Math.cos(elDir), Math.sin(elDir), -Math.cos(az) * Math.cos(elDir)).multiplyScalar(790);
    moon.color.setRGB(m.moonColor[0], m.moonColor[1], m.moonColor[2], SRGB);
    moon.intensity = m.moonIntensity;
    moon.position.set(tgt.x + 320, 520, tgt.z - 380);
    moon.target.position.set(tgt.x, 0, tgt.z);
    renderer.toneMappingExposure = m.exposure;

    // --- suelo mojado ---
    if (world.roadMaterial) {
      world.roadMaterial.roughness = 0.95 - 0.5 * m.wetGround;
      world.roadMaterial.color.setScalar(1 - 0.22 * m.wetGround);
    }
    if (world.ground?.material) {
      world.ground.material.roughness = 1 - 0.38 * m.wetGround;
      world.ground.material.color.setScalar(1 - 0.14 * m.wetGround);
    }

    // --- estrellas / luces ---
    stars.position.copy(camera.position);
    stars.material.opacity = m.stars * 0.9;
    stars.visible = m.stars > 0.02 && !state.lite;
    if (lamps) {
      lamps.material.opacity = Math.min(1, m.lampGlow * 0.9);
      lamps.visible = m.lamps > 0.02;
      if (poolMesh) {
        poolMesh.material.opacity = Math.min(1, m.lampGlow * 0.55);
        poolMesh.visible = m.lamps > 0.02;
      }
    }
    if (windows) {
      const w = clamp((m.lamps - 0.15) / 0.85);
      windows.material.opacity = w * 0.6;
      windows.visible = w > 0.02 && !state.lite;
    }

    // --- sombras de nubes (nubosidad parcial, de día) ---
    const partial = Math.sin(Math.PI * clamp(cur.cloud)) * (1 - 0.8 * Math.max(cur.rain, cur.fog));
    cloudMat.opacity = 0.34 * partial * m.day;
    cloudShadow.visible = cloudMat.opacity > 0.01 && !state.lite;
    if (cloudShadow.visible) {
      cloudTex.offset.x += (cur.wind * 0.00035 + 0.00004) * dt * 60 * 0.5;
      cloudTex.offset.y += cur.wind * 0.00012 * dt * 30 * 0.5;
    }

    // --- lluvia y nieve alrededor de lo que se mira ---
    const dist = camera.position.distanceTo(tgt);
    const S = clamp(dist * 0.9, 220, 1200);
    const Sy = S * 0.7;
    const rainAmt = cur.rain * (state.lite ? 0.5 : 1);
    if (rainAmt > 0.03) {
      rain.visible = true;
      rain.material.opacity = 0.2 + 0.28 * cur.rain;
      rain.position.set(tgt.x, Sy / 2, tgt.z);
      rain.scale.set(S, Sy, S);
      const n = Math.ceil(RAIN_N * rainAmt);
      const fall = (55 + 40 * cur.rain) / Sy; // fracciones de la caja por segundo
      const slant = clamp(cur.wind / 22, 0, 0.45);
      const len = 0.045 + 0.03 * cur.rain;
      for (let i = 0; i < n; i++) {
        let y = rainSeed[i * 3 + 1] - fall * dt;
        if (y < -0.5) {
          y += 1;
          rainSeed[i * 3] = rand() - 0.5;
          rainSeed[i * 3 + 2] = rand() - 0.5;
        }
        rainSeed[i * 3 + 1] = y;
        const x = rainSeed[i * 3];
        const z = rainSeed[i * 3 + 2];
        rainPos[i * 6] = x;
        rainPos[i * 6 + 1] = y;
        rainPos[i * 6 + 2] = z;
        rainPos[i * 6 + 3] = x + slant * len;
        rainPos[i * 6 + 4] = y + len;
        rainPos[i * 6 + 5] = z;
      }
      rainGeo.setDrawRange(0, n * 2);
      rainGeo.attributes.position.needsUpdate = true;
    } else rain.visible = false;

    const snowAmt = cur.snow * (state.lite ? 0.5 : 1);
    if (snowAmt > 0.03) {
      snow.visible = true;
      snow.position.set(tgt.x, Sy / 2, tgt.z);
      snow.scale.set(S, Sy, S);
      const n = Math.ceil(SNOW_N * snowAmt);
      const fall = 9 / Sy;
      const t = performance.now() / 1000;
      for (let i = 0; i < n; i++) {
        let y = snowSeed[i * 3 + 1] - fall * dt * (0.7 + (i % 5) * 0.12);
        if (y < -0.5) {
          y += 1;
          snowSeed[i * 3] = rand() - 0.5;
          snowSeed[i * 3 + 2] = rand() - 0.5;
        }
        snowSeed[i * 3 + 1] = y;
        snowPos[i * 3] = snowSeed[i * 3] + Math.sin(t * 0.8 + i) * 0.006;
        snowPos[i * 3 + 1] = y;
        snowPos[i * 3 + 2] = snowSeed[i * 3 + 2] + Math.cos(t * 0.7 + i * 1.3) * 0.006;
      }
      snowGeo.setDrawRange(0, n);
      snowGeo.attributes.position.needsUpdate = true;
    } else snow.visible = false;
  }

  return {
    sunOffset,
    update,
    getInfo,
    onInfo(fn) {
      onInfo = fn;
      notify();
    },
    /** Botón del clima: recorre horas de prueba (hora real → amanecer → mediodía → atardecer → noche). */
    cycleTime() {
      simIdx = (simIdx + 1) % SIM_HOURS.length;
      hourOverride = SIM_HOURS[simIdx];
      notify();
    },
    set lite(v) {
      state.lite = !!v;
    },
    dispose() {
      clearInterval(timer);
    },
  };
}
