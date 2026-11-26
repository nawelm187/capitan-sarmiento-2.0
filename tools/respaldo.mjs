// Copia de seguridad: guarda data/ y fuentes/ en respaldos/AAAA-MM-DD_HHMM/ (se conservan las últimas 8).
//   npm run respaldo
// Corre solo antes de cada `node tools/apply-update.mjs`. Para volver atrás, copiá la carpeta data/ (o fuentes/) del respaldo.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const quiet = process.argv.includes('--silencioso');
if (!existsSync(join(root, 'data'))) { if (!quiet) console.log('No hay carpeta data/ para respaldar.'); process.exit(0); }
const d = new Date();
const p2 = (n) => String(n).padStart(2, '0');
const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`;
const dest = join(root, 'respaldos', stamp);
mkdirSync(dest, { recursive: true });
for (const dir of ['data', 'fuentes']) if (existsSync(join(root, dir))) cpSync(join(root, dir), join(dest, dir), { recursive: true });
const all = readdirSync(join(root, 'respaldos')).filter((n) => /^\d{4}-/.test(n)).sort();
for (const old of all.slice(0, Math.max(0, all.length - 8))) rmSync(join(root, 'respaldos', old), { recursive: true, force: true });
console.log(`✔ Respaldo guardado en respaldos/${stamp} (data/ y fuentes/). Se conservan los últimos 8.`);
