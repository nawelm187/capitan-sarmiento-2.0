// «Mis lugares»: favoritos guardados SOLO en este celular (no hay cuentas ni se envía nada).
const KEY = 'guia.favoritos';
let mem = [];
export function leerFavoritos() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 200) : [];
  } catch {
    return mem;
  }
}
function guardar(list) {
  mem = list;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* sin almacenamiento: queda en memoria */ }
}
export const esFavorito = (id) => leerFavoritos().includes(id);
/** Agrega o saca un favorito; devuelve true si quedó como favorito. */
export function alternarFavorito(id) {
  const l = leerFavoritos();
  const i = l.indexOf(id);
  if (i >= 0) l.splice(i, 1);
  else l.unshift(id);
  guardar(l);
  return i < 0;
}
