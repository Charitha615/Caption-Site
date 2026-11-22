import { createId } from '../model/captionOps';
import type { CaptionLanguage } from '../model/types';
import { detectLanguage, normalizeCaptionText } from './unicode';
import { roundTime } from './time';

export interface ParsedImportCue {
  id: string;
  start: number;
  end: number;
  text: string;
  language: CaptionLanguage;
  /** Per-word timings when the cue was matched to speech. */
  words?: Array<{ text: string; start: number; end: number }>;
  /** The line exactly as provided (before punctuation removal), kept for review/restore. */
  original?: string;
}

/**
 * Removes punctuation and symbols from a caption line (. , ! ? ; : quotes brackets dashes
 * … ෴ * # etc.) while keeping marks that are part of a word: hyphens/apostrophes between
 * letters ("X-Urban", "don't"), decimal points and separators inside numbers ("12.4", "1,500"),
 * and Sinhala joiners (ZWJ/ZWNJ).
 */
export function stripCaptionPunctuation(input: string): string {
  const L = '\\p{L}\\p{M}\\p{N}\\u200C\\u200D';
  return input
    .replace(new RegExp(`(?<=[${L}])['’\\-](?=[${L}])`, 'gu'), '\u0000$&') // protect in-word ' and -
    .replace(/(?<=\d)[.,](?=\d)/gu, '\u0000$&') // protect 12.4 / 1,500
    .replace(/\u0000(.)|[^\p{L}\p{M}\p{N}\s\u200C\u200D%&+@]/gu, (_m, kept) => kept ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Repairs Sinhala rakaranshaya and yansaya conjuncts where virama (්) + letter was typed
 * without Zero-Width Joiner (ZWJ), or broken by plain input.
 * e.g., 'ප්ර' -> 'ප්‍ර', 'බ්ර' -> 'බ්‍ර', 'ත්ර' -> 'ත්‍ර', 'සත්යාපිත' -> 'සත්‍යාපිත'.
 */
export function repairSinhalaScript(input: string): string {
  let text = input;

  // Consonant + Virama (\u0DCA) + RA (\u0DBB) without ZWJ (\u200D) -> Rakaranshaya
  text = text.replace(/([ක-ෆ])\u0DCA(?!\u200D)\u0DBB/gu, '$1\u0DCA\u200D\u0DBB');

  // Consonant + Virama (\u0DCA) + YA (\u0DBA) without ZWJ (\u200D) -> Yansaya
  text = text.replace(/([ක-ෆ])\u0DCA(?!\u200D)\u0DBA/gu, '$1\u0DCA\u200D\u0DBA');

  return text;
}

/**
 * Maps commonly transliterated Sinhala car, tech, and digital terms into clean English.
 * Preserves Sinhala grammar and inflection suffixes where appropriate.
 */
const LOANWORD_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  // Compound brands & vehicle models
  { pattern: /ටොයොටා\s+ඇක්වා|ටොයෝටා\s+ඇක්වා/giu, replacement: 'Toyota Aqua' },
  { pattern: /ටොයොටා|ටොයෝටා/giu, replacement: 'Toyota' },
  { pattern: /ඇක්වා/giu, replacement: 'Aqua' },
  { pattern: /එක්ස්[\s-]අර්බන්/giu, replacement: 'X-Urban' },

  // Technical features & terms
  { pattern: /එක්දහස්\s+පන්සිය\s+සීසී/giu, replacement: '1500cc' },
  { pattern: /හයිබ්‍රිඩ්|හයිබ්රිඩ්/giu, replacement: 'Hybrid' },
  { pattern: /පුෂ්[\s-]ස්ටාර්ට්/giu, replacement: 'Push Start' },
  { pattern: /මල්ටිෆන්ෂන්\s+ස්ටියරින්\s+වීල්|මල්ටිෆන්ක්ෂන්\s+ස්ටියරින්\s+වීල්/giu, replacement: 'Multifunction Steering Wheel' },
  { pattern: /ක්ලයිමේට්\s+කන්ට්‍රෝල්\s+ඒසී|ක්ලයිමේට්\s+කන්ට්රෝල්\s+ඒසී/giu, replacement: 'Climate Control AC' },
  { pattern: /ඊ[\s-]වී[\s-]මෝඩ්|ඊවී[\s-]මෝඩ්/giu, replacement: 'EV Mode' },
  { pattern: /සෙකන්ඩ්[\s-]හෑන්ඩ්/giu, replacement: 'Second-hand' },
  { pattern: /හයිබ්‍රිඩ්\s+බැටරි|හයිබ්රිඩ්\s+බැටරි/giu, replacement: 'Hybrid Battery' },
  { pattern: /ඒ[\s-]බී[\s-]එස්\s+යුනිට්|ඒබීඑස්\s+යුනිට්/giu, replacement: 'ABS Unit' },
  { pattern: /ග්‍රවුන්ඩ්[\s-]ක්ලියරන්ස්|ග්රවුන්ඩ්[\s-]ක්ලියරන්ස්/giu, replacement: 'Ground Clearance' },
  { pattern: /වෙරිෆයිඩ්\s+සෙලර්ස්/giu, replacement: 'Verified Sellers' },
  { pattern: /ඇඩ්වාන්ස්ඩ්\s+ෆිල්ටර්ස්|ඇඩ්වාන්ස්\s+ෆිල්ටර්ස්/giu, replacement: 'Advanced Filters' },
  { pattern: /වට්ස්ඇප්\s+මැසේජ්/giu, replacement: 'WhatsApp message' },
  { pattern: /වට්ස්ඇප්/giu, replacement: 'WhatsApp' },
  { pattern: /වාහන\s+රිවීව්ස්|වාහන\s+රිවීව්/giu, replacement: 'Vehicle Reviews' },
  { pattern: /මොඩර්න්\s+ලුක්/giu, replacement: 'Modern Look' },
  { pattern: /ඔප්ෂන්ස්|ඔප්ෂන්/giu, replacement: 'Options' },
  { pattern: /එන්ජින්|එන්ජිම/giu, replacement: 'Engine' },
  { pattern: /ට්‍රැෆික්|ට්රැෆික්/giu, replacement: 'Traffic' },
  { pattern: /පෙට්‍රල්|පෙට්රල්/giu, replacement: 'Petrol' },
  { pattern: /මාකට්(?![\u0D85-\u0DC6\u200C\u200D])/giu, replacement: 'Market' },
  { pattern: /බජට්(?![\u0D85-\u0DC6\u200C\u200D])/giu, replacement: 'Budget' },
  { pattern: /ග්‍රේඩ්ස්|ග්රේඩ්ස්|ග්‍රේඩ්|ග්රේඩ්/giu, replacement: 'Grades' },

  // Vehicle types
  { pattern: /එස්[\s-]යූ[\s-]වී|එස්යූවී/giu, replacement: 'SUV' },
  { pattern: /ත්‍රීවීල්|ත්රීවීල්|ත්‍රීවීලර්|ත්රීවීලර්/giu, replacement: 'Three-wheel' },
  { pattern: /කාර්(?![\u0D85-\u0DC6\u200C\u200D])/giu, replacement: 'Car' },
  { pattern: /වෑන්(?![\u0D85-\u0DC6\u200C\u200D])/giu, replacement: 'Van' },
  { pattern: /බයික්(?![\u0D85-\u0DC6\u200C\u200D])/giu, replacement: 'Bike' },

  // Media & Web
  { pattern: /වීඩියෝ/giu, replacement: 'Video' },
  { pattern: /පේජ්(?![\u0D85-\u0DC6\u200C\u200D])/giu, replacement: 'Page' },
  { pattern: /ෆලෝ(?![\u0D85-\u0DC6\u200C\u200D])/giu, replacement: 'Follow' },
  { pattern: /වෙබ්[\s-]අඩවියට/giu, replacement: 'Website එකට' },
  { pattern: /වෙබ්[\s-]අඩවිය/giu, replacement: 'Website එක' },
  { pattern: /සීසී/giu, replacement: 'cc' },
];

/**
 * Enhances text with both Sinhala script repairs and standard English loanwords.
 */
export function enhanceTextForCaptions(input: string): string {
  let text = repairSinhalaScript(input);

  for (const { pattern, replacement } of LOANWORD_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  return normalizeCaptionText(text);
}

/** Parses time string (00:01:23.456 or 01:23,456 or 01:23.456) to seconds. */
function parseTimestamp(timeStr: string): number | null {
  const clean = timeStr.trim().replace(',', '.');
  const parts = clean.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return null;
}

/**
 * Tries to parse text as SRT or WebVTT format.
 * Returns null if the text does not match subtitle timing patterns.
 */
export function parseSubtitles(raw: string): ParsedImportCue[] | null {
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  // Check if text has timestamp arrows
  const arrowRe = /(\d{1,2}:\d{2}(?::\d{2})?[,.]\d{2,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[,.]\d{2,3})/;
  if (!arrowRe.test(normalized)) {
    return null;
  }

  const blocks = normalized.split(/\n\s*\n+/);
  const cues: ParsedImportCue[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let timeLineIdx = -1;
    let match: RegExpMatchArray | null = null;
    for (let i = 0; i < lines.length; i++) {
      match = lines[i].match(arrowRe);
      if (match) {
        timeLineIdx = i;
        break;
      }
    }

    if (timeLineIdx === -1 || !match) continue;

    const start = parseTimestamp(match[1]);
    const end = parseTimestamp(match[2]);
    if (start === null || end === null || end <= start) continue;

    // Remaining lines are text
    const textLines = lines.slice(timeLineIdx + 1);
    const text = textLines.join(' ').replace(/<[^>]+>/g, '').trim();
    if (!text) continue;

    cues.push({
      id: createId(),
      start: roundTime(start),
      end: roundTime(end),
      text,
      language: detectLanguage(text),
    });
  }

  return cues.length > 0 ? cues : null;
}

/**
 * Splits plain text/script into natural, readable caption cues.
 * Prioritises sentence breaks (. ! ? \n), then long clauses (, ;).
 */
export function splitTextIntoCues(raw: string, maxWordsPerCue = 10, maxCharsPerCue = 65): string[] {
  const normalized = normalizeCaptionText(raw).trim();
  if (!normalized) return [];

  // Split into paragraphs / lines first
  const blocks = normalized.split(/\n+/).map((b) => b.trim()).filter(Boolean);
  const sentences: string[] = [];

  for (const block of blocks) {
    // Split block by sentence terminators (. ! ? Sinhala kunddaliya ෴)
    const rawSentences = block
      .split(/(?<=[.!?෴])\s+/u)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const sent of rawSentences) {
      const words = sent.split(/\s+/).filter(Boolean);
      if (words.length <= maxWordsPerCue && sent.length <= maxCharsPerCue) {
        sentences.push(sent);
        continue;
      }

      // Sentence is long — split by commas or clause boundaries
      const clauses = sent.split(/(?<=[,;:])\s+/u).map((c) => c.trim()).filter(Boolean);
      let buffer: string[] = [];
      let bufferLen = 0;

      for (const clause of clauses) {
        const clauseWords = clause.split(/\s+/).filter(Boolean);
        if (buffer.length > 0 && (buffer.length + clauseWords.length > maxWordsPerCue || bufferLen + clause.length > maxCharsPerCue)) {
          sentences.push(buffer.join(' '));
          buffer = [...clauseWords];
          bufferLen = clause.length;
        } else {
          buffer.push(...clauseWords);
          bufferLen += clause.length;
        }
      }

      if (buffer.length > 0) {
        sentences.push(buffer.join(' '));
      }
    }
  }

  return sentences;
}

export interface TimingOptions {
  videoDuration: number;
  startAt?: number;
  mode?: 'fit-video' | 'from-playhead';
  wordsPerMinute?: number;
}

/**
 * Assigns start and end times to an array of cue texts.
 */
export function assignTimingsToCues(cues: string[], options: TimingOptions): ParsedImportCue[] {
  if (cues.length === 0) return [];

  const videoDuration = Math.max(1, options.videoDuration);
  const startAt = Math.max(0, Math.min(videoDuration - 1, options.startAt ?? 0));
  const mode = options.mode ?? 'fit-video';

  // Calculate weights based on text character count
  const weights = cues.map((c) => Math.max(4, c.length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const availableDuration = mode === 'fit-video'
    ? Math.max(cues.length * 1.5, videoDuration)
    : Math.max(cues.length * 1.5, videoDuration - startAt);

  const parsed: ParsedImportCue[] = [];
  let cursor = mode === 'fit-video' ? 0 : startAt;
  const GAP = 0.08; // 80ms small gap between cues for crisp visual transitions

  for (let i = 0; i < cues.length; i++) {
    const text = cues[i];
    let duration: number;

    if (mode === 'fit-video') {
      const share = weights[i] / totalWeight;
      duration = Math.max(1.4, share * (availableDuration - cues.length * GAP));
    } else {
      // Natural pacing from playhead: ~15 chars per second, clamped between 1.5s and 5.5s
      const estimatedSec = text.length / 15;
      duration = Math.max(1.5, Math.min(5.5, estimatedSec));
    }

    const start = roundTime(cursor);
    const end = roundTime(start + duration);

    parsed.push({
      id: createId(),
      start,
      end,
      text,
      language: detectLanguage(text),
    });

    cursor = end + GAP;
  }

  return parsed;
}
