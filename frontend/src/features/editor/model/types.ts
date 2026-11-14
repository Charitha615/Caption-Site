/**
 * Core editor domain types.
 *
 * These types are the contract shared by the browser editor (STEP 3) and the
 * styling/export pipeline (STEP 4). Keep them serialisable (plain JSON) — the
 * same objects are persisted to the API and will be handed to the renderer.
 */

export type CaptionLanguage = 'si' | 'en' | 'mixed';

export type AlignMatrix =
  | 'top-left' | 'top-center' | 'top-right'
  | 'mid-left' | 'center' | 'mid-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type CaptionAnimation =
  | 'none'
  | 'fade'
  | 'pop'
  | 'bounce'
  | 'slide'
  | 'typewriter'
  | 'karaoke'
  | 'highlight';

export type TextAlign = 'left' | 'center' | 'right';

export type FontStyle = 'normal' | 'italic';

export type CanvasAspect = 'source' | '16:9' | '9:16' | '1:1' | '4:5';

export interface CaptionWord {
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

/**
 * Visual style of a caption.
 *
 * All pixel values (fontSize, padding, outlineWidth, shadow*, borderRadius) are
 * expressed relative to a frame whose SHORT side is {@link REFERENCE_SHORT_SIDE}
 * pixels (1080p). The preview scales them down; the exporter renders them 1:1 on
 * a 1080p output. This keeps preview and export visually identical.
 */
export interface CaptionStyle {
  preset: string;

  /** Font used for Latin script (English). Listed first in the CSS stack. */
  englishFontFamily: string;
  /** Font used for Sinhala script. Browser falls back to it for Sinhala glyphs. */
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: FontStyle;
  lineHeight: number;
  letterSpacing: number;

  textColor: string;
  /** Karaoke: colour of the spoken word. Word box: colour of the box behind it. */
  highlightColor: string;
  /** Word box: colour of the spoken word's text inside the box. */
  highlightTextColor: string;
  /** Size of the spoken word in % (100 = no zoom) for karaoke / word box. */
  activeWordScale: number;

  /** Stroke ("outline") — names kept for compatibility with stored overrides. */
  outlineColor: string;
  outlineWidth: number;

  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;

  backgroundColor: string;
  backgroundOpacity: number;
  borderRadius: number;
  padding: number;

  textAlign: TextAlign;
  alignMatrix: AlignMatrix;
  /** Anchor X in % of frame width (0–100). */
  positionX: number;
  /** Anchor Y in % of frame height (0–100). */
  positionY: number;
  /** Max text box width in % of frame width. */
  maxWidth: number;

  animation: CaptionAnimation;
}

export type CaptionStyleOverride = Partial<CaptionStyle>;

export interface CaptionSegment {
  /** Stable client-side id. Always a UUID — it doubles as the persisted caption uuid. */
  id: string;
  start: number;
  end: number;
  text: string;
  language: CaptionLanguage;
  words?: CaptionWord[];
  styleOverride?: CaptionStyleOverride | null;
  /** Unknown metadata from the API (e.g. AI pipeline fields), passed through untouched on save. */
  meta?: Record<string, unknown>;
}

export interface CustomPreset {
  id: string;
  label: string;
  basePreset: string;
  style: CaptionStyle;
}

export interface CanvasSettings {
  aspect: CanvasAspect;
}

/**
 * The editable, undoable, persisted document. Everything the user can change
 * that should survive a reload lives here; everything else is view state.
 */
export interface CaptionDocument {
  captions: CaptionSegment[];
  style: CaptionStyle;
  customPresets: CustomPreset[];
  canvas: CanvasSettings;
}

export const REFERENCE_SHORT_SIDE = 1080;
export const MIN_CAPTION_DURATION = 0.2;
export const DEFAULT_CAPTION_DURATION = 2;
