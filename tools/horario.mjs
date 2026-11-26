// Convierte horarios escritos "como se habla" al formato que entiende la web (OpenStreetMap).
//   "Lun a Vie 8 a 12 y 16 a 20; Sáb 9-13"  →  "Mo-Fr 08:00-12:00,16:00-20:00; Sa 09:00-13:00"
//   "Todos los días 8 a 22" · "24 hs" · "Lun a Sáb 8:30-12:30" · "Dom cerrado"
//   También entiende lo que se copia de Google Maps: "lunes: 8:30–12:30, 16:30–20:30; martes: 8:30–12:30; domingo: cerrado"
// Devuelve null si no se entiende (para avisar y no guardar algo roto).
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const DAY = { lun: 'Mo', lunes: 'Mo', mar: 'Tu', martes: 'Tu', mie: 'We', miercoles: 'We', jue: 'Th', jueves: 'Th', vie: 'Fr', viernes: 'Fr', sab: 'Sa', sabado: 'Sa', sabados: 'Sa', dom: 'Su', domingo: 'Su', domingos: 'Su' };
const ORDER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const hhmm = (h, m = '00') => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

export function aFormatoOSM(texto) {
  const raw = String(texto || '').trim();
  if (!raw) return '';
  if (/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b|^24\/7$/.test(raw)) return raw; // ya está en formato OSM
  const t0 = norm(raw).replace(/([a-z])\s*:\s*(?=\d|cerrad|abiert|no abre)/g, '$1 ').replace(/abierto las 24 horas|abierto 24 horas|24 horas|24 hs?/g, '0:00-24:00').replace(/\s+/g, ' ');
  if (/^(0:00-24:00|siempre abierto)$/.test(t0)) return '24/7';
  const partes = t0.split(/\s*(?:;|\/|\.\s|\|)\s*/).filter(Boolean);
  const out = [];
  for (const parte of partes) {
    let diasTxt = parte;
    let rest = '';
    const m = /^(.*?)(?=\d|cerrad|no abre)/.exec(parte);
    if (m) { diasTxt = m[1]; rest = parte.slice(m[1].length); }
    diasTxt = diasTxt.replace(/\b(de|del|los|las|dias|dia|horario|hs)\b/g, ' ').replace(/\s+/g, ' ').trim();
    let dias;
    if (!diasTxt || /^(todos|todo)$|^(lun(es)? a dom(ingo)?)$|todos/.test(parte.slice(0, 12))) dias = null; // todos los días
    else {
      const sets = [];
      for (const seg of diasTxt.split(/\s*(?:,| y )\s*/).filter(Boolean)) {
        const r = /^([a-z]+)(?:\s+(?:a|al)\s+|\s*-\s*)([a-z]+)$/.exec(seg);
        if (r) {
          const a = DAY[r[1]], b = DAY[r[2]];
          if (!a || !b) return null;
          const i = ORDER.indexOf(a), j = ORDER.indexOf(b);
          sets.push(i === j ? a : i < j ? `${a}-${b}` : b === 'Mo' ? `${a}-Su,Mo` : `${a}-Su,Mo-${b}`);
        } else {
          const d = DAY[seg];
          if (!d) return null;
          sets.push(d);
        }
      }
      dias = sets.join(',');
    }
    let horas;
    if (/cerrad|no abre/.test(rest)) horas = 'off';
    else {
      const tramos = [];
      const re = /(\d{1,2})(?::(\d{2}))?\s*(?:hs?)?\s*(?:a|-|–|hasta)\s*(\d{1,2})(?::(\d{2}))?/g;
      let mm;
      while ((mm = re.exec(rest))) {
        const h1 = Number(mm[1]), h2 = Number(mm[3]);
        if (h1 > 24 || h2 > 24) return null;
        tramos.push(`${hhmm(h1, mm[2])}-${hhmm(h2, mm[4])}`);
      }
      if (!tramos.length) return null;
      horas = tramos.join(',');
    }
    out.push(`${dias ? dias + ' ' : ''}${horas}`);
  }
  // días sueltos con las mismas horas, uno al lado del otro (lo que pega Google Maps) → se juntan: Mo,Tu,We → Mo-We
  const sueltos = out.map((x) => /^(Mo|Tu|We|Th|Fr|Sa|Su) (.+)$/.exec(x));
  if (out.length >= 3 && sueltos.every(Boolean)) {
    const grupos = [];
    for (const [, d, h] of sueltos) {
      const g = grupos[grupos.length - 1];
      if (g && g.h === h && ORDER.indexOf(g.fin) + 1 === ORDER.indexOf(d)) g.fin = d;
      else grupos.push({ ini: d, fin: d, h });
    }
    return grupos.map((g) => `${g.ini === g.fin ? g.ini : `${g.ini}-${g.fin}`} ${g.h}`).join('; ');
  }
  return out.length ? out.join('; ') : null;
}
