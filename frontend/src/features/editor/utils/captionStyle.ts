import type React from 'react';
import { buildFontStack } from '../model/fonts';
import { ALIGN_POSITIONS, DEFAULT_STYLE } from '../model/presets';
import { REFERENCE_SHORT_SIDE, type CaptionStyle, type CaptionStyleOverride } from '../model/types';

export function resolveStyle(global: CaptionStyle, override?: CaptionStyleOverride | null): CaptionStyle {
  return override ? { ...global, ...override } : global;
}

function parseColor(input: string): [number, number, number, number] | null {
  const value = input.trim();
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a];
  }
  const rgb = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(',').map((p) => parseFloat(p));
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      return [parts[0], parts[1], parts[2], Number.isFinite(parts[3]) ? parts[3] : 1];
    }
  }
  return null;
}

/** Normalises any colour to #rrggbb for <input type="color">. */
export function toHex(input: string, fallback = '#000000'): string {
  const c = parseColor(input);
  if (!c) return fallback;
  return `#${c.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;
}

export function withOpacity(color: string, opacityPercent: number): string {
  const c = parseColor(color);
  if (!c) return color;
  const alpha = Math.max(0, Math.min(1, (opacityPercent / 100) * c[3]));
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha.toFixed(3)})`;
}

export function isValidColor(input: string): boolean {
  return parseColor(input) !== null;
}

/** Scale factor from 1080p reference units to an on-screen frame. */
export function frameScale(frameWidth: number, frameHeight: number): number {
  const short = Math.min(frameWidth, frameHeight);
  return short > 0 ? short / REFERENCE_SHORT_SIDE : 0.4;
}

function anchorTranslate(style: CaptionStyle): string {
  const [v, h] = style.alignMatrix === 'center' ? ['mid', 'center'] : style.alignMatrix.split('-');
  const tx = h === 'left' ? '0%' : h === 'right' ? '-100%' : '-50%';
  const ty = v === 'top' ? '0%' : v === 'bottom' ? '-100%' : '-50%';
  return `translate(${tx}, ${ty})`;
}

/** Absolute placement of the caption box inside the frame. */
export function captionAnchorStyle(style: CaptionStyle): React.CSSProperties {
  return {
    left: `${style.positionX}%`,
    top: `${style.positionY}%`,
    maxWidth: `${style.maxWidth}%`,
    transform: anchorTranslate(style),
    textAlign: style.textAlign,
    justifyContent: style.textAlign === 'left' ? 'flex-start' : style.textAlign === 'right' ? 'flex-end' : 'center',
  };
}

/** Box + typography. `scale` maps 1080p units to screen pixels. */
export function captionBoxStyle(style: CaptionStyle, scale: number): React.CSSProperties {
  const px = (v: number) => `${(v * scale).toFixed(2)}px`;
  const shadow =
    style.shadowOpacity > 0 && (style.shadowBlur > 0 || style.shadowOffsetX !== 0 || style.shadowOffsetY !== 0)
      ? `${px(style.shadowOffsetX)} ${px(style.shadowOffsetY)} ${px(style.shadowBlur)} ${withOpacity(style.shadowColor, style.shadowOpacity)}`
      : 'none';

  return {
    fontFamily: buildFontStack(style.englishFontFamily, style.fontFamily),
    fontSize: px(style.fontSize),
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    textTransform: style.textTransform === 'uppercase' ? 'uppercase' : undefined,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing ? px(style.letterSpacing) : undefined,
    color: style.textColor,
    textShadow: shadow,
    backgroundColor: style.backgroundOpacity > 0 ? withOpacity(style.backgroundColor, style.backgroundOpacity) : 'transparent',
    borderRadius: px(style.borderRadius),
    padding: `${px(style.padding * 0.6)} ${px(style.padding)}`,
    textAlign: style.textAlign,
    ['--cap-stroke-width' as string]: px(style.outlineWidth * 2),
    ['--cap-stroke-color' as string]: style.outlineColor,
    ['--cap-highlight' as string]: style.highlightColor,
    ['--cap-highlight-text' as string]: style.highlightTextColor,
    ['--cap-word-scale' as string]: String((style.activeWordScale ?? 100) / 100),
  };
}

const NUMERIC_KEYS: Array<keyof CaptionStyle> = [
  'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'outlineWidth', 'shadowOpacity', 'shadowBlur',
  'shadowOffsetX', 'shadowOffsetY', 'backgroundOpacity', 'borderRadius', 'padding', 'positionX', 'positionY', 'maxWidth',
  'activeWordScale',
];

const ENUMS: Record<string, string[]> = {
  fontStyle: ['normal', 'italic'],
  textAlign: ['left', 'center', 'right'],
  animation: ['none', 'fade', 'pop', 'bounce', 'slide', 'typewriter', 'karaoke', 'highlight'],
  textTransform: ['none', 'uppercase'],
};

const LEGACY_PX_KEYS: Array<keyof CaptionStyle> = ['fontSize', 'outlineWidth', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'borderRadius', 'padding'];

/**
 * Coerce untrusted persisted style data into a valid style (or override).
 *
 * `legacy` handles data written by the previous editor version: its pixel values
 * were preview pixels (about half of the 1080p reference units used now), its
 * positionX/Y were offsets rather than percentages, and backgrounds were rgba().
 */
export function sanitizeStyle(raw: unknown, partial: true, legacy?: boolean): CaptionStyleOverride;
export function sanitizeStyle(raw: unknown, partial?: false, legacy?: boolean): CaptionStyle;
export function sanitizeStyle(raw: unknown, partial = false, legacy = false): CaptionStyle | CaptionStyleOverride {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_STYLE) as Array<keyof CaptionStyle>) {
    if (!(key in input)) continue;
    const value = input[key];
    if (NUMERIC_KEYS.includes(key)) {
      const n = Number(value);
      if (Number.isFinite(n)) out[key] = n;
    } else if (typeof value === typeof DEFAULT_STYLE[key]) {
      out[key] = value;
    }
  }
  if (typeof out.alignMatrix === 'string' && !(out.alignMatrix in ALIGN_POSITIONS)) delete out.alignMatrix;
  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (key in out && !allowed.includes(out[key] as string)) delete out[key];
  }

  if (legacy) {
    for (const key of LEGACY_PX_KEYS) {
      if (typeof out[key] === 'number') out[key] = (out[key] as number) * 2;
    }
    delete out.positionX;
    delete out.positionY;
    if (typeof out.alignMatrix === 'string') {
      const p = ALIGN_POSITIONS[out.alignMatrix as keyof typeof ALIGN_POSITIONS];
      out.positionX = p.x;
      out.positionY = p.y;
    }
  }
  for (const key of ['positionX', 'positionY'] as const) {
    if (typeof out[key] === 'number') out[key] = Math.min(100, Math.max(0, out[key] as number));
  }
  if (typeof out.activeWordScale === 'number') out.activeWordScale = Math.min(150, Math.max(100, out.activeWordScale));

  for (const key of ['textColor', 'highlightColor', 'highlightTextColor', 'outlineColor', 'shadowColor', 'backgroundColor'] as const) {
    const value = out[key];
    if (typeof value !== 'string') continue;
    if (value === 'transparent') {
      delete out[key];
      if (key === 'backgroundColor') out.backgroundOpacity = 0;
    } else if (!isValidColor(value)) {
      delete out[key];
    } else {
      out[key] = toHex(value);
    }
  }
  return partial ? (out as CaptionStyleOverride) : { ...DEFAULT_STYLE, ...(out as CaptionStyleOverride) };
}
