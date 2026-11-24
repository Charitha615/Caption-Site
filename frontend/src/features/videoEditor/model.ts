/** Data model of the multi-track video editor (in development). Times are in seconds. */

export type MediaKind = 'video' | 'audio' | 'image';
export type TrackKind = 'text' | 'video' | 'audio';
export type ClipKind = MediaKind | 'text' | 'color';

export interface MediaItem {
  id: string;
  kind: MediaKind;
  name: string;
  /** Object URL of the local file. */
  url: string;
  /** Length of the source. Images get a default length when placed. */
  duration: number;
  width?: number;
  height?: number;
  /** Small preview frame (data URL) for videos; images use their own URL. */
  thumb?: string;
}

export type FontId = 'sans' | 'rounded' | 'serif' | 'impact' | 'mono';
export type TextAnimation = 'none' | 'fade' | 'pop' | 'slide' | 'typewriter';

export interface TextStyle {
  /** Size for a frame whose short side is 1080 px. */
  fontSize: number;
  font: FontId;
  color: string;
  background: string | null;
  outline: boolean;
  /** Vertical position of the text centre, 0 (top) … 1 (bottom). */
  y: number;
  bold: boolean;
  animation: TextAnimation;
}

export type FilterPresetId =
  | 'none' | 'vivid' | 'warm' | 'cool' | 'bw' | 'noir' | 'sepia' | 'vintage' | 'fade' | 'dramatic' | 'cinematic';

export interface FilterSettings {
  preset: FilterPresetId;
  /** 1 = unchanged. */
  brightness: number;
  contrast: number;
  saturation: number;
  /** Blur in px for a 1080 px frame. */
  blur: number;
}

export type FitMode = 'contain' | 'cover';

export interface Transform {
  fit: FitMode;
  /** 1 = fitted size. */
  scale: number;
  /** Centre offset as a share of half the frame, -1 … 1. */
  x: number;
  y: number;
  /** Degrees. */
  rotation: number;
  flip: boolean;
  opacity: number;
}

/** Solid colour, or a diagonal gradient when `to` is set. */
export interface Fill {
  from: string;
  to: string | null;
}

export interface Clip {
  id: string;
  trackId: string;
  kind: ClipKind;
  /** Source media, for video, audio and image clips. */
  mediaId?: string;
  /** Where the clip starts on the timeline. */
  start: number;
  /** How long it plays on the timeline. */
  duration: number;
  /** In-point inside the source, in source seconds. */
  offset: number;
  /** Playback speed (video and audio): 2 plays the source twice as fast. */
  speed: number;
  /** 0 … 1; video and audio clips. */
  volume: number;
  fadeIn: number;
  fadeOut: number;
  filter: FilterSettings;
  transform: Transform;
  text?: string;
  style?: TextStyle;
  fill?: Fill;
  /** Shown on the timeline for colour clips. */
  label?: string;
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  hidden: boolean;
}

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export const ASPECTS: { value: AspectRatio; label: string; ratio: number }[] = [
  { value: '16:9', label: '16:9 Landscape', ratio: 16 / 9 },
  { value: '9:16', label: '9:16 Reels / Shorts', ratio: 9 / 16 },
  { value: '1:1', label: '1:1 Square', ratio: 1 },
  { value: '4:5', label: '4:5 Portrait', ratio: 4 / 5 },
];

export const IMAGE_DEFAULT_DURATION = 5;
export const TEXT_DEFAULT_DURATION = 3;
export const MIN_CLIP_DURATION = 0.1;
export const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3];

export const DEFAULT_FILTER: FilterSettings = { preset: 'none', brightness: 1, contrast: 1, saturation: 1, blur: 0 };
export const DEFAULT_TRANSFORM: Transform = { fit: 'contain', scale: 1, x: 0, y: 0, rotation: 0, flip: false, opacity: 1 };
export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 56, font: 'sans', color: '#ffffff', background: null, outline: false, y: 0.82, bold: true, animation: 'fade',
};

export const FONTS: { id: FontId; label: string; css: string }[] = [
  { id: 'sans', label: 'Sans', css: '"Inter", "Noto Sans Sinhala", system-ui, sans-serif' },
  { id: 'rounded', label: 'Rounded', css: '"Nunito", "Arial Rounded MT Bold", "Noto Sans Sinhala", system-ui, sans-serif' },
  { id: 'serif', label: 'Serif', css: 'Georgia, "Noto Serif Sinhala", "Times New Roman", serif' },
  { id: 'impact', label: 'Impact', css: 'Impact, "Arial Black", "Noto Sans Sinhala", sans-serif' },
  { id: 'mono', label: 'Mono', css: 'ui-monospace, Menlo, Consolas, "Noto Sans Sinhala", monospace' },
];

export const fontCss = (id: FontId) => FONTS.find((f) => f.id === id)?.css ?? FONTS[0]!.css;

/** Which track kind a clip lives on. */
export const trackKindFor = (kind: ClipKind): TrackKind => (kind === 'text' ? 'text' : kind === 'audio' ? 'audio' : 'video');

export const clipEnd = (clip: Clip) => clip.start + clip.duration;

/** Clips with a time-based source can't run past its end. */
export const hasSource = (clip: Clip) => clip.kind === 'video' || clip.kind === 'audio';

/** Longest timeline length the clip can have from its current in-point. */
export function sourceLimit(clip: Clip, media: MediaItem | undefined): number {
  if (!media || !hasSource(clip)) return Infinity;
  return (media.duration - clip.offset) / clip.speed;
}

/** Source time shown at timeline time `t`. */
export const sourceTime = (clip: Clip, t: number) => clip.offset + (t - clip.start) * clip.speed;

/** 0 … 1 multiplier from the clip's fade in / fade out at timeline time `t`. */
export function fadeLevel(clip: Clip, t: number): number {
  let level = 1;
  if (clip.fadeIn > 0) level = Math.min(level, (t - clip.start) / clip.fadeIn);
  if (clip.fadeOut > 0) level = Math.min(level, (clipEnd(clip) - t) / clip.fadeOut);
  return Math.max(0, Math.min(1, level));
}

export function formatTime(seconds: number, withFraction = true): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const base = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (!withFraction) return base;
  return `${base}.${String(Math.floor((safe % 1) * 10))}`;
}

let counter = 0;
export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
