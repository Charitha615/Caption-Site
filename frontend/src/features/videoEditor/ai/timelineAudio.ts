import { encodeWav } from '../audio';
import { clipEnd, type Clip, type MediaItem, type Track } from '../model';

/**
 * The timeline's sound, worked out in the browser: mixed down for speech recognition, cut into
 * short parts at pauses, and scanned for silences.
 */

export const SPEECH_RATE = 16_000;
const MAX_DECODE_BYTES = 300 * 1024 * 1024;

const decoded = new Map<string, Promise<AudioBuffer | null>>();

/** Decoded sound of a media file (cached), or null when it has none. */
export function decodeMedia(item: MediaItem): Promise<AudioBuffer | null> {
  let job = decoded.get(item.id);
  if (!job) {
    job = (async () => {
      if (typeof OfflineAudioContext === 'undefined') throw new Error('This browser cannot read audio.');
      const blob = await (await fetch(item.url)).blob();
      if (blob.size > MAX_DECODE_BYTES) throw new Error(`“${item.name}” is too big to read the sound in the browser.`);
      try {
        return await new OfflineAudioContext(1, 1, 44_100).decodeAudioData(await blob.arrayBuffer());
      } catch {
        return null; // a video with no sound track
      }
    })();
    decoded.set(item.id, job);
    job.catch(() => decoded.delete(item.id));
  }
  return job;
}

export function forgetDecodedAudio() {
  decoded.clear();
}

/** Clips whose sound is heard: unmuted video and audio clips on unmuted tracks with some volume. */
export function soundingClips(clips: Clip[], tracks: Track[]): Clip[] {
  const muted = new Set(tracks.filter((t) => t.muted).map((t) => t.id));
  return clips.filter((c) => (c.kind === 'video' || c.kind === 'audio') && c.mediaId && c.volume > 0 && !c.muted && !muted.has(c.trackId));
}

/**
 * Mono mix of everything heard on the timeline from 0 to its end, at `rate` samples per second.
 * Speed changes play faster (and higher), as in the export.
 */
export async function mixTimeline(clips: Clip[], tracks: Track[], media: MediaItem[], rate = SPEECH_RATE): Promise<Float32Array> {
  const sounding = soundingClips(clips, tracks);
  const end = clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0);
  if (sounding.length === 0 || end <= 0) throw new Error('There is no sound on the timeline. Add a video with sound or an audio clip first.');
  const ctx = new OfflineAudioContext(1, Math.max(1, Math.ceil(end * rate)), rate);
  const byId = new Map(media.map((m) => [m.id, m]));
  let any = false;
  for (const clip of sounding) {
    const item = byId.get(clip.mediaId!);
    const buffer = item ? await decodeMedia(item) : null;
    if (!buffer) continue;
    any = true;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = clip.speed;
    const gain = ctx.createGain();
    gain.gain.value = clip.volume;
    source.connect(gain).connect(ctx.destination);
    source.start(clip.start, clip.offset, clip.duration * clip.speed);
  }
  if (!any) throw new Error('The clips on the timeline have no sound.');
  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0);
}

/** Loudness (RMS) of each `windowSeconds` slice. */
export function loudness(samples: Float32Array, rate: number, windowSeconds = 0.05): Float32Array {
  const size = Math.max(1, Math.round(rate * windowSeconds));
  const out = new Float32Array(Math.ceil(samples.length / size));
  for (let w = 0; w < out.length; w++) {
    let sum = 0;
    const end = Math.min(samples.length, (w + 1) * size);
    for (let i = w * size; i < end; i++) sum += samples[i]! * samples[i]!;
    out[w] = Math.sqrt(sum / Math.max(1, end - w * size));
  }
  return out;
}

export interface AudioPart {
  /** Where the part starts on the timeline, in seconds. */
  offset: number;
  samples: Float32Array;
}

/**
 * Cuts the sound into parts of about `target` seconds, each cut at the quietest moment within
 * `slack` seconds of the target, so words aren't cut in half.
 */
export function splitAtPauses(samples: Float32Array, rate: number, target = 30, slack = 8): AudioPart[] {
  const total = samples.length / rate;
  if (total <= target * 1.3) return [{ offset: 0, samples }];
  const win = 0.1;
  const levels = loudness(samples, rate, win);
  const parts: AudioPart[] = [];
  let start = 0;
  while (total - start > target * 1.3) {
    let best = start + target;
    let quietest = Infinity;
    for (let t = start + target - slack; t <= start + target + slack; t += win) {
      const level = levels[Math.floor(t / win)] ?? Infinity;
      if (level < quietest) {
        quietest = level;
        best = t;
      }
    }
    const cut = Math.round(best * rate);
    parts.push({ offset: start, samples: samples.subarray(Math.round(start * rate), cut) });
    start = cut / rate;
  }
  parts.push({ offset: start, samples: samples.subarray(Math.round(start * rate)) });
  return parts;
}

/** A WAV file of the samples with `leadIn` seconds of silence first (speech models often miss the very first words). */
export function partWav(samples: Float32Array, rate: number, leadIn = 1): Blob {
  const pad = Math.round(leadIn * rate);
  const data = new Float32Array(pad + samples.length);
  data.set(samples, pad);
  return encodeWav({ numberOfChannels: 1, sampleRate: rate, length: data.length, getChannelData: () => data });
}

export interface SilenceOptions {
  /** Quieter than this (dBFS) counts as silence. */
  thresholdDb: number;
  /** Only pauses at least this long are removed. */
  minSilence: number;
  /** Sound kept on each side of a pause, so speech doesn't sound clipped. */
  padding: number;
}

export const DEFAULT_SILENCE: SilenceOptions = { thresholdDb: -42, minSilence: 0.7, padding: 0.15 };

/** Time ranges that are silent (after padding), in seconds. */
export function findSilences(samples: Float32Array, rate: number, opts: SilenceOptions = DEFAULT_SILENCE): [number, number][] {
  const win = 0.02;
  const levels = loudness(samples, rate, win);
  const threshold = Math.pow(10, opts.thresholdDb / 20);
  const total = samples.length / rate;
  const ranges: [number, number][] = [];
  let quietFrom = -1;
  const close = (endIndex: number) => {
    const a = quietFrom * win;
    const b = Math.min(total, endIndex * win);
    if (b - a >= opts.minSilence) {
      // Keep padding next to sound, but not at the very start or end of the video.
      const from = a <= 0 ? 0 : a + opts.padding;
      const to = b >= total ? total : b - opts.padding;
      if (to - from > 0.05) ranges.push([from, to]);
    }
    quietFrom = -1;
  };
  for (let i = 0; i < levels.length; i++) {
    if (levels[i]! < threshold) {
      if (quietFrom < 0) quietFrom = i;
    } else if (quietFrom >= 0) {
      close(i);
    }
  }
  if (quietFrom >= 0) close(levels.length);
  return ranges;
}
