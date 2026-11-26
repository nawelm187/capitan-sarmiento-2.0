// Lee mensajes pegados (de WhatsApp o correo) y encuentra las líneas OPINION:/PERDIDO:/ERROR:/DATOS:
// para que las apruebes desde /revisar. Módulo puro: no toca archivos.
const TIPOS = {
  OPINION: { archivo: 'fuentes/opiniones.txt', titulo: 'Opinión', tool: 'opiniones.mjs', prefijo: false },
  PERDIDO: { archivo: 'fuentes/perdidos.txt', titulo: 'Mascota u objeto', tool: 'perdidos.mjs', prefijo: false },
  DATOS: { archivo: 'fuentes/sugerencias.txt', titulo: 'Cambio de datos de un comercio', tool: 'datos.mjs', prefijo: true },
  ERROR: { archivo: 'fuentes/errores.txt', titulo: 'Error reportado', tool: null, prefijo: true },
};
export { TIPOS };
const limpiar = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
const partes = (s) => s.split('|').map((x) => x.trim());

/** Devuelve [{tipo, linea, valido, problema, resumen, escribir}] — una por cada línea reconocida. */
export function analizar(texto) {
  const out = [];
  const vistos = new Set();
  for (const crudo of String(texto || '').split(/\r?\n/)) {
    const m = crudo.replace(/^\s*(?:\[[^\]]*\]\s*)?(?:[^:|]{1,40}:\s)?(?=(?:OPINION|PERDIDO|ERROR|DATOS):)/i, '').trim().match(/^(OPINION|PERDIDO|ERROR|DATOS):\s*(.+)$/i);
    if (!m) continue;
    const tipo = m[1].toUpperCase();
    const cuerpo = limpiar(m[2]);
    if (vistos.has(tipo + cuerpo)) continue;
    vistos.add(tipo + cuerpo);
    const p = partes(cuerpo);
    const r = { tipo, titulo: TIPOS[tipo].titulo, linea: cuerpo, valido: true, problema: '', resumen: '' };
    if (tipo === 'OPINION') {
      const n = Number(p[1]);
      r.resumen = `${p[0] || '¿?'} · ${n >= 1 && n <= 5 ? '★'.repeat(n) : '¿' + (p[1] || '?') + '?'} · “${p[2] || ''}”${p[3] ? ' — ' + p[3] : ''}`;
      if (!p[0]) { r.valido = false; r.problema = 'Falta el nombre del lugar.'; }
      else if (!(n >= 1 && n <= 5)) { r.valido = false; r.problema = 'Las estrellas tienen que ser de 1 a 5.'; }
    } else if (tipo === 'PERDIDO') {
      r.resumen = `${p[0] || '¿?'} ${p[1] || ''}: ${p[2] || ''} — ${p[3] || ''} (${p[4] || 'sin zona'}) · contacto ${p[6] || '¿?'}`;
      if (p.length < 7) { r.valido = false; r.problema = 'Le faltan campos (tiene que tener al menos 7 separados por |).'; }
      else if (!/^(perdido|encontrado)$/i.test(p[0])) { r.valido = false; r.problema = 'El estado tiene que ser «perdido» o «encontrado».'; }
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(p[5])) { r.valido = false; r.problema = 'La fecha tiene que ser AAAA-MM-DD.'; }
      else if (p[6].replace(/\D/g, '').length < 6) { r.valido = false; r.problema = 'El contacto no parece un teléfono.'; }
    } else if (tipo === 'DATOS') {
      r.resumen = `${p[0] || '¿?'} · tel ${p[1] || '—'} · WhatsApp ${p[2] || '—'} · horario ${p[3] || '—'} · ${p[4] || '—'}`;
      if (!p[0]) { r.valido = false; r.problema = 'Falta el nombre del comercio.'; }
    } else {
      r.resumen = `${p[0] || '¿?'} · ${p[1] || ''} · ${p[2] || ''}`;
    }
    if (/<\s*\/?\s*script|javascript:|on\w+\s*=/i.test(cuerpo)) { r.valido = false; r.problema = 'Contiene código sospechoso.'; }
    r.escribir = TIPOS[tipo].prefijo ? `${tipo}: ${cuerpo}` : cuerpo;
    out.push(r);
  }
  return out;
}
