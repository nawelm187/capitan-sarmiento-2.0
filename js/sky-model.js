// Modelo del cielo: a partir de la altura del sol y del clima calcula colores, luces y niebla.
// Puro (sin three ni DOM). Los colores son [r, g, b] entre 0 y 1.

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
export const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
const scale3 = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// Color de la bruma/cielo según la altura del sol (grados), con cielo despejado.
const SKY_KEYS = [
  [-14, [0.028, 0.04, 0.085]], // noche cerrada
  [-6, [0.075, 0.1, 0.22]], // crepúsculo
  [-1, [0.42, 0.34, 0.5]], // el cielo se enciende
  [3, [0.93, 0.58, 0.4]], // amanecer / atardecer
  [9, [0.76, 0.78, 0.84]], // luz dorada que se aclara
  [22, [0.62, 0.78, 0.94]], // día
  [90, [0.57, 0.75, 0.95]],
];

function keyed(keys, x) {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (x <= keys[i][0]) return mix3(keys[i - 1][1], keys[i][1], (x - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]));
  }
  return keys[keys.length - 1][1];
}

/**
 * @param {{elevation:number, cloud?:number, rain?:number, snow?:number, fog?:number, storm?:boolean}} s
 */
export function skyModel(s) {
  const el = s.elevation;
  const cloud = clamp(s.cloud ?? 0);
  const rain = clamp(s.rain ?? 0);
  const snow = clamp(s.snow ?? 0);
  const fog = clamp(s.fog ?? 0);
  const wet = Math.max(rain, snow);
  const day = smooth(-3, 14, el); // 0 noche … 1 día pleno
  const dusk = smooth(-7, -1, el) * (1 - smooth(4, 12, el)); // franja de amanecer / atardecer

  // --- Cielo / bruma ---
  let sky = keyed(SKY_KEYS, el);
  // Nublado: el color se apaga hacia un gris de la misma luminosidad.
  const gray = Math.max(0.05, lum(sky)) * (1 - 0.1 * wet);
  sky = mix3(sky, [gray, gray * 1.02, gray * 1.06], cloud * 0.72);
  sky = scale3(sky, 1 - 0.22 * rain - 0.12 * snow - (s.storm ? 0.16 : 0));
  // Niebla: bruma clara de día, oscura de noche.
  const haze = mix3([0.07, 0.085, 0.115], [0.8, 0.82, 0.85], day);
  sky = mix3(sky, haze, fog * 0.75);
  // La nieve aclara el aire.
  sky = mix3(sky, [0.8, 0.83, 0.88], snow * 0.25 * day);

  // --- Sol (luz principal) ---
  const sunWarm = mix3([1.0, 0.55, 0.28], [1.0, 0.9, 0.72], smooth(0, 28, el));
  const sunIntensity = 2.3 * smooth(-1.5, 13, el) * (1 - 0.72 * cloud) * (1 - 0.4 * wet) * (1 - 0.5 * fog);

  // --- Luz del cielo (hemisférica) ---
  const hemiSkyDay = [0.81, 0.86, 1.0];
  const hemiSkyDusk = [1.0, 0.76, 0.62];
  const hemiSkyNight = [0.27, 0.35, 0.58];
  let hemiSky = mix3(hemiSkyNight, hemiSkyDay, day);
  hemiSky = mix3(hemiSky, hemiSkyDusk, dusk * 0.7);
  hemiSky = mix3(hemiSky, [0.72, 0.75, 0.8], cloud * 0.5 * day);
  const hemiGround = mix3([0.06, 0.07, 0.1], [0.227, 0.2, 0.149], day);
  const hemiIntensity = (0.95 + 0.05 * day) * (1 + 0.16 * cloud * day) * (s.storm ? 0.85 : 1) * (1 - 0.18 * cloud * (1 - day));

  // --- Luna ---
  const moonIntensity = 1.0 * (1 - smooth(-6, 2, el)) * (1 - 0.6 * cloud) * (1 - 0.4 * fog);

  // --- Luces artificiales: se prenden al caer la tarde, o con tormenta fuerte ---
  const lamps = clamp(1 - smooth(-2, 7, el) + (rain > 0.6 || s.storm ? 0.35 * day : 0) + (fog > 0.6 ? 0.3 * day : 0));
  // Con lluvia o nubes la luna no alcanza: las luces de calle iluminan más fuerte.
  const lampGlow = lamps * (1 + 0.7 * Math.max(cloud, rain, fog));
  const stars = (1 - smooth(-13, -4, el)) * (1 - cloud) * (1 - fog);

  // --- Niebla del escenario (distancias en metros) ---
  const fogNear = 1500 * (1 - 0.55 * rain - 0.3 * snow) * (1 - 0.9 * fog) * mix(0.85, 1, day);
  const fogFar = 5200 * (1 - 0.45 * rain - 0.3 * snow) * (1 - 0.78 * fog) * mix(0.88, 1, day);

  return {
    sky, sunColor: sunWarm, sunIntensity,
    hemiSky, hemiGround, hemiIntensity,
    moonIntensity, moonColor: [0.55, 0.66, 1.0],
    lamps, lampGlow, stars, day, dusk,
    fogNear: Math.max(60, fogNear), fogFar: Math.max(500, fogFar),
    wetGround: rain, // 0 seco … 1 mojado
    exposure: 1.05 + 0.28 * (1 - day),
  };
}
