# Guía Sarmiento · Capitán Sarmiento en 3D

Guía local interactiva de **Capitán Sarmiento** sobre una maqueta 3D del pueblo: dónde comer, dónde dormir, qué ver y recorridos a pie o en auto.

- Sitio **100 % estático** (HTML + JS + JSON). No tiene servidor ni base de datos.
- 3D con [three.js](https://threejs.org) 0.164.1, cargado desde una CDN (jsDelivr).
- Instalable como app (PWA) y con modo sin conexión.
- Viene con un **pueblo de demostración** para que funcione de entrada. El mapa real se baja de OpenStreetMap con un clic (ver [paso 4](#4-poner-el-mapa-real-de-capitán-sarmiento)).

> **Estado de esta versión (1.0.0):** la interfaz (panel, fichas, recorridos, modales) se probó en un navegador real y las herramientas de `tools/` se probaron con datos simulados. La **escena 3D no se pudo ejecutar** donde se armó el proyecto (sin acceso a la CDN de three.js), así que el primer paso es abrirla en tu compu y mirar que se vea bien ([paso 1](#1-probarla-en-tu-computadora)). Si algo falla, la consola del navegador (F12) dice qué.

---

## Contenido

```
guia-sarmiento/
├─ index.html              página única
├─ manifest.webmanifest    datos de la app instalable
├─ sw.js                   modo sin conexión (se versiona solo, ver "Versiones")
├─ og.jpg, icons/          imagen para compartir e íconos
├─ css/style.css           estilos (colores en :root)
├─ js/
│  ├─ main.js              arranque: datos, escena, luces, postproceso, bucle
│  ├─ world.js             suelo, calles, agua, edificios extruidos desde OSM
│  ├─ wide.js              campo alrededor y árboles
│  ├─ landmarks.js         hitos (plaza, iglesia, estación, tanque, silos)
│  ├─ casas-destacadas.js  casonas con carácter
│  ├─ labels.js            pines de lugares
│  ├─ nav.js               vuelos de cámara, recorridos y ruta dibujada
│  ├─ life.js              peatones y pájaros
│  ├─ mascotas.js          guiños propios: perro, caballos, auto
│  ├─ ui.js                panel, pestañas, fichas, modales
│  └─ geo.js, route.js, util.js, icons.js, config.js, bus.js, scene-utils.js
├─ data/                   TODO el contenido (se edita sin tocar código)
│  ├─ meta.json            nombre, lema, centro del mapa, textos legales, versión
│  ├─ sarmiento-osm.geojson   mapa (demo ahora; real después del paso 4)
│  ├─ places.json · tours.json · guides.json
│  └─ landmarks.json · casonas.json · mascots.json
├─ models/ · textures/     para tus .glb y la imagen satelital (vacías)
├─ tools/                  scripts (necesitan Node 18+, solo para mantenimiento)
├─ .github/workflows/update-osm.yml   baja el mapa real desde GitHub, sin instalar nada
├─ VERSION · CHANGELOG.md · package.json
└─ README.md
```

---

## 1. Probarla en tu computadora

No se puede abrir `index.html` con doble clic (los módulos de JavaScript no cargan desde `file://`). Hace falta un servidor local, cualquiera de estos:

```bash
# Con Node (funciona igual en Windows, Mac y Linux)
npm run serve

# o, si ya tenés Python (en Windows suele ser "python", no "python3")
python -m http.server 8080
```

Abrí <http://localhost:8080>. Deberías ver el splash "Armando la maqueta del pueblo…" y después la maqueta con el panel a la izquierda (o abajo, en el celular).

**Si ves la pantalla en negro o el splash no se va:** F12 → pestaña *Consola*. Las causas más comunes: sin internet (la CDN de three.js no carga), navegador sin WebGL, o un archivo de `data/` con un error de formato. Para esto último: `npm run check`.

Si el navegador no soporta WebGL, la guía igual funciona en **modo lista** (sin la maqueta).

---

## 2. Subirla a GitHub

1. Entrá a <https://github.com/new>. Nombre sugerido: `guia-sarmiento`. Dejalo **público** (GitHub Pages es gratis solo con repositorios públicos). No agregues README ni .gitignore.
2. Subí **el contenido de la carpeta** (que `index.html` quede en la raíz del repositorio, no dentro de otra carpeta):
   - **Sin instalar nada:** en el repositorio nuevo, *uploading an existing file* → arrastrá todo lo de adentro de la carpeta `guia-sarmiento` → *Commit changes*. Revisá después que estén las carpetas `.github/workflows` y el archivo `.nojekyll` (son "ocultos" y algunos navegadores no los arrastran). Si faltan, usá la opción de abajo.
   - **Con git:**
     ```bash
     cd guia-sarmiento
     git init -b main
     git add -A
     git commit -m "Primera versión"
     git remote add origin https://github.com/TU-USUARIO/guia-sarmiento.git
     git push -u origin main
     ```
3. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)` → *Save*.
4. Esperá 1 a 10 minutos. La guía queda en `https://TU-USUARIO.github.io/guia-sarmiento/`.

Todas las rutas del proyecto son relativas, así que funciona igual en esa subcarpeta y, más adelante, en un dominio propio.

**Configurar la URL (recomendado):** para que al compartir el link se vea la imagen y el título, y para tener `robots.txt` y `sitemap.xml`:

```bash
npm run site-url -- https://TU-USUARIO.github.io/guia-sarmiento/
```

(Si no tenés Node, editá a mano en `index.html` el bloque entre `site-url:start` y `site-url:end` y los dos archivos `robots.txt` / `sitemap.xml`.)

---

## 3. Poner nombre, lema y textos

Todo en `data/meta.json`:

| Campo | Qué es |
|---|---|
| `kicker` | línea chica arriba del título del splash (acá va el lema oficial; **verificalo en la municipalidad** antes de usarlo) |
| `title` | `["Capitán", "Sarmiento"]` (la segunda palabra va en cursiva dorada) |
| `tagline` | la bajada que aparece en el panel |
| `center` | `{lat, lng}` del centro del mapa (**verificalo** en openstreetmap.org: clic derecho → *Mostrar dirección*) |
| `legal` | los 4 párrafos del "Aviso importante". Están escritos como base: **hacelos revisar por un abogado** antes de publicar, sobre todo si vas a mostrar comercios o guías |
| `emergency` | teléfonos del modal de ayuda. 107 / 911 / 100 son nacionales: **agregá los locales** (hospital, comisaría, bomberos voluntarios) después de verificarlos |

Colores: variables al principio de `css/style.css` (`--bg`, `--accent`…) y `COLORS` en `js/config.js`.

---

## 4. Poner el mapa real de Capitán Sarmiento

Ahora mismo se ve un pueblo de grilla **inventado** (para que pruebes todo). El mapa real sale de OpenStreetMap.

### Opción A — desde GitHub, sin instalar nada (la más fácil)

1. En tu repositorio: pestaña **Actions** → *Actualizar mapa desde OpenStreetMap* → **Run workflow**.
2. Dejá el centro y el tamaño por defecto (o ajustalos) y tildá "lugares candidatos". → *Run workflow*.
3. Cuando termina (unos minutos), el repositorio tiene el mapa real y una versión nueva. Recargá la página publicada.

Si falla al guardar los cambios: **Settings → Actions → General → Workflow permissions → Read and write permissions**.

### Opción B — en tu compu

```bash
npm install
npm run osm -- --center=-34.1728,-59.7886 --half=2000 --pois
```

- `--half=2000` = el mapa cubre un cuadrado de 4 km de lado. Si el archivo `data/sarmiento-osm.geojson` pesa más de ~8 MB, achicalo (`--half=1500`) para que cargue rápido en celulares.
- `--pois` guarda en `data/places.candidates.json` los comercios, alojamientos y atractivos que ya existen en OpenStreetMap, para que no empieces de cero.

**Importante:** al bajar el mapa real, el script **borra el contenido de ejemplo** (lugares, recorridos, hitos, casonas y mascotas), porque sus coordenadas no coinciden con el pueblo real y se verían en cualquier lado. Con `--keep-demo` no lo borra.

**Atajo para Capitán Sarmiento:** `npm run mapa -- --center=-34.1728,-59.7886` baja las calles reales y después suma los edificios de `fuentes/edificios_capitan_sarmiento.geojson`. Usalo siempre en vez de `npm run osm` solo, porque bajar el mapa borra los edificios importados (y la acción de GitHub "Actualizar mapa" también).

### Si el mapa sale con calles pero casi sin casas, o no es el centro del pueblo

OpenStreetMap tiene pocos edificios cargados en Capitán Sarmiento (el script te avisa: "muy pocos edificios"). Dos remedios, que se pueden combinar con la descarga:

1. **`npm run fill`** — genera casas **aproximadas** a lo largo de las calles (sin pisar calles, vías, plazas ni agua). Rápido, pero no son las construcciones reales; los créditos lo aclaran solos. `npm run fill -- --clear` las quita. Si salen pocas o demasiadas, probá `--min-road=500` (más casas) o `--min-road=1000` (menos).
2. **`npm run buildings -- archivo.geojson --source="Overture Maps Foundation"`** — importa huellas **reales** desde un archivo que descargues vos (Overture Maps, Microsoft Building Footprints o Google Open Buildings; revisá su licencia). Descarta las que ya están en OpenStreetMap y reemplaza las aproximadas. Acepta `.geojson` y `.geojsonl`. `--source` es obligatorio para acreditar la fuente.

**Centro equivocado:** el script imprime "Zona con más calles: LAT, LNG". Corré `npm run osm -- --auto-center` (guarda ese centro) y después `npm run osm` otra vez; o directamente `npm run osm -- --center=LAT,LNG` con las coordenadas exactas de la plaza (clic derecho en Google Maps → copiar coordenadas).

Después: `npm run check`, `npm run bump -- patch`, y subí los cambios.

El mapa de OpenStreetMap puede tener edificios sin cargar o con altura estimada (3 m por piso, o 4 m si no hay dato). Corregirlo en <https://www.openstreetmap.org> mejora el mapa para todos y se refleja la próxima vez que lo bajes.

---

## 5. Cargar el contenido real

Todo está en `data/`; no hace falta tocar código. Después de editar: `npm run check` (si no tenés Node, probalo directamente en el navegador).

### `places.json` — lugares

```json
{
  "id": "parrilla-don-pepe",
  "name": "Parrilla Don Pepe",
  "category": "comer",
  "lat": -34.1731, "lng": -59.7889,
  "address": "Mitre 123",
  "hours": "Mar a Dom 12 a 15 y 20 a 00",
  "phone": "+54 2326 000000",
  "web": "https://…",
  "googleMapsUrl": "https://maps.app.goo.gl/…",
  "reviewsUrl": "",
  "description": "Qué es y por qué ir (2 o 3 líneas, con tus palabras).",
  "localTip": "El dato que solo sabe alguien del pueblo.",
  "source": "Relevado en persona + Facebook del local",
  "updated": "2026-10-22"
}
```

- `category`: `comer`, `dormir`, `ver` o `servicios`.
- `id`: único, sin espacios ni tildes.
- Si no ponés `reviewsUrl` ni `googleMapsUrl`, el botón "Ver reseñas en Google" busca el nombre del lugar en Google Maps.
- "Cómo llegar" abre Google Maps con la ruta hasta las coordenadas.
- Para pasar los candidatos de OSM: abrí `places.candidates.json`, copiá los que sirvan a `places.json` y completá `description` y `localTip`. **Escribí las descripciones con tus palabras**; no copies textos de otras guías ni de sitios de terceros.

### `tours.json` — recorridos

```json
{
  "id": "centro-a-pie",
  "title": "Paseo por el centro",
  "mode": "walk",
  "durationMin": 45,
  "intro": "Un paseo tranquilo por lo más lindo del centro.",
  "stops": [
    { "placeId": "plaza-principal", "note": "Empezá acá.", "tip": "Mejor a la tarde." },
    { "placeId": "iglesia", "note": "Mirá la torre." }
  ]
}
```

`mode`: `walk` (pestaña "A pie") o `car` ("En auto"). Cada `placeId` tiene que existir en `places.json`. La ruta amarilla une las paradas en orden siguiendo la grilla; si querés un trayecto exacto, agregá `"path": [[lng, lat], [lng, lat], …]`.

### Comandos para los lugares (nuevos)

```bash
npm run calles                       # baja las calles reales (reemplaza las de ejemplo, no toca edificios)
npm run lugares                      # baja comercios y servicios de OpenStreetMap, los pega a su edificio real y arma los recorridos
npm run lugares -- --reset           # vuelve a empezar la lista de lugares
npm run lugares -- --agregar=hotel   # suma un tipo concreto (hotel, escuela, farmacia, ferreteria…)
npm run extras                       # suma los lugares de fuentes/lugares-extra.txt (nombre | tipo | link de Google Maps)
npm run recorridos                   # regenera los recorridos automáticos (por las calles)
```

Los nombres y textos que edites a mano en `places.json` se conservan al volver a correr `lugares`.

### `guides.json` — guías de turismo

```json
[{ "name": "Nombre", "contact": "+5492326000000", "languages": ["español", "inglés"], "notes": "", "consent": true }]
```

Para agregarlo desde la terminal: `npm run guias -- --nombre="María Gómez" --contacto="+5491123456789" --idiomas=es,en --consentimiento` (sin `--consentimiento` no lo agrega: ese aviso confirma que el guía te autorizó por escrito).

`contact` puede ser un teléfono (abre WhatsApp), un mail o un link. **`"consent": true` solo si el guía te dio su autorización por escrito para publicar sus datos**: el repositorio es público y cualquiera los puede ver. `npm run check` falla si falta. Si tenés dudas sobre datos personales, consultá la Ley 25.326 de Protección de Datos Personales.

### `landmarks.json`, `casonas.json`, `mascots.json` — hitos y guiños

Son los objetos 3D. Vienen con modelos simples hechos por código; podés dejar los simples o reemplazarlos por modelos propios:

- **Hitos** (`landmarks.json`): `kind` puede ser `plaza`, `iglesia`, `estacion`, `tanque` o `silo`, con `lat`, `lng`, `rotY` (grados). Agregá uno por cada hito real que quieras mostrar.
- **Casonas** (`casonas.json`): `w`, `d`, `h` (ancho, fondo, alto en metros), `wall` y `roof` (colores), `rotY`.
- **Mascotas** (`mascots.json`): `type` = `perro`, `caballo` o `auto`. Perros y caballos deambulan alrededor de su punto (`radius` en metros); el auto recorre `loop` (lista de `[lng, lat]`). Poné **tus propios guiños** (la mascota de alguien, un tractor, etc.).

**Modelos propios (.glb):** guardalos en `models/` y agregá `"model": "models/iglesia.glb"` y, si hace falta, `"scale"`. Recomendaciones: menos de 20 000 triángulos por hito, texturas de hasta 1024 px, comprimidos (`npx @gltf-transform/cli optimize in.glb out.glb`). Si el modelo no es tuyo, que tenga licencia CC0 o CC-BY y anotá la atribución en `meta.json → legal` o en este README. Si el `.glb` no carga, se muestra el modelo simple.

### Imagen satelital del entorno (opcional)

Por defecto el campo alrededor es un patchwork de lotes dibujado por código. Para usar una imagen satelital:

1. Conseguí una imagen **cuadrada** centrada en `meta.center` que cubra exactamente `wideExtentMeters` (9000 m por defecto) de lado, por ejemplo de [Sentinel-2 cloudless](https://s2maps.eu) (EOX, licencia CC BY 4.0). Verificá las condiciones de uso y descarga en su sitio.
2. Guardala como `textures/entorno.jpg` (hasta ~2048 px de lado).
3. En `data/meta.json`: `"satellite": { "file": "textures/entorno.jpg" }`.

Al activarla, el crédito de Sentinel-2 aparece solo en el "Aviso importante" (es obligatorio mantenerlo).

---

## Clima y ciclo del día (en tiempo real)

La maqueta usa la fecha y hora reales de Capitán Sarmiento: el sol sale y se pone donde corresponde, de noche oscurece, se ven estrellas y se prenden las luces de calles y casas. El clima sale de [Open-Meteo](https://open-meteo.com) (gratis, sin clave): nublado, lluvia, tormenta con relámpagos, niebla, nieve. Se actualiza cada 10 minutos. Si no hay internet, queda cielo despejado (el día y la noche siguen funcionando).

- El botón de arriba a la derecha (☀️ 18°) muestra el clima. **Tocalo** para ver el pueblo al amanecer, al mediodía, al atardecer o de noche.
- Para probar sin esperar, agregá a la dirección del sitio: `?hora=22` (o `?hora=6:30`) y/o `?clima=lluvia`. Climas: `despejado`, `nublado`, `lluvia`, `lluviafuerte`, `tormenta`, `niebla`, `nieve`. Ejemplo: `.../guia-sarmiento/?hora=23&clima=tormenta`.
- Los colores e intensidades están en `js/sky-model.js`; las luces de noche, la lluvia y los relámpagos en `js/atmosphere.js`.

## Calidad gráfica

Por defecto la maqueta arranca en modo **liviano**. Usa calidad alta solo en una PC (no celular) con placa de video potente (NVIDIA, AMD dedicada, Apple, Intel Arc). Además baja sola la calidad si va lenta. Para forzar: `?calidad=baja` o `?calidad=alta` al final de la dirección.

## 6. Versiones

El número de versión vive en `VERSION`, `package.json`, `data/meta.json` y `sw.js`; el **service worker lo usa para renovar la caché** (si no cambia, los visitantes pueden seguir viendo la versión vieja). Para no desincronizarlo:

```bash
npm run bump -- patch     # 1.0.0 -> 1.0.1   (correcciones y cambios de contenido)
npm run bump -- minor     # 1.0.1 -> 1.1.0   (funciones nuevas)
npm run bump -- major     # 1.1.0 -> 2.0.0   (cambios grandes)
```

Eso también agrega una entrada en `CHANGELOG.md` para que escribas qué cambió. La versión y la fecha se ven en el modal de ayuda. En GitHub podés marcar versiones importantes con *Releases → Draft a new release* (tag `v1.0.0`).

`npm run check` verifica que las versiones coincidan, que no haya rutas rotas o absolutas, que los recorridos apunten a lugares que existen y que los guías tengan consentimiento.

---

## 7. Pasar a dominio propio

1. Comprá el dominio (los `.com.ar` se registran en [nic.ar](https://nic.ar)) y configurá el DNS en el proveedor que uses.
2. En el repositorio: **Settings → Pages → Custom domain** → escribí el dominio → *Save*. GitHub crea un archivo `CNAME`.
3. En el DNS: para `www.tudominio.com.ar`, un registro `CNAME` apuntando a `TU-USUARIO.github.io`. Para el dominio sin `www`, registros `A` con las IP de GitHub Pages (las vigentes están en la documentación de GitHub, sección *Configuring an apex domain*).
4. Cuando el certificado esté listo, tildá **Enforce HTTPS**.
5. Corré `npm run site-url -- https://tudominio.com.ar/` para actualizar el canonical, la imagen para compartir, `robots.txt` y `sitemap.xml`.
6. Subí la versión (`npm run bump -- patch`) para que el modo sin conexión se renueve.

No hay que cambiar nada del código: las rutas ya son relativas.

---

## Cómo se usa (para quien visita)

- **Mouse:** arrastrar para moverse · rueda para acercar · clic derecho o ⌥ (Alt) + arrastrar para girar e inclinar · doble clic para acercar.
- **Celular:** un dedo para moverse · dos dedos para acercar y girar · doble toque para acercar.
- **N** reorienta al norte · **Mapa/Lista** muestra u oculta el panel · **?** abre la ayuda con emergencias y créditos.

---

## Créditos y licencias

- **Mapa:** © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright), licencia ODbL. La atribución es obligatoria (ya está en la guía). El archivo `sarmiento-osm.geojson` es una base de datos derivada de OSM: si lo publicás, mantené la atribución y la misma licencia para ese archivo.
- **Satélite (si lo usás):** Sentinel-2 cloudless de EOX IT Services GmbH (contiene datos Copernicus Sentinel modificados), CC BY 4.0.
- **three.js:** MIT. **Fraunces** e **Inter:** SIL Open Font License (Google Fonts).
- **Este proyecto:** el código y los textos de ejemplo son tuyos para usar y modificar. Elegí vos la licencia y agregá un archivo `LICENSE` si querés definirla.
- El contenido que cargues (descripciones, fotos, modelos) es tu responsabilidad: usá material propio o con licencia que lo permita. Este proyecto replica la **idea y el tipo de funcionalidad** de otras guías 3D de pueblos, pero no copia su código, textos, fotos, modelos ni su aviso legal.
