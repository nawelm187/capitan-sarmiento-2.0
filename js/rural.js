// Caminos rurales, actividades de todas las semanas y condiciones de pesca. Módulo puro (sin DOM).
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const sinTilde = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// ---------- Caminos ----------
export const ESTADOS = {
  transitable: { icono: '🟢', texto: 'Transitable', clase: 'ok' },
  barro: { icono: '🟡', texto: 'Con barro: solo con precaución o 4x4', clase: 'warn' },
  cortado: { icono: '🔴', texto: 'Cortado o intransitable', clase: 'bad' },
};
export function estadoCamino(s) {
  const t = sinTilde(s);
  if (/cort|intransit|anegad|inundad|cerrad/.test(t)) return 'cortado';
  if (/barro|bar+oso|mojad|regular|dificil|precau|enchar|pozos|4x4/.test(t)) return 'barro';
  return 'transitable';
}
/** Camino {nombre, estado, fecha?, nota?} → texto listo para mostrar. */
export function describirCamino(c, hoy = new Date()) {
  const clave = estadoCamino(c.estado);
  const e = ESTADOS[clave];
  let dias = null;
  if (c.fecha && /^\d{4}-\d{2}-\d{2}$/.test(c.fecha)) dias = Math.max(0, Math.round((new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12) - new Date(c.fecha + 'T12:00:00')) / 86400000));
  const viejo = dias != null && dias > 7;
  const cuando = dias == null ? '' : dias === 0 ? 'Informado hoy' : dias === 1 ? 'Informado ayer' : `Informado hace ${dias} días`;
  return { ...e, clave, nombre: c.nombre, nota: c.nota || '', cuando, viejo, aviso: viejo ? 'Dato viejo: confirmalo antes de salir.' : '' };
}
export const ordenarCaminos = (l) => [...l].sort((a, b) => ['cortado', 'barro', 'transitable'].indexOf(estadoCamino(a.estado)) - ['cortado', 'barro', 'transitable'].indexOf(estadoCamino(b.estado)) || a.nombre.localeCompare(b.nombre, 'es'));

// ---------- Actividades semanales ----------
/** «lunes», «lunes y miércoles», «lunes a viernes», «todos» → lista de números de día (0 = domingo). */
export function diasDeTexto(txt) {
  const t = sinTilde(txt);
  if (/todos|diari|cada dia/.test(t)) return [0, 1, 2, 3, 4, 5, 6];
  const idx = (s) => DIAS.findIndex((d) => sinTilde(d).startsWith(s.slice(0, 3)));
  const rango = t.match(/([a-z]+)\s+a\s+([a-z]+)/);
  if (rango && idx(rango[1]) >= 0 && idx(rango[2]) >= 0) {
    const out = []; let i = idx(rango[1]); const fin = idx(rango[2]);
    for (let n = 0; n < 7; n++) { out.push(i); if (i === fin) break; i = (i + 1) % 7; }
    return out;
  }
  return [...new Set((t.match(/[a-z]+/g) || []).map(idx).filter((i) => i >= 0))];
}
export const horaMin = (h) => { const m = String(h || '').match(/(\d{1,2})[:.hH]?(\d{2})?/); return m ? +m[1] * 60 + (+m[2] || 0) : 9999; };
export function actividadesDelDia(semanal, fecha = new Date()) {
  const d = fecha.getDay();
  return semanal.filter((a) => diasDeTexto(a.dia).includes(d)).sort((a, b) => horaMin(a.hora) - horaMin(b.hora));
}
/** Agrupa por día de la semana, empezando por hoy. */
export function semanaCompleta(semanal, fecha = new Date()) {
  const out = [];
  for (let n = 0; n < 7; n++) {
    const d = (fecha.getDay() + n) % 7;
    const items = semanal.filter((a) => diasDeTexto(a.dia).includes(d)).sort((a, b) => horaMin(a.hora) - horaMin(b.hora));
    if (items.length) out.push({ dia: DIAS[d], hoy: n === 0, items });
  }
  return out;
}

// ---------- Pesca ----------
/** Fase lunar aproximada (ciclo sinódico de 29,53 días desde la luna nueva del 6/1/2000). */
export function faseLunar(fecha = new Date()) {
  const dias = (fecha.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  const f = ((dias % 29.530588853) + 29.530588853) % 29.530588853;
  const ilum = Math.round((1 - Math.cos((2 * Math.PI * f) / 29.530588853)) / 2 * 100);
  const fases = [[1.85, 'Luna nueva', '🌑'], [5.54, 'Luna creciente', '🌒'], [9.23, 'Cuarto creciente', '🌓'], [12.92, 'Gibosa creciente', '🌔'], [16.61, 'Luna llena', '🌕'], [20.3, 'Gibosa menguante', '🌖'], [23.99, 'Cuarto menguante', '🌗'], [27.68, 'Luna menguante', '🌘'], [99, 'Luna nueva', '🌑']];
  const [, nombre, icono] = fases.find(([lim]) => f < lim);
  return { nombre, icono, iluminacion: ilum, edad: Math.round(f * 10) / 10, activa: f < 2.5 || f > 27 || (f > 13.5 && f < 16.5) };
}
export function urlPesca(lat, lng) {
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&hourly=surface_pressure,wind_speed_10m,precipitation_probability&past_days=1&forecast_days=2&timezone=America%2FArgentina%2FBuenos_Aires&wind_speed_unit=kmh`;
}
const KEY = 'guia.pesca.v1';
export async function fetchPesca(lat, lng, fetchImpl = fetch) {
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && Date.now() - v.t < 45 * 60000) return v.data; } catch { /* sin almacenamiento */ }
  try {
    const r = await fetchImpl(urlPesca(lat, lng)); if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json(); if (!j.hourly?.surface_pressure) throw new Error('sin datos');
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), data: j })); } catch { /* idem */ }
    return j;
  } catch { return null; }
}
/** Evalúa el día para pescar. Orientativo: presión (tendencia 6 h), viento, probabilidad de lluvia y luna. */
export function condicionesPesca(j, ahora = new Date(), luna = faseLunar(ahora)) {
  const h = j?.hourly; if (!h?.time?.length) return null;
  const pref = ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0') + '-' + String(ahora.getDate()).padStart(2, '0') + 'T' + String(ahora.getHours()).padStart(2, '0');
  let i = h.time.findIndex((t) => t.startsWith(pref)); if (i < 0) i = Math.min(24, h.time.length - 1);
  const pres = h.surface_pressure, viento = h.wind_speed_10m, lluv = h.precipitation_probability || [];
  const p0 = pres[Math.max(0, i - 6)], p1 = pres[i], p2 = pres[Math.min(pres.length - 1, i + 6)];
  const dPas = Math.round((p1 - p0) * 10) / 10, dFut = Math.round((p2 - p1) * 10) / 10;
  const v = Math.round(viento[i] ?? 0), prob = Math.max(...[0, 1, 2, 3, 4, 5, 6].map((k) => lluv[Math.min(i + k, lluv.length - 1)] ?? 0));
  let pts = 0; const motivos = [];
  const cambio = Math.max(Math.abs(dPas), Math.abs(dFut));
  if (cambio < 1.5) { pts += 2; motivos.push('Presión estable'); }
  else if (cambio < 3) { pts += 1; motivos.push('Presión con poca variación'); }
  else { pts -= 1; motivos.push(dFut < 0 || dPas < 0 ? 'Presión bajando rápido (cambio de tiempo)' : 'Presión subiendo rápido'); }
  if (v <= 12) { pts += 2; motivos.push(`Viento suave (${v} km/h)`); }
  else if (v <= 25) { pts += 1; motivos.push(`Viento moderado (${v} km/h)`); }
  else { pts -= 2; motivos.push(`Viento fuerte (${v} km/h): incómodo y peligroso en lancha`); }
  if (prob >= 70) { pts -= 2; motivos.push(`Lluvia probable (${prob}%)`); } else if (prob >= 40) { pts -= 1; motivos.push(`Posible lluvia (${prob}%)`); }
  if (luna.activa) { pts += 1; motivos.push(`${luna.nombre}: suele haber más actividad`); }
  const nivel = pts >= 4 ? 'buena' : pts >= 2 ? 'regular' : 'mala';
  return { nivel, icono: nivel === 'buena' ? '🎣' : nivel === 'regular' ? '🙂' : '🌬️', texto: { buena: 'Buen día para pescar', regular: 'Día regular para pescar', mala: 'Día complicado para pescar' }[nivel], motivos, presion: Math.round(p1), tendencia: dPas, viento: v, lluvia: prob, luna, mejores: 'Los mejores momentos suelen ser el amanecer y el atardecer.' };
}
