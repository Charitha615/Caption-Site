import { shakeAt } from './ai/stabilize';
import { keyedSource } from './chroma';
import { filterCss } from './filters';
import {
  STABILIZE_ZOOM, clipEnd, fadeLevel, fontCss, sourceTime, spokenWordIndex, transformAt, type AspectRatio, type Clip, type Fill, type Track, type Transform, type Transition,
} from './model';

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
function easeOutBounce(p: number) {
  const n = 7.5625;
  const d = 2.75;
  if (p < 1 / d) return n * p * p;
  if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
  if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
  return n * (p -= 2.625 / d) * p + 0.984375;
}

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

/** Runs `fn` with the canvas transformed around the frame centre. */
function aroundCentre(ctx: CanvasRenderingContext2D, w: number, h: number, fn: () => void) {
  ctx.translate(w / 2, h / 2);
  fn();
  ctx.translate(-w / 2, -h / 2);
}

/**
 * Sets up the canvas for a clip that is coming in (`dir` 'in') or going out ('out'). `p` runs from
 * 0 (fully hidden) to 1 (fully shown). Returns a CSS filter to add, if the transition needs one.
 */
export function applyTransition(ctx: CanvasRenderingContext2D, type: Transition['type'], p: number, dir: 'in' | 'out', w: number, h: number, px: number): string {
  const e = easeOut(clamp01(p));
  const away = 1 - e;
  const sign = dir === 'in' ? 1 : -1;
  switch (type) {
    case 'slide-left':
      ctx.translate(sign * away * w, 0);
      break;
    case 'slide-right':
      ctx.translate(-sign * away * w, 0);
      break;
    case 'slide-up':
      ctx.translate(0, sign * away * h);
      break;
    case 'slide-down':
      ctx.translate(0, -sign * away * h);
      break;
    case 'wipe-left':
    case 'wipe-right': {
      // The visible edge travels in the named direction.
      const fromRight = (type === 'wipe-left') === (dir === 'in');
      ctx.beginPath();
      ctx.rect(fromRight ? w * away : 0, 0, w * e, h);
      ctx.clip();
      break;
    }
    case 'circle':
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, (e * Math.hypot(w, h)) / 2, 0, Math.PI * 2);
      ctx.clip();
      break;
    case 'zoom-in':
    case 'zoom-out': {
      // Zoom in grows from small on the way in and keeps growing on the way out; zoom out is the reverse.
      const grow = (type === 'zoom-in') === (dir === 'in');
      const s = grow ? 0.6 + 0.4 * e : 1.4 - 0.4 * e;
      aroundCentre(ctx, w, h, () => ctx.scale(s, s));
      ctx.globalAlpha *= e;
      break;
    }
    case 'spin':
      aroundCentre(ctx, w, h, () => {
        ctx.rotate(sign * away * -Math.PI);
        ctx.scale(Math.max(0.01, e), Math.max(0.01, e));
      });
      ctx.globalAlpha *= e;
      break;
    case 'blur':
      ctx.globalAlpha *= e;
      return away > 0.01 ? `blur(${(away * 40 * px).toFixed(2)}px)` : '';
    default:
      break;
  }
  return '';
}

/** Applies the clip's in and out transitions at time `t`. Returns an extra CSS filter ('' for none). */
function applyTransitions(ctx: CanvasRenderingContext2D, clip: Clip, t: number, w: number, h: number, px: number): string {
  const filters: string[] = [];
  const { transitionIn: tin, transitionOut: tout } = clip;
  if (tin.type !== 'none' && tin.duration > 0 && t < clip.start + tin.duration) {
    filters.push(applyTransition(ctx, tin.type, (t - clip.start) / tin.duration, 'in', w, h, px));
  }
  if (tout.type !== 'none' && tout.duration > 0 && t > clipEnd(clip) - tout.duration) {
    filters.push(applyTransition(ctx, tout.type, (clipEnd(clip) - t) / tout.duration, 'out', w, h, px));
  }
  return filters.filter(Boolean).join(' ');
}

const joinFilters = (...parts: string[]) => parts.filter((f) => f && f !== 'none').join(' ') || 'none';

function drawPicture(
  ctx: CanvasRenderingContext2D, clip: Clip, tf: Transform, source: HTMLVideoElement | HTMLImageElement,
  w: number, h: number, px: number, extraFilter: string, t: number,
) {
  const fullW = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const fullH = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!fullW || !fullH) return;
  const { crop } = tf;
  const sx = fullW * crop.left;
  const sy = fullH * crop.top;
  const sw = Math.max(1, fullW * (1 - crop.left - crop.right));
  const sh = Math.max(1, fullH * (1 - crop.top - crop.bottom));
  // A picture turned on its side fits the frame with its sides swapped.
  const sideways = Math.abs(Math.round(tf.rotation / 90)) % 2 === 1 && Math.abs(tf.rotation % 90) < 1e-6;
  const [fw, fh] = sideways ? [sh, sw] : [sw, sh];
  const fitScale = tf.fit === 'cover' ? Math.max(w / fw, h / fh) : Math.min(w / fw, h / fh);
  const stab = clip.stabilize && source instanceof HTMLVideoElement ? clip.stabilize : undefined;
  const zoom = stab ? STABILIZE_ZOOM : 1;
  const dw = sw * fitScale * tf.scale * zoom;
  const dh = sh * fitScale * tf.scale * zoom;
  ctx.translate(w / 2 + (tf.x * w) / 2, h / 2 + (tf.y * h) / 2);
  if (tf.rotation) ctx.rotate((tf.rotation * Math.PI) / 180);
  if (stab) {
    // Move the picture back by the shake (in the picture's own direction, before any flip).
    const [cx, cy] = shakeAt(stab, sourceTime(clip, t));
    ctx.translate(cx * dw, cy * dh);
  }
  if (tf.flip || tf.flipV) ctx.scale(tf.flip ? -1 : 1, tf.flipV ? -1 : 1);
  const filter = joinFilters(filterCss(clip.filter, px), extraFilter);
  if (filter !== 'none') ctx.filter = filter;
  const keyed = clip.chroma.enabled ? keyedSource(source, sx, sy, sw, sh, clip.chroma) : null;
  if (keyed) ctx.drawImage(keyed, -dw / 2, -dh / 2, dw, dh);
  else ctx.drawImage(source, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
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

function drawText(ctx: CanvasRenderingContext2D, clip: Clip, tf: Transform, t: number, w: number, h: number, px: number, extraFilter: string) {
  const style = clip.style;
  if (!style || !clip.text) return;
  const size = style.fontSize * px;
  const progress = clamp01((t - clip.start) / TEXT_ANIM_SECONDS);
  let text = clip.text;
  let scale = 1;
  let shiftY = 0;
  let animFilter = '';
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
    case 'zoom':
      scale = 1.6 - 0.6 * easeOut(progress);
      ctx.globalAlpha *= progress;
      break;
    case 'blur':
      if (progress < 1) animFilter = `blur(${((1 - progress) * 18 * px).toFixed(2)}px)`;
      ctx.globalAlpha *= progress;
      break;
    case 'bounce': {
      // A little longer than the other animations so the bounces read.
      const p = clamp01((t - clip.start) / (TEXT_ANIM_SECONDS * 2));
      shiftY = -(1 - easeOutBounce(p)) * 160 * px;
      ctx.globalAlpha *= clamp01(p * 4);
      break;
    }
    case 'typewriter': {
      const typing = clamp01((t - clip.start) / Math.min(1.5, clip.duration * 0.6));
      text = text.slice(0, Math.ceil(text.length * typing));
      break;
    }
    default:
      break;
  }
  const filter = joinFilters(animFilter, extraFilter);
  if (filter !== 'none') ctx.filter = filter;

  const align = style.align ?? 'center';
  const anchor = style.x ?? 0.5;
  ctx.font = `${style.bold ? 800 : 500} ${size}px ${fontCss(style.font)}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // Room from the anchor to the frame edge(s) the text grows towards.
  const room = align === 'center' ? 2 * Math.min(anchor, 1 - anchor) : align === 'left' ? 1 - anchor : anchor;
  // Subtitles shown word by word, or with the spoken word highlighted.
  const mode = style.animation === 'typewriter' ? 'line' : style.captionMode ?? 'line';
  const tokens = mode === 'line' ? [] : clip.text.split(/\s+/).filter(Boolean);
  const spoken = mode === 'line' ? -1 : spokenWordIndex(clip, tokens, t - clip.start);
  if (mode === 'word' && spoken >= 0) text = tokens[spoken]!;
  const source = mode === 'word' ? text : clip.text;
  // Wrap the full text so typewriter lines don't jump while typing.
  const fullLines = wrapLines(ctx, source, Math.max(w * 0.25, room * w * 0.9));
  let remaining = text.length;
  const lines = fullLines.map((line) => {
    const shown = line.slice(0, Math.max(0, remaining));
    remaining -= line.length + 1;
    return shown;
  });
  const lineHeight = size * 1.25;
  const cx = anchor * w + (tf.x * w) / 2;
  const cy = style.y * h + shiftY + (tf.y * h) / 2;
  ctx.translate(cx, cy);
  if (tf.rotation) ctx.rotate((tf.rotation * Math.PI) / 180);
  const s = scale * tf.scale;
  if (s !== 1) ctx.scale(s, s);
  const top = -((lines.length - 1) * lineHeight) / 2;
  let tokenIndex = 0;

  lines.forEach((line, i) => {
    if (!line) return;
    const ly = top + i * lineHeight;
    if (style.background) {
      const tw = ctx.measureText(line).width;
      const padX = size * 0.35;
      const padY = size * 0.14;
      const left = align === 'left' ? 0 : align === 'right' ? -tw : -tw / 2;
      ctx.fillStyle = style.background;
      ctx.beginPath();
      ctx.roundRect(left - padX, ly - lineHeight / 2 - padY / 2 + size * 0.05, tw + padX * 2, lineHeight + padY, size * 0.2);
      ctx.fill();
    }
    if (style.outline) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = size * 0.14;
      if (mode !== 'karaoke') ctx.strokeText(line, 0, ly);
    } else if (!style.background) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 8 * px;
      ctx.shadowOffsetY = 2 * px;
    }
    if (mode === 'karaoke') {
      // Word by word, so the spoken one can take the highlight colour.
      const words = line.split(/\s+/).filter(Boolean);
      const space = ctx.measureText(' ').width;
      const lineWidth = ctx.measureText(line).width;
      let x = align === 'left' ? 0 : align === 'right' ? -lineWidth : -lineWidth / 2;
      ctx.textAlign = 'left';
      for (const word of words) {
        const ww = ctx.measureText(word).width;
        if (style.outline) ctx.strokeText(word, x, ly);
        ctx.fillStyle = tokenIndex === spoken ? style.highlight ?? '#facc15' : style.color;
        ctx.fillText(word, x, ly);
        x += ww + space;
        tokenIndex++;
      }
      ctx.textAlign = align;
    } else {
      ctx.fillStyle = style.color;
      ctx.fillText(line, 0, ly);
    }
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
    const tf = transformAt(clip, t);
    const alpha = fadeLevel(clip, t) * clamp01(tf.opacity);
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    const extraFilter = applyTransitions(ctx, clip, t, w, h, px);
    if (clip.kind === 'color' && clip.fill) {
      if (extraFilter) ctx.filter = extraFilter;
      paintFill(ctx, clip.fill, w, h);
    } else if (clip.kind === 'text') {
      drawText(ctx, clip, tf, t, w, h, px, extraFilter);
    } else if (clip.kind === 'video' || clip.kind === 'image') {
      const src = source(clip);
      if (src && (!(src instanceof HTMLVideoElement) || src.readyState >= 2)) drawPicture(ctx, clip, tf, src, w, h, px, extraFilter, t);
    }
    ctx.restore();
  }
}
