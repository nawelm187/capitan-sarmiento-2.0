// Pedido de cambio de datos de un comercio: arma el mensaje (WhatsApp o correo) con una última línea «DATOS: …»
// que se puede pegar tal cual en fuentes/sugerencias.txt y aplicar con `npm run datos`.
const limpio = (t) => String(t || '').replace(/[|\r\n]+/g, ' / ').replace(/\s+/g, ' ').trim();
export function mensajeComercio({ town = '', nombre = '', telefono = '', whatsapp = '', horario = '', direccion = '', nota = '' } = {}) {
  const f = { nombre: limpio(nombre), telefono: limpio(telefono), whatsapp: limpio(whatsapp).replace(/\D/g, ''), horario: limpio(horario), direccion: limpio(direccion), nota: limpio(nota) };
  const lineas = [`Hola, quiero actualizar los datos de mi comercio en la guía de ${town}.`, `Comercio: ${f.nombre}`];
  if (f.telefono) lineas.push(`Teléfono: ${f.telefono}`);
  if (f.whatsapp) lineas.push(`WhatsApp: ${f.whatsapp}`);
  if (f.horario) lineas.push(`Horario: ${f.horario}`);
  if (f.direccion) lineas.push(`Dirección: ${f.direccion}`);
  if (f.nota) lineas.push(`Comentario: ${f.nota}`);
  lineas.push(`DATOS: ${f.nombre} | ${f.telefono} | ${f.whatsapp} | ${f.horario} | ${f.direccion}`);
  return lineas.join('\n');
}
/** Link para enviar el mensaje al contacto configurado (npm run contacto). null si no hay contacto. */
export function linkContacto(contact, texto, asunto = 'Datos de mi comercio') {
  const c = contact || {};
  if (c.whatsapp) return `https://wa.me/${String(c.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;
  if (c.email) return `mailto:${c.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`;
  return null;
}
