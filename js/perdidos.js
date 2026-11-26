// Mascotas y objetos perdidos / encontrados (módulo puro, sin DOM).
//   data/perdidos.json  ← lo arma `npm run perdidos` desde fuentes/perdidos.txt
const limpio = (t) => String(t || '').replace(/[|\r\n]+/g, ' / ').replace(/\s+/g, ' ').trim();
const DIA = 86400000;
export const DIAS_VIGENTE = 30;

export function diasDesde(fechaISO, hoyISO) {
  const a = new Date(fechaISO + 'T12:00:00'), b = new Date(hoyISO + 'T12:00:00');
  return Math.round((b - a) / DIA);
}
/** Los avisos que siguen vigentes (30 días desde la fecha, o hasta `hasta`), los más nuevos primero. */
export function vigentes(items, hoyISO) {
  return (items || [])
    .filter((x) => x && x.title && (x.hasta ? x.hasta >= hoyISO : diasDesde(x.fecha || hoyISO, hoyISO) <= DIAS_VIGENTE))
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
}
export function textoHace(dias) {
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
}
/** Mensaje para mandar por WhatsApp/correo. La última línea «PERDIDO: …» se pega tal cual en fuentes/perdidos.txt. */
export function mensajePerdido({ town = '', estado = 'perdido', tipo = 'mascota', nombre = '', descripcion = '', zona = '', fecha = '', contacto = '', recompensa = '', info = '' } = {}) {
  const f = { estado: estado === 'encontrado' ? 'encontrado' : 'perdido', tipo: tipo === 'objeto' ? 'objeto' : 'mascota', nombre: limpio(nombre), descripcion: limpio(descripcion), zona: limpio(zona), fecha: limpio(fecha), contacto: limpio(contacto), recompensa: limpio(recompensa), info: limpio(info) };
  const L = [`Hola, quiero publicar en la guía de ${town} un aviso de ${f.tipo === 'mascota' ? 'mascota' : 'objeto'} ${f.estado}.`, `${f.tipo === 'mascota' ? 'Mascota' : 'Objeto'}: ${f.nombre}`];
  if (f.descripcion) L.push(`Descripción: ${f.descripcion}`);
  if (f.zona) L.push(`Zona donde ${f.estado === 'perdido' ? 'se perdió' : 'se encontró'}: ${f.zona}`);
  if (f.fecha) L.push(`Fecha: ${f.fecha}`);
  if (f.contacto) L.push(`Contacto: ${f.contacto}`);
  if (f.recompensa) L.push(`Recompensa: ${f.recompensa}`);
  if (f.info) L.push(`Más información: ${f.info}`);
  L.push('(Si tengo fotos, las mando en un mensaje aparte.)');
  L.push(`PERDIDO: ${f.estado} | ${f.tipo} | ${f.nombre} | ${f.descripcion} | ${f.zona} | ${f.fecha} | ${f.contacto} | ${f.recompensa} | ${f.info} |`);
  return L.join('\n');
}
/** Link de WhatsApp para contactar a quien publicó (solo si el contacto parece un teléfono). */
export function linkWhatsApp(contacto, texto = '') {
  const d = String(contacto || '').replace(/\D/g, '');
  return d.length >= 8 ? `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ''}` : null;
}
