// Sube la versión en todos lados a la vez: VERSION, package.json, data/meta.json y sw.js
// (el service worker usa la versión para renovar la caché).
//
//   npm run bump -- patch        1.0.0 -> 1.0.1
//   npm run bump -- minor        1.0.1 -> 1.1.0
//   npm run bump -- major        1.1.0 -> 2.0.0
//   npm run bump -- 1.4.2        versión exacta
//
// Agrega una entrada vacía al CHANGELOG para que la completes.

import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');
const write = (p, s) => writeFile(new URL(p, root), s);

const current = (await read('VERSION')).trim();
const arg = process.argv[2] || 'patch';
let next;
if (/^\d+\.\d+\.\d+$/.test(arg)) next = arg;
else {
  const [a, b, c] = current.split('.').map(Number);
  if (arg === 'major') next = `${a + 1}.0.0`;
  else if (arg === 'minor') next = `${a}.${b + 1}.0`;
  else if (arg === 'patch') next = `${a}.${b}.${c + 1}`;
  else throw new Error('Uso: npm run bump -- patch|minor|major|X.Y.Z');
}
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

await write('VERSION', next + '\n');

const pkg = JSON.parse(await read('package.json'));
pkg.version = next;
await write('package.json', JSON.stringify(pkg, null, 2) + '\n');

const meta = JSON.parse(await read('data/meta.json'));
meta.version = next;
meta.date = today;
await write('data/meta.json', JSON.stringify(meta, null, 2) + '\n');

const sw = await read('sw.js');
if (!/const VERSION = '[^']*';/.test(sw)) throw new Error('No encontré "const VERSION" en sw.js');
await write('sw.js', sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${next}';`));

const log = await read('CHANGELOG.md');
const entry = `## ${next} · ${today}\n\n- (completá qué cambió)\n\n`;
await write('CHANGELOG.md', log.replace(/^(# [^\n]*\n\n)/, `$1${entry}`));

console.log(`Versión ${current} -> ${next} (${today})`);
