// Entiende frases habladas o escritas como «farmacia de turno», «qué está abierto» o «cómo está el clima» (módulo puro).
// Devuelve {accion, texto?}; si no es una orden, la frase se usa como búsqueda de lugares.
const sin = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();

const REGLAS = [
  ['servicios', /\b(estacionar|estacionamiento|estacionamientos|donde dejo el auto|parking|banos?|sanitarios?|toilets?|wc)\b/],
  ['clima', /\b(clima|tiempo|pronostico|llueve|lluvia|llover|temperatura|calor|frio|viento|va a llover|weather|forecast|rain|raining|temperature|windy|hot|cold)\b/],
  ['turno', /\bfarmacia( de)? turno\b|\bde turno\b|\bnight pharmacy\b/],
  ['abierto', /\b(abierto|abiertos|abierta|abiertas|abre ahora|que abre|esta abierto|open now|whats open|what s open|what is open)\b/],
  ['utiles', /\b(telefonos?|emergencias?|ambulancia|bomberos|policia|urgencias?|emergency|phone numbers?|ambulance)\b/],
  ['finde', /\b(fin de semana|finde|donde dormir|donde alojar|alojamiento|weekend|where to stay)\b/],
  ['midia', /\b(mi dia|armame un recorrido|armar un recorrido)\b/],
  ['pie', /\b(a pie|caminando|recorridos? a pie|paseo a pie|on foot|walking tours?|walk)\b/],
  ['auto', /\b(en auto|recorridos? en auto|by car|driving)\b/],
  ['recorridos', /\b(recorridos?|paseos?|tours?)\b/],
  ['perdidos', /\b(perdid[oa]s?|encontrad[oa]s?|perdi mi|se perdio|mascota perdida|lost|found pet|lost pet)\b/],
  ['cerca', /\b(cerca mio|cerca de mi|cerca de aca|mas cercano|mas cerca|near me|nearby|close to me|closest)\b/],
  ['favoritos', /\b(mis lugares|favoritos|my places|favorites|favourites)\b/],
  ['ayuda', /\b(ayuda|ayudame|como funciona|accesibilidad|help|how does it work)\b/],
];
const RELLENO = /\b(buscame|buscar|busca|quiero|necesito|dame|mostrame|mostra|donde (hay|queda|esta)|hay (una|un|alguna|algun)|una|un|el|la|los|las|por favor|me podes|podes|decime|llevame a|ir a|ver)\b/g;

export function interpretar(frase) {
  const t = sin(frase);
  if (!t) return { accion: 'nada' };
  for (const [accion, re] of REGLAS) if (re.test(t)) return { accion, texto: t };
  const q = t.replace(RELLENO, ' ').replace(/\s+/g, ' ').trim();
  return { accion: 'buscar', texto: q || t };
}
