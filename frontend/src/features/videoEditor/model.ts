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
  /** Loudness of the sound, 0 … 1, `peaksPerSecond` values per second of source. Missing until worked out (or for silent files). */
  peaks?: number[];
  peaksPerSecond?: number;
}

export type FontId = 'sans' | 'rounded' | 'serif' | 'impact' | 'mono';
/** A built-in font id, or the id of a font the user uploaded (see `customFonts.ts`). */
export type FontRef = FontId | (string & {});
export type TextAnimation = 'none' | 'fade' | 'pop' | 'slide' | 'typewriter' | 'zoom' | 'blur' | 'bounce';
export type TextAlign = 'left' | 'center' | 'right';
/** How a subtitle line shows its words: all at once, with the spoken word highlighted, or one word at a time. */
export type CaptionMode = 'line' | 'karaoke' | 'word';

export interface TextStyle {
  /** Size for a frame whose short side is 1080 px. */
  fontSize: number;
  font: FontRef;
  color: string;
  background: string | null;
  outline: boolean;
  /** Vertical position of the text centre, 0 (top) … 1 (bottom). */
  y: number;
  /** Horizontal anchor, 0 (left) … 1 (right): the left edge, centre or right edge of the text depending on `align`. */
  x: number;
  align: TextAlign;
  bold: boolean;
  animation: TextAnimation;
  captionMode?: CaptionMode;
  /** Colour of the spoken word in karaoke mode. */
  highlight?: string;
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

/** Share of the source cut away on each side, 0 … 0.9. */
export interface Crop {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Transform {
  fit: FitMode;
  /** 1 = fitted size. */
  scale: number;
  /** Centre offset as a share of half the frame, -1 … 1. */
  x: number;
  y: number;
  /** Degrees. */
  rotation: number;
  /** Mirror left-right. */
  flip: boolean;
  /** Mirror upside down. */
  flipV: boolean;
  opacity: number;
  crop: Crop;
}

/** Transform values that can change over time with keyframes. */
export type AnimProp = 'scale' | 'x' | 'y' | 'rotation' | 'opacity';
export const ANIM_PROPS: AnimProp[] = ['scale', 'x', 'y', 'rotation', 'opacity'];

/** A value at a time, in seconds from the clip's start. */
export interface Keyframe {
  t: number;
  v: number;
}
export type Keyframes = Partial<Record<AnimProp, Keyframe[]>>;

export type TransitionType =
  | 'none' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'wipe-left' | 'wipe-right' | 'circle' | 'zoom-in' | 'zoom-out' | 'blur' | 'spin';

export interface Transition {
  type: TransitionType;
  duration: number;
}

export const TRANSITIONS: { id: TransitionType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'slide-left', label: 'Slide left' },
  { id: 'slide-right', label: 'Slide right' },
  { id: 'slide-up', label: 'Slide up' },
  { id: 'slide-down', label: 'Slide down' },
  { id: 'wipe-left', label: 'Wipe left' },
  { id: 'wipe-right', label: 'Wipe right' },
  { id: 'circle', label: 'Circle' },
  { id: 'zoom-in', label: 'Zoom in' },
  { id: 'zoom-out', label: 'Zoom out' },
  { id: 'blur', label: 'Blur' },
  { id: 'spin', label: 'Spin' },
];

/** Green screen: pixels close to `color` become see-through. */
export interface ChromaKey {
  enabled: boolean;
  color: string;
  /** 0 … 1: how far from the key colour a pixel can be and still be removed. */
  similarity: number;
  /** 0 … 1: width of the soft edge past `similarity`. */
  smoothness: number;
  /** Takes the green (or blue) tint off edges. */
  spill: boolean;
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
  /** Silences this one clip (video and audio clips), keeping its volume for when it is unmuted. */
  muted?: boolean;
  fadeIn: number;
  fadeOut: number;
  filter: FilterSettings;
  transform: Transform;
  /** Animated transform values; a property with keyframes ignores its `transform` value. */
  keyframes: Keyframes;
  transitionIn: Transition;
  transitionOut: Transition;
  chroma: ChromaKey;
  /** Voice clean-up (hum and hiss filters plus a leveller), video and audio clips. */
  denoise: boolean;
  text?: string;
  style?: TextStyle;
  fill?: Fill;
  /** Shown on the timeline for colour clips. */
  label?: string;
  /** Spoken words of a subtitle, in seconds from the clip's start. Dropped when the text is edited. */
  words?: ClipWord[];
  /** Shake correction for a video clip, when it has been stabilized. */
  stabilize?: Stabilization;
}

/**
 * How far to move the picture to cancel camera shake, as a share of its size, sampled `rate`
 * times a second of source time starting at source time `from`.
 */
export interface Stabilization {
  from: number;
  rate: number;
  dx: number[];
  dy: number[];
}

/** Stabilized pictures are enlarged this much so the moved edges stay out of view. */
export const STABILIZE_ZOOM = 1.08;

export interface ClipWord {
  text: string;
  t: number;
  e: number;
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  hidden: boolean;
  /** A track of generated subtitles (styled and translated together). */
  subtitles?: boolean;
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
export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
export const MIN_SPEED = 0.1;
export const MAX_SPEED = 10;

export const DEFAULT_FILTER: FilterSettings = { preset: 'none', brightness: 1, contrast: 1, saturation: 1, blur: 0 };
export const NO_CROP: Crop = { top: 0, right: 0, bottom: 0, left: 0 };
export const DEFAULT_TRANSFORM: Transform = {
  fit: 'contain', scale: 1, x: 0, y: 0, rotation: 0, flip: false, flipV: false, opacity: 1, crop: NO_CROP,
};
export const NO_TRANSITION: Transition = { type: 'none', duration: 0.6 };
export const DEFAULT_CHROMA: ChromaKey = { enabled: false, color: '#00ff00', similarity: 0.5, smoothness: 0.1, spill: true };
export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 56, font: 'sans', color: '#ffffff', background: null, outline: false, y: 0.82, x: 0.5, align: 'center', bold: true, animation: 'fade',
};

export const FONTS: { id: FontId; label: string; css: string }[] = [
  { id: 'sans', label: 'Sans', css: '"Inter", "Noto Sans Sinhala", system-ui, sans-serif' },
  { id: 'rounded', label: 'Rounded', css: '"Nunito", "Arial Rounded MT Bold", "Noto Sans Sinhala", system-ui, sans-serif' },
  { id: 'serif', label: 'Serif', css: 'Georgia, "Noto Serif Sinhala", "Times New Roman", serif' },
  { id: 'impact', label: 'Impact', css: 'Impact, "Arial Black", "Noto Sans Sinhala", sans-serif' },
  { id: 'mono', label: 'Mono', css: 'ui-monospace, Menlo, Consolas, "Noto Sans Sinhala", monospace' },
];

/** CSS font stack for a built-in or uploaded font (uploaded fonts are registered under their id). */
export const fontCss = (id: FontRef) =>
  FONTS.find((f) => f.id === id)?.css ?? (id.startsWith('custom-') ? `"${id}", "Noto Sans Sinhala", system-ui, sans-serif` : FONTS[0]!.css);

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

const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

/** Value of a keyframed property at `rel` seconds into the clip (eased between keys, held before the first and after the last). */
export function keyframeValue(keys: Keyframe[], rel: number): number {
  const first = keys[0]!;
  if (keys.length === 1 || rel <= first.t) return first.v;
  const last = keys[keys.length - 1]!;
  if (rel >= last.t) return last.v;
  const i = keys.findIndex((k) => k.t > rel);
  const a = keys[i - 1]!;
  const b = keys[i]!;
  return a.v + (b.v - a.v) * easeInOut((rel - a.t) / (b.t - a.t));
}

/** The transform at timeline time `t`, with keyframes applied. */
export function transformAt(clip: Clip, t: number): Transform {
  let out = clip.transform;
  for (const prop of ANIM_PROPS) {
    const keys = clip.keyframes[prop];
    if (keys?.length) {
      if (out === clip.transform) out = { ...out };
      out[prop] = keyframeValue(keys, t - clip.start);
    }
  }
  return out;
}

/** Two keyframes closer than this (one frame at 30 fps) are the same key. */
export const KEY_EPSILON = 1 / 60;

/** Adds or replaces the key at `t`, keeping the list sorted. */
export function withKeyframe(keys: Keyframe[] | undefined, t: number, v: number): Keyframe[] {
  const rest = (keys ?? []).filter((k) => Math.abs(k.t - t) > KEY_EPSILON);
  return [...rest, { t, v }].sort((a, b) => a.t - b.t);
}

/** Splits keyframes at `at` seconds into the clip: both halves keep the value at the cut, so the motion carries on. */
export function splitKeyframes(keyframes: Keyframes, at: number): [Keyframes, Keyframes] {
  const left: Keyframes = {};
  const right: Keyframes = {};
  for (const prop of ANIM_PROPS) {
    const keys = keyframes[prop];
    if (!keys?.length) continue;
    const v = keyframeValue(keys, at);
    left[prop] = withKeyframe(keys.filter((k) => k.t < at), at, v);
    right[prop] = withKeyframe(keys.filter((k) => k.t > at).map((k) => ({ t: k.t - at, v: k.v })), 0, v);
  }
  return [left, right];
}

/** Maps every key time through `fn` (shift after a trim, stretch after a speed change). */
export function retimeKeyframes(keyframes: Keyframes, fn: (t: number) => number): Keyframes {
  const out: Keyframes = {};
  for (const prop of ANIM_PROPS) {
    const keys = keyframes[prop];
    if (keys) out[prop] = keys.map((k) => ({ t: fn(k.t), v: k.v }));
  }
  return out;
}

/**
 * Index of the word being spoken `rel` seconds into a text clip. Uses the clip's word timings when
 * they match its words, otherwise spreads the words over the clip by their length.
 */
export function spokenWordIndex(clip: Clip, tokens: string[], rel: number): number {
  if (tokens.length === 0) return -1;
  const words = clip.words;
  if (words && words.length === tokens.length) {
    let index = 0;
    for (let i = 0; i < words.length; i++) if (rel >= words[i]!.t) index = i;
    return index;
  }
  const total = tokens.reduce((n, w) => n + w.length + 1, 0);
  let at = 0;
  for (let i = 0; i < tokens.length; i++) {
    at += tokens[i]!.length + 1;
    if ((at / total) * clip.duration > rel) return i;
  }
  return tokens.length - 1;
}

/** Gaps shorter than this aren't worth a button. */
export const MIN_GAP = 0.05;

/** Empty stretches on a track before and between its clips, as [from, to). */
export function trackGaps(clips: Clip[], trackId: string): [number, number][] {
  const gaps: [number, number][] = [];
  let cursor = 0;
  for (const c of clips.filter((x) => x.trackId === trackId).sort((a, b) => a.start - b.start)) {
    if (c.start - cursor > MIN_GAP) gaps.push([cursor, c.start]);
    cursor = Math.max(cursor, clipEnd(c));
  }
  return gaps;
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
