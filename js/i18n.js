// Versión en inglés: traduce en el momento los textos de la guía (diccionario + reglas). Sin DOM en las funciones puras.
// Lo que no está en el diccionario (descripciones de comercios, nombres de calles, etc.) queda en español.
const KEY = 'guia.lang';
let lang = 'es';
export const getLang = () => lang;
export function cargarLang() {
  try { const v = localStorage.getItem(KEY); if (v === 'en' || v === 'es') lang = v; } catch { /* sin almacenamiento */ }
  return lang;
}
export function sugerirIngles() {
  try { if (localStorage.getItem(KEY)) return false; } catch { /* nada */ }
  return typeof navigator !== 'undefined' && /^en/i.test(navigator.language || '');
}
export function guardarLang(l) { lang = l === 'en' ? 'en' : 'es'; try { localStorage.setItem(KEY, lang); } catch { /* nada */ } }

const D = {
  // --- pestañas y navegación ---
  'Lugares': 'Places', 'Hoy': 'Today', 'A pie': 'On foot', 'En auto': 'By car', 'Perdidos': 'Lost & found', 'Guías': 'Guides', 'Mapa': 'Map', 'Lista': 'List',
  'Ver el mapa': 'View the map', 'Ver mapa': 'View map', 'Ver en el mapa': 'Show on map', 'Cerrar': 'Close', 'Entendido': 'Got it', 'Anterior': 'Previous', 'Siguiente': 'Next', 'Parar': 'Stop',
  'Ayuda y créditos': 'Help & credits', 'Cargando…': 'Loading…', 'Capitán Sarmiento': 'Capitán Sarmiento',
  // --- buscador ---
  'Buscar un lugar': 'Search for a place', 'Buscar un lugar: farmacia, pizza, calle…': 'Search for a place: pharmacy, pizza, street…', 'Buscar hablando': 'Search by voice',
  'Todos los lugares': 'All places', 'Esenciales': 'Essentials', 'Solo esenciales': 'Essentials only', 'Capas': 'Layers', 'Activar todas': 'Select all', 'Desactivar todas': 'Clear all',
  '¿Quisiste decir…?': 'Did you mean…?', 'No encontré nada con eso.': 'I found nothing for that.',
  '🟢 Mostrar solo lo que está': '🟢 Show only what is', 'abierto ahora': 'open now', '🟢 Abierto ahora': '🟢 Open now', 'Abierto ahora': 'Open now', 'Abierto': 'Open',
  '📍 Lugares cerca mío': '📍 Places near me', 'Lo más cerca de donde estás': 'Closest to where you are', 'Buscando tu ubicación…': 'Finding your location…',
  'Buscando tu ubicación… (aceptá el permiso si el navegador te lo pide)': 'Finding your location… (allow access if your browser asks)',
  'Tu navegador no permite usar la ubicación.': 'Your browser does not allow location access.',
  'No pude saber dónde estás. Probá de nuevo al aire libre o con el GPS prendido.': 'I could not find where you are. Try again outdoors or with GPS on.',
  'No pude saber dónde estás. Probá de nuevo al aire libre.': 'I could not find where you are. Try again outdoors.',
  'No hay lugares en las capas activas. Abrí «Capas» y prendé alguna.': 'No places in the active layers. Open “Layers” and turn some on.',
  // --- ficha de un lugar ---
  'Cómo llegar': 'Directions', 'Ver en Google Maps': 'View on Google Maps', 'Más información': 'More information', '🔗 Compartir': '🔗 Share', 'Link copiado. Pegalo en WhatsApp o donde quieras.': 'Link copied. Paste it in WhatsApp or anywhere you like.',
  '🤍 Guardar en mis lugares': '🤍 Save to my places', '❤️ Mis lugares': '❤️ My places', 'Favorito': 'Favorite', '🌐 Ver en 360°': '🌐 View in 360°', ' en 360°': ' in 360°',
  '⭐ Dejar una opinión': '⭐ Leave a review', '★ Ver reseñas en Google': '★ See reviews on Google', '🏪 Soy el dueño': '🏪 I am the owner', '🙏 Dar las gracias': '🙏 Say thanks', '⚠️ Reportar un error': '⚠️ Report an error', '⚠ Reportar un dato': '⚠ Report a detail',
  '🧭 ¿Cuánto tardo desde acá?': '🧭 How long from here?', 'Es una estimación; el botón «Cómo llegar» abre el mapa con el camino real.': 'This is an estimate; the “Directions” button opens the map with the real route.',
  '📞 Llamar': '📞 Call', '💬 WhatsApp': '💬 WhatsApp', 'Escribir por WhatsApp': 'Message on WhatsApp', 'Contactar': 'Contact', 'Dirección: ': 'Address: ',
  'La ubicación es aproximada: no tengo la numeración oficial de las calles. Sirve para orientarte.': 'The location is approximate: I do not have the official street numbering. It is only a guide.',
  'Estás acá': 'You are here', 'Todavía sin ubicación exacta: no se dibujan en el mapa': 'No exact location yet: not drawn on the map',
  // --- Hoy ---
  'Acá ves qué está abierto ahora, la farmacia de turno y los eventos.': 'Here you see what is open now, the on-duty pharmacy and events.', 'Lo que pasa hoy': 'What is happening today',
  '💊 Farmacia de turno hoy': '💊 On-duty pharmacy today', 'Farmacia de turno': 'On-duty pharmacy', 'Todavía no tengo cargada la farmacia de turno de hoy.': 'I do not have today’s on-duty pharmacy yet.',
  'Próximos eventos': 'Upcoming events', 'Por ahora no hay eventos ni novedades cargadas.': 'There are no events or news posted for now.', 'Novedades': 'News',
  '🔥 Lo más visto': '🔥 Most viewed', 'Todavía no hay horarios cargados, o no hay nada abierto en este momento.': 'No opening hours are loaded yet, or nothing is open right now.',
  '📍 Estoy llegando': '📍 I am arriving', '📜 Línea del tiempo': '📜 Timeline', '🛠️ Oficios y servicios': '🛠️ Trades & services', '🅿️ Estacionamiento y baños': '🅿️ Parking & restrooms',
  '🧳 Fin de semana en Capitán Sarmiento': '🧳 A weekend in Capitán Sarmiento', '☎ Teléfonos útiles': '☎ Useful phone numbers', '🚨 Emergencias': '🚨 Emergencies', 'Emergencias': 'Emergencies', '🚓 Policía': '🚓 Police',
  'Bomberos:': 'Fire department:', 'Policía:': 'Police:', 'Teléfonos útiles': 'Useful phone numbers',
  // --- clima ---
  'Consultando el clima…': 'Checking the weather…', 'Clima': 'Weather', 'Próximas horas': 'Next hours', 'Próximos días': 'Next days', 'Despejado': 'Clear', 'Mayormente despejado': 'Mostly clear', 'Parcialmente nublado': 'Partly cloudy', 'Nublado': 'Cloudy',
  'Niebla': 'Fog', 'Llovizna': 'Drizzle', 'Lluvia': 'Rain', 'Lluvia fuerte': 'Heavy rain', 'Nieve': 'Snow', 'Chaparrones': 'Showers', 'Chaparrones fuertes': 'Heavy showers', 'Tormenta': 'Thunderstorm', 'Tormenta con granizo': 'Thunderstorm with hail', 'Sin datos': 'No data',
  '🔊 Escuchar el pronóstico': '🔊 Listen to the forecast', '😎 Planes para hoy': '😎 Plans for today', '🌧️ Qué hacer si llueve': '🌧️ What to do if it rains', 'Planes para hoy': 'Plans for today', 'Ver pronóstico': 'See forecast', 'Escuchar la alerta': 'Listen to the alert',
  'No pude consultar el pronóstico en este momento.': 'I could not get the forecast right now.', 'Tu plan para hoy': 'Your plan for today', '☔ Para un día de lluvia': '☔ For a rainy day', '🥵 Para un día de calor': '🥵 For a hot day', '🧣 Para un día de frío': '🧣 For a cold day', '💨 Para un día de viento': '💨 For a windy day', '😎 Para un día lindo': '😎 For a nice day',
  'Mañana': 'Morning', 'Mediodía': 'Midday', 'Tarde': 'Afternoon', 'Merienda': 'Afternoon snack', 'Noche': 'Evening', 'Cierre': 'To finish', 'Medio día': 'Midday',
  'Aviso automático según el pronóstico. No es una alerta oficial:': 'Automatic notice based on the forecast. It is not an official alert:', 'Aviso automático según el pronóstico; no es una alerta oficial del': 'Automatic notice based on the forecast; not an official alert from the',
  '. No reemplaza los alertas oficiales del': '. It does not replace official alerts from the', 'Clima: datos de': 'Weather: data from', 'ver alertas del Servicio Meteorológico': 'see Meteorological Service alerts', 'Pronóstico no disponible:': 'Forecast not available:', ' · sin conexión: último pronóstico guardado': ' · offline: last saved forecast',
  'El pronóstico indica tormentas.': 'The forecast shows thunderstorms.', 'El pronóstico indica tormentas, con posible granizo.': 'The forecast shows thunderstorms, possibly with hail.', 'Manejá con precaución en las rutas.': 'Drive carefully on the roads.',
  'Ojo': 'Heads up',
  // --- voz / manos libres ---
  '🙌 Modo manos libres': '🙌 Hands-free mode', '🙌 Manos libres': '🙌 Hands-free', 'Modo manos libres': 'Hands-free mode', 'Decí «siguiente», «anterior», «repetir», «cuánto falta» o «parar».': 'Say “next”, “previous”, “repeat”, “how much is left” or “stop”.',
  'Listo, terminé el modo manos libres.': 'Done, hands-free mode is off.', 'Te escucho… decime qué buscás.': 'Listening… tell me what you are looking for.', 'No te escuché bien. Tocá el micrófono y probá de nuevo.': 'I did not hear you well. Tap the microphone and try again.', 'No te escuché. Probá de nuevo.': 'I did not hear you. Try again.',
  'No diste permiso para usar el micrófono.': 'You did not allow microphone access.', 'No pude usar el micrófono ahora.': 'I could not use the microphone right now.', 'No tengo permiso para usar el micrófono. Revisá el permiso del navegador.': 'I do not have microphone permission. Check your browser settings.', 'No te entendí. ': 'I did not understand. ',
  'Estás en la última parada.': 'You are at the last stop.', '🔊 Escuchar': '🔊 Listen', '🔊 Escuchar el recorrido': '🔊 Listen to the tour', '🔇 Dejar de leer en voz alta': '🔇 Stop reading aloud',
  // --- recorridos ---
  '🔗 Compartir este recorrido': '🔗 Share this tour', 'Recorrido copiado. Pegalo en WhatsApp.': 'Tour copied. Paste it in WhatsApp.', '🖨 Imprimir': '🖨 Print', 'Todavía no hay recorridos en auto.': 'There are no car tours yet.',
  'Buen lugar para empezar: sentate un rato.': 'A good place to start: sit for a while.', 'Probá las facturas del día.': 'Try the day’s pastries.', 'Un helado para el camino.': 'An ice cream for the road.', 'Reservá si vas en fin de semana.': 'Book ahead if you go on a weekend.', 'Mirá el río desde arriba.': 'Look at the river from above.',
  'Si está abierta, pasá a verla por dentro.': 'If it is open, go in and take a look.', 'Ideal para fotos.': 'Great for photos.', 'Llevá repelente.': 'Bring insect repellent.', 'Fijate los horarios antes de ir.': 'Check the opening hours before you go.', 'Un buen descanso.': 'A good rest.',
  // --- Mi día / fin de semana ---
  'Mi día en Sarmiento': 'My day in Sarmiento', '✨ Armá «Mi día en Sarmiento»': '✨ Build “My day in Sarmiento”', 'Armar mi recorrido': 'Build my tour', '¿Cuánto tiempo tenés?': 'How much time do you have?', '¿Cómo te movés?': 'How are you getting around?', '¿Qué te gusta? (elegí uno o varios)': 'What do you like? (pick one or more)',
  'Contame cuánto tiempo tenés y qué te gusta, y te armo un recorrido a tu medida.': 'Tell me how much time you have and what you like, and I will build a tour for you.', 'Elegís cuánto tiempo tenés y qué te gusta, y te armo el recorrido.': 'Choose how much time you have and what you like, and I will build the tour.',
  'No encontré suficientes lugares con esos gustos. Probá marcando más opciones o cambiando a «En auto».': 'I did not find enough places for those tastes. Try ticking more options or switching to “By car”.', 'Todavía no hay lugares cargados para armar esta guía.': 'There are no places loaded yet to build this guide.', 'Todavía no hay lugares cargados para este plan.': 'There are no places loaded yet for this plan.',
  'Lo básico para pasar un fin de semana: dónde dormir, dónde comer y qué hacer, con sol o con lluvia.': 'The basics for a weekend stay: where to sleep, where to eat and what to do, rain or shine.', '🛏️ Dónde dormir': '🛏️ Where to sleep', '🌿 Río y naturaleza': '🌿 River and nature', 'Dónde comer': 'Where to eat', 'Dónde dormir': 'Where to sleep',
  // --- perdidos ---
  'Mirá avisos del pueblo o publicá el tuyo.': 'See the town’s notices or post your own.', '➕ Publicar un aviso': '➕ Post a notice', 'Se perdió': 'Lost', '🔎 Se perdió': '🔎 Lost', '✅ Se encontró': '✅ Found', 'Se encontró': 'Found', 'Lo encontré': 'I found it', '💬 Tengo información': '💬 I have information', '🎁 Recompensa:': '🎁 Reward:',
  'No hay avisos en este momento. Si perdiste o encontraste una mascota o un objeto, publicalo acá: lo ve todo el pueblo.': 'There are no notices right now. If you lost or found a pet or an object, post it here: the whole town sees it.', 'Los avisos se borran solos a los 30 días. Si ya apareció, avisanos para sacarlo.': 'Notices disappear after 30 days. If it has turned up, let us know to take it down.',
  '¿Qué pasó?': 'What happened?', '¿Es una…?': 'Is it a…?', 'Nombre o qué es': 'Name or what it is', 'Zona o barrio donde pasó': 'Area or neighborhood where it happened', 'Tu teléfono o WhatsApp': 'Your phone or WhatsApp', 'Algo más (opcional)': 'Anything else (optional)', 'Color, tamaño, collar, señas particulares…': 'Color, size, collar, distinguishing marks…', 'Si es manso, si tiene chip, horarios para llamar…': 'Whether it is friendly, microchipped, best times to call…',
  'Con código de país y área, ej. 5493364123456': 'With country and area code, e.g. 5493364123456', '(Si tengo fotos, las mando en un mensaje aparte.)': '(If I have photos, I will send them in a separate message.)', 'Se abrió tu aplicación con el mensaje listo: tocá enviar. Después mandá las fotos. ¡Gracias!': 'Your app opened with the message ready: tap send. Then send the photos. Thank you!',
  // --- formularios genéricos ---
  'Se abrió tu aplicación con el mensaje listo: tocá enviar. ¡Gracias!': 'Your app opened with the message ready: tap send. Thank you!', 'Se abrió tu aplicación con el mensaje listo: tocá enviar. ¡Gracias por agradecer!': 'Your app opened with the message ready: tap send. Thanks for saying thanks!', 'Copiá este mensaje y mandalo a quien administra la guía:': 'Copy this message and send it to whoever runs the guide:',
  'Armar el mensaje': 'Build the message', 'Enviar': 'Send', 'Comentario (opcional)': 'Comment (optional)', 'Detalle (opcional)': 'Details (optional)', 'Tu nombre (opcional)': 'Your name (optional)', '¿Qué pasa?': 'What is wrong?', 'Más información (opcional)': 'More information (optional)',
  'Contanos qué está mal; lo revisamos y lo corregimos.': 'Tell us what is wrong; we will check and fix it.', 'Elegí una frase y listo: te abre el mensaje armado para enviar.': 'Pick a phrase and that is it: it opens the ready-made message to send.', '🕒 El horario está mal': '🕒 The opening hours are wrong', '📞 El teléfono o WhatsApp está mal': '📞 The phone or WhatsApp is wrong', '📍 La dirección o el lugar en el mapa está mal': '📍 The address or map location is wrong', '🚫 Cerró o ya no existe': '🚫 It closed or no longer exists', '✏️ Otra cosa': '✏️ Something else',
  'Muy buena atención': 'Great service', 'Rico y bien servido': 'Tasty and generous', 'Buen precio': 'Good price', 'Son muy amables': 'Very friendly', 'Siempre cumplen': 'Always reliable', 'Soy el dueño: actualizar mis datos': 'I am the owner: update my details', 'Sumá o actualizá tu comercio': 'Add or update your business', '🏪 ¿Tenés un comercio? Sumalo o actualizá tus datos': '🏪 Do you run a business? Add it or update your details',
  'Datos de mi comercio': 'My business details', 'Escribí el nombre del comercio.': 'Enter the business name.', 'Escribí qué es y un teléfono de contacto.': 'Enter what it is and a contact phone number.', 'Escribilo como hablás: Lun a Vie 8 a 12 y 16 a 20; Sáb 9 a 13': 'Write it naturally: Mon to Fri 8 to 12 and 16 to 20; Sat 9 to 13', 'Si no sabés, dejá vacío': 'If you do not know, leave it empty', 'Dato de local': 'Business detail',
  // --- accesibilidad / ayuda / instalar ---
  'Accesibilidad': 'Accessibility', '♿ Accesibilidad: letra grande, contraste, modo lista': '♿ Accessibility: large text, contrast, list mode', '🧓 Modo fácil': '🧓 Easy mode', 'Tamaño de la letra': 'Text size', 'Colores': 'Colors', 'Colores más fuertes y bordes marcados, para ver mejor.': 'Stronger colors and clear borders, for easier viewing.',
  'Instalar la guía': 'Install the guide', 'Instalar la guía como app': 'Install the guide as an app', '📲 Instalar ahora': '📲 Install now', 'Con la guía en tu pantalla de inicio se abre más rápido y funciona sin internet (con lo que ya viste).': 'With the guide on your home screen it opens faster and works offline (for what you have already seen).', '¡Ya la tenés instalada! Se abre desde el ícono de tu pantalla de inicio.': 'You already have it installed! Open it from the icon on your home screen.',
  '👋 Ver la guía de bienvenida': '👋 See the welcome tour', 'Créditos': 'Credits', 'Código QR': 'QR code', '▦ Código QR': '▦ QR code', 'Código QR de la guía': 'QR code of the guide', '⬇ Descargar el código': '⬇ Download the code', 'Con el celular': 'On a phone', 'En la computadora': 'On a computer', 'Con mouse': 'With a mouse', 'Un dedo': 'One finger', 'Dos dedos': 'Two fingers', 'Arrastrá': 'Drag', 'Rueda': 'Wheel', 'Clic derecho': 'Right click',
  'Arrastrá con el dedo para mirar alrededor.': 'Drag with your finger to look around.', 'Arrastrá para moverte · rueda o pellizco para acercar · clic derecho o ⌥ + arrastrar para girar': 'Drag to move · wheel or pinch to zoom · right-click or ⌥ + drag to rotate', 'Arrastrá para moverte · rueda o pellizco para acercar · tocá un punto para ver el lugar': 'Drag to move · wheel or pinch to zoom · tap a point to see the place',
  'Tocá acá para esconder o mostrar la guía y ver el mapa completo.': 'Tap here to hide or show the guide and see the full map.', 'Cerrar la guía y ver el mapa': 'Close the guide and see the map', 'Cerrar y ver el mapa': 'Close and see the map', 'Cerrar este aviso': 'Dismiss this notice', 'Maqueta estilizada: las alturas están exageradas.': 'Stylized model: heights are exaggerated.',
  'Casas de las calles sin datos: generadas por la guía de forma aproximada; no son las construcciones reales.': 'Houses on streets without data: generated approximately by the guide; they are not the real buildings.', 'Imagen satelital de los alrededores:': 'Satellite imagery of the surroundings:', 'Mapa: © colaboradores de': 'Map: © contributors to', 'Contenido de ejemplo': 'Sample content',
  'Barrios': 'Neighborhoods', 'Calles': 'Streets', 'Calles y direcciones': 'Streets and addresses', 'Mostrar cómo se dividen los barrios': 'Show how the neighborhoods are divided', 'Mostrar u ocultar los nombres de calles y arroyos': 'Show or hide street and creek names', 'Norte': 'North', 'Orientar el mapa al norte': 'Point the map north', 'Acercar': 'Zoom in', 'Alejar': 'Zoom out', 'Acercar (tecla +)': 'Zoom in (+ key)', 'Alejar (tecla −)': 'Zoom out (− key)', 'Acercar o alejar el mapa': 'Zoom the map in or out', 'Secciones': 'Sections', 'Atajos de capas': 'Layer shortcuts', 'Clima y hora del día': 'Weather and time of day',
  'Guía de Capitán Sarmiento': 'Capitán Sarmiento guide', 'Tocá para cargar': 'Tap to load', 'No pude cargar la foto 360°. Revisá tu conexión e intentá de nuevo.': 'I could not load the 360° photo. Check your connection and try again.', 'Aviso importante': 'Important notice',
  // --- otros modales ---
  'Podés seguir viendo lugares, recorridos y teléfonos útiles. El clima y lo nuevo se actualizan cuando vuelva la señal.': 'You can keep browsing places, tours and useful phone numbers. Weather and news update when the signal returns.', 'Sin internet.': 'No internet.',
  'Buscando dónde estás…': 'Finding where you are…', 'Estoy llegando': 'I am arriving', 'Abierto ahora ': 'Open now ', 'Ver eventos': 'See events', '📅 Calendario': '📅 Calendar', '📅 Google Calendar': '📅 Google Calendar', '⬇ Agregar al calendario (.ics)': '⬇ Add to calendar (.ics)', 'Es hoy': 'Today', 'Es mañana': 'Tomorrow', 'En curso': 'Happening now', 'Ya pasó': 'Past',
  'Línea del tiempo': 'Timeline', '📷 Mandá tu foto o dato': '📷 Send your photo or fact', 'Todavía no hay hechos cargados. Si tenés fotos viejas o datos del pueblo, mandalos y los sumamos.': 'No facts loaded yet. If you have old photos or facts about the town, send them and we will add them.',
  'Oficios y servicios': 'Trades & services', 'Buscar (plomero, remís…)': 'Search (plumber, taxi…)', 'Tocá para llamar o escribir. Cada persona aceptó que su número se publique.': 'Tap to call or message. Each person agreed to have their number published.',
  'Estacionamiento y baños públicos': 'Parking and public restrooms', '🅿️ Estacionamiento': '🅿️ Parking', '🚻 Baños públicos': '🚻 Public restrooms', 'Todavía no hay cargados.': 'None loaded yet.', 'Ordenados desde donde estás (si diste permiso de ubicación) o desde el centro.': 'Sorted from where you are (if you allowed location) or from the center.',
  'Todavía no hay guías de turismo cargados. Cuando los haya, van a aparecer acá para que los contactes (se publican solo con el consentimiento de cada guía).': 'No tour guides are listed yet. When there are, they will appear here for you to contact (listed only with each guide’s consent).', ', los guías de turismo del pueblo para contactar.': ', the town’s tour guides you can contact.',
  'Mientras tanto, para pedir información:': 'Meanwhile, to ask for information:', 'Obras': 'Roadworks', 'Ruta 8 con desvío': 'Route 8 with a detour', 'Son sugerencias': 'These are suggestions',
  'Sentinel-2 cloudless': 'Sentinel-2 cloudless', '(licencia ODbL).': '(ODbL license).', '· idea personal, sin fines de lucro ·': '· a personal, non-profit idea ·', 'Motor 3D:': '3D engine:', '(MIT). Tipografías: Fraunces e Inter (SIL OFL).': '(MIT). Fonts: Fraunces and Inter (SIL OFL).', '(CC BY 4.0). Día y noche calculados con la posición real del sol.': '(CC BY 4.0). Day and night calculated from the real position of the sun.',
  'Los lugares, recorridos y el mapa que ves son de demostración. Reemplazá los archivos de la carpeta': 'The places, tours and map you see are demo content. Replace the files in the folder', 'por los reales.': 'with the real ones.', 'hay recorridos armados, parada por parada, y en': 'there are ready-made tours, stop by stop, and in', 'Tocá un pin para ver el lugar. En': 'Tap a pin to see the place. In',
  'Los teléfonos que faltan se cargan en fuentes/datos-lugares.txt.': 'Missing phone numbers are loaded in fuentes/datos-lugares.txt.',
  // --- kinds ---
  'Restaurante': 'Restaurant', 'Parrilla': 'Steakhouse', 'Pizzería': 'Pizzeria', 'Café': 'Café', 'Bar': 'Bar', 'Comida al paso': 'Fast food', 'Heladería': 'Ice cream shop', 'Panadería': 'Bakery', 'Carnicería': 'Butcher', 'Verdulería': 'Greengrocer', 'Hotel': 'Hotel', 'Hospedaje': 'Lodging', 'Camping': 'Campsite', 'Iglesia': 'Church', 'Museo': 'Museum', 'Cultura': 'Culture', 'Biblioteca': 'Library', 'Plaza': 'Square',
  'Monumento': 'Monument', 'Estación de tren': 'Train station', 'Mirador': 'Viewpoint', 'Atractivo': 'Attraction', 'Club': 'Club', 'Gimnasio': 'Gym', 'Cine': 'Cinema', 'Tanque de agua': 'Water tower', 'Silos': 'Silos', 'Estancia': 'Ranch', 'Aeródromo': 'Airfield', 'Estacionamiento': 'Parking', 'Baño público': 'Public restroom', 'Ferretería': 'Hardware store', 'Supermercado': 'Supermarket', 'Almacén': 'Grocery store', 'Kiosco': 'Kiosk',
  'Ropa y calzado': 'Clothing & shoes', 'Librería': 'Bookstore', 'Juguetería': 'Toy store', 'Mueblería': 'Furniture store', 'Electro y tecnología': 'Electronics', 'Celulares': 'Mobile phones', 'Pinturería': 'Paint store', 'Materiales de construcción': 'Building materials', 'Agro y veterinaria': 'Farm supplies & vet', 'Florería y vivero': 'Florist & nursery', 'Regalería': 'Gift shop', 'Óptica': 'Optician', 'Joyería': 'Jewelry', 'Mascotas': 'Pets', 'Perfumería': 'Perfume shop', 'Bebidas': 'Drinks', 'Comercio': 'Shop',
  'Hospital': 'Hospital', 'Clínica / consultorio': 'Clinic', 'Farmacia': 'Pharmacy', 'Odontología': 'Dentist', 'Veterinaria': 'Veterinarian', 'Puente': 'Bridge', 'Lugar de pesca': 'Fishing spot', 'Municipalidad': 'Town hall', 'Policía': 'Police', 'Bomberos': 'Fire department', 'Banco': 'Bank', 'Banco Nación': 'Banco Nación', 'Cajero automático': 'ATM', 'Correo': 'Post office', 'Estación de servicio': 'Gas station', 'Escuela': 'School', 'Jardín de infantes': 'Kindergarten',
  'Taller y gomería': 'Garage & tire shop', 'Lavadero': 'Car wash', 'Peluquería y estética': 'Hair & beauty', 'Inmobiliaria': 'Real estate', 'Seguros': 'Insurance', 'Estudio / oficina': 'Office', 'Cooperativa': 'Cooperative', 'Terminal de ómnibus': 'Bus terminal', 'Taxi / remís': 'Taxi', 'Turismo': 'Tourism', 'Servicio': 'Service',
  // --- capas ---
  'Salud': 'Health', 'Emergencias y seguridad': 'Emergency & safety', 'Gobierno y servicios públicos': 'Government & public services', 'Transporte': 'Transport', 'Educación': 'Education', 'Supermercados y comercios': 'Supermarkets & shops', 'Ferreterías, construcción y hogar': 'Hardware, building & home', 'Gastronomía y cafeterías': 'Food & cafés', 'Farmacias y otros prestadores': 'Pharmacies & other providers', 'Clubes, deportes y gimnasios': 'Clubs, sports & gyms',
  'Cultura, patrimonio y culto': 'Culture, heritage & worship', 'Turismo, alojamiento y recreación': 'Tourism, lodging & recreation', 'Puentes, pesca y agua': 'Bridges, fishing & water', 'Rural, estancias y naturaleza': 'Rural, ranches & nature', 'Otros servicios y profesionales': 'Other services & professionals',
  // --- horarios ---
  'Modo manos libres activado.': 'Hands-free mode on.', 'Esa era la última parada. Decí «parar» para terminar o «repetir» para escucharla otra vez.': 'That was the last stop. Say “stop” to finish or “repeat” to hear it again.', 'Estás en la primera parada.': 'You are at the first stop.', 'Estás en la parada': 'You are at stop',
  'Las 24 horas, todos los días': 'Open 24 hours, every day', 'Todos los días': 'Every day', 'Cerrado': 'Closed',
};
const DIAS = { Lun: 'Mon', Mar: 'Tue', 'Mié': 'Wed', Jue: 'Thu', Vie: 'Fri', 'Sáb': 'Sat', Dom: 'Sun', lunes: 'Monday', martes: 'Tuesday', 'miércoles': 'Wednesday', jueves: 'Thursday', viernes: 'Friday', 'sábado': 'Saturday', domingo: 'Sunday', Lunes: 'Monday', Martes: 'Tuesday', 'Miércoles': 'Wednesday', Jueves: 'Thursday', Viernes: 'Friday', 'Sábado': 'Saturday', Domingo: 'Sunday', lun: 'Mon', mar: 'Tue', 'mié': 'Wed', jue: 'Thu', vie: 'Fri', 'sáb': 'Sat', dom: 'Sun' };
const MESES = { enero: 'January', febrero: 'February', marzo: 'March', abril: 'April', mayo: 'May', junio: 'June', julio: 'July', agosto: 'August', septiembre: 'September', octubre: 'October', noviembre: 'November', diciembre: 'December' };
const RUMBOS = { norte: 'north', noreste: 'northeast', este: 'east', sureste: 'southeast', sur: 'south', suroeste: 'southwest', oeste: 'west', noroeste: 'northwest' };
const UV = { extremo: 'extreme', 'muy alto': 'very high', alto: 'high', moderado: 'moderate', bajo: 'low' };
const NIVEL = { amarilla: 'Yellow', naranja: 'Orange', roja: 'Red' };
const QUE = { lluvia: 'rain', tormenta: 'thunderstorms', 'viento fuerte': 'strong wind', calor: 'heat', helada: 'frost' };
const CUANDO = { hoy: 'today', 'mañana': 'tomorrow', 'esta noche': 'tonight' };
const w = (x) => { const c = String(x).charAt(0).toUpperCase() + String(x).slice(1); const r = D[c]; return r ? r.toLowerCase() : x; };
const dec = (s) => String(s).replace(',', '.');

/** Reglas para textos con números o nombres: [regex de texto completo, función]. */
const R = [
  [/^Ahora hay (-?\d+) grados, (.+)\.$/, (m) => `It is ${m[1]} degrees, ${w(m[2])}.`], [/^Sensación térmica de (-?\d+)\.$/, (m) => `It feels like ${m[1]}.`],
  [/^Viento de (\d+) kilómetros por hora del (\w+)\.$/, (m) => `Wind of ${m[1]} kilometers per hour from the ${RUMBOS[m[2]] || m[2]}.`],
  [/^Hoy: máxima de (-?\d+) y mínima de (-?\d+), con (\d+) por ciento de probabilidad de lluvia\.$/, (m) => `Today: high of ${m[1]} and low of ${m[2]}, with a ${m[3]} percent chance of rain.`],
  [/^Mañana: (.+), entre (-?\d+) y (-?\d+) grados(?:, con (\d+) por ciento de lluvia)?\.$/, (m) => `Tomorrow: ${w(m[1])}, between ${m[2]} and ${m[3]} degrees${m[4] ? `, with a ${m[4]} percent chance of rain` : ''}.`],
  [/^El sol sale a las (\S+) y se pone a las (\S+)\.$/, (m) => `The sun rises at ${m[1]} and sets at ${m[2]}.`],
  [/^Hoy hay (\d+)% de probabilidad de lluvia\.$/, (m) => `Today there is a ${m[1]}% chance of rain.`], [/^Hoy hay (\d+)% de probabilidad de lluvia\. (.+)$/, (m) => `Today there is a ${m[1]}% chance of rain. ${tr(m[2])}`], [/^Llevá paraguas; buen día para el museo, la biblioteca o un café\.$/, () => 'Bring an umbrella; a good day for the museum, the library or a café.'],
  [/^Máxima de (-?\d+) °C\. Tomá agua, usá protector y buscá la sombra o un helado\.$/, (m) => `High of ${m[1]} °C. Drink water, wear sunscreen and look for shade or an ice cream.`], [/^Día frío \(máxima (-?\d+) °C\)\. Abrigate bien; ideal un café o un paseo corto\.$/, (m) => `Cold day (high of ${m[1]} °C). Dress warmly; a coffee or a short walk is ideal.`],
  [/^Ráfagas de hasta (\d+) km\/h\. Cuidado con los objetos sueltos y en la ruta\.$/, (m) => `Gusts up to ${m[1]} km/h. Watch out for loose objects and on the road.`], [/^Día lindo, pero con UV (.+): protector y gorra al mediodía\.$/, (m) => `Nice day, but with ${UV[m[1]] || m[1]} UV: sunscreen and a hat at midday.`],
  [/^Alerta (amarilla|naranja|roja) por (lluvia|tormenta|viento fuerte|calor|helada) (hoy|mañana|esta noche) cerca de las (\d{1,2}:\d{2}) hs, con (.+)\.$/, (m) => `${NIVEL[m[1]]} alert for ${QUE[m[2]]} ${CUANDO[m[3]]} around ${m[4]}, ${m[5].replace(/^con (\d+)% de probabilidad$/, '$1% chance').replace(/^con ráfagas de (\d+) km\/h$/, 'with gusts of $1 km/h').replace(/^con (-?\d+) °C$/, 'at $1 °C').replace(/^(\d+)% de probabilidad$/, '$1% chance')}.`],
  [/^Alerta (amarilla|naranja|roja) por (lluvia|tormenta|viento fuerte|calor|helada) (hoy|mañana|esta noche) cerca de las (\d{1,2}:\d{2}) hs, con (\d+)% de probabilidad\.$/, (m) => `${NIVEL[m[1]]} alert for ${QUE[m[2]]} ${CUANDO[m[3]]} around ${m[4]}, ${m[5]}% chance.`],
  [/^Alerta (amarilla|naranja|roja) por (lluvia|tormenta|viento fuerte|calor|helada) (hoy|mañana|esta noche) cerca de las (\d{1,2}:\d{2}) hs, con ráfagas de (\d+) km\/h\.$/, (m) => `${NIVEL[m[1]]} alert for ${QUE[m[2]]} ${CUANDO[m[3]]} around ${m[4]}, with gusts of ${m[5]} km/h.`],
  [/^Alerta (amarilla|naranja|roja) por (lluvia|tormenta|viento fuerte|calor|helada) (hoy|mañana|esta noche) cerca de las (\d{1,2}:\d{2}) hs, con (-?\d+) °C\.$/, (m) => `${NIVEL[m[1]]} alert for ${QUE[m[2]]} ${CUANDO[m[3]]} around ${m[4]}, at ${m[5]} °C.`],
  [/^Faltan (\d+) días$/, (m) => `${m[1]} days to go`], [/^Empieza en (\d+) min$/, (m) => `Starts in ${m[1]} min`], [/^Hoy, faltan (\d+) h$/, (m) => `Today, in ${m[1]} h`],
  [/^Cierra pronto: a las (\d{1,2}:\d{2})$/, (m) => `Closing soon: at ${m[1]}`], [/^Cierra a las (\d{1,2}:\d{2})$/, (m) => `Closes at ${m[1]}`], [/^Cierra (mañana|el \w+) a las (\d{1,2}:\d{2})$/, (m) => `Closes ${m[1] === 'mañana' ? 'tomorrow' : 'on ' + DIAS[m[1].slice(3)]} at ${m[2]}`],
  [/^Abre (hoy|mañana|el \w+) a las (\d{1,2}:\d{2})$/, (m) => `Opens ${m[1] === 'hoy' ? 'today' : m[1] === 'mañana' ? 'tomorrow' : 'on ' + DIAS[m[1].slice(3)]} at ${m[2]}`], [/^hasta las (\d{1,2}:\d{2})$/, (m) => `until ${m[1]}`],
  [/^a (\d+) m$/, (m) => `${m[1]} m away`], [/^a ([\d,]+) km$/, (m) => `${dec(m[1])} km away`],
  [/^(\d+) lugares?$/, (m) => `${m[1]} place${m[1] === '1' ? '' : 's'}`], [/^(\d+) paradas$/, (m) => `${m[1]} stops`], [/^(\d+) en el mapa$/, (m) => `${m[1]} on the map`],
  [/^Parada (\d+) de (\d+)\.?(.*)$/, (m) => `Stop ${m[1]} of ${m[2]}.${m[3]}`], [/^Parada (\d+) de (\d+)$/, (m) => `Stop ${m[1]} of ${m[2]}`],
  [/^(.+?) · sensación (-?\d+)°$/, (m) => `${tr(m[1])} · feels like ${m[2]}°`], [/^(.+?) y sensación (-?\d+)°$/, (m) => `${tr(m[1])} · feels like ${m[2]}°`], [/^Día lindo para salir: (\d+)° a (\d+)°\.$/, (m) => `Nice day to go out: ${m[1]}° to ${m[2]}°.`],
  [/^💨 (\d+) km\/h del (\w+) · 💧 (\d+)% · 🌅 (\S+) · 🌇 (\S+) · UV (\d+) \((.+)\)$/, (m) => `💨 ${m[1]} km/h from the ${RUMBOS[m[2]] || m[2]} · 💧 ${m[3]}% · 🌅 ${m[4]} · 🌇 ${m[5]} · UV ${m[6]} (${UV[m[7]] || m[7]})`],
  [/^Farmacia de turno: (.+)$/, (m) => `On-duty pharmacy: ${m[1]}`], [/^Zona: (.+)$/, (m) => `Area: ${m[1]}`], [/^Dirección: (.+)$/, (m) => `Address: ${m[1]}`], [/^Hace (\d+) días$/i, (m) => `${m[1]} days ago`], [/^hace (\d+) días$/, (m) => `${m[1]} days ago`],
  [/^No encontré «(.+)»\. Probá con otra palabra.*$/, (m) => `I found nothing for “${m[1]}”. Try another word: “pharmacy”, “pizza”, a street name (“Mármol”), an address (“Mármol 536”) or a corner (“Mármol y Planes”).`],
  [/^Encontré (\d+) (lugares?): (.+)$/, (m) => `I found ${m[1]} place${m[1] === '1' ? '' : 's'}: ${m[3]}`], [/^Escuché: «(.+)»$/, (m) => `I heard: “${m[1]}”`],
  [/^Probá con (.+)$/, (m) => `Try ${m[1]}`], [/^Ya casi llegás \((.+)\)$/, (m) => `Almost there (${tr(m[1])})`], [/^Estás a (.+) del pueblo$/, (m) => `You are ${tr(m[1])} from town`],
  [/^(\d+) días$/, (m) => `${m[1]} days`], [/^Todos los días (\d.+)$/, (m) => `Every day ${m[1].replace(/ a /g, ' to ')}`],
  [/^(Posibles tormentas|Lluvias fuertes|Lluvias importantes|Ráfagas muy fuertes|Viento fuerte|Calor extremo|Helada|Niebla) (hoy|mañana|el \w+)$/, (m) => `${{ 'Posibles tormentas': 'Possible thunderstorms', 'Lluvias fuertes': 'Heavy rain', 'Lluvias importantes': 'Significant rain', 'Ráfagas muy fuertes': 'Very strong gusts', 'Viento fuerte': 'Strong wind', 'Calor extremo': 'Extreme heat', Helada: 'Frost', Niebla: 'Fog' }[m[1]]} ${m[2] === 'hoy' ? 'today' : m[2] === 'mañana' ? 'tomorrow' : 'on ' + DIAS[m[2].slice(3)]}`],
];
function conFecha(s) {
  // «Miércoles, 25 de noviembre» → «Wednesday, 25 November»; «hasta el 25/11» → «until 25/11»
  let t = s.replace(/\b(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo|lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/g, (d) => DIAS[d]);
  t = t.replace(/(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/g, (_, d, m) => `${d} ${MESES[m]}`);
  t = t.replace(/\bhasta el (\d)/g, 'until $1').replace(/ h · /g, ' · ').replace(/\bdel (\d)/g, 'from $1');
  return t;
}
function horario(s) {
  // «Lun a Vie 08:00 a 12:00 y 16:00 a 20:00 · Sáb 09:00 a 13:00»
  if (!/^(?:(?:Lun|Mar|Mié|Jue|Vie|Sáb|Dom)(?![a-záéíóúñ])|Todos|Cerrado|Las 24)/.test(s)) return null;
  return s.replace(/(?<![a-záéíóúñ])(Lun|Mar|Mié|Jue|Vie|Sáb|Dom)(?![a-záéíóúñ])/g, (d) => DIAS[d]).replace(/ a /g, ' to ').replace(/ y /g, ' and ').replace(/cerrado/gi, 'closed').replace(/Todos los días/g, 'Every day');
}

/** Traduce un texto (cuando el idioma es inglés). Devuelve el mismo texto si no sabe. */
export function tr(texto) {
  const s = String(texto);
  const t = s.trim();
  if (!t) return s;
  const lead = s.slice(0, s.indexOf(t)), trail = s.slice(s.indexOf(t) + t.length);
  let out = D[t];
  if (out == null) for (const [re, f] of R) { const m = t.match(re); if (m) { out = f(m); break; } }
  if (out == null && /\d+ de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)|^(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)/.test(t)) out = conFecha(t);
  if (out == null) out = horario(t);
  return out == null ? s : lead + out + trail;
}
export const traducir = (t) => (lang === 'en' ? tr(t) : String(t));

/** Búsqueda en inglés → palabras en español (para encontrar lugares escribiendo o hablando en inglés). */
const BUSQUEDA = [
  [/\bice[- ]?cream\b/g, 'heladeria'], [/\bpharmacy|drugstore|chemist\b/g, 'farmacia'], [/\bon[- ]duty|late[- ]night\b/g, 'turno'], [/\brestaurants?\b/g, 'restaurante'], [/\bsteak(house)?|grill|barbecue|bbq\b/g, 'parrilla'], [/\bbakery|bread\b/g, 'panaderia'], [/\bsupermarket|grocer(y|ies)\b/g, 'supermercado'],
  [/\bcoffee|cafe|café\b/g, 'cafe'], [/\bhotels?|lodging|accommodation|where to sleep\b/g, 'hotel'], [/\bbanks?\b/g, 'banco'], [/\batm|cash machine\b/g, 'cajero'], [/\bhospital|clinic|doctor\b/g, 'hospital'], [/\bpolice\b/g, 'policia'], [/\bfire (department|station)\b/g, 'bomberos'],
  [/\bgas station|petrol|fuel\b/g, 'servicio'], [/\bchurch\b/g, 'iglesia'], [/\bmuseum\b/g, 'museo'], [/\bsquare|plaza|park\b/g, 'plaza'], [/\bparking|car park\b/g, 'estacionamiento'], [/\b(public )?(toilets?|restrooms?|bathrooms?|wc)\b/g, 'bano'], [/\bbridge\b/g, 'puente'], [/\bfishing\b/g, 'pesca'],
  [/\bcamp(ing|site)\b/g, 'camping'], [/\bgym\b/g, 'gimnasio'], [/\bschool\b/g, 'escuela'], [/\bpost office\b/g, 'correo'], [/\bhardware( store)?\b/g, 'ferreteria'], [/\bbutcher\b/g, 'carniceria'], [/\bbar|pub\b/g, 'bar'], [/\btown hall|city hall\b/g, 'municipalidad'], [/\btrain station|railway\b/g, 'estacion'], [/\bbus (station|terminal)\b/g, 'terminal'], [/\bviewpoint\b/g, 'mirador'],
];
export function consultaES(q) {
  if (lang !== 'en') return q;
  let t = String(q).toLowerCase();
  for (const [re, es] of BUSQUEDA) t = t.replace(re, es);
  const relleno = /\b(where|what|whats|is|are|the|a|an|to|find|show|me|i|need|want|looking|for|near|nearby|in|of|any|there|can|get|go|how|do|you|know|please|some|my|at)\b/g;
  const limpio = t.replace(relleno, ' ').replace(/\s+/g, ' ').trim();
  return limpio || t;
}

// ---------- DOM ----------
const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
const orig = new WeakMap();
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE']);
let obs = null;

function nodo(n) {
  if (n.nodeType === 3) {
    const p = n.parentElement;
    if (!p || SKIP.has(p.tagName) || p.closest('[data-no-i18n]')) return;
    const o = orig.has(n) ? orig.get(n) : n.nodeValue;
    const t = tr(o);
    if (t !== n.nodeValue) { if (!orig.has(n)) orig.set(n, o); n.nodeValue = t; }
  } else if (n.nodeType === 1) {
    if (SKIP.has(n.tagName) || n.closest?.('[data-no-i18n]')) return;
    for (const a of ATTRS) {
      const v = n.getAttribute(a);
      if (!v) continue;
      const k = `${a}`;
      const m = orig.get(n) || {};
      const o = m[k] ?? v;
      const t = tr(o);
      if (t !== v) { m[k] = o; orig.set(n, m); n.setAttribute(a, t); }
    }
    for (const c of n.childNodes) nodo(c);
  }
}
export function traducirDOM(root) { if (lang === 'en') nodo(root); }
function restaurar(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3 && orig.has(n)) n.nodeValue = orig.get(n);
    else if (n.nodeType === 1 && orig.has(n)) { const m = orig.get(n); for (const k of Object.keys(m)) n.setAttribute(k, m[k]); }
  }
}
/** Aplica el idioma elegido a toda la página y sigue traduciendo lo que se vaya dibujando. */
export function aplicarIdioma(root = document.body) {
  document.documentElement.lang = lang === 'en' ? 'en' : 'es-AR';
  obs?.disconnect();
  obs = null;
  if (lang === 'en') {
    nodo(root);
    obs = new MutationObserver((muts) => {
      obs.disconnect();
      for (const m of muts) {
        if (m.type === 'characterData') nodo(m.target);
        else if (m.type === 'attributes') nodo(m.target);
        else m.addedNodes.forEach(nodo);
      }
      obs.observe(root, { childList: true, subtree: true, characterData: true });
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true });
  } else restaurar(root);
}
