// "Cerca mío": distancias desde la ubicación de la persona a los lugares (módulo puro).
export function metros(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
export function textoDistancia(m) {
  if (m < 950) return `a ${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `a ${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`;
}
/** Los `n` lugares más cercanos: [{place, m}]. */
export function masCercanos(places, lat, lng, n = 12) {
  return places
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((place) => ({ place, m: metros(lat, lng, place.lat, place.lng) }))
    .sort((a, b) => a.m - b.m)
    .slice(0, n);
}

// Estimaciones simples (línea recta × 1,3 por las calles). A pie ~75 m/min, en auto ~350 m/min en el pueblo.
export const minutosAPie = (m) => Math.max(1, Math.round((m * 1.3) / 75));
export const minutosAuto = (m) => Math.max(1, Math.round((m * 1.3) / 350 + 0.5));
export function textoMinutos(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
