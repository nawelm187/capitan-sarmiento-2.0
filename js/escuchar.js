// Dictado por voz con el reconocimiento del propio navegador (Web Speech API). Chrome/Edge/Safari lo traen; Firefox no.
// En Chrome el audio lo procesa el servicio de voz de Google: por eso solo se activa cuando la persona toca el micrófono.
const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const soportadoEscuchar = !!SR;
let rec = null;

/** Empieza a escuchar. Devuelve una función para cancelar. */
export function escuchar({ lang = 'es-AR', alResultado, alTerminar, alError } = {}) {
  if (!SR) { alError?.('no-soportado'); return () => {}; }
  try { rec?.abort(); } catch { /* nada */ }
  rec = new SR();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = false;
  let dijo = false;
  rec.onresult = (e) => {
    const t = e.results?.[0]?.[0]?.transcript;
    if (t) { dijo = true; alResultado?.(String(t).trim()); }
  };
  rec.onerror = (e) => alError?.(e.error || 'error');
  rec.onend = () => { alTerminar?.(dijo); };
  try { rec.start(); } catch (e) { alError?.('no-inicio'); }
  return () => { try { rec?.abort(); } catch { /* nada */ } };
}
