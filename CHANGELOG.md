# Historial de cambios

## 1.33.1 · 2026-11-26

- Se sacó el cartel «+N sin ubicar» de las capas: el público no tiene por qué verlo. Lo pendiente se sigue viendo con `npm run salud` y en `localhost:8080/ubicar`.

## 1.33.0 · 2026-11-26

- **Edificios importantes siempre sobre su edificio:** al abrir la guía, cada iglesia, municipalidad, museo, escuela, etc. se calza solo sobre el edificio real que tiene debajo (o a menos de 25 m), con su forma, tamaño, giro y frente a la calle. Si no hay ningún edificio, se arma el edificio completo en ese punto, así ya no quedan fachadas ni torres flotando. Sirve también para los que moviste con `/reubicar`.
- **Paleta propia, sacada del logo del caballo:** rojo, naranja, amarillo, verde, azul y violeta de las facetas del logo, sobre neutros cálidos (papel crema de día, ciruela oscuro de noche) en vez del azul marino. Franja de seis colores bajo el encabezado, rubros con los colores del logo (Comer naranja, Dormir azul, Qué ver amarillo, Compras violeta, Salud rojo, Servicios verde) y botones principales azules.

## 1.32.1 · 2026-11-26

- **Arreglo:** al mover con `/reubicar` un lugar que tiene edificio importante (iglesia, municipalidad, museo…), el modelo quedaba flotando en el punto y el edificio real seguía resaltado donde estaba. Ahora el modelo se vuelve a calzar solo sobre el edificio real que hay en el nuevo lugar (toma su forma, tamaño, giro y frente hacia la calle) y el edificio anterior deja de estar resaltado. También se corrige solo en lo que ya habías movido: corré `npm run reubicar`.

## 1.32.0 · 2026-11-26

- **📍 `/reubicar`:** página (con `npm run serve`, en `localhost:8080/reubicar`) con mapa satelital donde arrastrás los lugares mal ubicados hasta su lugar real o los eliminás. Se guarda en `fuentes/reubicados.txt` y `fuentes/eliminados.txt` y se vuelve a aplicar solo cada vez que corrés `npm run lugares` (también existe `npm run reubicar`).
- **📥 `/revisar`:** pegás el mensaje de WhatsApp que te llegó (opinión, perdido, cambio de datos o error), te muestra qué dice y si está bien armado, y con «Aprobar» lo guarda en el archivo que corresponde y actualiza los datos.
- **🛣️ Caminos rurales:** estado de cada camino (transitable, con barro, cortado), con fecha y aviso si el dato es viejo. `fuentes/caminos.txt` + `npm run rural`.
- **📅 Actividades de todas las semanas:** «Hoy hay…» en la pestaña Hoy y vista de la semana. `fuentes/semanal.txt` + `npm run rural`.
- **🎣 Pesca del día:** presión, viento, lluvia y fase de la luna (Open-Meteo), con una opinión orientativa y los puentes y lugares de pesca más cercanos.
- **🏠 Techos con el color real:** `npm run colores` mira la imagen satelital de cada edificio y guarda el color de su techo; la guía 3D lo usa. Se respetan los colores de OpenStreetMap y se pueden fijar a mano (iglesia, municipalidad…) en `fuentes/colores-manual.txt`. Hace falta correr `npm install` una vez.
- Arreglo: el modo quiosco abría en «Lugares» en vez de «Hoy».

## 1.31.0 · 2026-11-25

- **🅿️ Estacionamiento y 🚻 baños públicos:** tipos nuevos de lugar, con ícono y capa propia en el mapa («Estacionamiento y baños públicos»). Un botón en «Hoy» (aparece cuando hay alguno cargado) los muestra ordenados desde donde estás. También se encuentran con el buscador y por voz («dónde hay un baño», «dónde estaciono»). Se cargan en `fuentes/lugares-extra.txt` con tipo `estacionamiento` o `bano`; los que estén en OpenStreetMap con nombre entran solos.
- **🌐 Versión en inglés:** botón «English» arriba del panel (y «Español» para volver). Traduce pestañas, botones, formularios, clima, alertas, horarios, fechas, cuenta regresiva, tipos de lugar y capas. La búsqueda y la voz entienden inglés («pharmacy», «ice cream», «where is the toilet», «weather»), la guía lee en voz alta en inglés y, si el navegador está en inglés, ofrece cambiar al abrirla. Los textos propios de cada comercio (descripciones, nombres) quedan en español.

## 1.30.0 · 2026-11-25

- **Aviso «Sin internet»:** un cartel dice qué sigue funcionando (lugares, recorridos, teléfonos) y se va solo al volver la señal.
- **Recordatorio de eventos:** si hay un evento hoy o mañana, aparece un cartel una sola vez con botón para agregarlo al calendario.
- **🔥 Lo más visto** en la pestaña «Hoy»: `npm run estadisticas -- --token=…` ahora también actualiza esa lista con los lugares más abiertos.
- **`npm run salud`:** informe de qué tan completa está la guía (horarios, contactos, direcciones, mapa, recorridos, farmacia de turno) y qué cargar primero.
- **Prueba automática en GitHub** (`prueba.yml`): abre la guía publicada en un navegador de verdad, busca, mira las pestañas, detecta errores y revisa accesibilidad con axe-core. Si falla, abre un aviso en tu repositorio.

## 1.29.0 · 2026-11-25

- **Plan del día según el clima:** el botón «Planes para hoy» ahora arma mañana, mediodía, tarde y cierre con lugares reales (café, almuerzo, paseo o museo, merienda) según llueva, haga calor, frío o esté lindo. Se puede imprimir.
- **🛠️ Oficios y servicios** (plomero, electricista, remís…): se cargan en `fuentes/oficios.txt` con `npm run oficios`, con buscador y botones de llamar y WhatsApp. El botón aparece solo cuando hay oficios cargados.
- **🙏 Dar las gracias:** en cada lugar, un toque en una frase («Muy buena atención», «Buen precio»…) arma una opinión de 5 estrellas lista para enviar.
- **🧓 Modo fácil:** letra muy grande, botones grandes y menos botones secundarios. Se activa en Accesibilidad o con un link `…/guia-sarmiento/?facil=1` (útil para mandarle a un familiar).
- **🖨 Imprimir** recorridos, planes y fin de semana en una hoja limpia, sin mapa ni botones.
- **Extras:** datos estructurados para buscadores (JSON-LD) y precarga del servicio del clima.

## 1.28.0 · 2026-11-25

- **Aviso de lluvia en los recorridos:** si va a llover en las próximas horas, el recorrido muestra un cartel con un lugar techado cerca de la parada, y el modo manos libres lo dice en voz alta (una sola vez).
- **📍 Estoy llegando** (pestaña «Hoy»): según qué tan lejos estás del pueblo te da la bienvenida, el clima, qué está abierto y un recorrido para empezar. Si ya diste permiso de ubicación y venís en camino, se abre sola una vez por día.
- **Eventos con cuenta regresiva** («Faltan 3 días», «Empieza en 40 min») y botones para agregarlos a Google Calendar o bajarlos como archivo .ics.
- **📜 Línea del tiempo del pueblo** con fotos viejas: se carga en `fuentes/historia.txt` (fotos en `fuentes/historia/`) con `npm run historia`. Incluye botón para que los vecinos manden fotos o datos por WhatsApp.
- **⚠️ Reportar un error** en cada lugar (horario, teléfono, dirección, cerró u otra cosa): llega por WhatsApp con una línea «ERROR: …».
- **Estadísticas:** `npm run estadisticas -- --token=TOKEN` muestra los lugares, recorridos y pestañas más vistos (GoatCounter).
- **Modo quiosco** (`…/guia-sarmiento/?quiosco=1`): pantalla completa con letra grande, vuelve sola al inicio a los 90 segundos sin tocar y no deja que se apague la pantalla.

## 1.27.1 · 2026-11-25

- **Cartel de alerta de clima:** un popup avisa, por ejemplo, «Alerta amarilla por lluvia hoy cerca de las 16:00 hs, con 60% de probabilidad». Mira las próximas 18 horas: lluvia, tormenta, viento fuerte, calor y helada, con nivel amarillo, naranja o rojo. Se puede escuchar (🔊), ver el pronóstico o cerrar; no vuelve a molestar por el mismo aviso. No es una alerta oficial.
- **Modo manos libres 🙌** en los recorridos (ideal en auto): la guía lee cada parada y escucha «siguiente», «anterior», «repetir», «cuánto falta» y «parar». Si el celular tiene GPS, también avanza sola al llegar a la siguiente parada.
- **Monitoreo:** `npm run monitoreo` y revisión automática cada 30 minutos en GitHub: si la web se cae o faltan datos abre un aviso en tu repositorio (te llega por mail) y lo cierra solo cuando vuelve.

## 1.27.0 · 2026-11-24

- **Clima completo (Open-Meteo, gratis y sin clave):** ahora, sensación, viento, humedad, salida y puesta del sol, UV, próximas 6 horas y 5 días. Aparece en la pestaña «Hoy» y como chip arriba. Da un consejo del día y «Planes para hoy» sugiere lugares según llueva, haga calor, frío o esté lindo. Funciona sin internet con el último pronóstico guardado.
- **Hablarle a la guía 🎤:** botón de micrófono en el buscador (donde el navegador lo permita). Entiende frases como «farmacia de turno», «qué hay abierto», «clima», «recorridos a pie», «cerca mío», «teléfonos útiles», «fin de semana» o cualquier búsqueda, y te responde en voz alta.
- **🔊 Escuchar el pronóstico.**
- **Seguridad:** política CSP en el index (solo hosts conocidos), `_headers` para Cloudflare/Netlify, `npm run seguridad` (revisa CSP, claves pegadas por error, enlaces), revisión automática semanal en GitHub Actions (Gitleaks, Lighthouse) y Dependabot. `fuentes/sugerencias.txt` ya no se publica.

## 1.26.0 · 2026-11-24

- **Guía de bienvenida (Driver.js):** la primera vez que alguien entra le señala el buscador, las pestañas y el botón de ayuda. Se repite desde «?» → «Ver la guía de bienvenida».
- **Buscador que perdona errores (Fuse.js):** si escribís «farmasia» o «panaderia la esquna», muestra «¿Quisiste decir…?».
- **Transiciones suaves entre pantallas (View Transitions)**, sin sumar peso.
- **Mis lugares (favoritos):** corazón en cada lugar y lista «Mis lugares» arriba. Se guarda solo en el celular.
- **Compartir un recorrido** por WhatsApp o copiando la lista de paradas.
- **Teléfonos útiles** (emergencias, hospital, policía, bomberos, farmacias, remises) en un toque, también sin internet.
- **Fin de semana en Sarmiento:** dónde dormir, dónde comer y qué hacer con sol o con lluvia.
- **Opiniones con estrellas:** cualquiera puede opinar (te llega por WhatsApp para aprobarla); las aprobadas se cargan en `fuentes/opiniones.txt` con `npm run opiniones` y se ve el promedio ★ en la lista y la ficha.
- **Saludo de temporada** en la portada (Navidad, Día de la Tradición, 25 de Mayo, 9 de Julio, etc.).
- **Mapa liviano 2D en modo oscuro** y botones de acción fijos abajo en la ficha del celular.
- `npm run velocidad` mide la velocidad y accesibilidad con Lighthouse (necesita internet).

## 1.25.0 · 2026-11-24

- **Contador de visitas (GoatCounter, gratis y sin cookies):** cuenta entradas, lugares vistos, recorridos y pestañas, sin guardar datos personales y sin contar tus pruebas en localhost. Se activa con `npm run visitas -- --codigo=TUCODIGO`.
- **Fotos 360° (Pannellum):** los lugares con foto esférica muestran el botón «🌐 Ver en 360°». Las fotos van en `fuentes/fotos360/` y se asocian con `npm run fotos`.
- `npm run fotos` ahora también achica las fotos solas si instalás `sharp` (`npm i sharp`), y `npm run lugares` vuelve a poner las fotos después de rearmar la lista.

## 1.24.0 · 2026-11-24

- **GSAP incorporado** (gratis, también para uso comercial): el título de la portada aparece letra por letra (SplitText), las listas y fichas entran con un rebote suave, las ventanas «saltan» con efecto elástico y las listas largas aparecen al deslizar (ScrollTrigger).
- Se carga en segundo plano después de que la guía ya abrió, y queda guardado para usarse sin conexión. Si falla o no hay internet, siguen las animaciones CSS de antes. «Sin movimiento» en Accesibilidad lo apaga.

## 1.23.0 · 2026-11-24

- **Mascotas y objetos perdidos / encontrados:** pestaña nueva «Perdidos». Cada aviso puede llevar foto, descripción, zona, **recompensa (opcional)** e información extra (opcional), con botón «Tengo información» por WhatsApp. Se borran solos a los 30 días. Cualquiera puede mandar su aviso con el botón «Publicar un aviso» (llega por WhatsApp). Los cargás en `fuentes/perdidos.txt` y corrés `npm run perdidos`.
- **«Mi día en Sarmiento»:** elegís cuánto tiempo tenés (1 h a medio día), a pie o en auto, y qué te gusta (historia, comer, compras, río y naturaleza) y arma el recorrido a tu medida.
- **Modo oscuro:** automático según el celular; también se elige en Accesibilidad → Colores (Automático / Claro / Oscuro).
- **Fichas con foto grande** y etiqueta «Abierto ahora / Cerrado ahora» sobre la foto.
- **Animaciones suaves** al abrir paneles, listas y ventanas (se apagan con «Sin movimiento»).
- **Botones más grandes** al tocar en celulares.

## 1.22.0 · 2026-11-23

- **Arreglo: los recorridos «A pie» estaban vacíos.** Se medían desde el centro del mapa grande, que se corrió lejos del pueblo. Ahora se miden desde el centro del pueblo (Banco Nación / plaza).
- **Recorridos nuevos para visitantes:** a pie → Paseo por el centro, Historia y cultura, Para comer y tomar algo, Café, dulces y merienda, De compras; en auto → Vuelta al pueblo, Río, puentes y pesca, Servicios útiles. Cada parada trae un consejo («Mejor al atardecer», «Probá las facturas del día»…).
- **Pestaña «Hoy» siempre visible:** lo que está abierto ahora, la farmacia de turno, eventos y novedades.
- **«¿Cuánto tardo desde acá?»** en cada lugar: minutos a pie y en auto desde tu ubicación (el GPS solo se usa al tocar el botón).
- **Fotos de los lugares:** `npm run fotos` toma las fotos de `fuentes/fotos/` y las pone en cada ficha.
- «Lugares cerca mío» ahora mide desde el pueblo y no desde el centro del mapa.

## 1.21.0 · 2026-11-23

- **Cuándo abre y cuándo cierra:** en cada lugar con horario se lee «Abierto ahora · Cierra a las 20:00» o «Cerrado ahora · Abre hoy a las 16:00» (mañana / el lunes…). Si falta menos de una hora para cerrar se avisa en amarillo. En la lista aparece «Abierto · hasta las 20:00».
- **Horarios en castellano:** la ficha muestra «Lun a Vie 08:00 a 12:00 y 16:00 a 20:00 · Sáb 09:00 a 13:00» en vez del formato técnico.
- **`npm run datos` entiende lo que se copia de Google Maps** («lunes: 8:30–12:30, 16:30–20:30; martes: …; domingo: cerrado», «Abierto las 24 horas») y junta los días iguales.

## 1.20.0 · 2026-11-22

- **Instalar la guía como app:** botón «Instalar la guía» (abajo del panel). En Android/PC usa el instalador del navegador; en iPhone explica los pasos.
- **Código QR:** en cada lugar («▦ Código QR») y de la guía entera (abajo del panel), con botón para descargarlo. Generador propio, sin librerías ni internet.
- **`npm run qr`:** arma afiches para imprimir: de la guía (`qr/afiche-guia.html`), de un comercio (`--lugar="Farmacia"`) y una hoja con el QR de todos los lugares (`--lugares`).
- **«Soy el dueño»:** formulario para que cada comercio mande sus datos (teléfono, WhatsApp, horario, dirección) por WhatsApp o correo. Se activa con `npm run contacto`. Los mensajes traen una línea `DATOS: …`: pegalos en `fuentes/sugerencias.txt` y corré `npm run datos` para publicarlos (vos decidís qué mensajes pegar).

## 1.19.0 · 2026-11-22

- **Mapa liviano 2D:** un mapa plano con calles (con sus nombres girados), casas, agua, barrios, lugares y recorridos. No baja three.js, así que carga mucho más rápido y anda en celulares viejos. Se activa en Accesibilidad → «Mapa liviano 2D» y es también la salida automática cuando el navegador no tiene WebGL (antes mostraba solo la lista).
- **La Luisa y otros pueblos sin datos:**
  - Los archivos `fuentes/edificios*.geojson` se importan todos juntos (ponele `edificios_la_luisa.geojson` al lado del de Sarmiento).
  - `npm run luisa`: genera casas **aproximadas** (se marcan como tales) sobre las calles de La Luisa mientras no tengas los edificios reales. Se vuelven a generar solas con `npm run mapa` y `node tools/apply-update.mjs`.
- `npm run fill -- --zona=lat,lng,radio` permite hacer lo mismo en cualquier zona.

## 1.18.0 · 2026-11-22

- **Nombres de calles sin pisarse:** en las esquinas ya no se amontonan. Se elige un solo cartel por esquina (queda el de la calle más larga) y, según desde dónde mires, se ocultan los que taparían a otro.
- **Editor de barrios renovado** (`npm run serve` y abrir http://localhost:8080/barrios):
  - Fondo con el mapa de calles de OpenStreetMap o con imagen satelital, para trazar los límites reales (o «Solo dibujo»).
  - **Imán:** los puntos se pegan a las esquinas/calles y a los bordes de otros barrios, así no quedan huecos ni solapes (Alt para soltar libre).
  - **Redibujar el borde de cero**, mover todo el barrio con Shift + arrastrar, y **Deshacer** (Ctrl+Z).
  - Nombres de calles más claros y sin pisarse.
- `node tools/apply-update.mjs` ahora anota solo los módulos que tengas en `js/` y falten en `sw.js` / `index.html` (se terminan los avisos de `partido-layer.js` y `poi-config.js`).

## 1.17.0 · 2026-11-21

- **Llamar y WhatsApp con un toque** en la ficha de cada lugar (si tiene teléfono / WhatsApp cargado).
- **Farmacia de turno en el cartel de arriba** (💊), además de la pestaña Lugares.
- **`npm run datos`:** arma `fuentes/datos-lugares.txt` con la lista de los lugares a los que les falta teléfono u horario (y cuenta cuántos faltan). Completás `Nombre | teléfono | whatsapp | horario | dirección` (el horario como se habla: «Lun a Vie 8 a 12 y 16 a 20; Sáb 9 a 13») y volvés a correr el comando. `npm run lugares` lo vuelve a aplicar solo.

## 1.16.0 · 2026-11-21

- **«Mostrar solo lo que está abierto ahora»:** casilla en la pestaña Lugares (filtra la lista y el buscador) y etiqueta «Abierto» en cada lugar que lo está. Avisa cuántos lugares no tienen horario cargado.
- **Avisos del camino y del tiempo** arriba del panel, con botón ✕ para cerrarlos:
  - Manuales: `fuentes/avisos.txt` (`desde | hasta | ruta/clima/otro | título | texto`) y `npm run agenda`.
  - Automáticos: tormentas, lluvias fuertes, viento fuerte, calor extremo, heladas y niebla según el pronóstico de Open-Meteo (para hoy y los 2 días siguientes). Se aclara que NO son alertas oficiales y se enlaza al Servicio Meteorológico Nacional.

## 1.15.0 · 2026-11-21

- **Puentes y pesca:** ya no aparece la palabra «bridge»; ahora tienen íconos propios (puente y pez) que se ven siempre, sin depender de la tipografía de Google.
- **Nombres de calles, ríos y arroyos sobre el mapa:** cartelitos chicos que aparecen al acercarse (calles) y en vista media (arroyos y ríos, en azul). Botón «Calles» para mostrarlos u ocultarlos.

## 1.14.0 · 2026-11-21

- **Recorridos con audio:** botón «🔊 Escuchar el recorrido»: lee en voz alta cada parada con el narrador del navegador (sin archivos de sonido). También «🔊 Escuchar» en la ficha de cada lugar. Si el navegador no tiene voz, los botones no aparecen.
- **«📍 Lugares cerca mío»:** usa el GPS del celular (solo al tocar el botón; no se guarda ni se envía) y lista los 12 lugares más cercanos con la distancia; si estás a más de 20 km del pueblo, avisa.

## 1.13.1 · 2026-11-21

- **Barrios:** los nombres de los barrios ya no se ven al abrir la web; aparecen solo al tocar el botón «Barrios» (las etiquetas HTML ignoraban que el grupo estaba oculto).

## 1.13.0 · 2026-11-21

- **Buscador de calles y direcciones:** en la caja «Buscar un lugar» ahora se puede escribir una calle («Mármol»), una dirección («Mármol 536») o una esquina («Mármol y Planes»). Aparece un pin en el mapa y la cámara vuela ahí. La numeración se calcula con los lugares que ya tienen dirección en esa calle, por eso es aproximada y la web lo avisa; con la calle sola, va al medio de la calle.
- La brújula y el «?» quedan lado a lado.

## 1.12.1 · 2026-11-21

- La brújula pasa al lado del botón «?» (misma fila, abajo de la columna de botones).

## 1.12.0 · 2026-11-21

- **Pestaña «Hoy»** (aparece sola si hay datos): farmacia de turno, próximos eventos ("Hoy", "Mañana", "En 3 días") y novedades del pueblo. Se cargan en `fuentes/agenda.txt` y `fuentes/novedades.txt` y se publican con `npm run agenda`.
- **«Abierto ahora / Cerrado ahora»** en la ficha de cada lugar con horario en formato OpenStreetMap (por ejemplo `Mo-Fr 08:00-12:00,16:00-20:00; Sa 09:00-13:00`). Si el horario no se entiende, no se muestra nada.
- **«⚠ Reportar un dato»** en cada ficha (WhatsApp o mail): se activa con `npm run contacto -- --whatsapp=549...` o `--email=...`.
- **Copia de seguridad:** `npm run respaldo` guarda `data/` y `fuentes/` en `respaldos/` (últimas 8) y corre sola antes de cada `apply-update`. La carpeta `respaldos/` no se sube a GitHub.

## 1.11.0 · 2026-11-20

- **Farmacia de turno automática:** `npm run turnos -- --web` lee la farmacia de turno de farmaciasdeturnohoy.site; lo escrito a mano en `fuentes/turnos.txt` manda. Con `.github/workflows/turnos.yml` se actualiza solo todos los días en GitHub. Si la farmacia no está entre los lugares, se muestra igual por nombre.
- **Barrios:** nuevo `fuentes/barrios-puntos.txt` (`Nombre | link de Google Maps`) para sumar barrios que faltan (Los Milagros, Filomena, Fonavi, La Liga, Tropezón, Mancha Verde, La Huella, 29 de Junio) y renombrar (`Ruta 8 = Los Patos`). `npm run barrios` sigue andando aunque OpenStreetMap esté caído, y rehace solo las zonas "aprox."; las que corregiste en `/barrios` no se tocan (al mover un vértice dejan de ser "aprox.").
- **Accesibilidad:** botón "Accesibilidad" (letra grande y muy grande, alto contraste, sin movimiento y modo lista sin 3D).

## 1.10.0 · 2026-11-20

- **Farmacia de turno:** `fuentes/turnos.txt` (`desde | hasta | farmacia | nota`) + `npm run turnos`. La web muestra arriba de la lista la farmacia de turno de HOY (con "Ver en el mapa" y "Llamar").
- **Puentes y pesca:** nueva capa "Puentes, pesca y agua" y tipos `puente` y `pesca`. `npm run puentes` baja los puentes con nombre de OpenStreetMap; los tuyos van en `fuentes/puentes-manual.txt`.
- **Alejar el mapa:** la cámara ajusta su plano cercano según la distancia, para que no parpadeen calles ni techos al alejarse (precisión de profundidad).

## 1.9.0 · 2026-11-20

- **La cámara arranca en el centro del pueblo:** por defecto cerca del Banco Nación (si está cargado). Se cambia con `npm run inicio -- museo` (o cualquier nombre de lugar), `npm run inicio -- ninguno` o `npm run inicio` (automático).
- Agregado al inventario: Casa de la Cultura (ex Cine Español), pendiente de ubicar en el mapa.

## 1.8.2 · 2026-11-20

- El botón "✕ Ver mapa" ahora está arriba a la derecha, en la misma fila que "Capitán Sarmiento".

## 1.8.1 · 2026-11-20

- **Arreglo de la carga en 0 %:** `js/barrios.js` pedía un archivo de three.js que no existe (`CSS2DObject.js`; en realidad está dentro de `CSS2DRenderer.js`). El navegador no podía arrancar la web. Corregido.

## 1.8.0 · 2026-11-20

- **Buscador:** caja "Buscar un lugar" arriba de la lista. Busca sin importar tildes ni mayúsculas, por nombre, tipo, dirección o descripción, en TODOS los lugares (aunque su capa esté apagada).
- **Compartir:** botón "🔗 Compartir" en cada ficha. En el celular abre el menú de compartir; en PC copia el link. El link (`?lugar=ID`) abre la web directamente en ese lugar.
- Al elegir un lugar cuya capa está apagada, la capa se prende sola para que se vea su pin.
- "Cómo llegar" ya estaba en cada ficha (abre Google Maps con la ruta).

## 1.7.3 · 2026-11-20

- **Botón "✕ Ver mapa"** arriba a la derecha de la guía, para cerrarla sin tener que saber que había que tocar "Mapa" (pensado para personas mayores).

## 1.7.2 · 2026-11-20

- **Arreglo del mapa grande:** `npm run mapa -- --half=8500 ...` fallaba con "HTTP 400" por un error mío en la consulta a OpenStreetMap. Corregido.
- **Barrios:** `npm run barrios` ahora también lee los barrios que en OpenStreetMap son solo un punto y arma una zona APROXIMADA para cada uno (marcada "aprox."), que después se corrige en `http://localhost:8080/barrios`.
- **Aviso de carga:** si la web se queda sin avanzar (archivo viejo, error, internet), la pantalla de carga muestra qué pasó y un botón "Borrar caché y reintentar".
- `npm run mapa` ahora deja `data/meta.json` con la versión correcta.

## 1.7.1 · 2026-11-18

- **`npm run duplicados`:** encuentra lugares repetidos (mismo nombre a menos de 150 m, o mismo tipo a menos de 12 m) y líneas repetidas en `fuentes/lugares-extra.txt`. Solo muestra; con `npm run duplicados -- --aplicar` los junta (queda el que cargaste vos antes que el de OpenStreetMap, con los datos que le falten pasados del otro), arregla los recorridos que los usaban y evita que vuelvan a aparecer. Guarda una copia en `data/places.antes-de-duplicados.json`.

## 1.7.0 · 2026-11-18

- La brújula pasa al lado del botón «?» (misma fila, abajo de la columna de botones).

## 1.7.0 · 2026-11-18

- **Botones + y − de zoom** abajo a la derecha (y teclas + / −), para quien no tiene rueda en la PC.
- **Barrios:** botón «Barrios» que muestra las zonas de color con su nombre (clic en un nombre = acerca la cámara). Se cargan con `npm run barrios` (OpenStreetMap, si los tiene dibujados) o dibujándolos vos en `http://localhost:8080/barrios` (editor con clics, mover puntos, renombrar, color, «aproximado»).
- **Mapa grande opcional** (balneario, La Luisa o todo el partido): suelo en dos niveles (general + baldosas nítidas donde hay casas), cámara, niebla y zoom máximo que crecen con el tamaño del mapa, punto de arranque (`meta.focus`) y opciones `--foco` y `--edificios-osm` en `npm run mapa`. Con el mapa de siempre (hasta 2,4 km de radio) todo funciona igual que antes.

## 1.6.2 · 2026-11-14

- La brújula pasa al lado del botón «?» (misma fila, abajo de la columna de botones).

## 1.6.2 · 2026-11-14

- **Página «Ubicar lugares pendientes»** (`npm run serve` y abrir `http://localhost:8080/ubicar`): lista los pendientes ordenados por importancia, con un botón que abre cada lugar en Google Maps, un cuadro para pegar las coordenadas (clic derecho en el mapa → copiar) o el link, y **Guardar**. Valida que se pueda leer la ubicación y lo suma al mapa al instante. **No va** saca de la lista un lugar que ya no existe (`fuentes/descartados.txt`). **Armar el mapa** le pone su edificio y rearma los recorridos.

## 1.6.1 · 2026-11-13

- La brújula pasa al lado del botón «?» (misma fila, abajo de la columna de botones).

## 1.6.1 · 2026-11-13

- **`npm run geocodificar`:** busca solo la ubicación de los lugares «sin dibujar» por su dirección usando OpenStreetMap (Nominatim) y los suma al mapa. Criterio estricto: solo acepta la casa con ese número exacto dentro del mapa; esquinas, rutas y calles sin número quedan pendientes. Lo encontrado se guarda en `fuentes/geocodificados.txt` (borrá una línea si un pin queda mal).

## 1.6.0 · 2026-11-13

- La brújula pasa al lado del botón «?» (misma fila, abajo de la columna de botones).

## 1.6.0 · 2026-11-13

- **Capas / categorías:** panel nuevo en la pestaña Lugares con 15 categorías activables, «Solo esenciales», «Activar todas» y «Desactivar todas», y la cantidad de lugares de cada una. La web **arranca solo con los esenciales** (salud y emergencias, municipalidad, transporte, plazas y puntos cívicos). Los pines de las capas apagadas no se crean (menos trabajo en celulares). Los lugares de un recorrido abierto siempre se ven.
- **Inventario ampliado** (`fuentes/inventario-ampliado.txt`): 21 puntos con coordenadas publicadas (municipalidad, policía, bomberos, hospital, museo, cine, centro cultural, iglesias, terminal, clubes, camping, farmacia Bava, etc.) se suman al mapa si no estaban ya; ~140 comercios, escuelas y servicios con dirección pero sin ubicación exacta quedan en una lista de pendientes (`data/pendientes.json`) y **no se dibujan**. Se corrige la distinción entre Piletas Camping (parque acuático) y el Camping y Balneario Municipal.
- Los puntos fuera del área del mapa (La Luisa, Estancia La Posta, camping) no se dibujan: avisa cómo agrandar el mapa.
- Nuevos tipos: `estancia` y `aerodromo`. `npm run lugares` vuelve a acomodar una vez cuando se suman lugares nuevos, para que tengan su edificio y su modelo.

## 1.5.8 · 2026-11-01
- Los pines de los lugares que vienen de OpenStreetMap o de lugares-extra.txt ahora se acomodan adentro de su edificio (hasta 30 m de distancia) cuando corrés `npm run lugares` o `npm run extras`. Los que cargaste a mano no se tocan (y podés poner `"snapped": false` en cualquier lugar para que no se mueva).
- El pin queda a la altura del techo del edificio.

## 1.5.8 · 2026-11-01

- La brújula pasa al lado del botón «?» (misma fila, abajo de la columna de botones).

## 1.5.7 · 2026-11-01

- **Arreglo importante:** faltaban miles de edificios (en tu pueblo, 7167 de 10989) porque el techo plano se triangulaba con un formato que three.js no acepta (`.equals is not a function`). Desde la 1.5.0 solo se dibujaban las casas con techo a dos aguas; los edificios con techo plano (incluidos el museo, el banco y el cuerpo de la iglesia) no. Ahora se triangulan bien.
- Red de seguridad: si algún edificio no puede dibujarse con el método rápido, se dibuja con el método clásico, así no falta ninguno. La consola informa cuántos se rescataron.

## 1.5.6 · 2026-11-01

- **Los edificios importantes siempre aparecen:** si el museo, la iglesia, el banco, la municipalidad, el hospital, la estación, la casa de la cultura o la biblioteca no tienen edificio en el mapa, `npm run lugares` arma el edificio completo con el modelo (orientado hacia la calle). Si lo tienen, el modelo se arma sobre el edificio real, que nunca se borra (antes una iglesia chica reemplazaba y borraba casas del mapa).
- **Comercios sin edificio:** los comercios y servicios con ficha en un lugar donde el mapa no tiene ningún edificio reciben uno sencillo, detrás de la vereda y paralelo a la calle (se rehacen en cada corrida; los de OpenStreetMap y los tuyos no se tocan).
- La maqueta casi no saca casas por estar cerca de una calle (solo las que están justo sobre el eje).
- La consola (F12) informa cuántos edificios hay en los datos y cuántos no se pudieron dibujar (con el motivo).

## 1.5.5 · 2026-10-31

- **Tres edificios rehechos a partir de fotos reales:**
  - Iglesia San Carlos: torre campanario con base de ladrillo y esquinas blancas, campanario con persianas, reloj y aguja verde-gris con cruz; frente blanco con tres arcos con ribete verde; reja con pilares de ladrillo y capitel verde.
  - Museo Histórico: casona de dos plantas crema con molduras ocre, frontón, balcón de hierro, portal con arco, ventanas con arco, letrero «MUSEO / HISTÓRICO», farolas de dos globos y palmeras.
  - Banco de la Nación Argentina: edificio crema con zócalo, arcos con persianas, balcones de hierro, cornisa con modillones, balaustrada, portal con frontón, escalera, carteles azules y banderas.
- **El frente mira a la calle:** `npm run lugares` calcula qué lado de cada edificio importante da a la calle más cercana (las iglesias, solo los lados cortos) y el modelo se orienta así.
- El Banco Nación se reconoce por el nombre y se resalta como edificio especial.

## 1.5.4 · 2026-10-30

- **Arreglo:** volvían a faltar edificios (museo, Club Sarmiento, Banco Nación…) porque la maqueta sacaba toda casa cuya esquina rozaba una calle. Ahora solo se saca la casa cuyo centro está claramente en medio de la calzada, y los edificios importantes (resaltados o con nombre) nunca se sacan. La consola (F12) informa cuántas se sacaron.

## 1.5.3 · 2026-10-30

- **Edificios importantes con arquitectura propia**, armados sobre el edificio real y a su medida (hace falta correr `npm run lugares` para que se guarde el tamaño):
  - Iglesia: torre campanario con reloj, arcos, cornisa, aguja con cruz, pináculos y frontón con cruz.
  - Municipalidad: pórtico con columnas, frontón y escalinata, torre de reloj con aguja, balaustrada y mástiles con banderas.
  - Estación / Casa de la Cultura: andén techado con postes, reloj, chimeneas y faroles.
  - Museo: estilo colonial pampeano con parapeto, frontón, rejas de hierro y alero de pulpería.
  - Hospital (cruz, marquesina de guardia, caja de escaleras), escuela, policía, bomberos y biblioteca con sus rasgos propios.
- Basado en lo que dicen las fuentes (capilla del Pilar frente al Palacio Municipal, museo colonial pampeano, La Estación como Casa de la Cultura); los detalles de color y forma son aproximados hasta tener fotos.

## 1.5.2 · 2026-10-30

- **Edificios con más detalle:** techos a dos aguas con aleros que sobresalen, chimeneas, tanques de agua más grandes, marcos claros en las ventanas, puertas de varios colores con marco, toldos sobre algunas puertas y balcones en pisos altos.
- El detalle se ve desde más lejos (620 m; 300 m en gama baja, que mantiene la versión liviana).

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
