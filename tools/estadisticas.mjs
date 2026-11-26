// Qué se mira más en la guía (lugares, recorridos, pestañas), con los datos de GoatCounter.
//
// 1) En GoatCounter: Configuración (Settings) → «API» → crear un token con permiso de lectura («Read statistics»).
// 2) Correr:  npm run estadisticas -- --token=TU_TOKEN
//    (el código del sitio sale de data/meta.json; si querés otro: --codigo=micodigo; días: --dias=30)
// El token es secreto: no lo subas a GitHub ni lo pegues en un archivo del proyecto.
import { readFile, writeFile } from 'node:fs/promises';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const token = arg('token') || process.env.GOATCOUNTER_TOKEN;
let codigo = arg('codigo');
const dias = Math.min(365, Math.max(1, Number(arg('dias')) || 30));
if (!codigo) { try { codigo = JSON.parse(await readFile(new URL('../data/meta.json', import.meta.url), 'utf8')).analytics?.goatcounter; } catch { /* nada */ } }
if (!token || !codigo) { console.log('Falta el token o el código. Mirá las instrucciones al principio de tools/estadisticas.mjs'); process.exit(1); }

const fin = new Date(), ini = new Date(Date.now() - dias * 86400000);
const q = new URLSearchParams({ start: ini.toISOString(), end: fin.toISOString(), limit: '100' });
const r = await fetch(`https://${codigo}.goatcounter.com/api/v0/stats/hits?${q}`, { headers: { Authorization: `Bearer ${token}` } });
if (!r.ok) { console.log(`GoatCounter respondió ${r.status}. Revisá el token y el código.`); process.exit(1); }
const j = await r.json();
const hits = (j.hits || []).map((h) => ({ path: h.path, titulo: h.title || h.path, n: h.count ?? 0 }));
const grupo = (pref) => hits.filter((h) => h.path.startsWith(pref)).sort((a, b) => b.n - a.n).slice(0, 10);
const bloque = (t, l) => `\n${t}\n${l.length ? l.map((h, i) => `  ${i + 1}. ${h.titulo.replace(/^[^:]+: /, '')} — ${h.n}`).join('\n') : '  (todavía sin datos)'}`;
const salida = [`Estadísticas de los últimos ${dias} días (${codigo}.goatcounter.com)`, bloque('Lugares más vistos', grupo('lugar/')), bloque('Recorridos más abiertos', grupo('recorrido/')), bloque('Pestañas', grupo('pestana/')), bloque('Fotos 360°', grupo('360/'))].join('\n');
console.log(salida);
await writeFile(new URL('../estadisticas.txt', import.meta.url), salida + '\n');
console.log('\nGuardé una copia en estadisticas.txt');
// «Lo más visto» en la pestaña Hoy: los 8 lugares más abiertos (se publica con git add .)
const populares = grupo('lugar/').slice(0, 8).filter((h) => h.n >= 2).map((h) => ({ id: h.path.replace('lugar/', ''), n: h.n }));
const { mkdir } = await import('node:fs/promises');
await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/populares.json', import.meta.url), JSON.stringify(populares, null, 2) + '\n');
try {
  const mu = new URL('../data/meta.json', import.meta.url);
  const meta = JSON.parse(await readFile(mu, 'utf8'));
  meta.dataRev = Date.now().toString(36);
  await writeFile(mu, JSON.stringify(meta, null, 2) + '\n');
} catch { /* sin meta */ }
console.log(`«Lo más visto» actualizado en data/populares.json (${populares.length} lugares).`);
