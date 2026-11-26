// Elige cómo arrancar: maqueta 3D (por defecto) o mapa liviano 2D (Accesibilidad → «Mapa liviano 2D»).
// El mapa liviano no baja three.js: así carga mucho más rápido en celulares viejos.
let lite = false;
try { const p = JSON.parse(localStorage.getItem('guia-accesibilidad') || 'null'); lite = Boolean(p && p.map2d && !p.simple); } catch { /* sin almacenamiento: 3D */ }
if (lite) import('./main2d.js'); else import('./main.js');
