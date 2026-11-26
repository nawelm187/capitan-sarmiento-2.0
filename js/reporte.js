// «Reportar un error»: arma el mensaje para WhatsApp/correo con una última línea «ERROR: …» para revisar y corregir.
const limpio = (t) => String(t || '').replace(/[|\r\n]+/g, ' / ').replace(/\s+/g, ' ').trim();
export const TIPOS = [
  ['horario', '🕒 El horario está mal'],
  ['telefono', '📞 El teléfono o WhatsApp está mal'],
  ['direccion', '📍 La dirección o el lugar en el mapa está mal'],
  ['cerro', '🚫 Cerró o ya no existe'],
  ['otro', '✏️ Otra cosa'],
];
export function mensajeError({ town = '', lugar = '', tipo = 'otro', texto = '' } = {}) {
  const t = TIPOS.find((x) => x[0] === tipo) ? tipo : 'otro';
  const etiqueta = TIPOS.find((x) => x[0] === t)[1].replace(/^\S+\s/, '');
  const l = [`Hola, encontré un error en la guía de ${town}.`, `Lugar: ${limpio(lugar)}`, `Problema: ${etiqueta}`];
  if (limpio(texto)) l.push(`Detalle: ${limpio(texto)}`);
  l.push(`ERROR: ${limpio(lugar)} | ${t} | ${limpio(texto)}`);
  return l.join('\n');
}
