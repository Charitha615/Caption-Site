/**
 * After `vite build` (client) and `vite build --ssr` (dist-ssr), writes:
 *   dist/index.html, dist/<page>/index.html  – each public page with real HTML and its own head tags
 *   dist/app.html                            – the empty app shell, served for every other path (SPA fallback)
 *   dist/sitemap.xml, dist/robots.txt
 * Static hosts serve the page files directly; see docs/DEPLOYMENT.md for the fallback rule.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const ssrDir = join(root, 'dist-ssr');

const { render, PAGES, SITE_URL, sourceOf } = await import(pathToFileURL(join(ssrDir, 'entry-server.js')).href);
const template = await readFile(join(dist, 'index.html'), 'utf8');
const manifest = JSON.parse(await readFile(join(dist, '.vite', 'manifest.json'), 'utf8'));

/** CSS and JS chunks a source file needs (itself and everything it imports statically). */
function assetsOf(src) {
  const css = new Set();
  const js = new Set();
  const seen = new Set();
  const walk = (key) => {
    if (seen.has(key) || !manifest[key]) return;
    seen.add(key);
    const entry = manifest[key];
    js.add(entry.file);
    (entry.css ?? []).forEach((f) => css.add(f));
    (entry.imports ?? []).forEach(walk);
  };
  walk(src);
  return { css: [...css], js: [...js] };
}

/** The template without its default title and SEO tags (each page brings its own). */
const shell = template
  .replace(/<title>[\s\S]*?<\/title>\s*/, '')
  .replace(/\s*<(meta|link)[^>]*data-seo[^>]*>/g, '');

function pageHtml({ html, head, lang }, assets) {
  const extra = [
    head,
    ...assets.css.map((f) => `<link rel="stylesheet" href="/${f}">`),
    ...assets.js.map((f) => `<link rel="modulepreload" href="/${f}">`),
  ].join('\n    ');
  return shell
    .replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
    .replace('</head>', `    ${extra}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${html}</div>`);
}

for (const page of PAGES) {
  const out = page.path === '/' ? join(dist, 'index.html') : join(dist, page.path.slice(1), 'index.html');
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, pageHtml(render(page.path), assetsOf(sourceOf(page.path))));
}

// The app shell for signed-in screens and unknown paths: never indexed.
await writeFile(
  join(dist, 'app.html'),
  template.replace(/<meta name="robots"[^>]*>/, '').replace('</head>', '    <meta name="robots" content="noindex, nofollow">\n  </head>'),
);

const today = new Date().toISOString().slice(0, 10);
const loc = (path) => `${SITE_URL}${path === '/' ? '/' : path}`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${PAGES.map((p) => `  <url>
    <loc>${loc(p.path)}</loc>
    <lastmod>${p.updated ?? today}</lastmod>
${p.alternates.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.lang}" href="${loc(a.path)}"/>`).join('\n')}
  </url>`.replace(/\n\n/g, '\n')).join('\n')}
</urlset>
`;
await writeFile(join(dist, 'sitemap.xml'), sitemap);

await writeFile(join(dist, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /projects
Disallow: /settings
Disallow: /profile
Disallow: /admin
Disallow: /video-editor

Sitemap: ${SITE_URL}/sitemap.xml
`);

// The manifest and the server bundle were only needed for this step.
await rm(join(dist, '.vite'), { recursive: true, force: true });
await rm(ssrDir, { recursive: true, force: true });
console.log(`Prerendered ${PAGES.length} pages, sitemap.xml and robots.txt for ${SITE_URL}`);
