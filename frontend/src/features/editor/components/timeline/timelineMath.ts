const TICK_INTERVALS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

/** Smallest "nice" label interval keeping labels at least `minPx` apart. */
export function pickTickInterval(zoom: number, minPx = 72): { major: number; minor: number } {
  const major = TICK_INTERVALS.find((i) => i * zoom >= minPx) ?? TICK_INTERVALS[TICK_INTERVALS.length - 1];
  const minor = major / (major === 0.2 || major === 2 || major === 20 ? 4 : major === 15 ? 3 : 5);
  return { major, minor };
}

export interface SnapResult {
  value: number;
  guide: number | null;
}

/** Snap `value` to the nearest candidate within `threshold` seconds. */
export function snapTo(value: number, candidates: number[], threshold: number): SnapResult {
  let best: number | null = null;
  let bestDist = threshold;
  for (const c of candidates) {
    const d = Math.abs(c - value);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best === null ? { value, guide: null } : { value: best, guide: best };
}
