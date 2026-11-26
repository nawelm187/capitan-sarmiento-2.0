// Capas (categorías activables) del mapa. Puro: sin DOM ni three (lo usan la web y las herramientas).
//
// La web arranca SOLO con la capa "Esenciales"; el resto se prende desde el panel "Capas".
// Un lugar pertenece a una capa según su tipo (`icon`, ver kinds.js). Para forzar uno como esencial
// (o sacarlo) se puede escribir "essential": true / false en data/places.json.

export const LAYERS = [
  { id: 'esenciales', label: 'Esenciales', virtual: true },
  { id: 'salud', label: 'Salud' },
  { id: 'emergencias', label: 'Emergencias y seguridad' },
  { id: 'gobierno', label: 'Gobierno y servicios públicos' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'estacionamiento', label: 'Estacionamiento y baños públicos' },
  { id: 'educacion', label: 'Educación' },
  { id: 'comercios', label: 'Supermercados y comercios' },
  { id: 'construccion', label: 'Ferreterías, construcción y hogar' },
  { id: 'gastronomia', label: 'Gastronomía y cafeterías' },
  { id: 'farmacias', label: 'Farmacias y otros prestadores' },
  { id: 'clubes', label: 'Clubes, deportes y gimnasios' },
  { id: 'cultura', label: 'Cultura, patrimonio y culto' },
  { id: 'turismo', label: 'Turismo, alojamiento y recreación' },
  { id: 'pesca', label: 'Puentes, pesca y agua' },
  { id: 'rural', label: 'Rural, estancias y naturaleza' },
  { id: 'otros', label: 'Otros servicios y profesionales' },
];

const OF = {
  hospital: 'salud', clinica: 'salud', dentista: 'salud',
  policia: 'emergencias', bomberos: 'emergencias',
  municipalidad: 'gobierno', correo: 'gobierno', banco: 'gobierno', banconacion: 'gobierno', cajero: 'gobierno', cooperativa: 'gobierno',
  estacionamiento: 'estacionamiento', bano: 'estacionamiento',
  terminal: 'transporte', estacion: 'transporte', taxi: 'transporte', combustible: 'transporte', aerodromo: 'transporte',
  escuela: 'educacion', jardin: 'educacion', biblioteca: 'educacion',
  supermercado: 'comercios', almacen: 'comercios', kiosco: 'comercios', ropa: 'comercios', libreria: 'comercios', jugueteria: 'comercios',
  electro: 'comercios', celulares: 'comercios', regaleria: 'comercios', optica: 'comercios', joyeria: 'comercios', mascotas: 'comercios',
  perfumeria: 'comercios', bebidas: 'comercios', tienda: 'comercios', florista: 'comercios', panaderia: 'comercios', carniceria: 'comercios', verduleria: 'comercios',
  ferreteria: 'construccion', pinturas: 'construccion', materiales: 'construccion', muebleria: 'construccion', taller: 'construccion',
  restaurante: 'gastronomia', parrilla: 'gastronomia', pizzeria: 'gastronomia', cafe: 'gastronomia', bar: 'gastronomia', comida_rapida: 'gastronomia', heladeria: 'gastronomia',
  farmacia: 'farmacias', veterinaria: 'farmacias',
  club: 'clubes', gimnasio: 'clubes',
  iglesia: 'cultura', museo: 'cultura', cultura: 'cultura', cine: 'cultura', monumento: 'cultura', plaza: 'cultura',
  hotel: 'turismo', hospedaje: 'turismo', camping: 'turismo', atractivo: 'turismo', mirador: 'turismo', turismo: 'turismo',
  puente: 'pesca', pesca: 'pesca',
  tanque: 'rural', silo: 'rural', agro: 'rural', estancia: 'rural',
  peluqueria: 'otros', inmobiliaria: 'otros', seguros: 'otros', estudio: 'otros', lavadero: 'otros', servicio: 'otros',
};
const OF_CAT = { comer: 'gastronomia', dormir: 'turismo', ver: 'cultura', compras: 'comercios', salud: 'salud', servicios: 'otros' };

/** Tipos que se ven al abrir la web: salud y emergencias, municipalidad, transporte y puntos cívicos. */
export const ESSENTIAL_TYPES = new Set(['hospital', 'bomberos', 'policia', 'municipalidad', 'terminal', 'estacion', 'plaza', 'iglesia', 'museo', 'monumento']);

export const layerIds = LAYERS.map((l) => l.id);
export const realLayerIds = LAYERS.filter((l) => !l.virtual).map((l) => l.id);

/** Capa de un tipo suelto (para los pendientes, que todavía no son lugares). */
export const layerOfType = (type, cat) => OF[type] || OF_CAT[cat] || 'otros';
export const layerOf = (p) => layerOfType(p?.icon, p?.category);

/**
 * ¿Es esencial? Sí si lo marcaste (`essential: true`), si es de un tipo esencial, si es un CAPS,
 * o si es un lugar tuyo sin tipo (cargado a mano; los que vienen de OpenStreetMap o extras siempre tienen tipo).
 */
export function isEssential(p) {
  if (p.essential === true) return true;
  if (p.essential === false) return false;
  if (ESSENTIAL_TYPES.has(p.icon)) return true;
  if (/^(caps|centro de atenci[oó]n primaria|sala de primeros auxilios)\b/i.test(p.name || '')) return true;
  if (!p.icon && !/^(osm|extra)-/.test(String(p.id))) return true;
  return false;
}

export const defaultLayers = () => new Set(['esenciales']);

/** ¿Se dibuja este lugar con las capas activas? */
export function isVisible(p, active) {
  if (!active) return true;
  return active.has(layerOf(p)) || (active.has('esenciales') && isEssential(p));
}

const KEY = 'guia-capas';
export function loadLayers() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (Array.isArray(raw)) return new Set(raw.filter((id) => layerIds.includes(id)));
  } catch { /* sin almacenamiento: se arranca con lo esencial */ }
  return defaultLayers();
}
export function saveLayers(active) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify([...active]));
  } catch { /* no pasa nada */ }
}
