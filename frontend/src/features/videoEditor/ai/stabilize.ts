import type { Stabilization } from '../model';

/**
 * Video stabilization for handheld shake. The clip is sampled ANALYSIS_FPS times a second on a
 * small greyscale copy; each frame's shift from the previous one is found by block matching. The
 * camera path is smoothed, and the difference (the shake) is what the renderer moves the picture
 * back by, with a slight zoom so the moved edges stay out of view.
 */

export const ANALYSIS_FPS = 15;
const WIDTH = 192;
const SEARCH = 10;

/** Greyscale pixels of a frame, WIDTH wide. */
function grey(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, h: number): Float32Array {
  ctx.drawImage(video, 0, 0, WIDTH, h);
  const { data } = ctx.getImageData(0, 0, WIDTH, h);
  const out = new Float32Array(WIDTH * h);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4]! * 0.299 + data[i * 4 + 1]! * 0.587 + data[i * 4 + 2]! * 0.114;
  return out;
}

/** The (dx, dy) in pixels that best moves `prev` onto `cur`, comparing the middle of the frame. */
export function estimateShift(prev: Float32Array, cur: Float32Array, w: number, h: number, search = SEARCH): [number, number] {
  const x0 = search + Math.floor(w * 0.1);
  const y0 = search + Math.floor(h * 0.1);
  const x1 = w - x0;
  const y1 = h - y0;
  let best: [number, number] = [0, 0];
  let bestCost = Infinity;
  for (let dy = -search; dy <= search; dy++) {
    for (let dx = -search; dx <= search; dx++) {
      let cost = 0;
      // Every other pixel is plenty for a global shift.
      for (let y = y0; y < y1; y += 2) {
        const row = y * w;
        const shifted = (y + dy) * w + dx;
        for (let x = x0; x < x1; x += 2) cost += Math.abs(cur[shifted + x]! - prev[row + x]!);
        if (cost >= bestCost) break;
      }
      // Prefer no movement on ties (flat or blurry frames).
      if (cost < bestCost || (cost === bestCost && Math.abs(dx) + Math.abs(dy) < Math.abs(best[0]) + Math.abs(best[1]))) {
        bestCost = cost;
        best = [dx, dy];
      }
    }
  }
  return best;
}

/** Shake to remove at each sample: the smoothed camera path minus the real one. */
export function shakeFromPath(path: number[], window = ANALYSIS_FPS): number[] {
  return path.map((_, i) => {
    const from = Math.max(0, i - window);
    const to = Math.min(path.length - 1, i + window);
    let sum = 0;
    for (let j = from; j <= to; j++) sum += path[j]!;
    return sum / (to - from + 1) - path[i]!;
  });
}

const seek = (video: HTMLVideoElement, time: number) =>
  new Promise<void>((resolve) => {
    const done = () => {
      video.removeEventListener('seeked', done);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, 3000);
    video.addEventListener('seeked', done);
    video.currentTime = time;
  });

/** Works out the correction for the source span [from, to) of a video file. */
export async function analyzeShake(url: string, from: number, to: number, onProgress: (p: number) => void, signal: AbortSignal): Promise<Stabilization> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('Could not read this video.'));
  });
  const h = Math.max(16, Math.round((WIDTH * video.videoHeight) / Math.max(1, video.videoWidth)));
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser cannot analyse video frames.');

  const steps = Math.max(2, Math.ceil((to - from) * ANALYSIS_FPS));
  const pathX = [0];
  const pathY = [0];
  let prev: Float32Array | null = null;
  try {
    for (let i = 0; i < steps; i++) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      await seek(video, Math.min(to - 0.01, from + i / ANALYSIS_FPS));
      const cur = grey(ctx, video, h);
      if (prev) {
        const [dx, dy] = estimateShift(prev, cur, WIDTH, h);
        pathX.push(pathX.at(-1)! + dx);
        pathY.push(pathY.at(-1)! + dy);
      }
      prev = cur;
      onProgress(i / steps);
    }
  } finally {
    video.removeAttribute('src');
    video.load();
  }
  // Pixels of the small copy → share of the frame.
  return {
    from,
    rate: ANALYSIS_FPS,
    dx: shakeFromPath(pathX).map((v) => Math.round((v / WIDTH) * 10000) / 10000),
    dy: shakeFromPath(pathY).map((v) => Math.round((v / h) * 10000) / 10000),
  };
}

/** Correction (share of the picture) at source time `s`, interpolated between samples. */
export function shakeAt(stab: Stabilization, s: number): [number, number] {
  const pos = (s - stab.from) * stab.rate;
  const i = Math.max(0, Math.min(stab.dx.length - 1, Math.floor(pos)));
  const j = Math.min(stab.dx.length - 1, i + 1);
  const f = Math.max(0, Math.min(1, pos - i));
  return [stab.dx[i]! + (stab.dx[j]! - stab.dx[i]!) * f, stab.dy[i]! + (stab.dy[j]! - stab.dy[i]!) * f];
}
