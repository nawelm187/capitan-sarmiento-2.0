// Línea del tiempo del pueblo (fuentes/historia.txt → npm run historia → data/historia.json).
export const fotoHistoriaOk = (u) => typeof u === 'string' && (/^img\/historia\/[\w\-.]+\.(jpe?g|png|webp)$/i.test(u));
export function ordenarHistoria(items) {
  return (Array.isArray(items) ? items : []).filter((x) => x && x.titulo).slice().sort((a, b) => (Number(a.anio) || 0) - (Number(b.anio) || 0));
}
