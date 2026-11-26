// Búsqueda que perdona errores de tipeo («farmasia», «panaderia la esquna») con Fuse.js (gratis, MIT: https://www.fusejs.io).
// Se baja solo cuando una búsqueda normal no encontró nada.
const URL_FUSE = (typeof window !== 'undefined' && window.__FUSE_URL) || 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.mjs';
let fuse = null, cargando = null;
const sin = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export async function sugerir(places, texto, max = 6) {
  const q = sin(texto).trim();
  if (q.length < 3) return [];
  try {
    if (!fuse) {
      cargando ||= import(/* @vite-ignore */ URL_FUSE);
      const mod = await cargando;
      const Fuse = mod.default || mod.Fuse;
      fuse = new Fuse(places.map((p) => ({ id: p.id, name: sin(p.name), cat: sin(p.category), tipo: sin(p.icon), dir: sin(p.address) })), {
        keys: [{ name: 'name', weight: 3 }, { name: 'tipo', weight: 2 }, { name: 'cat', weight: 1 }, { name: 'dir', weight: 1 }],
        threshold: 0.38, ignoreLocation: true, minMatchCharLength: 3,
      });
    }
    const ids = fuse.search(q, { limit: max }).map((r) => r.item.id);
    return ids.map((id) => places.find((p) => p.id === id)).filter(Boolean);
  } catch {
    cargando = null;
    return [];
  }
}
