// Posición del sol y hora local del pueblo. Puro (sin three ni DOM): se prueba desde Node.
// Fórmulas simplificadas de NOAA (error de pocos minutos, de sobra para una maqueta).

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const mod = (a, n) => ((a % n) + n) % n;

/** @returns {{elevation: number, azimuth: number}} grados; azimut desde el norte, hacia el este (0=N, 90=E). */
export function sunPosition(date, lat, lng) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = mod(280.46646 + T * (36000.76983 + T * 0.0003032), 360);
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const Mr = M * RAD;
  const C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) + Math.sin(3 * Mr) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = (trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD)) * RAD;
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = (eps0 + 0.00256 * Math.cos(omega * RAD)) * RAD;
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const y = Math.tan(eps / 2) ** 2;
  const L0r = L0 * RAD;
  const eqTime = 4 * DEG * (y * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr) + 4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r) - 0.5 * y * y * Math.sin(4 * L0r) - 1.25 * e * e * Math.sin(2 * Mr));
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60 + date.getUTCMilliseconds() / 60000;
  const tst = mod(utcMin + eqTime + 4 * lng, 1440);
  const H = (tst / 4 - 180) * RAD;
  const phi = lat * RAD;
  const sinEl = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(H);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) + Math.PI;
  return { elevation: el * DEG, azimuth: mod(az * DEG, 360) };
}

/** Argentina no usa horario de verano desde 2009: UTC-3 todo el año. */
export const ART_OFFSET_H = -3;

/** Fecha/hora actual vista en Argentina, como números. */
export function localParts(date = new Date()) {
  const d = new Date(date.getTime() + ART_OFFSET_H * 3600000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), min: d.getUTCMinutes() };
}

/** Instante (Date) que corresponde a las `hour` horas (puede tener decimales) de hoy en Argentina. */
export function todayAtHour(hour, now = new Date()) {
  const p = localParts(now);
  return new Date(Date.UTC(p.y, p.m, p.d, 0, 0, 0) + (hour - ART_OFFSET_H) * 3600000);
}

/** Hora del día (0–24) en Argentina para un instante. */
export function localHour(date = new Date()) {
  const p = localParts(date);
  return p.h + p.min / 60;
}

/** Salida y puesta del sol (instantes) del día local de `date`, o null si no hay (polos). */
export function sunTimes(date, lat, lng) {
  const start = todayAtHour(0, date).getTime();
  let rise = null;
  let set = null;
  let prev = sunPosition(new Date(start), lat, lng).elevation;
  for (let m = 5; m <= 1440; m += 5) {
    const el = sunPosition(new Date(start + m * 60000), lat, lng).elevation;
    if (prev < -0.833 && el >= -0.833 && rise === null) rise = new Date(start + (m - 2.5) * 60000);
    if (prev >= -0.833 && el < -0.833 && set === null) set = new Date(start + (m - 2.5) * 60000);
    prev = el;
  }
  return { sunrise: rise, sunset: set };
}
