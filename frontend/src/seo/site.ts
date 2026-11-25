import { BRAND } from '../config/brand';

/** The one public address of the site. Other domains (sinsub.cc, www.) redirect here. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL?.trim() || 'https://sinsub.lk').replace(/\/+$/, '');

export const absoluteUrl = (path: string) => `${SITE_URL}${path === '/' ? '/' : path}`;

/** Share image (1200×630) in public/. */
export const OG_IMAGE = `${SITE_URL}/og-image.png`;

export interface SeoMeta {
  /** Page title without the brand; the home pages give the full title. */
  title: string;
  description: string;
  path: string;
  lang: 'en' | 'si';
  /** Pages that must stay out of search results (sign-in, the app). */
  noindex?: boolean;
  /** Language versions of this page, for hreflang. */
  alternates?: { lang: 'en' | 'si' | 'x-default'; path: string }[];
  /** Full title as written (home pages); otherwise "<title> | Sinsub". */
  fullTitle?: boolean;
  /** schema.org objects for this page. */
  jsonLd?: object[];
  /** 'article' for guides. */
  type?: 'website' | 'article';
}

export const pageTitle = (meta: SeoMeta) => (meta.fullTitle ? meta.title : `${meta.title} | ${BRAND.name}`);

/** The head tags for a page, as plain data (used by the prerender and by the browser). */
export function headTags(meta: SeoMeta) {
  const url = absoluteUrl(meta.path);
  const title = pageTitle(meta);
  const metas: Record<string, string>[] = [
    { name: 'description', content: meta.description },
    { name: 'robots', content: meta.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large' },
    { property: 'og:type', content: meta.type ?? 'website' },
    { property: 'og:site_name', content: BRAND.name },
    { property: 'og:title', content: title },
    { property: 'og:description', content: meta.description },
    { property: 'og:url', content: url },
    { property: 'og:image', content: OG_IMAGE },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:locale', content: meta.lang === 'si' ? 'si_LK' : 'en_US' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: meta.description },
    { name: 'twitter:image', content: OG_IMAGE },
  ];
  const links: Record<string, string>[] = [
    { rel: 'canonical', href: url },
    ...(meta.alternates ?? []).map((a) => ({ rel: 'alternate', hreflang: a.lang, href: absoluteUrl(a.path) })),
  ];
  return { title, metas, links, jsonLd: meta.jsonLd ?? [] };
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The head tags as an HTML string, for prerendered pages. */
export function headHtml(meta: SeoMeta): string {
  const tags = headTags(meta);
  const attrs = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}="${escapeAttr(v)}"`).join(' ');
  return [
    `<title>${escapeAttr(tags.title)}</title>`,
    ...tags.metas.map((m) => `<meta ${attrs(m)} data-seo>`),
    ...tags.links.map((l) => `<link ${attrs(l)} data-seo>`),
    // "<" is escaped so the JSON can't close the script tag.
    ...tags.jsonLd.map((d) => `<script type="application/ld+json" data-seo>${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`),
  ].join('\n    ');
}
