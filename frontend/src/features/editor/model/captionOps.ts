/**
 * Pure, immutable caption operations. No store access — easy to test and reuse
 * from the exporter. Arrays are always kept sorted by start time.
 */
import {
  DEFAULT_CAPTION_DURATION,
  MIN_CAPTION_DURATION,
  type CaptionLanguage,
  type CaptionSegment,
  type CaptionWord,
} from './types';
import { detectLanguage, findSplitOffset, normalizeCaptionText, tokenizeWords } from '../utils/unicode';
import { clamp, roundTime } from '../utils/time';

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC4122 v4 fallback for non-secure contexts (e.g. LAN IP during development).
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const sortCaptions = (captions: CaptionSegment[]) =>
  [...captions].sort((a, b) => a.start - b.start || a.end - b.end);

/** Binary search for the caption showing at `time` (start inclusive, end exclusive). */
export function findCaptionIndexAt(captions: CaptionSegment[], time: number): number {
  let lo = 0;
  let hi = captions.length - 1;
  let candidate = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (captions[mid].start <= time) {
      candidate = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  // Walk back to handle overlaps: the latest-starting caption that still covers `time` wins.
  for (let i = candidate; i >= 0 && i > candidate - 4; i--) {
    if (time < captions[i].end) return i;
  }
  return -1;
}

export function replaceCaption(captions: CaptionSegment[], id: string, next: CaptionSegment): CaptionSegment[] {
  return captions.map((c) => (c.id === id ? next : c));
}

export function createCaption(
  captions: CaptionSegment[],
  at: number,
  totalDuration: number,
  text = '',
  language?: CaptionLanguage
): CaptionSegment {
  const start = roundTime(clamp(at, 0, Math.max(0, totalDuration - MIN_CAPTION_DURATION)));
  const next = captions.find((c) => c.start > start + 0.001);
  const limit = next ? next.start : totalDuration;
  const end = roundTime(Math.max(start + MIN_CAPTION_DURATION, Math.min(start + DEFAULT_CAPTION_DURATION, limit)));
  return {
    id: createId(),
    start,
    end,
    text,
    language: language ?? (text ? detectLanguage(text) : 'si'),
  };
}

/** Update text and keep word timings when the word count still matches. */
export function withText(caption: CaptionSegment, rawText: string): CaptionSegment {
  const text = normalizeCaptionText(rawText);
  let words = caption.words;
  if (words?.length) {
    const tokens = tokenizeWords(text);
    words = tokens.length === words.length ? words.map((w, i) => ({ ...w, text: tokens[i] })) : undefined;
  }
  return { ...caption, text, words };
}

export function withTiming(caption: CaptionSegment, start: number, end: number, totalDuration: number): CaptionSegment {
  const s = roundTime(clamp(start, 0, Math.max(0, totalDuration - MIN_CAPTION_DURATION)));
  const e = roundTime(clamp(end, s + MIN_CAPTION_DURATION, Math.max(totalDuration, s + MIN_CAPTION_DURATION)));
  const shift = s - caption.start;
  const isMove = Math.abs(e - s - (caption.end - caption.start)) < 0.0005;
  let words = caption.words;
  if (words?.length) {
    words = isMove
      ? words.map((w) => ({ ...w, start: roundTime(w.start + shift), end: roundTime(w.end + shift) }))
      : words.map((w) => ({ ...w, start: clamp(w.start, s, e), end: clamp(w.end, s, e) }));
  }
  return { ...caption, start: s, end: e, words };
}

/** Split at `time`. Uses word timings when present, else a Unicode-safe text split proportional to time. */
export function splitCaption(caption: CaptionSegment, time: number): [CaptionSegment, CaptionSegment] | null {
  if (time <= caption.start + MIN_CAPTION_DURATION / 2 || time >= caption.end - MIN_CAPTION_DURATION / 2) {
    return null;
  }
  const t = roundTime(time);
  let firstText: string;
  let secondText: string;
  let firstWords: CaptionWord[] | undefined;
  let secondWords: CaptionWord[] | undefined;

  if (caption.words && caption.words.length > 1) {
    const idx = caption.words.findIndex((w) => (w.start + w.end) / 2 >= t);
    const cut = idx <= 0 ? Math.ceil(caption.words.length / 2) : idx;
    firstWords = caption.words.slice(0, cut);
    secondWords = caption.words.slice(cut);
    firstText = firstWords.map((w) => w.text).join(' ');
    secondText = secondWords.map((w) => w.text).join(' ');
  } else {
    const ratio = (t - caption.start) / (caption.end - caption.start);
    const offset = findSplitOffset(caption.text, ratio);
    if (offset === null) {
      firstText = caption.text;
      secondText = '';
    } else {
      firstText = caption.text.slice(0, offset).trim();
      secondText = caption.text.slice(offset).trim();
    }
  }

  const first: CaptionSegment = { ...caption, end: t, text: firstText, words: firstWords };
  const second: CaptionSegment = {
    ...caption,
    id: createId(),
    start: t,
    text: secondText,
    words: secondWords,
    language: secondText ? detectLanguage(secondText) : caption.language,
  };
  return [first, second];
}

export function mergeCaptions(a: CaptionSegment, b: CaptionSegment): CaptionSegment {
  const text = [a.text.trim(), b.text.trim()].filter(Boolean).join(' ');
  const words = a.words?.length && b.words?.length ? [...a.words, ...b.words] : undefined;
  return {
    ...a,
    start: Math.min(a.start, b.start),
    end: Math.max(a.end, b.end),
    text,
    words,
    language: a.language === b.language ? a.language : detectLanguage(text),
  };
}

export function duplicateCaption(caption: CaptionSegment, totalDuration: number): CaptionSegment {
  const length = caption.end - caption.start;
  const start = roundTime(Math.min(caption.end, Math.max(0, totalDuration - length)));
  return withTiming({ ...caption, id: createId() }, start, start + length, Math.max(totalDuration, start + length));
}

/** Gap-aware bounds used by drags and nudges so captions don't overlap their neighbours. */
export function neighbourBounds(captions: CaptionSegment[], id: string, totalDuration: number) {
  const idx = captions.findIndex((c) => c.id === id);
  return {
    min: idx > 0 ? captions[idx - 1].end : 0,
    max: idx >= 0 && idx < captions.length - 1 ? captions[idx + 1].start : totalDuration,
  };
}

/**
 * Word timings for timed animations. Uses real word timings when available;
 * otherwise distributes time across tokens weighted by length.
 */
export function getWordTimings(caption: CaptionSegment): CaptionWord[] {
  if (caption.words?.length) return caption.words;
  const tokens = tokenizeWords(caption.text);
  if (tokens.length === 0) return [];
  const weights = tokens.map((t) => Math.max(1, t.length));
  const total = weights.reduce((a, b) => a + b, 0);
  const span = caption.end - caption.start;
  let cursor = caption.start;
  return tokens.map((text, i) => {
    const d = (weights[i] / total) * span;
    const w = { text, start: cursor, end: cursor + d };
    cursor += d;
    return w;
  });
}
