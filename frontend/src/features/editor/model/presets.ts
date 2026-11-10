import type { AlignMatrix, CaptionStyle } from './types';

export const ALIGN_POSITIONS: Record<AlignMatrix, { x: number; y: number; label: string }> = {
  'top-left': { x: 6, y: 7, label: 'Top left' },
  'top-center': { x: 50, y: 7, label: 'Top center' },
  'top-right': { x: 94, y: 7, label: 'Top right' },
  'mid-left': { x: 6, y: 50, label: 'Middle left' },
  center: { x: 50, y: 50, label: 'Center' },
  'mid-right': { x: 94, y: 50, label: 'Middle right' },
  'bottom-left': { x: 6, y: 92, label: 'Bottom left' },
  'bottom-center': { x: 50, y: 92, label: 'Bottom center' },
  'bottom-right': { x: 94, y: 92, label: 'Bottom right' },
};

export const DEFAULT_STYLE: CaptionStyle = {
  preset: 'modern',
  englishFontFamily: '"Inter", sans-serif',
  fontFamily: '"Noto Sans Sinhala", sans-serif',
  fontSize: 56,
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: 0,
  textColor: '#FFFFFF',
  highlightColor: '#F97316',
  outlineColor: '#000000',
  outlineWidth: 0,
  shadowColor: '#000000',
  shadowOpacity: 50,
  shadowBlur: 12,
  shadowOffsetX: 0,
  shadowOffsetY: 4,
  backgroundColor: '#111827',
  backgroundOpacity: 82,
  borderRadius: 16,
  padding: 18,
  textAlign: 'center',
  alignMatrix: 'bottom-center',
  positionX: 50,
  positionY: 92,
  maxWidth: 80,
  animation: 'fade',
};

/** Only the "look" of a preset — never touches position, so applying a preset keeps the user's layout. */
export type PresetLook = Omit<CaptionStyle, 'preset' | 'alignMatrix' | 'positionX' | 'positionY' | 'maxWidth' | 'textAlign'>;

export interface PresetDefinition {
  key: string;
  label: string;
  description: string;
  sample: string;
  look: PresetLook;
}

const look = (overrides: Partial<PresetLook>): PresetLook => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { preset, alignMatrix, positionX, positionY, maxWidth, textAlign, ...base } = DEFAULT_STYLE;
  return { ...base, ...overrides };
};

export const BUILT_IN_PRESETS: PresetDefinition[] = [
  {
    key: 'modern',
    label: 'Modern',
    description: 'Rounded dark pill, crisp white text.',
    sample: 'ලංකාවේ අලුත් Story',
    look: look({}),
  },
  {
    key: 'bold',
    label: 'Bold',
    description: 'Heavy yellow type with thick outline.',
    sample: 'ගැම්මටම කතා කරමු',
    look: look({
      fontSize: 68,
      fontWeight: 800,
      textColor: '#FACC15',
      highlightColor: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 8,
      shadowOpacity: 70,
      shadowBlur: 0,
      shadowOffsetY: 6,
      backgroundOpacity: 0,
      borderRadius: 0,
      padding: 8,
      animation: 'pop',
    }),
  },
  {
    key: 'minimal',
    label: 'Minimal',
    description: 'Clean white text, soft shadow, no box.',
    sample: 'සරල සහ අලංකාර',
    look: look({
      fontSize: 50,
      fontWeight: 500,
      shadowOpacity: 75,
      shadowBlur: 10,
      shadowOffsetY: 2,
      backgroundOpacity: 0,
      borderRadius: 0,
      padding: 8,
      animation: 'fade',
    }),
  },
  {
    key: 'cinema',
    label: 'Cinema',
    description: 'Serif film subtitles in warm ivory.',
    sample: 'සිනමා උපසිරැසි',
    look: look({
      englishFontFamily: '"Merriweather", serif',
      fontFamily: '"Noto Serif Sinhala", serif',
      fontSize: 52,
      fontWeight: 500,
      textColor: '#FEF3C7',
      highlightColor: '#FFFFFF',
      outlineWidth: 2,
      shadowOpacity: 90,
      shadowBlur: 6,
      shadowOffsetY: 2,
      backgroundOpacity: 0,
      borderRadius: 0,
      padding: 8,
      animation: 'none',
    }),
  },
  {
    key: 'youtube',
    label: 'YouTube',
    description: 'Solid black box, broadcast legibility.',
    sample: 'Subscribe කරන්න',
    look: look({
      englishFontFamily: '"Roboto", sans-serif',
      fontSize: 54,
      fontWeight: 500,
      highlightColor: '#EF4444',
      shadowOpacity: 0,
      shadowBlur: 0,
      shadowOffsetY: 0,
      backgroundColor: '#000000',
      backgroundOpacity: 75,
      borderRadius: 4,
      padding: 12,
      animation: 'none',
    }),
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    description: 'Big punchy words with live karaoke highlight.',
    sample: 'Trending වීඩියෝ',
    look: look({
      englishFontFamily: '"Poppins", sans-serif',
      fontSize: 72,
      fontWeight: 800,
      textColor: '#FFFFFF',
      highlightColor: '#F97316',
      outlineColor: '#000000',
      outlineWidth: 6,
      shadowOpacity: 60,
      shadowBlur: 0,
      shadowOffsetY: 5,
      backgroundOpacity: 0,
      borderRadius: 0,
      padding: 8,
      letterSpacing: 0.5,
      animation: 'karaoke',
    }),
  },
  {
    key: 'classic',
    label: 'Classic',
    description: 'Teletext yellow on a solid block.',
    sample: 'ටෙලිටෙක්ස්ට් මාදිලිය',
    look: look({
      englishFontFamily: '"Courier New", monospace',
      fontSize: 50,
      fontWeight: 700,
      textColor: '#FDE047',
      highlightColor: '#FFFFFF',
      shadowOpacity: 0,
      shadowBlur: 0,
      shadowOffsetY: 0,
      backgroundColor: '#000000',
      backgroundOpacity: 100,
      borderRadius: 2,
      padding: 12,
      animation: 'none',
    }),
  },
];

export const PRESETS_BY_KEY: Record<string, PresetDefinition> = Object.fromEntries(
  BUILT_IN_PRESETS.map((p) => [p.key, p])
);

export const ANIMATIONS: Array<{ id: CaptionStyle['animation']; label: string; description: string; timed: boolean }> = [
  { id: 'none', label: 'Static', description: 'No motion. Best for long-form and films.', timed: false },
  { id: 'fade', label: 'Fade', description: 'Gentle fade in on every caption.', timed: false },
  { id: 'pop', label: 'Pop', description: 'Springy scale-in for reels and shorts.', timed: false },
  { id: 'bounce', label: 'Bounce', description: 'Drops in with a bounce.', timed: false },
  { id: 'slide', label: 'Slide up', description: 'Rises softly into place.', timed: false },
  { id: 'typewriter', label: 'Typewriter', description: 'Reveals letter by letter over the caption duration.', timed: true },
  { id: 'karaoke', label: 'Karaoke', description: 'Colours the word currently being spoken.', timed: true },
  { id: 'highlight', label: 'Word box', description: 'Draws a highlight box behind the spoken word.', timed: true },
];

/** Layout templates: position & size combos the user can apply in one click. */
export const LAYOUT_TEMPLATES: Array<{ key: string; label: string; description: string; patch: Partial<CaptionStyle> }> = [
  { key: 'lower', label: 'Lower third', description: 'Standard subtitle position near the bottom.', patch: { alignMatrix: 'bottom-center', positionX: 50, positionY: 92, maxWidth: 80, textAlign: 'center' } },
  { key: 'shorts', label: 'Shorts center', description: 'Vertical video — just below center, large and narrow.', patch: { alignMatrix: 'center', positionX: 50, positionY: 62, maxWidth: 70, textAlign: 'center' } },
  { key: 'headline', label: 'Top headline', description: 'Title-style text at the top of the frame.', patch: { alignMatrix: 'top-center', positionX: 50, positionY: 7, maxWidth: 86, textAlign: 'center' } },
  { key: 'speaker', label: 'Speaker left', description: 'Left-aligned, for interviews and two-shots.', patch: { alignMatrix: 'bottom-left', positionX: 6, positionY: 90, maxWidth: 55, textAlign: 'left' } },
];

export function applyPresetLook(style: CaptionStyle, presetKey: string, lookToApply: PresetLook): CaptionStyle {
  return { ...style, ...lookToApply, preset: presetKey };
}
