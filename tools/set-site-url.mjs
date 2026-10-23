// Configura la URL pública del sitio: canonical, og:url, imágenes absolutas para compartir,
// robots.txt y sitemap.xml. Correlo de nuevo cuando cambies a un dominio propio.
//
//   npm run site-url -- https://TU-USUARIO.github.io/guia-sarmiento/
//   npm run site-url -- https://guiasarmiento.com.ar/

import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
let site = process.argv[2];
if (!site || !/^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(site)) {
  throw new Error('Uso: npm run site-url -- https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/');
}
if (!site.endsWith('/')) site += '/';

const htmlUrl = new URL('index.html', root);
let html = await readFile(htmlUrl, 'utf8');

const block = `<!-- site-url:start -->
<link rel="canonical" href="${site}">
<meta property="og:url" content="${site}">
<meta property="og:image" content="${site}og.jpg">
<meta name="twitter:image" content="${site}og.jpg">
<!-- site-url:end -->`;
if (!html.includes('<!-- site-url:start -->')) throw new Error('index.html no tiene el bloque site-url');
html = html.replace(/<!-- site-url:start -->[\s\S]*?<!-- site-url:end -->/, block);
// og:image relativo original (si todavía está) se elimina para no duplicarlo
html = html.replace(/<meta property="og:image" content="og\.jpg">\n?/, '');
await writeFile(htmlUrl, html);

await writeFile(new URL('robots.txt', root), `User-agent: *\nAllow: /\n\nSitemap: ${site}sitemap.xml\n`);

const meta = JSON.parse(await readFile(new URL('data/meta.json', root), 'utf8'));
await writeFile(
  new URL('sitemap.xml', root),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${site}</loc><lastmod>${meta.date}</lastmod></url>\n</urlset>\n`,
);
console.log(`Listo: ${site}\nSe actualizaron index.html, robots.txt y sitemap.xml`);
