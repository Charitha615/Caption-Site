/**
 * SEO data for every public URL: title, description, language versions and structured data.
 * Used by the browser (useSeo), the prerender step and the sitemap.
 */
import { BRAND } from '../config/brand';
import { PRICING_CURRENCY, PRICING_PLANS } from '../config/pricing';
import { CONTENT_PAGES, guidesLabel, guidesOf, guidesPath, homePath, otherLanguagePath, type ContentPageData, type Lang } from '../pages/Marketing/content';
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

/** hreflang links for a page that exists in both languages (English is the default). */
function alternatesFor(path: string, lang: Lang): SeoMeta['alternates'] {
  const other = otherLanguagePath(path);
  if (!other) return undefined;
  const en = lang === 'en' ? path : other;
  const si = lang === 'si' ? path : other;
  return [{ lang: 'en', path: en }, { lang: 'si', path: si }, { lang: 'x-default', path: en }];
}

function contentMeta(page: ContentPageData): SeoMeta {
  const trail = page.kind === 'guide'
    ? [{ name: BRAND.name, path: homePath(page.lang) }, { name: guidesLabel(page.lang), path: guidesPath(page.lang) }, { name: page.h1, path: page.path }]
    : [{ name: BRAND.name, path: homePath(page.lang) }, { name: page.linkLabel, path: page.path }];
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
    alternates: alternatesFor(page.path, page.lang),
    jsonLd: withContext(ld),
  };
}

function guidesIndexMeta(lang: Lang, title: string, description: string): SeoMeta {
  const path = guidesPath(lang);
  return {
    title,
    description,
    path,
    lang,
    alternates: alternatesFor(path, lang),
    jsonLd: withContext([
      { '@type': 'CollectionPage', name: guidesLabel(lang), inLanguage: lang, hasPart: guidesOf(lang).map((g) => ({ '@type': 'Article', headline: g.h1, url: absoluteUrl(g.path) })) },
      breadcrumbs([{ name: BRAND.name, path: homePath(lang) }, { name: guidesLabel(lang), path }]),
    ]),
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
    alternates: alternatesFor('/', 'en'),
    jsonLd: withContext([organization, website, app, faqLd(LANDING_FAQ)]),
  },
  ...CONTENT_PAGES.map(contentMeta),
  guidesIndexMeta('en', 'Guides: Sinhala Subtitles, Captions and Video Editing',
    'Step-by-step guides for adding Sinhala subtitles to YouTube, making captions for TikTok and Reels, and creating SRT files.'),
  guidesIndexMeta('si', 'මාර්ගෝපදේශ: සිංහල Subtitles, Captions සහ Video Editing',
    'YouTube වලට සිංහල subtitles දාන හැටි, TikTok සහ Reels වලට captions හදන හැටි, SRT files හදන හැටි වගේ පියවරෙන් පියවර මාර්ගෝපදේශ.'),
  {
    title: 'Privacy Policy',
    description: `How ${BRAND.name} collects, uses and protects your account details, videos and captions, including Google sign-in.`,
    path: '/privacy',
    lang: 'en',
    jsonLd: withContext([breadcrumbs([{ name: BRAND.name, path: '/' }, { name: 'Privacy Policy', path: '/privacy' }])]),
  },
];

/** Pages that are public but kept out of search results. */
export const NOINDEX_PAGES: SeoMeta[] = [
  { title: 'Sign in', description: `Sign in to ${BRAND.name}.`, path: '/login', lang: 'en', noindex: true },
  { title: 'Create your free account', description: `Create a free ${BRAND.name} account.`, path: '/register', lang: 'en', noindex: true },
  { title: 'Forgot password', description: `Reset your ${BRAND.name} password.`, path: '/forgot-password', lang: 'en', noindex: true },
  { title: 'Set a new password', description: `Choose a new ${BRAND.name} password.`, path: '/reset-password', lang: 'en', noindex: true },
];

export const seoFor = (path: string): SeoMeta | undefined =>
  [...PUBLIC_PAGES, ...NOINDEX_PAGES].find((p) => p.path === (path.replace(/\/+$/, '') || '/'));
