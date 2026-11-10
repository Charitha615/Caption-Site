import type { CaptionLanguage } from '../model/types';

const SINHALA_RE = /[඀-෿]/g;
const LATIN_RE = /[A-Za-z]/g;
const ZWJ = '‍';
const AL_LAKUNA = '්'; // Sinhala virama (්)

const graphemeSegmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('si', { granularity: 'grapheme' })
    : null;

/**
 * Split text into user-perceived characters, Sinhala-aware.
 *
 * Plain code-point splitting breaks Sinhala syllables (e.g. separates "ක" from
 * its vowel sign "ා"). Extended grapheme clusters fix that, but Unicode does
 * not join Sinhala conjuncts formed with al-lakuna + ZWJ (ක්‍ෂ, ශ්‍රී, යංශය
 * forms), so we glue those clusters back together.
 */
export function splitGraphemes(text: string): string[] {
  const raw = graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(text), (s) => s.segment)
    : Array.from(text);

  const out: string[] = [];
  for (const cluster of raw) {
    const prev = out[out.length - 1];
    if (
      prev !== undefined &&
      (prev.endsWith(ZWJ) || (prev.endsWith(AL_LAKUNA) && cluster.startsWith(ZWJ)))
    ) {
      out[out.length - 1] = prev + cluster;
    } else {
      out.push(cluster);
    }
  }
  return out;
}

export function countGraphemes(text: string): number {
  return splitGraphemes(text).length;
}

/** NFC-normalise without trimming (trimming while the user types would eat their spaces). Keeps ZWJ/ZWNJ. */
export function normalizeCaptionText(text: string): string {
  return text.replace(/\r\n?/g, '\n').normalize('NFC');
}

export function detectLanguage(text: string): CaptionLanguage {
  const si = text.match(SINHALA_RE)?.length ?? 0;
  const en = text.match(LATIN_RE)?.length ?? 0;
  if (si === 0 && en === 0) return 'si';
  if (si === 0) return 'en';
  if (en === 0) return 'si';
  return si >= en * 4 ? 'si' : en >= si * 4 ? 'en' : 'mixed';
}

export function tokenizeWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Pick a split offset (in UTF-16 units) for `text` close to `ratio`, preferring
 * whitespace. Falls back to a grapheme boundary so a Sinhala word is never cut
 * inside a syllable.
 */
export function findSplitOffset(text: string, ratio: number): number | null {
  const target = Math.round(text.length * Math.min(0.95, Math.max(0.05, ratio)));
  let best: number | null = null;
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i]) && i > 0 && i < text.length - 1) {
      if (best === null || Math.abs(i - target) < Math.abs(best - target)) best = i;
    }
  }
  if (best !== null) return best;

  const graphemes = splitGraphemes(text);
  if (graphemes.length < 2) return null;
  const cut = Math.min(graphemes.length - 1, Math.max(1, Math.round(graphemes.length * ratio)));
  return graphemes.slice(0, cut).join('').length;
}

export const LANGUAGE_LABELS: Record<CaptionLanguage, string> = {
  si: 'සිංහල',
  en: 'English',
  mixed: 'Mixed',
};
