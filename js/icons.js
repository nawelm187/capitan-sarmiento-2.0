// Categorías de lugares e íconos (SVG inline, sin dependencias).

const svg = (inner, size = 16) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;

export const ICONS = {
  comer: svg('<path d="M7 3v7a2 2 0 0 0 4 0V3M9 3v18M17 21V3c-2.2 1.6-3 4-3 7v3h3"/>'),
  dormir: svg('<path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11" r="1.6"/>'),
  ver: svg('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>'),
  servicios: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  walk: svg('<circle cx="13" cy="4.5" r="1.6"/><path d="M12 8l-2 5 3 2 1 6M10 13l-3 3M12 8l3 3 3 1"/>'),
  car: svg('<path d="M5 16l1.5-5a2 2 0 0 1 1.9-1.4h7.2A2 2 0 0 1 17.5 11L19 16"/><path d="M3 16h18v3H3z"/>'),
  guide: svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  pin: svg('<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>'),
};

export const CATS = [
  { id: 'comer', label: 'Comer', color: '#e8795a' },
  { id: 'dormir', label: 'Dormir', color: '#6aa7e8' },
  { id: 'ver', label: 'Qué ver', color: '#e0a53a' },
  { id: 'servicios', label: 'Servicios', color: '#7ccfa0' },
];

export const catInfo = (id) => CATS.find((c) => c.id === id) || CATS[2];
export const catIcon = (id) => ICONS[id] || ICONS.pin;
