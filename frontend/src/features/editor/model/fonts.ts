/** Keep in sync with backend config/captions.php 'fonts' (same families/weights are burned into MP4). */
export interface FontOption {
  label: string;
  value: string;
  /** Google Fonts css2 family spec. Each family is loaded with its own <link> so one bad spec can't block the rest. */
  google?: string;
}

export const SINHALA_FONTS: FontOption[] = [
  { label: 'Noto Sans Sinhala', value: '"Noto Sans Sinhala", sans-serif', google: 'Noto+Sans+Sinhala:wght@400;500;600;700;800;900' },
  { label: 'Noto Serif Sinhala', value: '"Noto Serif Sinhala", serif', google: 'Noto+Serif+Sinhala:wght@400;500;600;700;800;900' },
  { label: 'Abhaya Libre', value: '"Abhaya Libre", serif', google: 'Abhaya+Libre:wght@400;500;600;700;800' },
  { label: 'Yaldevi', value: '"Yaldevi", sans-serif', google: 'Yaldevi:wght@400;500;600;700' },
  { label: 'Gemunu Libre', value: '"Gemunu Libre", sans-serif', google: 'Gemunu+Libre:wght@400;500;600;700;800' },
];

export const LATIN_FONTS: FontOption[] = [
  { label: 'Inter', value: '"Inter", sans-serif', google: 'Inter:wght@400;500;600;700;800;900' },
  { label: 'Poppins', value: '"Poppins", sans-serif', google: 'Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700;1,800;1,900' },
  { label: 'Montserrat', value: '"Montserrat", sans-serif', google: 'Montserrat:wght@400;500;600;700;800;900' },
  { label: 'Roboto', value: '"Roboto", sans-serif', google: 'Roboto:ital,wght@0,400;0,500;0,700;0,900;1,400;1,500;1,700;1,900' },
  { label: 'Merriweather', value: '"Merriweather", serif', google: 'Merriweather:ital,wght@0,400;0,700;0,900;1,400;1,700;1,900' },
  { label: 'Courier New', value: '"Courier New", monospace' },
];

export const FONT_WEIGHTS = [
  { label: 'Regular', value: 400 },
  { label: 'Medium', value: 500 },
  { label: 'Semibold', value: 600 },
  { label: 'Bold', value: 700 },
  { label: 'Extra bold', value: 800 },
  { label: 'Black', value: 900 },
];

let fontsInjected = false;

/** Lazily load caption fonts — only the editor needs them, not the whole app. */
export function ensureEditorFonts(): void {
  if (fontsInjected || typeof document === 'undefined') return;
  fontsInjected = true;
  for (const font of [...SINHALA_FONTS, ...LATIN_FONTS]) {
    if (!font.google) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
    link.dataset.editorFont = font.label;
    document.head.appendChild(link);
  }
}

/** Latin font first: it has no Sinhala glyphs, so the browser falls through to the Sinhala font per character. */
export function buildFontStack(englishFontFamily: string, sinhalaFontFamily: string): string {
  return `${englishFontFamily}, ${sinhalaFontFamily}, "Noto Sans Sinhala", sans-serif`;
}
