import type { FilterPresetId, FilterSettings } from './model';

/** Ready-made looks. Values are CSS filter functions, which canvas `ctx.filter` understands too. */
export const FILTER_PRESETS: { id: FilterPresetId; label: string; css: string }[] = [
  { id: 'none', label: 'Original', css: '' },
  { id: 'vivid', label: 'Vivid', css: 'saturate(1.45) contrast(1.1)' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.25) saturate(1.25) hue-rotate(-8deg)' },
  { id: 'cool', label: 'Cool', css: 'saturate(1.05) hue-rotate(14deg) brightness(1.03)' },
  { id: 'bw', label: 'B & W', css: 'grayscale(1) contrast(1.1)' },
  { id: 'noir', label: 'Noir', css: 'grayscale(1) contrast(1.5) brightness(0.9)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(0.85)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.4) contrast(0.9) brightness(1.05) saturate(0.8)' },
  { id: 'fade', label: 'Faded', css: 'contrast(0.85) brightness(1.1) saturate(0.75)' },
  { id: 'dramatic', label: 'Dramatic', css: 'contrast(1.35) saturate(1.2) brightness(0.92)' },
  { id: 'cinematic', label: 'Cinematic', css: 'contrast(1.15) saturate(0.85) sepia(0.15) hue-rotate(-5deg)' },
];

/**
 * The full filter for a clip. `pxScale` turns the blur (stored for a 1080 px frame) into
 * pixels of the surface being drawn on. Returns 'none' when nothing changes the picture.
 */
export function filterCss(filter: FilterSettings, pxScale = 1): string {
  const parts: string[] = [];
  const preset = FILTER_PRESETS.find((p) => p.id === filter.preset)?.css;
  if (preset) parts.push(preset);
  if (filter.brightness !== 1) parts.push(`brightness(${filter.brightness})`);
  if (filter.contrast !== 1) parts.push(`contrast(${filter.contrast})`);
  if (filter.saturation !== 1) parts.push(`saturate(${filter.saturation})`);
  if (filter.blur > 0) parts.push(`blur(${(filter.blur * pxScale).toFixed(2)}px)`);
  return parts.length ? parts.join(' ') : 'none';
}
