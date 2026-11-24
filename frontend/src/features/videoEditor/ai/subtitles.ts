import { clipEnd, type Clip, type MediaItem, type Track } from '../model';
import type { SubtitleLine } from '../store';
import { aiService, type SpeechLanguage } from './aiService';
import { SPEECH_RATE, mixTimeline, partWav, splitAtPauses } from './timelineAudio';

const LEAD_IN = 1;
/** Parts sent at the same time. */
const PARALLEL = 2;

export interface SubtitleProgress {
  phase: 'mixing' | 'transcribing';
  done: number;
  total: number;
}

/**
 * Subtitles for everything heard on the timeline: the sound is mixed in the browser, cut into
 * ~30 s parts at pauses and transcribed part by part on the server. When a part fails, the lines
 * finished so far come back with the error, so a long video doesn't lose all its work.
 */
export async function generateSubtitles(
  scene: { clips: Clip[]; tracks: Track[]; media: MediaItem[] },
  language: SpeechLanguage,
  onProgress: (p: SubtitleProgress) => void,
  signal: AbortSignal,
): Promise<{ lines: SubtitleLine[]; error?: unknown }> {
  onProgress({ phase: 'mixing', done: 0, total: 1 });
  const samples = await mixTimeline(scene.clips, scene.tracks, scene.media);
  const parts = splitAtPauses(samples, SPEECH_RATE);
  const results: SubtitleLine[][] = parts.map(() => []);
  const finished = parts.map(() => false);
  let done = 0;
  let next = 0;
  let error: unknown;
  onProgress({ phase: 'transcribing', done, total: parts.length });

  const worker = async () => {
    while (next < parts.length && !error) {
      const n = next++;
      const part = parts[n]!;
      try {
        const lines = await aiService.transcribePart(partWav(part.samples, SPEECH_RATE, LEAD_IN), language, n + 1, LEAD_IN, signal);
        results[n] = lines.map((l) => ({
          start: l.start + part.offset,
          end: l.end + part.offset,
          text: l.text,
          words: l.words.map((w) => ({ word: w.word, start: w.start + part.offset, end: w.end + part.offset })),
        }));
        finished[n] = true;
      } catch (err) {
        error ??= err;
        return;
      }
      done++;
      onProgress({ phase: 'transcribing', done, total: parts.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, parts.length) }, worker));
  // Only parts before the first unfinished one are kept, so the subtitles have no holes in the middle.
  const firstMissing = finished.indexOf(false);
  const kept = firstMissing >= 0 ? results.slice(0, firstMissing) : results;
  return { lines: kept.flat(), error };
}

const srtTime = (s: number) => {
  const ms = Math.round(Math.max(0, s) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
};

/** The clips as an SRT subtitle file. */
export function toSrt(clips: Clip[]): string {
  return clips
    .filter((c) => c.text?.trim())
    .sort((a, b) => a.start - b.start)
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(clipEnd(c))}\n${c.text!.trim()}\n`)
    .join('\n');
}
