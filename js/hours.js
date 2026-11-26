// "Abierto ahora": lee horarios en formato OpenStreetMap (ej. "Mo-Fr 08:00-12:00,16:00-20:00; Sa 09:00-13:00", "24/7").
// Devuelve true (abierto), false (cerrado) o null (no se entiende el texto: no se muestra nada).
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const mins = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** Día de la semana (0=domingo) y minutos desde medianoche en hora de Argentina. */
export function nowAR(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (t) => f.find((p) => p.type === t)?.value;
  return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')), min: Number(get('hour')) * 60 + Number(get('minute')) };
}

function daysOf(spec) {
  const set = new Set();
  for (const part of spec.split(',')) {
    const m = /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/.exec(part.trim());
    if (!m) return null;
    let i = DAYS.indexOf(m[1]);
    const j = DAYS.indexOf(m[2] || m[1]);
    for (let k = 0; k < 8; k++) { set.add(i); if (i === j) break; i = (i + 1) % 7; }
  }
  return set;
}

export function openNow(text, date = new Date()) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (/^24\/7$/i.test(t)) return true;
  const { day, min } = nowAR(date);
  let known = false;
  let open = false;
  for (const rule of t.split(';')) {
    const r = rule.trim();
    if (!r) continue;
    const m = /^(?:((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+)?(off|closed|\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*)$/i.exec(r);
    if (!m) return null; // algo que no entendemos (feriados, meses, etc.): mejor no afirmar nada
    known = true;
    const days = m[1] ? daysOf(m[1]) : new Set([0, 1, 2, 3, 4, 5, 6]);
    if (!days) return null;
    const prev = (day + 6) % 7;
    if (/^(off|closed)$/i.test(m[2])) { if (days.has(day)) open = false; continue; }
    for (const span of m[2].split(',')) {
      const [a, b] = span.split('-').map((x) => mins(x.trim()));
      if (a <= b) { if (days.has(day) && min >= a && min < b) open = true; }
      else { // pasa la medianoche (ej. 20:00-02:00)
        if (days.has(day) && min >= a) open = true;
        if (days.has(prev) && min < b) open = true;
      }
    }
  }
  return known ? open : null;
}

// ---------- Textos amigables ----------
const ES_DIA = { Mo: 'Lun', Tu: 'Mar', We: 'Mié', Th: 'Jue', Fr: 'Vie', Sa: 'Sáb', Su: 'Dom' };
const ES_DIA_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const RE_REGLA = /^(?:((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+)?(off|closed|\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*)$/i;

/** "Mo-Fr 08:00-12:00,16:00-20:00; Sa 09:00-13:00" → "Lun a Vie 08:00 a 12:00 y 16:00 a 20:00 · Sáb 09:00 a 13:00". Si no se entiende, devuelve el texto tal cual. */
export function aEspanol(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  if (/^24\/7$/i.test(t)) return 'Las 24 horas, todos los días';
  const out = [];
  for (const rule of t.split(';')) {
    const r = rule.trim();
    if (!r) continue;
    const m = RE_REGLA.exec(r);
    if (!m) return t;
    const dias = m[1]
      ? m[1].split(',').map((s) => s.trim()).map((s) => (s.includes('-') ? s.split('-').map((d) => ES_DIA[d]).join(' a ') : ES_DIA[s])).join(' y ').replace(/ y (?=[^]*$)/, (x, i, str) => (str.split(' y ').length > 2 ? ', ' : x))
      : 'Todos los días';
    const horas = /^(off|closed)$/i.test(m[2]) ? 'cerrado' : m[2].split(',').map((s) => s.trim().replace(/\s*-\s*/, ' a ')).join(' y ');
    out.push(`${dias} ${horas}`);
  }
  return out.join(' · ');
}

/**
 * Cuándo cambia el estado: { abierto, minutos, texto, corto, pronto } o null si no se entiende el horario.
 *   abierto: "Cierra a las 20:00" · cerrado: "Abre hoy a las 16:00" / "Abre mañana a las 08:00" / "Abre el lunes a las 08:00"
 */
export function estadoHorario(text, date = new Date()) {
  const now = openNow(text, date);
  if (now === null) return null;
  if (/^24\/7$/i.test(String(text).trim())) return { abierto: true, minutos: Infinity, texto: 'Abierto las 24 horas', corto: '', pronto: false };
  const base = nowAR(date);
  for (let k = 1; k <= 8 * 24 * 60; k += k < 2880 ? 1 : 30) {
    const t = new Date(date.getTime() + k * 60000);
    if (openNow(text, t) === now) continue;
    const at = nowAR(t);
    const hh = `${String(Math.floor(at.min / 60)).padStart(2, '0')}:${String(at.min % 60).padStart(2, '0')}`;
    const dias = Math.floor((base.min + k) / 1440);
    const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `el ${ES_DIA_LARGO[at.day]}`;
    if (now) {
      return { abierto: true, minutos: k, pronto: k <= 60, corto: dias === 0 ? `hasta las ${hh}` : '', texto: k <= 60 ? `Cierra pronto: a las ${hh}` : `Cierra ${dias === 0 ? '' : cuando + ' '}a las ${hh}` };
    }
    return { abierto: false, minutos: k, pronto: false, corto: '', texto: `Abre ${cuando} a las ${hh}` };
  }
  return { abierto: now, minutos: Infinity, texto: '', corto: '', pronto: false };
}
