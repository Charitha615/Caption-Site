export interface BrandConfig {
  name: string;
  shortName: string;
  logoText: string;
  tagline: string;
  description: string;
  supportEmail: string;
  website: string;
  colors: {
    primary: string;
    accent: string;
    dark: string;
    background: string;
    lightPurple: string;
  };
  supportedLanguages: Array<{
    code: string;
    name: string;
    native: string;
    flag: string;
  }>;
  version: string;
}

/**
 * CENTRALIZED BRAND CONFIGURATION
 * To rename product across the entire application (e.g. to "පේළිCap"),
 * change the values here in this single source of truth.
 * Full Unicode & Sinhala characters are fully supported.
 */
export const BRAND: BrandConfig = {
  name: "SampleCap",
  shortName: "SampleCap",
  logoText: "SampleCap",
  tagline: "AI-powered video captions",
  description: "Create, edit and export captions with AI.",
  supportEmail: "support@samplecap.com",
  website: "http://localhost:5173",
  colors: {
    primary: "#5B21B6",
    accent: "#F97316",
    dark: "#171717",
    background: "#F8FAFC",
    lightPurple: "#F5F3FF",
  },
  supportedLanguages: [
    { code: "si", name: "Sinhala", native: "සිංහල", flag: "🇱🇰" },
    { code: "en", name: "English", native: "English", flag: "🇺🇸" },
  ],
  version: "1.0.0",
};
