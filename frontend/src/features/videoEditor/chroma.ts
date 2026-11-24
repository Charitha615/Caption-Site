import type { ChromaKey } from './model';

/**
 * Green-screen keying on the CPU. The picture is drawn into a scratch canvas no bigger than
 * MAX_KEY_SIDE, keyed there, and the result is scaled onto the frame. That keeps a 1080p export
 * at a few milliseconds per keyed clip per frame.
 */

const MAX_KEY_SIDE = 960;
/** Colours further than this from the key colour are never removed. */
const MAX_KEY_DISTANCE = 0.5;
let scratch: HTMLCanvasElement | null = null;

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  return m ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)] : [0, 255, 0];
}

/** Chroma (Cb, Cr) of an RGB colour, each roughly -0.5 … 0.5. Brightness is ignored so shadows on the screen still key. */
const chromaOf = (r: number, g: number, b: number): [number, number] => [
  (-0.169 * r - 0.331 * g + 0.5 * b) / 255,
  (0.5 * r - 0.419 * g - 0.081 * b) / 255,
];

/** Makes pixels near the key colour transparent, in place. Exported for tests. */
export function keyPixels(data: Uint8ClampedArray, key: ChromaKey) {
  const [kr, kg, kb] = hexToRgb(key.color);
  const [kcb, kcr] = chromaOf(kr, kg, kb);
  // Distances run up to ~0.9. Greys sit ~0.53 from pure green and skin tones ~0.58, so the soft edge
  // stops at 0.5 whatever the sliders say; the default (0.225) still takes darker, real-world screen greens.
  const outer = Math.min(MAX_KEY_DISTANCE, key.similarity * 0.45 + Math.max(0.002, key.smoothness * 0.3));
  const inner = Math.min(key.similarity * 0.45, outer - 0.002);
  // The channel the screen is strongest in (green for a green screen) gets clamped on edges.
  const dominant = kg >= kr && kg >= kb ? 1 : kb >= kr ? 2 : 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const [cb, cr] = chromaOf(r, g, b);
    const dist = Math.hypot(cb - kcb, cr - kcr);
    if (dist < inner) {
      data[i + 3] = 0;
      continue;
    }
    if (dist < outer) data[i + 3] = Math.round(data[i + 3]! * ((dist - inner) / (outer - inner)));
    if (key.spill && dist < outer * 1.3) {
      const c = [r, g, b];
      const others = c.filter((_, j) => j !== dominant);
      c[dominant] = Math.min(c[dominant]!, Math.max(others[0]!, others[1]!));
      data[i] = c[0]!;
      data[i + 1] = c[1]!;
      data[i + 2] = c[2]!;
    }
  }
}

/**
 * The cropped source region keyed onto a scratch canvas, or null when the browser can't read the
 * pixels. The canvas is reused, so draw it before calling this again.
 */
export function keyedSource(
  source: CanvasImageSource,
  sx: number, sy: number, sw: number, sh: number,
  key: ChromaKey,
): HTMLCanvasElement | null {
  const ratio = Math.min(1, MAX_KEY_SIDE / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * ratio));
  const h = Math.max(1, Math.round(sh * ratio));
  scratch ??= document.createElement('canvas');
  if (scratch.width !== w || scratch.height !== h) {
    scratch.width = w;
    scratch.height = h;
  }
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
  try {
    const img = ctx.getImageData(0, 0, w, h);
    keyPixels(img.data, key);
    ctx.putImageData(img, 0, 0);
  } catch {
    return null;
  }
  return scratch;
}
