/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_BRAND_NAME?: string;
  readonly VITE_BRAND_SHORT_NAME?: string;
  readonly VITE_BRAND_TAGLINE?: string;
  readonly VITE_BRAND_DESCRIPTION?: string;
  readonly VITE_BRAND_SUPPORT_EMAIL?: string;
  readonly VITE_SHOW_DEMO_LOGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
