// Controla que la web esté viva y con datos al día: npm run monitoreo
// También lo corre GitHub cada 30 minutos (.github/workflows/monitoreo.yml) y, si algo falla, abre un aviso (Issue)
// en tu repositorio: GitHub te lo manda por mail. Cuando vuelve a funcionar, lo cierra solo.
const SITIO = (process.env.SITIO || 'https://nawelm187.github.io/guia-sarmiento/').replace(/\/?$/, '/');
const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
const fallas = [], avisos = [];

async function bajar(ruta, { json = false } = {}) {
  const t0 = Date.now();
  const r = await fetch(SITIO + ruta + (ruta.includes('?') ? '&' : '?') + 'm=' + Date.now(), { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${ruta}: respondió ${r.status}`);
  const x = json ? await r.json() : await r.text();
  return { x, ms: Date.now() - t0 };
}

try {
  const { x, ms } = await bajar('');
  if (!/Capit[aá]n Sarmiento/i.test(x)) fallas.push('La página principal no tiene el contenido esperado.');
  if (ms > 8000) avisos.push(`La página tardó ${Math.round(ms / 1000)} s en responder.`);
} catch (e) { fallas.push('No abre la página principal: ' + e.message); }

for (const f of ['sw.js', 'manifest.webmanifest', 'js/ui.js', 'js/clima.js']) {
  try { await bajar(f); } catch (e) { fallas.push('Falta o no responde: ' + e.message); }
}

let meta = null;
try { meta = (await bajar('data/meta.json', { json: true })).x; if (!meta?.center) fallas.push('data/meta.json no tiene el centro del mapa.'); } catch (e) { fallas.push('No carga data/meta.json: ' + e.message); }
try { const p = (await bajar('data/places.json', { json: true })).x; if (!Array.isArray(p) || p.length < 5) fallas.push('data/places.json está vacío o muy corto.'); } catch (e) { fallas.push('No carga data/places.json: ' + e.message); }

try {
  const t = (await bajar('data/turnos.json', { json: true })).x;
  const lista = Array.isArray(t) ? t : t?.turnos || [];
  if (!lista.some((x) => x.from <= hoy && hoy <= (x.to || x.from))) avisos.push('La farmacia de turno de hoy no está cargada todavía (data/turnos.json).');
} catch { avisos.push('No pude leer data/turnos.json (si no usás farmacia de turno, ignorá este aviso).'); }

try {
  const c = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-34.17&longitude=-59.79&current=temperature_2m', { signal: AbortSignal.timeout(15000) });
  if (!c.ok) avisos.push(`El servicio del clima (Open-Meteo) respondió ${c.status}. La web usa el último pronóstico guardado.`);
} catch { avisos.push('No pude consultar Open-Meteo desde acá.'); }

console.log(`Sitio: ${SITIO}`);
avisos.forEach((a) => console.log('⚠️  ' + a));
fallas.forEach((f) => console.log('❌ ' + f));
if (!fallas.length) console.log('✅ La web está funcionando.');
if (process.env.GITHUB_OUTPUT) {
  const fs = await import('node:fs');
  const cuerpo = [...fallas.map((f) => '- ❌ ' + f), ...avisos.map((a) => '- ⚠️ ' + a)].join('\n');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `fallo=${fallas.length ? 'si' : 'no'}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `cuerpo<<EOF\n${cuerpo || 'Sin detalles.'}\nEOF\n`);
}
process.exit(fallas.length ? 1 : 0);
