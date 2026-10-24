# Historial de cambios

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
