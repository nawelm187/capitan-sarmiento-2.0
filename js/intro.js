// Recorrido guiado de bienvenida con Driver.js (gratis, MIT: https://driverjs.com). Se muestra solo la primera vez
// y se puede repetir desde «?» → «Ver la guía de bienvenida».
const BASE = (typeof window !== 'undefined' && window.__DRIVER_BASE) || 'https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/';
const KEY = 'guia.intro.v1';
let cargando = null;

export function yaVioIntro() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return true; }
}
function marcar() { try { localStorage.setItem(KEY, '1'); } catch { /* nada */ } }

function cargar() {
  return (cargando ||= new Promise((resolve, reject) => {
    if (window.driver?.js?.driver) return resolve(window.driver.js.driver);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = BASE + 'driver.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = BASE + 'driver.js.iife.js';
    s.onload = () => (window.driver?.js?.driver ? resolve(window.driver.js.driver) : reject(new Error('sin driver')));
    s.onerror = () => { cargando = null; reject(new Error('no cargó')); };
    document.head.appendChild(s);
  }));
}

/** Pasos: solo los que existen en pantalla en este momento. */
export const PASOS = [
  { element: '#q', titulo: 'Buscá lo que necesites', texto: 'Escribí «farmacia», «pizza» o el nombre de una calle. Si te equivocás al escribir, igual te ayudo.' },
  { element: '#tab-hoy', titulo: 'Lo que pasa hoy', texto: 'Acá ves qué está abierto ahora, la farmacia de turno y los eventos.' },
  { element: '#tab-pie', titulo: 'Recorridos armados', texto: 'Paseos a pie y en auto, parada por parada. También podés armar «Mi día en Sarmiento».' },
  { element: '#tab-perdidos', titulo: 'Mascotas y objetos perdidos', texto: 'Mirá avisos del pueblo o publicá el tuyo.' },
  { element: '#btn-list', titulo: 'Ver el mapa', texto: 'Tocá acá para esconder o mostrar la guía y ver el mapa completo.' },
  { element: '#btn-help', titulo: 'Ayuda', texto: 'Teléfonos útiles, accesibilidad (letra grande, modo oscuro) y esta guía de bienvenida cuando quieras.' },
];

export async function iniciarIntro({ forzar = false } = {}) {
  if (!forzar && yaVioIntro()) return false;
  try {
    const driver = await cargar();
    const steps = PASOS.filter((p) => document.querySelector(p.element) && document.querySelector(p.element).offsetParent !== null).map((p) => ({ element: p.element, popover: { title: p.titulo, description: p.texto } }));
    if (steps.length < 2) return false;
    const d = driver({ showProgress: true, steps, nextBtnText: 'Siguiente', prevBtnText: 'Atrás', doneBtnText: 'Listo', progressText: '{{current}} de {{total}}', onDestroyed: marcar });
    d.drive();
    return true;
  } catch {
    return false;
  }
}
