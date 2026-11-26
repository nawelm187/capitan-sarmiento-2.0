// Eventos: cuenta regresiva y «agregar al calendario» (link de Google Calendar o archivo .ics para Apple/Outlook).
const pad = (n) => String(n).padStart(2, '0');
const TZ = 'America/Argentina/Buenos_Aires';

/** «21:30», «21», «21 h» → {h, m} o null. */
export function horaDe(t) {
  const m = String(t || '').match(/(\d{1,2})(?:[:.](\d{2}))?/);
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2] || 0);
  return h <= 23 && mm <= 59 ? { h, m: mm } : null;
}
const compacta = (iso) => iso.replace(/-/g, '');
const masUnDia = (iso) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

/** Cuenta regresiva: {texto, estado: 'ya'|'curso'|'hoy'|'pronto'|'futuro'|'pasado'}. Argentina no tiene horario de verano (UTC-3). */
export function cuentaRegresiva(e, ahora = new Date(), hoyISO = ahora.toLocaleDateString('sv-SE', { timeZone: TZ })) {
  if (!e?.from) return { texto: '', estado: 'pasado' };
  const to = e.to || e.from;
  if (to < hoyISO) return { texto: 'Ya pasó', estado: 'pasado' };
  const hr = horaDe(e.time);
  if (e.from <= hoyISO && hoyISO <= to) {
    if (e.from === to && hr) {
      const ms = new Date(`${e.from}T${pad(hr.h)}:${pad(hr.m)}:00-03:00`) - ahora;
      if (ms > 0) return ms < 3600000 ? { texto: `Empieza en ${Math.max(1, Math.round(ms / 60000))} min`, estado: 'pronto' } : { texto: `Hoy, faltan ${Math.floor(ms / 3600000)} h`, estado: 'hoy' };
    }
    return { texto: e.from === to ? 'Es hoy' : 'En curso', estado: 'curso' };
  }
  const dias = Math.round((new Date(e.from + 'T12:00:00Z') - new Date(hoyISO + 'T12:00:00Z')) / 86400000);
  return { texto: dias === 1 ? 'Es mañana' : `Faltan ${dias} días`, estado: dias <= 7 ? 'pronto' : 'futuro' };
}

export function urlGoogleCalendar(e, ciudad = '') {
  const hr = horaDe(e.time);
  const to = e.to || e.from;
  let dates;
  if (hr && e.from === to) {
    const ini = `${compacta(e.from)}T${pad(hr.h)}${pad(hr.m)}00`;
    const fh = hr.h + 2;
    dates = `${ini}/${fh < 24 ? compacta(e.from) + 'T' + pad(fh) + pad(hr.m) + '00' : compacta(masUnDia(e.from)) + 'T' + pad(fh - 24) + pad(hr.m) + '00'}`;
  } else dates = `${compacta(e.from)}/${compacta(masUnDia(to))}`;
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title || 'Evento', dates, details: e.text || '', location: [e.place, ciudad].filter(Boolean).join(', '), ctz: TZ });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

const esc = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n');
export function ics(e, ciudad = '') {
  const hr = horaDe(e.time);
  const to = e.to || e.from;
  const f = hr && e.from === to
    ? [`DTSTART;TZID=${TZ}:${compacta(e.from)}T${pad(hr.h)}${pad(hr.m)}00`, `DTEND;TZID=${TZ}:${compacta(e.from)}T${pad(Math.min(23, hr.h + 2))}${pad(hr.m)}00`]
    : [`DTSTART;VALUE=DATE:${compacta(e.from)}`, `DTEND;VALUE=DATE:${compacta(masUnDia(to))}`];
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Guia Sarmiento//ES', 'BEGIN:VEVENT', `UID:${compacta(e.from)}-${(e.title || '').length}-${Math.abs([...String(e.title)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7))}@guia-sarmiento`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, ...f, `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(e.text)}`, `LOCATION:${esc([e.place, ciudad].filter(Boolean).join(', '))}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
