import { useEffect, useState } from 'react';
import type { MediaItem } from './model';

/**
 * Timeline filmstrips: small frames taken across a video, so each clip shows the part of the video
 * it actually plays (trimming the start removes the first frames from the clip, as in other editors).
 *
 * Frames are drawn side by side into one canvas ("sprite") per video and kept in memory only. They are
 * taken one video at a time, and each strip fills in as it goes.
 */

/** Height of a frame in the sprite (the lane is about 46 px tall; 2× for sharp screens). */
export const FRAME_H = 80;
/** At most this many frames per video; long videos get one frame every few seconds. */
const MAX_FRAMES = 120;
/** At least this many seconds between frames. */
const MIN_INTERVAL = 0.5;

export interface Filmstrip {
  sprite: HTMLCanvasElement;
  frameW: number;
  /** Seconds of video between frames: frame i shows time i × interval. */
  interval: number;
  /** Frames drawn so far (the rest fall back to the nearest drawn one). */
  ready: number;
  count: number;
}

type Listener = (strip: Filmstrip) => void;
interface Entry { strip: Filmstrip | null; listeners: Set<Listener>; cancelled: boolean }

const cache = new Map<string, Entry>();
/** One video decodes at a time, so a project with many clips doesn't stall the browser. */
let queue: Promise<void> = Promise.resolve();

const seek = (el: HTMLVideoElement, time: number) =>
  new Promise<void>((resolve, reject) => {
    const done = () => {
      el.removeEventListener('seeked', done);
      el.removeEventListener('error', fail);
      resolve();
    };
    const fail = () => {
      el.removeEventListener('seeked', done);
      el.removeEventListener('error', fail);
      reject(new Error('seek failed'));
    };
    el.addEventListener('seeked', done);
    el.addEventListener('error', fail);
    el.currentTime = time;
  });

async function build(media: MediaItem, entry: Entry) {
  const el = document.createElement('video');
  el.muted = true;
  el.playsInline = true;
  el.preload = 'auto';
  el.src = media.url;
  try {
    await new Promise<void>((resolve, reject) => {
      if (el.readyState >= 1) return resolve();
      el.onloadedmetadata = () => resolve();
      el.onerror = () => reject(new Error('load failed'));
    });
    const duration = media.duration || el.duration;
    if (!Number.isFinite(duration) || duration <= 0 || !el.videoWidth) return;
    const interval = Math.max(MIN_INTERVAL, duration / MAX_FRAMES);
    const count = Math.max(1, Math.ceil(duration / interval));
    const frameW = Math.max(1, Math.round((FRAME_H * el.videoWidth) / el.videoHeight));
    const sprite = document.createElement('canvas');
    sprite.width = frameW * count;
    sprite.height = FRAME_H;
    const ctx = sprite.getContext('2d');
    if (!ctx) return;
    const strip: Filmstrip = { sprite, frameW, interval, ready: 0, count };
    entry.strip = strip;
    for (let i = 0; i < count && !entry.cancelled; i++) {
      // The middle of each slot, kept just inside the end (the very last frame often fails to seek).
      await seek(el, Math.min(duration - 0.05, (i + 0.5) * interval));
      ctx.drawImage(el, i * frameW, 0, frameW, FRAME_H);
      strip.ready = i + 1;
      if (i % 6 === 5 || i === count - 1) entry.listeners.forEach((l) => l(strip));
    }
  } catch {
    // No filmstrip for this file: the clip keeps its single picture.
  } finally {
    el.removeAttribute('src');
    el.load();
  }
}

/** Starts (once per video) and follows the filmstrip of a video; null until its first frames are ready. */
export function useFilmstrip(media: MediaItem | undefined): Filmstrip | null {
  const key = media?.kind === 'video' && media.url ? media.url : null;
  const [strip, setStrip] = useState<Filmstrip | null>(() => (key ? cache.get(key)?.strip ?? null : null));
  useEffect(() => {
    if (!key || !media) return;
    let entry = cache.get(key);
    if (!entry) {
      const created: Entry = { strip: null, listeners: new Set(), cancelled: false };
      cache.set(key, created);
      entry = created;
      queue = queue.then(() => build(media, created));
    }
    // A new object each time, so React redraws as frames arrive.
    const listener: Listener = (s) => setStrip({ ...s });
    entry.listeners.add(listener);
    if (entry.strip?.ready) listener(entry.strip);
    return () => {
      entry.listeners.delete(listener);
    };
  }, [key, media]);
  return key ? strip : null;
}

/** Frees the filmstrip of a video that was removed from the project. */
export function forgetFilmstrip(url: string) {
  const entry = cache.get(url);
  if (entry) entry.cancelled = true;
  cache.delete(url);
}
