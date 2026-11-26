// Oficios y servicios (plomero, electricista, remís…): módulo puro. Datos: data/oficios.json (npm run oficios).
const quitar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const soloDigitos = (t) => String(t || '').replace(/\D/g, '');
/** Link para llamar y, si parece celular argentino, para WhatsApp. */
export function enlacesTelefono(tel) {
  const d = soloDigitos(tel);
  if (d.length < 6) return { tel: null, wa: null };
  const wa = d.startsWith('549') && d.length >= 12 ? d : d.startsWith('54') && d.length >= 12 ? '549' + d.slice(2) : null;
  return { tel: d.startsWith('54') ? `tel:+${d}` : `tel:${d}`, wa: wa ? `https://wa.me/${wa}` : null };
}
export function filtrarOficios(items, q = '') {
  const t = quitar(q).trim();
  const l = (Array.isArray(items) ? items : []).filter((x) => x && x.nombre && x.rubro);
  return t ? l.filter((x) => quitar(`${x.rubro} ${x.nombre} ${x.zona || ''} ${x.nota || ''}`).includes(t)) : l;
}
export function agruparOficios(items) {
  const m = new Map();
  for (const x of items) { if (!m.has(x.rubro)) m.set(x.rubro, []); m.get(x.rubro).push(x); }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([rubro, lista]) => ({ rubro, lista: lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) }));
}
