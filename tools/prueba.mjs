// Prueba automática: abre la guía en un navegador de verdad, mira que cargue, que se pueda buscar y que no haya errores.
//   SITIO=https://nawelm187.github.io/guia-sarmiento/ node tools/prueba.mjs     (necesita: npm i playwright)
//   AXE=1 …  además revisa accesibilidad con axe-core (informa, no falla)
import { chromium } from 'playwright';

const SITIO = process.env.SITIO || 'https://nawelm187.github.io/guia-sarmiento/';
const fallas = [], avisos = [];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1200, height: 800 }, locale: 'es-AR' });
await ctx.addInitScript(() => { try { localStorage.setItem('guia-accesibilidad', JSON.stringify({ theme: 'auto', text: 0, contrast: false, calm: true, simple: false, map2d: true })); localStorage.setItem('guia.intro.v1', '1'); } catch {} window.__noIntro = true; });
const pg = await ctx.newPage();
const errores = [];
pg.on('pageerror', (e) => errores.push(String(e)));
pg.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(SITIO.slice(0, 20))) avisos.push(`HTTP ${r.status()}: ${r.url()}`); });
try {
  await pg.goto(SITIO, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await pg.waitForSelector('.tab', { timeout: 45000 });
  const tabs = await pg.locator('.tab').count();
  if (tabs < 3) fallas.push(`Se esperaban pestañas y hay ${tabs}.`);
  await pg.click('#tab-lugares').catch(() => {});
  await pg.fill('#q', 'farmacia');
  await pg.waitForTimeout(500);
  const res = await pg.locator('#results .item').count();
  if (res < 1) avisos.push('Buscar «farmacia» no devolvió resultados.');
  await pg.click('#tab-hoy');
  await pg.waitForTimeout(800);
  if (!(await pg.innerText('#body')).trim()) fallas.push('La pestaña «Hoy» está vacía.');
  if (process.env.AXE) {
    try {
      await pg.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js' });
      const r = await pg.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => ({ id: v.id, impacto: v.impact, n: v.nodes.length, ayuda: v.help })));
      r.filter((v) => v.impacto === 'critical' || v.impacto === 'serious').forEach((v) => avisos.push(`Accesibilidad (${v.impacto}): ${v.ayuda} — ${v.n} elemento(s) [${v.id}]`));
      console.log(`axe: ${r.length} tipo(s) de problema de accesibilidad.`);
    } catch (e) { avisos.push('No pude correr axe: ' + e.message); }
  }
} catch (e) { fallas.push('No cargó la guía: ' + e.message); }
const graves = errores.filter((e) => !/ResizeObserver|WebGL|GL context/i.test(e));
if (graves.length) fallas.push('Errores de JavaScript: ' + graves.slice(0, 3).join(' | '));
await b.close();
avisos.forEach((a) => console.log('⚠️  ' + a));
fallas.forEach((f) => console.log('❌ ' + f));
if (!fallas.length) console.log('✅ La guía carga y funciona.');
if (process.env.GITHUB_OUTPUT) {
  const fs = await import('node:fs');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `fallo=${fallas.length ? 'si' : 'no'}\ncuerpo<<EOF\n${[...fallas.map((f) => '- ❌ ' + f), ...avisos.map((a) => '- ⚠️ ' + a)].join('\n') || 'Sin detalles.'}\nEOF\n`);
}
process.exit(fallas.length ? 1 : 0);
