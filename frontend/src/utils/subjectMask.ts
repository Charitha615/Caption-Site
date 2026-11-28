import type { ImageSegmenter } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';

/**
 * "Caption behind the subject" (Pro): finds the person in a video frame with MediaPipe's selfie
 * segmenter, running in the browser. Captions are drawn first, then the person is drawn back on
 * top of them, so the text looks like it sits behind them.
 *
 * The library (~15 MB of WebAssembly) and the model (~250 KB, served from /models) load only the
 * first time the effect is used.
 */

const MODEL_PATH = '/models/selfie_segmenter.tflite';

/** A person mask: one byte per pixel, 0 = background … 255 = person. */
export interface SubjectMask {
  width: number;
  height: number;
  data: Uint8Array;
}

let segmenter: ImageSegmenter | null = null;
let loading: Promise<ImageSegmenter> | null = null;
let failed = false;

/** Loads the segmenter once (GPU when the browser has it, else CPU). */
export function loadSubjectSegmenter(): Promise<ImageSegmenter> {
  if (segmenter) return Promise.resolve(segmenter);
  if (loading) return loading;
  loading = (async () => {
    const { ImageSegmenter } = await import('@mediapipe/tasks-vision');
    const fileset = { wasmLoaderPath, wasmBinaryPath };
    const create = (delegate: 'GPU' | 'CPU') => ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
    try {
      segmenter = await create('GPU').catch(() => create('CPU'));
      failed = false;
      return segmenter;
    } catch (err) {
      failed = true;
      loading = null;
      throw err;
    }
  })();
  return loading;
}

export const isSubjectSegmenterReady = () => segmenter !== null;
export const subjectSegmenterFailed = () => failed;

/**
 * The person mask of a picture, or null while the segmenter is still loading. Runs synchronously,
 * so it can be used inside a frame being drawn.
 */
export function subjectMaskOf(image: HTMLCanvasElement | OffscreenCanvas | HTMLVideoElement | HTMLImageElement | ImageBitmap): SubjectMask | null {
  if (!segmenter) return null;
  const result = segmenter.segment(image as HTMLCanvasElement);
  try {
    const masks = result.confidenceMasks ?? [];
    // One mask (the person) for the selfie model; if a model also returns background, the person is last.
    const mask = masks[masks.length - 1];
    if (!mask) return null;
    const conf = mask.getAsFloat32Array();
    const data = new Uint8Array(conf.length);
    for (let i = 0; i < conf.length; i++) data[i] = conf[i]! >= 1 ? 255 : conf[i]! <= 0 ? 0 : Math.round(conf[i]! * 255);
    return { width: mask.width, height: mask.height, data };
  } finally {
    result.close();
  }
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function sized(canvas: AnyCanvas | null, w: number, h: number): AnyCanvas {
  if (!canvas) return makeCanvas(w, h);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return canvas;
}

const ctx2d = (c: AnyCanvas) => c.getContext('2d') as CanvasRenderingContext2D;

let maskCanvas: AnyCanvas | null = null;
let cutoutCanvas: AnyCanvas | null = null;
let snapshotCanvas: AnyCanvas | null = null;

/**
 * Edges: values under `low` are background, over `high` fully person, smooth in between. A little
 * tighter than the raw confidence, so the background doesn't haze over the text.
 */
const edge = (v: number, low = 90, high = 200) => (v <= low ? 0 : v >= high ? 255 : Math.round(((v - low) / (high - low)) * 255));

/** The mask as a canvas whose alpha is the person (white where they are). */
export function maskToCanvas(mask: SubjectMask): AnyCanvas {
  maskCanvas = sized(maskCanvas, mask.width, mask.height);
  const c = ctx2d(maskCanvas);
  const img = c.createImageData(mask.width, mask.height);
  for (let i = 0; i < mask.data.length; i++) {
    const p = i * 4;
    img.data[p] = 255;
    img.data[p + 1] = 255;
    img.data[p + 2] = 255;
    img.data[p + 3] = edge(mask.data[i]!);
  }
  c.putImageData(img, 0, 0);
  return maskCanvas;
}

/**
 * Draws the person from `picture` (same size as the target) on top of what is on `ctx` now, using
 * `mask` stretched over the whole picture.
 */
export function drawSubjectCutout(ctx: CanvasRenderingContext2D, picture: CanvasImageSource, mask: SubjectMask, x: number, y: number, w: number, h: number) {
  const mw = Math.max(1, Math.round(w));
  const mh = Math.max(1, Math.round(h));
  cutoutCanvas = sized(cutoutCanvas, mw, mh);
  const c = ctx2d(cutoutCanvas);
  c.save();
  c.globalCompositeOperation = 'copy';
  c.drawImage(picture, 0, 0, mw, mh);
  c.globalCompositeOperation = 'destination-in';
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.drawImage(maskToCanvas(mask), 0, 0, mw, mh);
  c.restore();
  ctx.drawImage(cutoutCanvas, x, y, w, h);
}

/** Copies what is on the canvas now, to draw the person from after the caption is painted. */
export function snapshotOf(ctx: CanvasRenderingContext2D): AnyCanvas {
  const { width, height } = ctx.canvas;
  snapshotCanvas = sized(snapshotCanvas, width, height);
  const c = ctx2d(snapshotCanvas);
  c.globalCompositeOperation = 'copy';
  c.drawImage(ctx.canvas, 0, 0);
  c.globalCompositeOperation = 'source-over';
  return snapshotCanvas;
}

/**
 * Draws a caption so it looks behind the person: `draw` paints the caption, then the person from
 * the frame as it was before the caption is drawn over it. Without the segmenter (still loading),
 * the caption is simply drawn in front.
 */
export function drawBehindSubject(ctx: CanvasRenderingContext2D, draw: () => void) {
  if (!segmenter) {
    draw();
    return;
  }
  const before = snapshotOf(ctx);
  const mask = subjectMaskOf(before);
  draw();
  if (!mask) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
  drawSubjectCutout(ctx, before, mask, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/* ---------- Compact form for upload (caption tool export) ---------- */

/**
 * Packs masks (all the same size) for the server: header "SSM1", width, height (uint16), frames per
 * second × 100 and frame count (uint32), then each frame as a uint32 byte length followed by
 * run lengths (uint16, little endian) of alternating background / person pixels, starting with
 * background. A run longer than 65535 is split with a zero-length run of the other kind.
 */
export function packMasks(masks: SubjectMask[], fps: number, threshold = 128): Blob {
  const width = masks[0]?.width ?? 0;
  const height = masks[0]?.height ?? 0;
  const header = new DataView(new ArrayBuffer(16));
  [0x53, 0x53, 0x4d, 0x31].forEach((b, i) => header.setUint8(i, b));
  header.setUint16(4, width, true);
  header.setUint16(6, height, true);
  header.setUint32(8, Math.round(fps * 100), true);
  header.setUint32(12, masks.length, true);
  const parts: BlobPart[] = [header.buffer];
  for (const mask of masks) {
    const runs: number[] = [];
    let current = 0;
    let run = 0;
    for (let i = 0; i < mask.data.length; i++) {
      const v = mask.data[i]! >= threshold ? 1 : 0;
      if (v === current && run < 65535) {
        run++;
      } else if (v === current) {
        runs.push(run, 0);
        run = 1;
      } else {
        runs.push(run);
        current = v;
        run = 1;
      }
    }
    runs.push(run);
    const body = new Uint16Array(runs);
    const len = new DataView(new ArrayBuffer(4));
    len.setUint32(0, body.byteLength, true);
    parts.push(len.buffer, body.buffer);
  }
  return new Blob(parts, { type: 'application/octet-stream' });
}

/* ---------- Whole-video analysis (caption tool export) ---------- */

/** At most this many masks per video; long videos are sampled less often. */
const MAX_FRAMES = 3000;
const MAX_FPS = 10;
const MIN_FPS = 2;

/** Frames per second to sample a video of this length at. */
export const analysisFps = (duration: number) => Math.max(MIN_FPS, Math.min(MAX_FPS, MAX_FRAMES / Math.max(1, duration)));

function waitFor(el: HTMLMediaElement, event: string, timeoutMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (fn: () => void) => {
      el.removeEventListener(event, onEvent);
      el.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
      clearTimeout(timer);
      fn();
    };
    const onEvent = () => done(resolve);
    const onError = () => done(() => reject(new Error('The video could not be read for person detection.')));
    const onAbort = () => done(() => reject(new DOMException('Cancelled', 'AbortError')));
    const timer = setTimeout(() => done(() => reject(new Error('The video took too long to load for person detection.'))), timeoutMs);
    el.addEventListener(event, onEvent, { once: true });
    el.addEventListener('error', onError, { once: true });
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Finds the person through the whole video (a few times a second) and packs the masks for upload.
 * `onProgress` gets 0 … 1.
 */
export async function analyzeVideoSubject(url: string, onProgress: (done: number) => void, signal?: AbortSignal): Promise<{ blob: Blob; fps: number; frames: number }> {
  await loadSubjectSegmenter();
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await waitFor(video, 'loadeddata', 30000, signal);
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration <= 0) throw new Error('The video has no length to analyse.');
    const fps = analysisFps(duration);
    const count = Math.max(1, Math.floor(duration * fps));
    const masks: SubjectMask[] = [];
    for (let i = 0; i < count; i++) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      // Middle of each sample's slot, and never past the last frame.
      video.currentTime = Math.min(duration - 0.05, (i + 0.5) / fps);
      await waitFor(video, 'seeked', 15000, signal);
      const mask = subjectMaskOf(video);
      if (!mask) throw new Error('Person detection is not ready.');
      masks.push(mask);
      onProgress((i + 1) / count);
    }
    return { blob: packMasks(masks, fps), fps, frames: masks.length };
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}
