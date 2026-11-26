// Opiniones con estrellas (se publican después de que las revises: llegan por WhatsApp y las cargás en fuentes/opiniones.txt).
const limpio = (t) => String(t || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
export const estrellas = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
/** @returns {{prom:number, n:number}|null} promedio de las opiniones aprobadas de un lugar */
export function resumen(opiniones, placeId) {
  const v = (opiniones || []).filter((o) => o.placeId === placeId && o.estrellas >= 1 && o.estrellas <= 5);
  if (!v.length) return null;
  return { prom: Math.round((v.reduce((s, o) => s + o.estrellas, 0) / v.length) * 10) / 10, n: v.length };
}
export function mensajeOpinion({ town = '', lugar = '', estrellas: e = 5, comentario = '', nombre = '' } = {}) {
  const n = Math.min(5, Math.max(1, Number(e) || 5));
  const L = [`Hola, quiero dejar una opinión en la guía de ${town}.`, `Lugar: ${limpio(lugar)}`, `Puntaje: ${estrellas(n)} (${n}/5)`];
  if (limpio(comentario)) L.push(`Comentario: ${limpio(comentario)}`);
  if (limpio(nombre)) L.push(`Mi nombre: ${limpio(nombre)}`);
  L.push(`OPINION: ${limpio(lugar)} | ${n} | ${limpio(comentario)} | ${limpio(nombre)}`);
  return L.join('\n');
}
