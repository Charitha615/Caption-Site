import { useEffect } from 'react';
import { BRAND } from '../config/brand';
import { seoFor } from '../seo/pages';

/** Sets the tab title of app screens. Public pages get theirs (and their meta tags) from SeoManager. */
export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    if (typeof window !== 'undefined' && seoFor(window.location.pathname)) return;
    document.documentElement.lang = 'en';
    document.title = title ? `${title} • ${BRAND.name}` : `${BRAND.name} — ${BRAND.tagline}`;
  }, [title]);
}
