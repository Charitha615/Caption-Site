/**
 * Build-time renderer for the public pages (see scripts/prerender.mjs). Each page is rendered to
 * HTML with its head tags, so search engines and link previews get real content without running
 * JavaScript. In the browser the app then takes over as usual.
 */
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { LandingPage } from './pages/Landing/LandingPage';
import { ContentPage, GuidesPage } from './pages/Marketing/ContentPage';
import { contentPage, CONTENT_PAGES } from './pages/Marketing/content';
import { PUBLIC_PAGES, seoFor } from './seo/pages';
import { headHtml, SITE_URL } from './seo/site';

export { SITE_URL };

/** Every page to prerender, with what the sitemap needs. */
export const PAGES = PUBLIC_PAGES.map((p) => ({
  path: p.path,
  lang: p.lang,
  updated: contentPage(p.path)?.updated,
  alternates: p.alternates ?? [],
}));

/** Source file of each page's screen, to find its CSS and scripts in the build manifest. */
export function sourceOf(path: string): string {
  if (path === '/') return 'src/pages/Landing/LandingPage.tsx';
  return 'src/pages/Marketing/ContentPage.tsx';
}

function screenFor(path: string) {
  if (path === '/') return <LandingPage />;
  if (path === '/guides') return <GuidesPage />;
  if (CONTENT_PAGES.some((p) => p.path === path)) return <ContentPage path={path} />;
  throw new Error(`No public page at ${path}`);
}

export function render(path: string): { html: string; head: string; lang: string } {
  const meta = seoFor(path);
  if (!meta) throw new Error(`No SEO data for ${path}`);
  const html = renderToString(
    <StrictMode>
      <StaticRouter location={path}>{screenFor(path)}</StaticRouter>
    </StrictMode>,
  );
  return { html, head: headHtml(meta), lang: meta.lang };
}
