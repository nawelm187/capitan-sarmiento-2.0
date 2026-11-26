// Modo manos libres: entiende órdenes cortas para manejar un recorrido sin tocar el celular.
const limpiar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zñ0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Devuelve 'sig' | 'ant' | 'rep' | 'fin' | 'falta' | 'nada'. */
export function comandoTour(frase) {
  const t = ` ${limpiar(frase)} `;
  if (!t.trim()) return 'nada';
  if (/ (parar|para|pare|termin\w*|basta|chau|salir|salgamos|apag\w*|callate|silencio|detener|fin) /.test(t)) return 'fin';
  if (/ (cuanto falta|cuantas paradas|que falta|falta mucho|donde estoy) /.test(t)) return 'falta';
  if (/ (anterior|atras|volve\w*|volver|retroced\w*|la de antes|previa) /.test(t)) return 'ant';
  if (/ (repeti\w*|repetir|repite|de nuevo|otra vez|decilo|no entendi|como\??) /.test(t)) return 'rep';
  if (/ (siguiente|segui\w*|seguir|sigue|continua\w*|continuar|adelante|dale|proxima|proximo|avanza\w*|vamos|next) /.test(t)) return 'sig';
  return 'nada';
}

export const AYUDA_MANOS = 'Decí «siguiente», «anterior», «repetir», «cuánto falta» o «parar».';
