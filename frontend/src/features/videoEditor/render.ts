import { filterCss } from './filters';
import { clipEnd, fadeLevel, fontCss, type AspectRatio, type Clip, type Fill, type Track } from './model';

/**
 * Draws one frame of the project on a canvas. The preview and the export both use this,
 * so what you see while editing is what gets exported.
 */

/** Everything drawn is sized for a frame whose short side is this many pixels. */
export const BASE_SHORT_SIDE = 1080;
const TEXT_ANIM_SECONDS = 0.45;

export interface Scene {
  tracks: Track[];
  clips: Clip[];
}

/** Gives the decoded picture for a clip: a <video> (already at the right time) or a loaded <img>. */
export type SourceLookup = (clip: Clip) => HTMLVideoElement | HTMLImageElement | undefined;

/** Output size for an aspect ratio, with `short` pixels on the short side (even numbers, as encoders need). */
export function frameSize(aspect: AspectRatio, short: number): { width: number; height: number } {
  const [a, b] = aspect.split(':').map(Number) as [number, number];
  const even = (n: number) => Math.round(n / 2) * 2;
  return a >= b ? { width: even((short * a) / b), height: short } : { width: short, height: even((short * b) / a) };
}

/** The clip on a track at time `t` (the later-starting one wins where clips overlap). */
export function activeClip(clips: Clip[], trackId: string, t: number): Clip | undefined {
  let found: Clip | undefined;
  for (const c of clips) {
    if (c.trackId === trackId && t >= c.start && t < clipEnd(c) && (!found || c.start >= found.start)) found = c;
  }
  return found;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const easeOutBack = (p: number) => 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);

function paintFill(ctx: CanvasRenderingContext2D, fill: Fill, w: number, h: number) {
  if (fill.to) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, fill.from);
    g.addColorStop(1, fill.to);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = fill.from;
  }
  ctx.fillRect(0, 0, w, h);
}

function drawPicture(ctx: CanvasRenderingContext2D, clip: Clip, source: HTMLVideoElement | HTMLImageElement, w: number, h: number, px: number) {
  const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!sw || !sh) return;
  const { fit, scale, x, y, rotation, flip } = clip.transform;
  const fitScale = fit === 'cover' ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh);
  const dw = sw * fitScale * scale;
  const dh = sh * fitScale * scale;
  ctx.translate(w / 2 + (x * w) / 2, h / 2 + (y * h) / 2);
  if (rotation) ctx.rotate((rotation * Math.PI) / 180);
  if (flip) ctx.scale(-1, 1);
  const filter = filterCss(clip.filter, px);
  if (filter !== 'none') ctx.filter = filter;
  ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh);
}

/** Splits text into lines that fit `maxWidth` (explicit line breaks are kept). */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawText(ctx: CanvasRenderingContext2D, clip: Clip, t: number, w: number, h: number, px: number) {
  const style = clip.style;
  if (!style || !clip.text) return;
  const size = style.fontSize * px;
  const progress = clamp01((t - clip.start) / TEXT_ANIM_SECONDS);
  let text = clip.text;
  let scale = 1;
  let shiftY = 0;
  switch (style.animation) {
    case 'fade':
      ctx.globalAlpha *= progress;
      break;
    case 'pop':
      scale = 0.6 + 0.4 * easeOutBack(progress);
      ctx.globalAlpha *= clamp01(progress * 2);
      break;
    case 'slide':
      shiftY = (1 - easeOut(progress)) * 60 * px;
      ctx.globalAlpha *= progress;
      break;
    case 'typewriter': {
      const typing = clamp01((t - clip.start) / Math.min(1.5, clip.duration * 0.6));
      text = text.slice(0, Math.ceil(text.length * typing));
      break;
    }
    default:
      break;
  }

  ctx.font = `${style.bold ? 800 : 500} ${size}px ${fontCss(style.font)}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // Wrap the full text so typewriter lines don't jump while typing.
  const fullLines = wrapLines(ctx, clip.text, w * 0.9);
  let remaining = text.length;
  const lines = fullLines.map((line) => {
    const shown = line.slice(0, Math.max(0, remaining));
    remaining -= line.length + 1;
    return shown;
  });
  const lineHeight = size * 1.25;
  const cx = w / 2;
  const cy = style.y * h + shiftY;
  ctx.translate(cx, cy);
  if (scale !== 1) ctx.scale(scale, scale);
  const top = -((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, i) => {
    if (!line) return;
    const ly = top + i * lineHeight;
    if (style.background) {
      const tw = ctx.measureText(line).width;
      const padX = size * 0.35;
      const padY = size * 0.14;
      ctx.fillStyle = style.background;
      ctx.beginPath();
      ctx.roundRect(-tw / 2 - padX, ly - lineHeight / 2 - padY / 2 + size * 0.05, tw + padX * 2, lineHeight + padY, size * 0.2);
      ctx.fill();
    }
    if (style.outline) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = size * 0.14;
      ctx.strokeText(line, 0, ly);
    } else if (!style.background) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 8 * px;
      ctx.shadowOffsetY = 2 * px;
    }
    ctx.fillStyle = style.color;
    ctx.fillText(line, 0, ly);
    ctx.shadowColor = 'transparent';
  });
}

export function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, scene: Scene, source: SourceLookup) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const px = Math.min(w, h) / BASE_SHORT_SIDE;
  // Tracks higher in the list are drawn on top, so paint from the bottom up.
  for (let i = scene.tracks.length - 1; i >= 0; i--) {
    const track = scene.tracks[i]!;
    if (track.kind === 'audio' || track.hidden) continue;
    const clip = activeClip(scene.clips, track.id, t);
    if (!clip) continue;
    const alpha = fadeLevel(clip, t) * clip.transform.opacity;
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (clip.kind === 'color' && clip.fill) {
      paintFill(ctx, clip.fill, w, h);
    } else if (clip.kind === 'text') {
      drawText(ctx, clip, t, w, h, px);
    } else if (clip.kind === 'video' || clip.kind === 'image') {
      const src = source(clip);
      if (src && (!(src instanceof HTMLVideoElement) || src.readyState >= 2)) drawPicture(ctx, clip, src, w, h, px);
    }
    ctx.restore();
  }
}
