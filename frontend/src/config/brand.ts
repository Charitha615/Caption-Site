export interface BrandConfig {
  name: string;
  shortName: string;
  logoText: string;
  tagline: string;
  description: string;
  supportEmail: string;
  colors: {
    primary: string;
    accent: string;
    dark: string;
    background: string;
    lightPurple: string;
  };
  supportedLanguages: Array<{
    code: 'si' | 'en';
    name: string;
    native: string;
    flag: string;
  }>;
  version: string;
}

const env = import.meta.env;
const name = env.VITE_BRAND_NAME?.trim() || 'SampleCap';

/**
 * SINGLE SOURCE OF FRONTEND BRANDING.
 *
 * Rename the product (e.g. to "පේළිCap") with VITE_BRAND_NAME in frontend/.env —
 * every screen, the document title and index.html read from here. Pair it with
 * BRAND_NAME in backend/.env (used in API metadata and rendered files).
 */
export const BRAND: BrandConfig = {
  name,
  shortName: env.VITE_BRAND_SHORT_NAME?.trim() || name,
  logoText: name,
  tagline: env.VITE_BRAND_TAGLINE?.trim() || 'AI-powered video captions',
  description: env.VITE_BRAND_DESCRIPTION?.trim() || 'Create, edit and export captions with AI.',
  supportEmail: env.VITE_BRAND_SUPPORT_EMAIL?.trim() || 'support@example.com',
  colors: {
    primary: '#5B21B6',
    accent: '#F97316',
    dark: '#171717',
    background: '#F8FAFC',
    lightPurple: '#F5F3FF',
  },
  supportedLanguages: [
    { code: 'si', name: 'Sinhala', native: 'සිංහල', flag: '🇱🇰' },
    { code: 'en', name: 'English', native: 'English', flag: '🇺🇸' },
  ],
  version: '1.0.0',
};
