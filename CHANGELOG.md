# Historial de cambios

## 1.5.1 · 2026-10-30

- **Lugares extra:** nuevo `fuentes/lugares-extra.txt` (una línea por lugar: `Nombre | tipo | link de Google Maps`) y `npm run extras`. Entiende links largos, links cortos (maps.app.goo.gl, necesita internet) y coordenadas «lat, lng». Se corre solo al final de `npm run lugares`. Ya trae 14 lugares de Sarmiento para completar con su link.

## 1.5.0 · 2026-10-29

- **Edificios más detallados (siempre lowpoly):**
  - Las casas chicas y rectangulares tienen techo a dos aguas con frontones; los edificios grandes, techo plano con parapeto, y algunos con tanque de agua.
  - Paleta más variada de paredes y techos (teja, chapa, losa), con pequeñas diferencias de brillo entre casas vecinas.
  - Ventanas, puertas, zócalo, cornisa y postigos: se dibujan solo cuando la cámara está cerca (distancia 420 m; 230 m en gama baja, con menos detalle) para no cargar la página.
  - Los edificios resaltados (escuela, hospital, iglesia…) mantienen su color y techo plano.
- Si la página va lenta, el detalle cercano se reduce solo.

## 1.4.9 · 2026-10-28

- **Más liviana en equipos de gama baja:** el tránsito y los peatones se actualizan menos veces por segundo (30 en gama baja, y menos si la maqueta va lenta); en gama baja arrancan con la mitad de vehículos y peatones, y si aun así va lenta se baja a lo mínimo (sin vehículos y con pocos peatones). Si mirás todo el pueblo de lejos no aparecen vehículos nuevos.
- Los vehículos iniciales se calculan de a uno por cuadro (antes todos juntos) para que el arranque no se trabe.
- La alineación de calles y casas se calcula una sola vez y se guarda en el navegador (la primera visita tarda un poco más; en gama baja usa menos muestras y deja respirar a la pantalla de carga).

## 1.4.8 · 2026-10-27

- **Tránsito vivo:** los vehículos (autos, motos, bicis, camiones y ahora también colectivos) aparecen de a poco cerca de donde mirás, hacen un recorrido por las calles reales (con el mismo buscador de caminos de los recorridos, así no atraviesan casas ni plazas) y desaparecen al llegar a destino. Hay un máximo de cada tipo en pantalla, así la página no se sobrecarga.

## 1.4.7 · 2026-10-27

- **Los zips de actualización ya no incluyen la carpeta `data/`**, para no pisar tus lugares, calles y casas reales con los de ejemplo.
- `npm run mapa` usa ahora las calles de `calles.mjs` (no necesita `npm install`) y, si los datos eran de ejemplo, descarta las casas y lugares inventados antes de sumar los reales.
- `apply-update` pone en `data/meta.json` la versión y fecha del proyecto.

## 1.4.6 · 2026-10-27

- `npm run calles` al final actualiza lugares y recorridos.
- La página, al cargar, detecta si las calles reales están corridas respecto de las casas, prueba corrimientos de hasta 32 m y corre las calles al lugar donde menos casas quedan sobre el asfalto (los pines no se mueven). Lo informa en la consola (F12): «Calles alineadas con las casas».
- Las casas cuyo centro o esquinas caen sobre la calzada ya no se dibujan.
- `npm run check` ya no marca error en los edificios especiales (escuela, policía, bomberos…), y `lugares` descarta lugares fuera del mapa.

## 1.4.4 · 2026-10-26

- **Calles reales:** nuevo `npm run calles` (no necesita `npm install`): baja las calles, vías, agua y verdes reales de OpenStreetMap y reemplaza las de ejemplo sin tocar los edificios; avisa qué porcentaje de casas cae encima de una calle y con `--alinear` las corre si están desplazadas. `apply-update` lo corre solo si detecta calles de ejemplo, y la página avisa en pantalla si siguen siendo de ejemplo.

## 1.4.3 · 2026-10-26

- Los pines se vuelven más livianos: de lejos solo se muestran los lugares importantes (hospital, escuelas, iglesia, hoteles, plazas…), a media distancia solo el punto y de cerca el nombre. Ya no se recalcula cada pin en cada cuadro.
- `npm run guias` ahora exige `--consentimiento` y guarda `consent: true` (antes `npm run check` fallaba con guías cargados por comando).
- `apply-update` baja los lugares solo si todavía no están (primera vez que actualizás desde una versión vieja).
- README con los comandos nuevos (`lugares`, `recorridos`, `guias`).

## 1.4.2 · 2026-10-26

- Los recorridos a pie y en auto ahora siguen las calles reales: se busca el camino más corto sobre la red de calles (autos solo por calles para autos; a pie también por peatonales y veredas) en vez de cruzar manzanas, casas y plazas en línea recta.

## 1.4.1 · 2026-10-26

- Hoteles, hosterías, cabañas, camping, parroquias, clubes, escuelas y otros: además de las etiquetas de OpenStreetMap, ahora se reconocen por el nombre ("Hotel …", "Hostería …", "Club …") aunque estén mal etiquetados.
- `npm run lugares` avisa si una categoría (Dormir, Comer, Compras, Salud) quedó vacía y cómo cargar esos lugares a mano.

## 1.4.0 · 2026-10-26

- Muchos más lugares: `npm run lugares` ahora baja todos los comercios, servicios y atractivos con nombre de OpenStreetMap (ferreterías, supermercados, ropa, farmacias, bancos, talleres, peluquerías, clubes, etc.). Nuevas categorías: Compras y Salud.
- Cada tipo de lugar tiene su propio ícono de Google (Material Symbols): ferretería, farmacia, iglesia, escuela, parrilla, café… Se piden a Google Fonts en una tipografía chica con solo los íconos usados; sin internet se ven los íconos simples de respaldo.
- Pestañas "A pie" y "En auto": recorridos armados automáticamente con los lugares (centro, comer, compras, vuelta al pueblo y servicios útiles) con `npm run recorridos` (se corre solo con `npm run lugares`). Los que escribas a mano se conservan.
- Pestaña "Guías": `npm run guias -- --nombre=... --contacto=...` agrega guías; mientras no haya, muestra la oficina de turismo si existe.
- `npm run lugares -- --agregar` acepta cualquier tipo de lugar (ferreteria, farmacia, club…).

## 1.3.6 · 2026-10-26

- Edificios especiales que quedaban sobre la calle: si OpenStreetMap pone el punto en la vereda o la calle, ahora se usa el edificio real más cercano (hasta 40 m); si no hay ninguno, queda solo el pin, sin modelo (ya no existe el modelo "Escuela" genérico).
- Los elementos de OSM sin nombre ya no crean fichas ni modelos repetidos: el edificio se resalta una sola vez. El pin se acomoda sobre el edificio.

## 1.3.5 · 2026-10-26

- Escuelas, hospital, bomberos, policía, municipalidad, museo, biblioteca y casa de la cultura ya no se dibujan con un modelo inventado: se resaltan los edificios REALES del pueblo (mismo contorno) con techo de color propio, y arriba lleva una marca (bandera de color; cruz roja en el hospital). Solo la iglesia chica se reemplaza por el modelo en cruz.
- Los pines ya no flotan a 16 m: la punta queda sobre el techo del edificio, así no se ven corridos.

## 1.3.4 · 2026-10-26

- Arreglo de edificios especiales (escuelas, hospital…) duplicados o encima de la calle: OpenStreetMap suele marcar el terreno entero, así que ahora `npm run lugares` busca el edificio real que está adentro y usa su tamaño y orientación. Los repetidos (mismo tipo a menos de 30 m) se unen en uno y los modelos tienen un tamaño máximo.

## 1.3.3 · 2026-10-26

- Noches más claras: luz de luna y de cielo más fuertes y más exposición, para que se distingan calles y edificios.
- Cada farol deja un charco de luz cálida sobre la calle, más fuerte cuando está nublado o llueve (ahí manda el alumbrado y no la luna). Los puntos de luz son más grandes.

## 1.3.2 · 2026-10-25

- Paleta nueva "papel y tinta", sacada del escudo de la ciudad: azul profundo, papel crema, ladrillo de las casas, trigo y verde pampa. El panel de lugares pasa a ser de papel crema con encabezado azul (sin vidrio ni degradados), los botones flotantes son azules, los pines y categorías usan colores sobrios (ladrillo, azul laguna, trigo, verde).

## 1.3.1 · 2026-10-25

- Los datos nuevos (`npm run lugares`, `npm run mapa`) ahora se ven enseguida: antes el navegador podía seguir mostrando la lista de lugares vieja (vacía) guardada en caché.
- Calles que se cruzan sin parpadeos de textura; luces de calle sobre la vereda.

## 1.3.0 · 2026-10-25

- Calles de cemento con losas y juntas, veredas, línea central (amarilla doble en avenidas, blanca cortada en calles), líneas de borde y sendas peatonales en los cruces. Se ven nítidas de cerca y mojadas cuando llueve.
- Tránsito: autos, camiones, motos y bicis circulan por las calles por la mano derecha y siguen por la calle que se junta al final del tramo.
- Avenidas con cantero central: se detectan solas (dos calzadas con el mismo nombre en sentido opuesto) y se dibuja el cantero con cordón, pasto, árboles y estatuas. Los árboles de vereda ya no caen en medio de la calle y las luces de calle quedan sobre la vereda.
- Edificios especiales con forma propia vista desde arriba: iglesia en cruz con torre, municipalidad con torre de reloj, casa de la cultura con cúpula, museo con columnata, biblioteca, escuela en U, hospital con cruz roja, bomberos, policía, estación y monumentos. Cada uno tiene una base de color y reemplaza al edificio común que estaba ahí.
- Nuevo `npm run lugares`: baja de OpenStreetMap los lugares (pines) y los edificios especiales y los deja en data/places.json y data/landmarks.json. `npm run lugares -- --agregar ...` suma uno a mano. `npm run mapa` ahora también lo ejecuta.

## 1.2.0 · 2026-10-25

- Ciclo día/noche con la posición real del sol en Capitán Sarmiento: amanecer, atardecer, noche con estrellas, luces de calles y de casas.
- Clima en vivo (Open-Meteo): nublado, lluvia, tormenta con relámpagos, niebla y nieve; suelo mojado y sombras de nubes. Botón con el clima y la temperatura; al tocarlo se ve el pueblo a otras horas. Pruebas con ?hora= y ?clima=.
- Calidad liviana por defecto; la alta solo en PC con placa de video potente.

## 1.1.4 · 2026-10-24

- Logo de carga con otro nombre de archivo (logo-sarmiento.webp) para que ningún navegador muestre la versión vieja con fondo blanco; el service worker ahora descarga sus archivos salteando la caché del navegador.
- Más fluido en PC de pocos recursos: detecta placas de video integradas viejas y arranca en modo liviano; las sombras ya no se redibujan en cada cuadro; la calidad automática baja hasta 6 escalones (sombras, resolución) y reacciona más rápido.
- `?calidad=baja` fuerza el modo liviano y `?calidad=alta` lo desactiva (se agrega al final de la dirección del sitio).

## 1.1.3 · 2026-10-24

- Nuevo `npm run mapa`: baja las calles reales y suma los edificios en un solo paso.
- `apply-update` avisa si la carpeta data/ tiene las calles de ejemplo en vez de las reales.

## 1.1.2 · 2026-10-24

- Pantalla de carga: el logo ya no tiene fondo blanco (transparente), empieza en la punta verde de la derecha y termina en la cabeza del caballo.

## 1.1.1 · 2026-10-24

- Arranque más rápido: los datos se bajan en paralelo con three.js, precarga de módulos, tipografías sin bloquear y logo en WebP (13 KB en vez de 130 KB).
- Edificios más livianos: se arman sin la tapa de abajo y agrupados en celdas de 400 m, así la cámara y las sombras descartan lo que no se ve; se construyen en tandas para que la carga siga animada.
- Calidad automática: si la maqueta va lenta, baja de a un escalón (desenfoque, resolución, brillo) en vez de trabarse.
- Service worker revisado: se registra con la maqueta ya dibujada (sin competir por la red durante el arranque) y guarda la guía para próximas visitas y uso sin conexión.
- Equipos lentos: sin desenfoque de fondo en los paneles.

## 1.1.0 · 2026-10-24

- Pantalla de carga con el logo de la ciudad que se colorea en círculo mientras carga.
- Edificios reales de Capitán Sarmiento (Google Open Buildings vía Overture Maps).
- `npm run serve` ahora usa Node (antes pedía `python3`, que no existe en Windows).
- Nuevos `npm run fill` (casas aproximadas) y `npm run buildings` (importar huellas reales).
- Íconos de la app e imagen para compartir con el logo.

## 1.0.1 · 2026-10-24

- `npm run serve` ahora usa Node (antes pedía `python3`, que en Windows no existe).
- Nuevo `npm run fill`: casas aproximadas a lo largo de las calles cuando OpenStreetMap casi no tiene edificios.
- Nuevo `npm run buildings`: importa huellas reales (Overture, Microsoft, Google) con su atribución.
- `npm run osm` avisa si hay pocos edificios y sugiere el centro real (`--auto-center`).
- Los créditos mencionan las casas aproximadas y las fuentes importadas.

## 1.0.0 · 2026-10-22

- Primera versión: maqueta 3D (Three.js 0.164.1) con pueblo de demostración.
- Pestañas Lugares / A pie / En auto / Guías, fichas con "Cómo llegar" y reseñas, recorridos paso a paso.
- Hitos y casonas procedurales, peatones, pájaros, perro, caballos y un auto de ejemplo.
- PWA con service worker, íconos e imagen para compartir.
- Herramientas: descarga del mapa real de OpenStreetMap, validación, versionado y URL del sitio.
