/**
 * Noise removal by spectral gating. The quietest moments of the recording give a noise profile
 * (how loud the steady background is at each frequency); every moment is then turned down at the
 * frequencies where it isn't clearly louder than that profile. It removes steady noise (fans, hiss,
 * hum, air conditioning, traffic rumble) well; sudden noises like a door slam stay.
 */

const FRAME = 1024;
const HOP = FRAME / 4;

/** In-place radix-2 FFT (inverse when `inverse`), arrays of length FRAME. */
function fft(re: Float64Array, im: Float64Array, inverse: boolean) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] = re[i]! / n;
      im[i] = im[i]! / n;
    }
  }
}

const hann = Float64Array.from({ length: FRAME }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FRAME));

export interface DenoiseOptions {
  /** 0 … 1: how hard noise is turned down. */
  strength: number;
}

/**
 * A cleaned copy of one channel. `onProgress` gets 0 … 1; the work yields to the browser now and
 * then so the page stays responsive.
 */
export async function denoiseChannel(input: Float32Array, opts: DenoiseOptions, onProgress?: (p: number) => void): Promise<Float32Array> {
  const frames = Math.max(1, Math.ceil(input.length / HOP));
  const bins = FRAME / 2 + 1;
  const re = new Float64Array(FRAME);
  const im = new Float64Array(FRAME);
  const frameAt = (f: number) => {
    for (let i = 0; i < FRAME; i++) {
      re[i] = (input[f * HOP + i] ?? 0) * hann[i]!;
      im[i] = 0;
    }
    fft(re, im, false);
  };

  // 1. Noise profile: average spectrum of the quietest 10% of frames.
  const energy = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = 0; i < FRAME; i++) sum += (input[f * HOP + i] ?? 0) ** 2;
    energy[f] = sum;
  }
  const quiet = Array.from(energy.keys()).sort((a, b) => energy[a]! - energy[b]!).slice(0, Math.max(1, Math.floor(frames * 0.1)));
  const noise = new Float64Array(bins);
  for (const f of quiet) {
    frameAt(f);
    for (let k = 0; k < bins; k++) noise[k] = noise[k]! + Math.hypot(re[k]!, im[k]!) / quiet.length;
  }

  // 2. Gate every frame against the profile, smoothing the gains over time to avoid "musical" noise.
  const over = 1.5 + opts.strength * 2.5;
  const floor = 1 - 0.92 * opts.strength;
  const output = new Float64Array(input.length + FRAME);
  const norm = new Float64Array(input.length + FRAME);
  const prevGain = new Float64Array(bins).fill(1);
  for (let f = 0; f < frames; f++) {
    frameAt(f);
    for (let k = 0; k < bins; k++) {
      const mag = Math.hypot(re[k]!, im[k]!);
      const target = mag > noise[k]! * over ? 1 : floor;
      // Open fast, close slowly.
      const g = target > prevGain[k]! ? target : prevGain[k]! * 0.8 + target * 0.2;
      prevGain[k] = g;
      re[k] = re[k]! * g;
      im[k] = im[k]! * g;
      if (k > 0 && k < FRAME / 2) {
        re[FRAME - k] = re[k]!;
        im[FRAME - k] = -im[k]!;
      }
    }
    fft(re, im, true);
    for (let i = 0; i < FRAME; i++) {
      output[f * HOP + i] = output[f * HOP + i]! + re[i]! * hann[i]!;
      norm[f * HOP + i] = norm[f * HOP + i]! + hann[i]! * hann[i]!;
    }
    if (f % 2000 === 0) {
      onProgress?.(f / frames);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  onProgress?.(1);
  const result = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) result[i] = norm[i]! > 1e-3 ? output[i]! / norm[i]! : 0;
  return result;
}
