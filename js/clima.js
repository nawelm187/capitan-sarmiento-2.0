// Clima completo con Open-Meteo (gratis, sin clave: https://open-meteo.com). Módulo sin DOM.
// Datos: ahora, próximas horas, 5 días, salida/puesta del sol, UV y un consejo para el día.
const KEY = 'guia.clima.v3';
const TZ = 'America/Argentina/Buenos_Aires';
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Código WMO → ícono y texto. */
export function describir(code, esDia = true) {
  const c = Number(code);
  if (c === 0) return { icono: esDia ? '☀️' : '🌙', texto: esDia ? 'Despejado' : 'Despejado' };
  if (c === 1) return { icono: esDia ? '🌤️' : '🌙', texto: 'Mayormente despejado' };
  if (c === 2) return { icono: '⛅', texto: 'Parcialmente nublado' };
  if (c === 3) return { icono: '☁️', texto: 'Nublado' };
  if (c === 45 || c === 48) return { icono: '🌫️', texto: 'Niebla' };
  if (c >= 51 && c <= 57) return { icono: '🌦️', texto: 'Llovizna' };
  if (c >= 61 && c <= 67) return { icono: '🌧️', texto: c >= 65 ? 'Lluvia fuerte' : 'Lluvia' };
  if (c >= 71 && c <= 77) return { icono: '🌨️', texto: 'Nieve' };
  if (c >= 80 && c <= 82) return { icono: '🌦️', texto: c === 82 ? 'Chaparrones fuertes' : 'Chaparrones' };
  if (c >= 95) return { icono: '⛈️', texto: c >= 96 ? 'Tormenta con granizo' : 'Tormenta' };
  return { icono: '🌡️', texto: 'Sin datos' };
}
export const uvTexto = (uv) => (uv >= 11 ? 'extremo' : uv >= 8 ? 'muy alto' : uv >= 6 ? 'alto' : uv >= 3 ? 'moderado' : 'bajo');
export const rumbo = (g) => ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'][Math.round((((Number(g) % 360) + 360) % 360) / 45) % 8];
const hhmm = (iso) => String(iso || '').slice(11, 16);

export function urlClima(lat, lng) {
  return 'https://api.open-meteo.com/v1/forecast' + `?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m' +
    '&hourly=temperature_2m,precipitation_probability,weather_code,wind_gusts_10m' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max,sunrise,sunset,uv_index_max' +
    `&forecast_days=5&timezone=${encodeURIComponent(TZ)}`;
}

/** Baja el pronóstico (cache de 30 min en el celular; si no hay internet usa el último guardado). */
export async function fetchClima(lat, lng, fetchImpl = fetch) {
  let viejo = null;
  try {
    viejo = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (viejo && Date.now() - viejo.t < 30 * 60000) return { ...viejo.data, _t: viejo.t };
  } catch { /* sin almacenamiento */ }
  try {
    const res = await fetchImpl(urlClima(lat, lng));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    if (!j.current || !j.daily) throw new Error('sin datos');
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), data: j })); } catch { /* idem */ }
    return { ...j, _t: Date.now() };
  } catch (e) {
    console.warn('Clima no disponible:', e.message || e);
    return viejo ? { ...viejo.data, _t: viejo.t, _viejo: true } : null;
  }
}

/** Arma lo que muestra la pantalla. */
export function resumenClima(j, ahora = new Date()) {
  if (!j?.current || !j?.daily) return null;
  const c = j.current;
  const d = j.daily;
  const hoyISO = String(c.time || d.time?.[0] || '').slice(0, 10);
  const horaActual = String(c.time || '').slice(11, 13) || '00';
  const desc = describir(c.weather_code, c.is_day === 1);
  const dias = (d.time || []).map((t, i) => {
    const f = new Date(t + 'T12:00:00');
    const x = describir(d.weather_code[i]);
    return { fecha: t, nombre: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : DIAS[f.getDay()], nombreLargo: i === 0 ? 'hoy' : i === 1 ? 'mañana' : DIAS_LARGO[f.getDay()], icono: x.icono, texto: x.texto, max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]), lluvia: Math.round(d.precipitation_probability_max?.[i] ?? 0), mm: Math.round((d.precipitation_sum?.[i] ?? 0) * 10) / 10, rafaga: Math.round(d.wind_gusts_10m_max?.[i] ?? 0), uv: Math.round(d.uv_index_max?.[i] ?? 0) };
  });
  // Próximas 6 horas
  const hs = j.hourly?.time || [];
  const i0 = Math.max(0, hs.findIndex((t) => t >= `${hoyISO}T${horaActual}:00`));
  const horas = hs.slice(i0, i0 + 6).map((t, k) => ({ hora: hhmm(t), temp: Math.round(j.hourly.temperature_2m[i0 + k]), lluvia: Math.round(j.hourly.precipitation_probability?.[i0 + k] ?? 0), icono: describir(j.hourly.weather_code?.[i0 + k], true).icono }));
  const r = {
    ahora: { temp: Math.round(c.temperature_2m), sensacion: Math.round(c.apparent_temperature), humedad: Math.round(c.relative_humidity_2m), viento: Math.round(c.wind_speed_10m), rafaga: Math.round(c.wind_gusts_10m), rumbo: rumbo(c.wind_direction_10m), icono: desc.icono, texto: desc.texto, esDia: c.is_day === 1 },
    salida: hhmm(d.sunrise?.[0]), puesta: hhmm(d.sunset?.[0]), uv: dias[0]?.uv ?? 0, dias, horas, hoy: hoyISO, viejo: !!j._viejo,
  };
  r.consejo = consejoClima(r);
  r.alerta = alertaClima(j, ahora);
  return r;
}

/** Un consejo corto y a qué tipo de plan conviene: «lluvia», «calor», «frio», «viento» o «lindo». */
export function consejoClima(r) {
  const h = r.dias[0];
  const a = r.ahora;
  if (!h) return { tipo: 'lindo', icono: '🙂', texto: '' };
  if (h.lluvia >= 60 || h.mm >= 5) return { tipo: 'lluvia', icono: '☔', texto: `Hoy hay ${h.lluvia}% de probabilidad de lluvia. Llevá paraguas; buen día para el museo, la biblioteca o un café.` };
  if (h.max >= 33 || a.temp >= 33) return { tipo: 'calor', icono: '🥵', texto: `Máxima de ${h.max} °C. Tomá agua, usá protector y buscá la sombra o un helado.` };
  if (h.max <= 12 || a.temp <= 5) return { tipo: 'frio', icono: '🧣', texto: `Día frío (máxima ${h.max} °C). Abrigate bien; ideal un café o un paseo corto.` };
  if (h.rafaga >= 55) return { tipo: 'viento', icono: '💨', texto: `Ráfagas de hasta ${h.rafaga} km/h. Cuidado con los objetos sueltos y en la ruta.` };
  if (r.uv >= 8) return { tipo: 'lindo', icono: '🕶️', texto: `Día lindo, pero con UV ${uvTexto(r.uv)}: protector y gorra al mediodía.` };
  return { tipo: 'lindo', icono: '😎', texto: `Día lindo para salir: ${h.min}° a ${h.max}°.` };
}

/** Texto para que el celular lo lea en voz alta. */
export function textoVozClima(r) {
  if (!r) return 'No pude consultar el pronóstico en este momento.';
  const a = r.ahora, h = r.dias[0], m = r.dias[1];
  let t = `Ahora hay ${a.temp} grados, ${a.texto.toLowerCase()}. Sensación térmica de ${a.sensacion}. Viento de ${a.viento} kilómetros por hora del ${a.rumbo}. `;
  if (h) t += `Hoy: máxima de ${h.max} y mínima de ${h.min}, con ${h.lluvia} por ciento de probabilidad de lluvia. `;
  if (m) t += `Mañana: ${m.texto.toLowerCase()}, entre ${m.min} y ${m.max} grados${m.lluvia >= 30 ? `, con ${m.lluvia} por ciento de lluvia` : ''}. `;
  if (r.salida && r.puesta) t += `El sol sale a las ${r.salida} y se pone a las ${r.puesta}. `;
  return t + (r.consejo?.texto || '');
}

const NIVEL = { amarilla: 1, naranja: 2, roja: 3 };

/**
 * Busca en las próximas 18 horas algo que merezca un cartel: lluvia, tormenta, viento, calor o helada.
 * Devuelve null si no hay nada. No es una alerta oficial: son avisos automáticos según el pronóstico.
 */
export function alertaClima(j, ahora = new Date()) {
  const h = j?.hourly;
  if (!h?.time?.length || !j?.current) return null;
  const hoyISO = String(j.current.time).slice(0, 10);
  const horaAct = String(j.current.time).slice(11, 13) || '00';
  const i0 = Math.max(0, h.time.findIndex((t) => t >= `${hoyISO}T${horaAct}:00`));
  const fin = Math.min(h.time.length, i0 + 18);
  let mejor = null;
  const probar = (a) => { if (!mejor || NIVEL[a.nivel] > NIVEL[mejor.nivel]) mejor = a; };
  for (let i = i0; i < fin; i++) {
    const t = h.time[i];
    const prob = h.precipitation_probability?.[i] ?? 0;
    const code = h.weather_code?.[i];
    const rafaga = h.wind_gusts_10m?.[i] ?? 0;
    const temp = h.temperature_2m?.[i];
    if (code >= 95) probar({ tipo: 'tormenta', nivel: code >= 96 ? 'roja' : 'naranja', i, t, valor: prob, icono: '⛈️', que: 'tormenta' });
    else if (prob >= 50) probar({ tipo: 'lluvia', nivel: prob >= 85 ? 'roja' : prob >= 70 ? 'naranja' : 'amarilla', i, t, valor: prob, icono: '☔', que: 'lluvia' });
    if (rafaga >= 60) probar({ tipo: 'viento', nivel: rafaga >= 90 ? 'roja' : rafaga >= 75 ? 'naranja' : 'amarilla', i, t, valor: Math.round(rafaga), icono: '💨', que: 'viento fuerte' });
    if (temp >= 35) probar({ tipo: 'calor', nivel: temp >= 40 ? 'roja' : temp >= 38 ? 'naranja' : 'amarilla', i, t, valor: Math.round(temp), icono: '🥵', que: 'calor' });
    if (temp <= 0) probar({ tipo: 'helada', nivel: temp <= -4 ? 'naranja' : 'amarilla', i, t, valor: Math.round(temp), icono: '🥶', que: 'helada' });
  }
  if (!mejor) return null;
  // Si dura varias horas seguidas, tomamos la hora donde empieza.
  const hora = Number(mejor.t.slice(11, 13));
  const fecha = mejor.t.slice(0, 10);
  const cuando = fecha !== hoyISO ? 'mañana' : hora >= 20 || hora < 5 ? 'esta noche' : 'hoy';
  const cerca = `${String(hora).padStart(2, '0')}:00 hs`;
  const dato = mejor.tipo === 'lluvia' || mejor.tipo === 'tormenta' ? `con ${mejor.valor}% de probabilidad` : mejor.tipo === 'viento' ? `con ráfagas de ${mejor.valor} km/h` : `con ${mejor.valor} °C`;
  const texto = `Alerta ${mejor.nivel} por ${mejor.que} ${cuando} cerca de las ${cerca}, ${dato}.`;
  return { tipo: mejor.tipo, nivel: mejor.nivel, icono: mejor.icono, texto, hora: cerca, cuando, clave: `${fecha}|${mejor.tipo}|${mejor.nivel}` };
}

/** ¿Va a llover en las próximas horas? {hora, prob} o null (usa las próximas 6 horas del resumen). */
export function lluviaPronto(r, minProb = 60) {
  const h = r?.horas?.find((x) => x.lluvia >= minProb);
  return h ? { hora: h.hora, prob: h.lluvia } : null;
}
