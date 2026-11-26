// «Estoy llegando»: según la distancia al centro, qué decirle a quien viene hacia el pueblo.
import { textoDistancia, minutosAuto, textoMinutos } from './cerca.js';
export function describirLlegada(metros) {
  if (!Number.isFinite(metros)) return null;
  if (metros < 1200) return { zona: 'ya', titulo: '¡Ya estás en el centro!', texto: 'Bienvenido a Capitán Sarmiento. Empezá por la plaza y seguí con un recorrido a pie.' };
  if (metros < 40000) return { zona: 'cerca', titulo: `Ya casi llegás (${textoDistancia(metros)})`, texto: `Estás a unos ${textoMinutos(minutosAuto(metros))} en auto del centro. Mientras tanto, mirá qué conviene hacer primero.` };
  return { zona: 'lejos', titulo: `Estás ${textoDistancia(metros)} del pueblo`, texto: 'Todavía te falta un tramo. Cuando llegues, abrí esta pantalla de nuevo y te digo por dónde empezar.' };
}
