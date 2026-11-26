// Avisos del tiempo y del camino (módulo puro).
//  · avisosClima(): avisos AUTOMÁTICOS armados con el pronóstico de Open-Meteo. No son alertas oficiales.
//  · Los avisos manuales (ruta cortada, obras…) vienen de data/agenda.json (npm run agenda, archivo fuentes/avisos.txt).

export const SMN = 'https://www.smn.gob.ar/alertas';
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const nombreDia = (iso, hoy) => {
  if (iso === hoy) return 'hoy';
  const d = new Date(iso + 'T12:00:00');
  const h = new Date(hoy + 'T12:00:00');
  return Math.round((d - h) / 86400000) === 1 ? 'mañana' : DIAS[d.getDay()];
};

/** daily: bloque `daily` de Open-Meteo (time[], weather_code[], temperature_2m_max[], temperature_2m_min[], precipitation_sum[], wind_gusts_10m_max[]). */
export function avisosClima(daily, hoy) {
  const out = [];
  const t = daily?.time || [];
  for (let i = 0; i < Math.min(t.length, 3); i++) {
    const cuando = nombreDia(t[i], hoy);
    const code = Number(daily.weather_code?.[i]);
    const mm = Number(daily.precipitation_sum?.[i]);
    const rafaga = Number(daily.wind_gusts_10m_max?.[i]);
    const tmax = Number(daily.temperature_2m_max?.[i]);
    const tmin = Number(daily.temperature_2m_min?.[i]);
    if (code >= 95) out.push({ tipo: 'clima', nivel: 2, titulo: `Posibles tormentas ${cuando}`, texto: code >= 96 ? 'El pronóstico indica tormentas, con posible granizo.' : 'El pronóstico indica tormentas.' });
    else if (mm >= 30) out.push({ tipo: 'clima', nivel: 2, titulo: `Lluvias fuertes ${cuando}`, texto: `Se esperan unos ${Math.round(mm)} mm. Precaución en caminos rurales y de tierra.` });
    else if (mm >= 15) out.push({ tipo: 'clima', nivel: 1, titulo: `Lluvias importantes ${cuando}`, texto: `Se esperan unos ${Math.round(mm)} mm. Los caminos de tierra pueden ponerse difíciles.` });
    if (rafaga >= 70) out.push({ tipo: 'clima', nivel: 2, titulo: `Ráfagas muy fuertes ${cuando}`, texto: `Hasta ${Math.round(rafaga)} km/h.` });
    else if (rafaga >= 55) out.push({ tipo: 'clima', nivel: 1, titulo: `Viento fuerte ${cuando}`, texto: `Ráfagas de hasta ${Math.round(rafaga)} km/h.` });
    if (tmax >= 37) out.push({ tipo: 'clima', nivel: 2, titulo: `Calor extremo ${cuando}`, texto: `Máxima de ${Math.round(tmax)} °C. Tomá agua y evitá el sol del mediodía.` });
    if (tmin <= 1) out.push({ tipo: 'clima', nivel: 1, titulo: `Helada ${cuando}`, texto: `Mínima de ${Math.round(tmin)} °C.` });
    if (code === 45 || code === 48) out.push({ tipo: 'clima', nivel: 1, titulo: `Niebla ${cuando}`, texto: 'Manejá con precaución en las rutas.' });
  }
  return out.sort((a, b) => b.nivel - a.nivel).slice(0, 3);
}

const KEY = 'sarmiento-pronostico-v1';
export async function fetchPronostico(lat, lng, hoy, fetchImpl = fetch) {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (c && c.hoy === hoy && Date.now() - c.t < 3 * 3600000) return avisosClima(c.daily, hoy);
  } catch { /* sin almacenamiento */ }
  try {
    const url = 'https://api.open-meteo.com/v1/forecast' + `?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max&forecast_days=3&timezone=America%2FArgentina%2FBuenos_Aires';
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    if (!j.daily) throw new Error('sin datos');
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), hoy, daily: j.daily })); } catch { /* idem */ }
    return avisosClima(j.daily, hoy);
  } catch (e) {
    console.warn('Pronóstico no disponible:', e.message || e);
    return [];
  }
}
