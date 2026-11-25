/**
 * SEO data for every public URL: title, description, language versions and structured data.
 * Used by the browser (useSeo), the prerender step and the sitemap.
 */
import { BRAND } from '../config/brand';
import { PRICING_CURRENCY, PRICING_PLANS } from '../config/pricing';
import { CONTENT_PAGES, GUIDES, type ContentPageData } from '../pages/Marketing/content';
import { LANDING_FAQ } from '../pages/Landing/landingFaq';
import { absoluteUrl, OG_IMAGE, SITE_URL, type SeoMeta } from './site';

const organization = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: BRAND.name,
  alternateName: BRAND.logoText,
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/apple-touch-icon.png`,
  email: BRAND.supportEmail,
  areaServed: 'LK',
};

const website = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: BRAND.name,
  url: `${SITE_URL}/`,
  inLanguage: ['en', 'si'],
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const app = {
  '@type': 'WebApplication',
  name: BRAND.name,
  url: `${SITE_URL}/`,
  image: OG_IMAGE,
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (web browser)',
  inLanguage: ['si', 'en'],
  description: 'Automatic Sinhala and English video captions with word-level timing, caption styles, SRT/VTT export and an online video editor.',
  offers: PRICING_PLANS.map((p) => ({
    '@type': 'Offer',
    name: p.name,
    price: String(p.price),
    priceCurrency: PRICING_CURRENCY,
    category: p.price === 0 ? 'free' : 'subscription',
  })),
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const faqLd = (faq: { q: string; a: string }[]) => ({
  '@type': 'FAQPage',
  mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

const breadcrumbs = (trail: { name: string; path: string }[]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: absoluteUrl(t.path) })),
});

const withContext = (items: object[]) => items.map((i) => ({ '@context': 'https://schema.org', ...i }));

const HOME_ALTERNATES: SeoMeta['alternates'] = [
  { lang: 'en', path: '/' },
  { lang: 'si', path: '/si' },
  { lang: 'x-default', path: '/' },
];

function contentMeta(page: ContentPageData): SeoMeta {
  const trail = page.kind === 'guide'
    ? [{ name: BRAND.name, path: '/' }, { name: 'Guides', path: '/guides' }, { name: page.h1, path: page.path }]
    : [{ name: BRAND.name, path: '/' }, { name: page.linkLabel, path: page.path }];
  const ld: object[] = [];
  if (page.kind === 'home') ld.push(organization, website, app);
  if (page.kind === 'feature') ld.push(app);
  if (page.kind === 'guide') {
    ld.push({
      '@type': 'Article',
      headline: page.h1,
      description: page.description,
      inLanguage: page.lang,
      datePublished: page.updated,
      dateModified: page.updated,
      image: OG_IMAGE,
      mainEntityOfPage: absoluteUrl(page.path),
      author: { '@id': `${SITE_URL}/#organization` },
      publisher: { '@id': `${SITE_URL}/#organization` },
    });
    const steps = page.sections.flatMap((s) => s.blocks).find((b) => b.kind === 'steps');
    if (steps?.kind === 'steps') {
      ld.push({
        '@type': 'HowTo',
        name: page.h1,
        step: steps.items.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.title, text: s.text })),
      });
    }
  }
  if (page.faq?.length) ld.push(faqLd(page.faq));
  if (page.kind !== 'home') ld.push(breadcrumbs(trail));
  return {
    title: page.title,
    fullTitle: page.kind === 'home',
    description: page.description,
    path: page.path,
    lang: page.lang,
    type: page.kind === 'guide' ? 'article' : 'website',
    alternates: page.kind === 'home' ? HOME_ALTERNATES : undefined,
    jsonLd: withContext(ld),
  };
}

/** Every public, indexable page. */
export const PUBLIC_PAGES: SeoMeta[] = [
  {
    title: `${BRAND.name} – Sinhala & English Video Captions and Subtitles`,
    fullTitle: true,
    description: 'Automatic Sinhala and English captions for your videos, with word-by-word timing, beautiful styles and SRT, VTT or MP4 export. Free to start.',
    path: '/',
    lang: 'en',
    alternates: HOME_ALTERNATES,
    jsonLd: withContext([organization, website, app, faqLd(LANDING_FAQ)]),
  },
  ...CONTENT_PAGES.map(contentMeta),
  {
    title: 'Guides: Sinhala Subtitles, Captions and Video Editing',
    description: 'Step-by-step guides for adding Sinhala subtitles to YouTube, making captions for TikTok and Reels, and creating SRT files.',
    path: '/guides',
    lang: 'en',
    jsonLd: withContext([
      { '@type': 'CollectionPage', name: 'Guides', hasPart: GUIDES.map((g) => ({ '@type': 'Article', headline: g.h1, url: absoluteUrl(g.path) })) },
      breadcrumbs([{ name: BRAND.name, path: '/' }, { name: 'Guides', path: '/guides' }]),
    ]),
  },
];

/** Pages that are public but kept out of search results. */
export const NOINDEX_PAGES: SeoMeta[] = [
  { title: 'Sign in', description: `Sign in to ${BRAND.name}.`, path: '/login', lang: 'en', noindex: true },
  { title: 'Create your free account', description: `Create a free ${BRAND.name} account.`, path: '/register', lang: 'en', noindex: true },
];

export const seoFor = (path: string): SeoMeta | undefined =>
  [...PUBLIC_PAGES, ...NOINDEX_PAGES].find((p) => p.path === (path.replace(/\/+$/, '') || '/'));
