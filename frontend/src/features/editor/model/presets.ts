import type { AlignMatrix, CaptionStyle } from './types';
import presetData from './presets.json';

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
  preset: 'spotlight',
  englishFontFamily: '"Poppins", sans-serif',
  fontFamily: '"Noto Sans Sinhala", sans-serif',
  fontSize: 64,
  fontWeight: 800,
  fontStyle: 'normal',
  lineHeight: 1.35,
  letterSpacing: 0,
  textColor: '#FFFFFF',
  highlightColor: '#FFD400',
  outlineColor: '#000000',
  outlineWidth: 6,
  shadowColor: '#000000',
  shadowOpacity: 60,
  shadowBlur: 8,
  shadowOffsetX: 0,
  shadowOffsetY: 3,
  backgroundColor: '#000000',
  backgroundOpacity: 0,
  borderRadius: 12,
  padding: 12,
  textAlign: 'center',
  alignMatrix: 'bottom-center',
  positionX: 50,
  positionY: 92,
  maxWidth: 80,
  animation: 'karaoke',
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

/**
 * Built-in presets are structured configuration in presets.json — the same file
 * the backend seeds as system caption templates (backend/resources/captions/presets.json,
 * kept identical by a backend test). Never define preset styles inside components.
 */
export const BUILT_IN_PRESETS: PresetDefinition[] = presetData.presets.map((p) => ({
  key: p.key,
  label: p.label,
  description: p.description,
  sample: p.sample,
  look: { ...lookDefaults(), ...(p.style as Partial<PresetLook>) },
}));

function lookDefaults(): PresetLook {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { preset, alignMatrix, positionX, positionY, maxWidth, textAlign, ...base } = DEFAULT_STYLE;
  return base;
}

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
