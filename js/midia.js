// «Mi día en Sarmiento»: arma un recorrido a medida según el tiempo y los gustos (módulo puro, sin DOM).
import { metros } from './cerca.js';

export const INTERESES = {
  historia: { label: '🏛️ Historia y cultura', tipos: ['plaza', 'iglesia', 'museo', 'cultura', 'biblioteca', 'estacion', 'monumento', 'cine', 'municipalidad'] },
  comer: { label: '🍽️ Comer y tomar algo', tipos: ['cafe', 'heladeria', 'panaderia', 'parrilla', 'restaurante', 'pizzeria', 'bar'] },
  compras: { label: '🛍️ Compras y regalos', tipos: ['regaleria', 'ropa', 'libreria', 'florista', 'joyeria', 'tienda', 'supermercado', 'jugueteria'] },
  naturaleza: { label: '🌿 Río y naturaleza', tipos: ['puente', 'pesca', 'mirador', 'camping', 'atractivo', 'estancia'] },
};
const TIPS = {
  plaza: 'Buen lugar para empezar: sentate un rato.', iglesia: 'Si está abierta, pasá a verla por dentro.', museo: 'Fijate los horarios antes de ir.',
  estacion: 'Ideal para fotos.', mirador: 'Mejor al atardecer.', puente: 'Mirá el río desde arriba.', pesca: 'Llevá repelente.',
  panaderia: 'Probá las facturas del día.', heladeria: 'Un helado para el camino.', cafe: 'Un buen descanso.', parrilla: 'Reservá si vas en fin de semana.',
};

/**
 * @param {{places:any[], home:{lat:number,lng:number}, horas:number, intereses:string[], modo:'walk'|'car'}} o
 * @returns tour o null si no alcanzan los lugares
 */
export function armarDia({ places, home, horas = 2, intereses = ['historia'], modo = 'walk' }) {
  const radio = modo === 'walk' ? 2500 : 15000;
  const dist = (p) => metros(home.lat, home.lng, p.lat, p.lng);
  const ok = (places || []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && dist(p) < radio);
  const porMin = modo === 'walk' ? 25 : 20; // minutos por parada, contando el trayecto
  const n = Math.max(2, Math.min(10, Math.round((horas * 60) / porMin)));
  const elegidos = (intereses.length ? intereses : ['historia']).filter((i) => INTERESES[i]);
  const colas = elegidos.map((i) => {
    const vistos = new Set();
    return ok.filter((p) => INTERESES[i].tipos.includes(p.icon)).sort((a, b) => dist(a) - dist(b)).filter((p) => (i === 'compras' ? !vistos.has(p.icon) && vistos.add(p.icon) : true));
  });
  const pick = [];
  for (let k = 0; pick.length < n && colas.some((c) => c.length); k++) {
    const c = colas[k % colas.length];
    const p = c.shift();
    if (p && !pick.includes(p)) pick.push(p);
  }
  if (pick.length < 2) return null;
  // Orden: vecino más cercano desde el centro.
  const left = [...pick], out = [];
  let cur = { lat: home.lat, lng: home.lng };
  while (left.length) {
    left.sort((a, b) => metros(cur.lat, cur.lng, a.lat, a.lng) - metros(cur.lat, cur.lng, b.lat, b.lng));
    cur = left.shift();
    out.push(cur);
  }
  const largo = out.slice(1).reduce((s, p, i) => s + metros(out[i].lat, out[i].lng, p.lat, p.lng) * 1.3, 0);
  const dur = Math.round((largo / (modo === 'walk' ? 75 : 450) + out.length * (modo === 'walk' ? 12 : 8)) / 5) * 5;
  const label = (p) => p.name;
  return {
    id: 'mi-dia', mode: modo, title: 'Mi día en Sarmiento', durationMin: Math.max(10, dur),
    intro: `Armado para vos: ${out.length} paradas, ${modo === 'walk' ? 'a pie' : 'en auto'}, según ${elegidos.map((i) => INTERESES[i].label.replace(/^\S+\s/, '').toLowerCase()).join(', ')}.`,
    stops: out.map((p) => ({ placeId: p.id, note: label(p), tip: TIPS[p.icon] || '' })),
  };
}
