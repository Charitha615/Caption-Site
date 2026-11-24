import { voiceChain } from './audio';
import { clipEnd, fadeLevel, sourceTime, type AspectRatio, type Clip, type MediaItem, type Track } from './model';
import { drawFrame, frameSize, type Scene } from './render';
import { imageFor } from './sources';

/**
 * In-browser export: every frame is drawn on a canvas with the same renderer as the preview, while the
 * browser's MediaRecorder captures the canvas and the mixed audio. It runs in real time, so a 1-minute
 * video takes about a minute, and the tab has to stay visible (browsers pause hidden tabs).
 */

export type ExportQuality = 480 | 720 | 1080;

export interface ExportFormat {
  mimeType: string;
  extension: 'mp4' | 'webm';
  label: string;
}

const CANDIDATES: ExportFormat[] = [
  { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4', label: 'MP4 (H.264)' },
  { mimeType: 'video/mp4;codecs=avc1,mp4a', extension: 'mp4', label: 'MP4 (H.264)' },
  { mimeType: 'video/mp4', extension: 'mp4', label: 'MP4' },
  { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm', label: 'WebM (VP9)' },
  { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm', label: 'WebM (VP8)' },
  { mimeType: 'video/webm', extension: 'webm', label: 'WebM' },
];

/** The best format this browser can record, MP4 first. Null when the browser can't record video. */
export function pickExportFormat(): ExportFormat | null {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') return null;
  return CANDIDATES.find((c) => MediaRecorder.isTypeSupported(c.mimeType)) ?? null;
}

const BITRATE: Record<ExportQuality, number> = { 480: 2_500_000, 720: 5_000_000, 1080: 8_000_000 };

export interface ExportJob {
  aspect: AspectRatio;
  quality: ExportQuality;
  fps: number;
  tracks: Track[];
  clips: Clip[];
  media: MediaItem[];
  format: ExportFormat;
  onProgress: (done: number) => void;
  signal: AbortSignal;
}

interface Voice {
  clip: Clip;
  el: HTMLMediaElement;
  gain: GainNode;
  muted: boolean;
}

const once = (el: HTMLMediaElement, event: string, timeoutMs: number) =>
  new Promise<void>((resolve) => {
    const done = () => {
      el.removeEventListener(event, done);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, timeoutMs);
    el.addEventListener(event, done);
  });

/** Browsers support different speed ranges; out-of-range speeds play as fast (or slow) as allowed. */
export function setRate(el: HTMLMediaElement, rate: number) {
  if (el.playbackRate === rate) return;
  try {
    el.playbackRate = rate;
  } catch {
    el.playbackRate = Math.min(4, Math.max(0.25, rate));
  }
}

async function prepareElement(clip: Clip, url: string): Promise<HTMLMediaElement> {
  const el = document.createElement(clip.kind === 'video' ? 'video' : 'audio');
  el.preload = 'auto';
  el.src = url;
  if (el instanceof HTMLVideoElement) el.playsInline = true;
  if (el.readyState < 2) await once(el, 'loadeddata', 8000);
  el.currentTime = clip.offset;
  await once(el, 'seeked', 4000);
  return el;
}

export async function exportVideo(job: ExportJob): Promise<Blob> {
  const { aspect, quality, fps, tracks, clips, media, format, onProgress, signal } = job;
  const total = clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0);
  if (total <= 0) throw new Error('Add something to the timeline before exporting.');

  const { width, height } = frameSize(aspect, quality);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the video frames.');

  const byId = new Map(media.map((m) => [m.id, m]));
  const trackMuted = new Map(tracks.map((t) => [t.id, t.muted]));
  const audio = new AudioContext();
  const mix = audio.createMediaStreamDestination();
  const voices: Voice[] = [];
  const cleanup = () => {
    voices.forEach((v) => {
      v.el.pause();
      v.el.removeAttribute('src');
      v.el.load();
    });
    void audio.close().catch(() => undefined);
  };

  try {
    // One element per clip, so split parts of the same file can be at different times.
    for (const clip of clips) {
      if (clip.kind !== 'video' && clip.kind !== 'audio') continue;
      const item = clip.mediaId ? byId.get(clip.mediaId) : undefined;
      if (!item) continue;
      const el = await prepareElement(clip, item.url);
      const gain = audio.createGain();
      gain.gain.value = 0;
      const input = audio.createMediaElementSource(el);
      if (clip.denoise) {
        const chain = voiceChain(audio);
        input.connect(chain.input);
        chain.output.connect(gain);
      } else {
        input.connect(gain);
      }
      gain.connect(mix);
      voices.push({ clip, el, gain, muted: (trackMuted.get(clip.trackId) ?? false) || !!clip.muted });
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
    }
    // Images: make sure every one is decoded before recording starts.
    await Promise.all(
      clips
        .filter((c) => c.kind === 'image' && c.mediaId && byId.has(c.mediaId))
        .map((c) => imageFor(c.mediaId!, byId.get(c.mediaId!)!.url).decode().catch(() => undefined)),
    );

    const videoEls = new Map(voices.filter((v) => v.el instanceof HTMLVideoElement).map((v) => [v.clip.id, v.el as HTMLVideoElement]));
    const lookup = (clip: Clip) => {
      if (clip.kind === 'video') return videoEls.get(clip.id);
      if (clip.kind === 'image' && clip.mediaId) {
        const item = byId.get(clip.mediaId);
        return item ? imageFor(clip.mediaId, item.url) : undefined;
      }
      return undefined;
    };
    const scene: Scene = { tracks, clips };

    const stream = canvas.captureStream(fps);
    mix.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const recorder = new MediaRecorder(stream, { mimeType: format.mimeType, videoBitsPerSecond: BITRATE[quality], audioBitsPerSecond: 128_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    drawFrame(ctx, width, height, 0, scene, lookup);
    await audio.resume();
    recorder.start(500);
    const t0 = performance.now();

    await new Promise<void>((resolve, reject) => {
      let raf = 0;
      const onAbort = () => {
        cancelAnimationFrame(raf);
        reject(new DOMException('Export cancelled', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });

      const tick = () => {
        const t = Math.min(total, (performance.now() - t0) / 1000);
        for (const v of voices) {
          const { clip, el, gain } = v;
          const active = t >= clip.start && t < clipEnd(clip);
          if (active) {
            const target = sourceTime(clip, t);
            setRate(el, clip.speed);
            if (Math.abs(el.currentTime - target) > 0.25 * Math.max(1, clip.speed)) el.currentTime = target;
            if (el.paused) void el.play().catch(() => undefined);
            gain.gain.value = v.muted ? 0 : clip.volume * fadeLevel(clip, t);
          } else {
            if (!el.paused) el.pause();
            gain.gain.value = 0;
          }
        }
        drawFrame(ctx, width, height, t, scene, lookup);
        onProgress(t / total);
        if (t >= total) {
          signal.removeEventListener('abort', onAbort);
          resolve();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }).finally(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    });

    await stopped;
    return new Blob(chunks, { type: format.mimeType.split(';')[0] });
  } finally {
    cleanup();
  }
}
