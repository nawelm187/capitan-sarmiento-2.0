// Temporadas y fechas especiales: cambian el saludo de la portada (módulo puro).
// Fechas fijas (mes-día, ambos inclusive). Las que cruzan fin de año se manejan aparte.
const FECHAS = [
  { id: 'navidad', desde: [12, 1], hasta: [1, 6], emoji: '🎄', texto: '¡Felices fiestas desde Capitán Sarmiento!' },
  { id: 'tradicion', desde: [11, 5], hasta: [11, 11], emoji: '🧉', texto: 'Semana de la Tradición: ¡a disfrutar de lo nuestro!' },
  { id: 'patria', desde: [5, 20], hasta: [5, 25], emoji: '🇦🇷', texto: '¡Feliz 25 de Mayo!' },
  { id: 'bandera', desde: [6, 17], hasta: [6, 20], emoji: '🇦🇷', texto: 'Día de la Bandera' },
  { id: 'independencia', desde: [7, 7], hasta: [7, 9], emoji: '🇦🇷', texto: '¡Feliz 9 de Julio!' },
  { id: 'sanmartin', desde: [8, 15], hasta: [8, 17], emoji: '🇦🇷', texto: 'Paso a la inmortalidad del Gral. San Martín' },
  { id: 'primavera', desde: [9, 21], hasta: [9, 23], emoji: '🌸', texto: '¡Llegó la primavera!' },
  { id: 'madres', desde: [10, 14], hasta: [10, 20], emoji: '💐', texto: 'Semana del Día de la Madre' },
];
const val = (m, d) => m * 100 + d;
/** @param {Date} [fecha] @param {Array} [extra] fechas propias: [{desde:[m,d],hasta:[m,d],emoji,texto,id}] */
export function temporadaActual(fecha = new Date(), extra = []) {
  const v = val(fecha.getMonth() + 1, fecha.getDate());
  for (const f of [...extra, ...FECHAS]) {
    if (!f?.desde || !f?.hasta || !f.texto) continue;
    const a = val(...f.desde), b = val(...f.hasta);
    if (a <= b ? v >= a && v <= b : v >= a || v <= b) return { id: f.id || 'propia', emoji: f.emoji || '✨', texto: f.texto };
  }
  return null;
}
