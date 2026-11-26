// Activa o desactiva el contador de visitas (GoatCounter, gratis y sin cookies).
//   1) Creá tu cuenta en https://www.goatcounter.com/signup  (elegí un código, ej. "sarmiento" → sarmiento.goatcounter.com)
//   2) npm run visitas -- --codigo=sarmiento
//   3) Subí los cambios (git add . / commit / push). Las estadísticas las ves en https://sarmiento.goatcounter.com
//   npm run visitas -- --quitar        (lo apaga)
import { readFile, writeFile } from 'node:fs/promises';
const metaUrl = new URL('../data/meta.json', import.meta.url);
const meta = JSON.parse(await readFile(metaUrl, 'utf8'));
const code = process.argv.find((a) => a.startsWith('--codigo='))?.split('=')[1]?.trim().toLowerCase();
if (process.argv.includes('--quitar')) delete meta.analytics;
else if (code && /^[a-z0-9][a-z0-9-]{1,40}$/.test(code)) meta.analytics = { goatcounter: code };
else { console.log('Uso: npm run visitas -- --codigo=TUCODIGO   (o --quitar)\nEl código es el nombre que elegiste en goatcounter.com (solo letras, números y guiones).'); process.exit(1); }
meta.dataRev = Date.now().toString(36);
await writeFile(metaUrl, JSON.stringify(meta, null, 2) + '\n');
console.log(meta.analytics ? `Listo: contador activo en https://${meta.analytics.goatcounter}.goatcounter.com (no cuenta las visitas desde localhost).` : 'Listo: contador apagado.');
