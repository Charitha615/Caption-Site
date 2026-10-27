import { useEffect } from 'react';
import { BRAND } from '../config/brand';

export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    if (title) {
      document.title = `${title} • ${BRAND.name}`;
    } else {
      document.title = `${BRAND.name} — ${BRAND.tagline}`;
    }
  }, [title]);
}
