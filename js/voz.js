// Lectura en voz alta con el narrador del propio navegador (Web Speech API). No usa archivos de sonido ni internet propio.
// Si el navegador no lo trae, `soportado` es false y la web no muestra los botones de audio.
export const soportado = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

let idioma = 'es';
/** 'es' o 'en': elige el narrador y el acento. */
export function setIdiomaVoz(l) { idioma = l === 'en' ? 'en' : 'es'; }
export const codigoIdioma = () => (idioma === 'en' ? 'en-US' : 'es-AR');

function elegirVoz() {
  const voces = soportado ? speechSynthesis.getVoices() : [];
  if (idioma === 'en') return voces.find((v) => /^en[-_]US/i.test(v.lang)) || voces.find((v) => /^en/i.test(v.lang)) || null;
  return voces.find((v) => /^es[-_]AR/i.test(v.lang)) || voces.find((v) => /^es[-_](419|MX|US|CL|UY)/i.test(v.lang)) || voces.find((v) => /^es/i.test(v.lang)) || null;
}

let hablando = false;
export const estaHablando = () => hablando;

/** Lee `texto` en voz alta (corta lo que estuviera leyendo). `alTerminar` se llama al final. */
export function hablar(texto, alTerminar) {
  if (!soportado || !texto) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(texto).replace(/\s+/g, ' ').trim());
  const v = elegirVoz();
  u.lang = v?.lang || codigoIdioma();
  if (v) u.voice = v;
  u.rate = 0.95;
  u.onstart = () => { hablando = true; };
  u.onend = u.onerror = () => { hablando = false; alTerminar?.(); };
  speechSynthesis.speak(u);
}

export function callar() {
  if (!soportado) return;
  hablando = false;
  speechSynthesis.cancel();
}
