// Clima en vivo (Open-Meteo, gratis, sin clave) y su traducción a un "estado" simple para la maqueta.
// Si no hay internet o falla el servicio, la maqueta muestra cielo despejado (el ciclo día/noche igual funciona).
// Datos meteorológicos: Open-Meteo.com (CC BY 4.0).

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Estado base de la maqueta: todo entre 0 y 1 salvo temperatura (°C) y viento (m/s). */
export const CLEAR = { cloud: 0.05, rain: 0, snow: 0, fog: 0, storm: false, wind: 2, temp: null, label: 'Despejado', code: 0 };

// Código WMO -> [nubosidad mínima, lluvia, nieve, niebla, tormenta, etiqueta]
const WMO = {
  0: [0.04, 0, 0, 0, false, 'Despejado'],
  1: [0.18, 0, 0, 0, false, 'Mayormente despejado'],
  2: [0.5, 0, 0, 0, false, 'Parcialmente nublado'],
  3: [0.92, 0, 0, 0, false, 'Nublado'],
  45: [0.85, 0, 0, 0.85, false, 'Niebla'],
  48: [0.88, 0, 0, 0.95, false, 'Niebla con escarcha'],
  51: [0.85, 0.22, 0, 0, false, 'Llovizna leve'],
  53: [0.88, 0.35, 0, 0, false, 'Llovizna'],
  55: [0.9, 0.5, 0, 0, false, 'Llovizna intensa'],
  56: [0.88, 0.35, 0, 0, false, 'Llovizna helada'],
  57: [0.9, 0.5, 0, 0, false, 'Llovizna helada'],
  61: [0.88, 0.42, 0, 0, false, 'Lluvia leve'],
  63: [0.92, 0.7, 0, 0, false, 'Lluvia'],
  65: [0.96, 1, 0, 0, false, 'Lluvia fuerte'],
  66: [0.9, 0.6, 0, 0, false, 'Lluvia helada'],
  67: [0.95, 0.9, 0, 0, false, 'Lluvia helada fuerte'],
  71: [0.9, 0, 0.35, 0, false, 'Nevada leve'],
  73: [0.93, 0, 0.65, 0, false, 'Nevada'],
  75: [0.96, 0, 1, 0, false, 'Nevada fuerte'],
  77: [0.9, 0, 0.4, 0, false, 'Granizo fino'],
  80: [0.85, 0.45, 0, 0, false, 'Chaparrones leves'],
  81: [0.9, 0.75, 0, 0, false, 'Chaparrones'],
  82: [0.96, 1, 0, 0, false, 'Chaparrones fuertes'],
  85: [0.9, 0, 0.5, 0, false, 'Chaparrones de nieve'],
  86: [0.95, 0, 0.9, 0, false, 'Chaparrones de nieve fuertes'],
  95: [0.96, 0.85, 0, 0, true, 'Tormenta'],
  96: [0.97, 1, 0, 0, true, 'Tormenta con granizo'],
  99: [0.98, 1, 0, 0, true, 'Tormenta fuerte con granizo'],
};

/** Traduce el bloque `current` de Open-Meteo. */
export function fromOpenMeteo(cur) {
  if (!cur || typeof cur !== 'object') return { ...CLEAR };
  const code = Number(cur.weather_code);
  const row = WMO[code] || WMO[code >= 95 ? 95 : code >= 80 ? 81 : code >= 71 ? 73 : code >= 61 ? 63 : code >= 51 ? 53 : 0];
  const cover = Number.isFinite(Number(cur.cloud_cover)) ? clamp01(Number(cur.cloud_cover) / 100) : row[0];
  const wetOrFog = row[1] || row[2] || row[3];
  return {
    cloud: wetOrFog ? Math.max(row[0], cover) : cover,
    rain: row[1],
    snow: row[2],
    fog: row[3],
    storm: row[4],
    wind: Number.isFinite(Number(cur.wind_speed_10m)) ? Number(cur.wind_speed_10m) / 3.6 : 2, // km/h -> m/s
    temp: Number.isFinite(Number(cur.temperature_2m)) ? Number(cur.temperature_2m) : null,
    label: row[5],
    code,
  };
}

/** Estados de prueba para `?clima=...` en la dirección del sitio. */
export const PRESETS = {
  despejado: { ...CLEAR },
  nublado: { ...CLEAR, cloud: 0.92, label: 'Nublado', code: 3 },
  lluvia: { ...CLEAR, cloud: 0.95, rain: 0.7, label: 'Lluvia', code: 63, wind: 6 },
  lluviafuerte: { ...CLEAR, cloud: 0.97, rain: 1, label: 'Lluvia fuerte', code: 65, wind: 10 },
  tormenta: { ...CLEAR, cloud: 0.98, rain: 0.9, storm: true, label: 'Tormenta', code: 95, wind: 12 },
  niebla: { ...CLEAR, cloud: 0.85, fog: 0.85, label: 'Niebla', code: 45, wind: 1 },
  nieve: { ...CLEAR, cloud: 0.93, snow: 0.7, label: 'Nevada', code: 73, wind: 3 },
};

export const CLIMA_VALIDOS = Object.keys(PRESETS);

const KEY = 'sarmiento-clima-v1';

function readCache() {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (j && Date.now() - j.t < 6 * 3600000 && j.state) return j.state;
  } catch { /* sin almacenamiento: se ignora */ }
  return null;
}
function writeCache(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), state }));
  } catch { /* idem */ }
}

/** Pide el clima actual. Devuelve el estado, o null si no se pudo. */
export async function fetchWeather(lat, lng, fetchImpl = fetch) {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
    '&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m&timezone=America%2FArgentina%2FBuenos_Aires';
  try {
    const res = await fetchImpl(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    if (!j.current) throw new Error('sin datos');
    const state = fromOpenMeteo(j.current);
    writeCache(state);
    return state;
  } catch (e) {
    console.warn('Clima no disponible:', e.message || e);
    return null;
  }
}

/** Último clima guardado en este navegador (si es de hace menos de 6 horas). */
export const cachedWeather = readCache;
