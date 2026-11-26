// Contador de visitas con GoatCounter (gratis, sin cookies, no guarda datos personales): https://www.goatcounter.com
// Se activa con:  npm run visitas -- --codigo=TUCODIGO   (guarda meta.analytics.goatcounter)
// Cuenta: entradas a la guía, lugares vistos, recorridos, pestañas. Nunca cuenta desde localhost.
const OK = /^[a-z0-9][a-z0-9-]{1,40}$/i;

export function iniciarVisitas(meta) {
  const code = meta?.analytics?.goatcounter;
  if (!code || !OK.test(code) || typeof document === 'undefined') return false;
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return false;
  if (document.querySelector('script[data-goatcounter]')) return true;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
  document.head.appendChild(s);
  return true;
}

/** Cuenta un «evento» (lugar visto, recorrido abierto…). Si GoatCounter no está, no hace nada. */
export function contar(path, title) {
  try {
    window.goatcounter?.count?.({ path: String(path).slice(0, 120), title: String(title || path).slice(0, 120), event: true });
  } catch { /* sin contador */ }
}
