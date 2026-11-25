import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { seoFor } from './pages';
import { headTags } from './site';

/** Removes the SEO tags of the previous page (all carry data-seo). */
function clearSeoTags() {
  document.head.querySelectorAll('[data-seo]').forEach((el) => el.remove());
}

function addTag(tag: 'meta' | 'link' | 'script', attrs: Record<string, string>, text?: string) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  el.setAttribute('data-seo', '');
  if (text) el.textContent = text;
  document.head.appendChild(el);
}

/**
 * Keeps the head (title, description, canonical, share tags, structured data) in step with the URL.
 * Public pages get their own tags; app pages are marked noindex.
 */
export function SeoManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = seoFor(pathname);
    clearSeoTags();
    if (!meta) {
      addTag('meta', { name: 'robots', content: 'noindex, nofollow' });
      return;
    }
    const tags = headTags(meta);
    document.title = tags.title;
    document.documentElement.lang = meta.lang;
    tags.metas.forEach((m) => addTag('meta', m));
    tags.links.forEach((l) => addTag('link', l));
    tags.jsonLd.forEach((d) => addTag('script', { type: 'application/ld+json' }, JSON.stringify(d)));
  }, [pathname]);
  return null;
}
