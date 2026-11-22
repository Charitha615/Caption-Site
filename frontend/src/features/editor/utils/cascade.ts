/**
 * "Cascade" line transition: words fade in one after another (first → last) when a
 * caption appears, and fade out in reverse (last → first) before it disappears.
 *
 * Mirrored exactly by AssCaptionRenderer::cascadeWindows() so preview and export match.
 */
export const CASCADE_MAX_FADE = 0.22;
export const CASCADE_MAX_STAGGER = 0.06;

export interface CascadeWindow {
  inStart: number;
  inEnd: number;
  outStart: number;
  outEnd: number;
}

export function cascadeWindows(count: number, start: number, end: number): CascadeWindow[] {
  const duration = Math.max(0, end - start);
  // Fade + stagger together never use more than ~30% of the caption for each direction.
  const fade = Math.min(CASCADE_MAX_FADE, duration * 0.15);
  const stagger = count > 1 ? Math.max(0, Math.min(CASCADE_MAX_STAGGER, (duration * 0.3 - fade) / (count - 1))) : 0;
  return Array.from({ length: count }, (_, i) => ({
    inStart: start + i * stagger,
    inEnd: start + i * stagger + fade,
    outStart: end - i * stagger - fade,
    outEnd: end - i * stagger,
  }));
}

/** Opacity 0–1 of one word at time t. */
export function cascadeOpacity(w: CascadeWindow, t: number): number {
  const span = w.inEnd - w.inStart;
  if (span <= 0) return t >= w.inStart && t < w.outEnd ? 1 : 0;
  const fadeIn = (t - w.inStart) / span;
  const fadeOut = (w.outEnd - t) / span;
  return Math.max(0, Math.min(1, fadeIn, fadeOut));
}
