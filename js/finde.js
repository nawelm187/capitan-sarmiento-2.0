// «Fin de semana en Sarmiento»: dónde dormir, comer y qué hacer (con sol o con lluvia). Módulo puro.
const T = {
  dormir: ['hotel', 'hospedaje', 'alojamiento', 'cabana', 'camping', 'hostel', 'estancia', 'complejo'],
  comer: ['parrilla', 'restaurante', 'pizzeria', 'rotiseria', 'cafe', 'heladeria', 'panaderia', 'bar', 'resto'],
  sol: ['plaza', 'mirador', 'puente', 'pesca', 'camping', 'atractivo', 'monumento', 'club', 'estacion', 'balneario'],
  lluvia: ['museo', 'cultura', 'biblioteca', 'cine', 'cafe', 'iglesia'],
};
const dedupe = (l) => [...new Set(l)];
export function armarFinde(places, max = 5) {
  const por = (tipos, cat) => places.filter((p) => tipos.includes(p.icon) || (cat && p.category === cat));
  const cortar = (l) => dedupe(l).slice(0, max);
  return [
    { id: 'dormir', titulo: '🛏️ Dónde dormir', items: cortar(por(T.dormir)) },
    { id: 'comer', titulo: '🍽️ Dónde comer', items: cortar(por(T.comer, 'comer')) },
    { id: 'sol', titulo: '☀️ Qué hacer si hay sol', items: cortar(por(T.sol)) },
    { id: 'lluvia', titulo: '🌧️ Qué hacer si llueve', items: cortar(por(T.lluvia)) },
  ].filter((s) => s.items.length);
}

/** Lugares sugeridos según el clima del día («lluvia», «calor», «frio», «viento», «lindo»). */
const SEGUN = {
  lluvia: { titulo: '☔ Para un día de lluvia', tipos: ['museo', 'cultura', 'biblioteca', 'cine', 'cafe', 'panaderia', 'iglesia', 'supermercado'] },
  calor: { titulo: '🥵 Para un día de calor', tipos: ['heladeria', 'camping', 'pesca', 'plaza', 'club', 'balneario', 'bar', 'cafe'] },
  frio: { titulo: '🧣 Para un día de frío', tipos: ['cafe', 'panaderia', 'parrilla', 'restaurante', 'museo', 'biblioteca', 'cultura'] },
  viento: { titulo: '💨 Para un día de viento', tipos: ['museo', 'cultura', 'biblioteca', 'cafe', 'restaurante', 'cine'] },
  lindo: { titulo: '😎 Para un día lindo', tipos: ['plaza', 'mirador', 'puente', 'pesca', 'camping', 'atractivo', 'monumento', 'estacion', 'heladeria'] },
};
export function lugaresSegunClima(places, tipo, max = 8) {
  const cfg = SEGUN[tipo] || SEGUN.lindo;
  const orden = new Map(cfg.tipos.map((t, i) => [t, i]));
  const items = places.filter((p) => orden.has(p.icon)).sort((a, b) => orden.get(a.icon) - orden.get(b.icon));
  const cuenta = new Map();
  const out = [];
  for (const p of items) {
    // variedad: hasta 2 de cada rubro
    const n = cuenta.get(p.icon) || 0;
    if (n >= 2) continue;
    cuenta.set(p.icon, n + 1);
    out.push(p);
    if (out.length >= max) break;
  }
  return { titulo: cfg.titulo, items: out };
}

/** Plan del día armado según el clima: mañana, mediodía, tarde y cierre, sin repetir lugares. */
const COMER = ['parrilla', 'restaurante', 'pizzeria', 'rotiseria', 'resto'];
const PLANES = {
  lluvia: [['Mañana', '☕', ['cafe', 'panaderia']], ['Mediodía', '🍽️', COMER], ['Tarde', '🏛️', ['museo', 'cultura', 'biblioteca', 'cine', 'iglesia']], ['Merienda', '🥐', ['panaderia', 'cafe', 'heladeria']]],
  frio: [['Mañana', '☕', ['cafe', 'panaderia']], ['Mediodía', '🍽️', COMER], ['Tarde', '🏛️', ['museo', 'cultura', 'biblioteca', 'iglesia', 'plaza']], ['Noche', '🔥', ['parrilla', 'restaurante', 'pizzeria']]],
  viento: [['Mañana', '☕', ['cafe', 'panaderia']], ['Mediodía', '🍽️', COMER], ['Tarde', '🏛️', ['museo', 'cultura', 'biblioteca', 'cine']], ['Cierre', '🥐', ['panaderia', 'cafe']]],
  calor: [['Mañana', '🌳', ['plaza', 'mirador', 'monumento', 'atractivo', 'estacion']], ['Mediodía', '🍽️', COMER], ['Tarde', '🏊', ['balneario', 'camping', 'pesca', 'club', 'puente']], ['Cierre', '🍦', ['heladeria', 'bar', 'cafe']]],
  lindo: [['Mañana', '🚶', ['plaza', 'monumento', 'atractivo', 'estacion', 'iglesia']], ['Mediodía', '🍽️', COMER], ['Tarde', '🌅', ['mirador', 'puente', 'pesca', 'camping', 'balneario', 'club']], ['Merienda', '🍦', ['heladeria', 'panaderia', 'cafe']]],
};
export function planDelDia(places, tipo) {
  const usados = new Set();
  const pasos = [];
  for (const [momento, icono, tipos] of PLANES[tipo] || PLANES.lindo) {
    let hit = null;
    for (const t of tipos) { hit = places.find((p) => p.icon === t && !usados.has(p.id)); if (hit) break; }
    if (hit) { usados.add(hit.id); pasos.push({ momento, icono, place: hit }); }
  }
  return pasos;
}
