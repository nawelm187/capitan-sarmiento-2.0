// Configura a dónde llegan los avisos de «⚠ Reportar un dato» (aparece en cada ficha de lugar).
//   npm run contacto -- --whatsapp=5493564123456        (código de país 54 + 9 + código de área + número, sin + ni espacios)
//   npm run contacto -- --email=tu@correo.com
//   npm run contacto -- --quitar                         (saca el botón)
import { readFile, writeFile } from 'node:fs/promises';
const metaUrl = new URL('../data/meta.json', import.meta.url);
const meta = JSON.parse(await readFile(metaUrl, 'utf8'));
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
if (process.argv.includes('--quitar')) delete meta.contact;
else {
  const wa = arg('whatsapp'), em = arg('email');
  if (!wa && !em) { console.log('Uso: npm run contacto -- --whatsapp=5493564123456   o   --email=tu@correo.com   (o --quitar)'); process.exit(1); }
  meta.contact = { ...(meta.contact || {}), ...(wa ? { whatsapp: wa.replace(/\D/g, '') } : {}), ...(em ? { email: em } : {}) };
}
meta.dataRev = Date.now().toString(36);
await writeFile(metaUrl, JSON.stringify(meta, null, 2) + '\n');
console.log(meta.contact ? `Listo: el botón «Reportar un dato» usa ${JSON.stringify(meta.contact)}.` : 'Listo: sin botón de reporte.');
