import * as React from 'react';
import { flushSync } from 'react-dom';
import createGlobe from 'cobe';
import type { Globe } from 'cobe';
import './TestimonialGlobe.css';

/**
 * Reviews pinned on a spinning 3D globe (cobe). Ported from the shadcn "testimonial-globe"
 * component to plain CSS and themed for the always-dark auth panel.
 */

type Vec3 = [number, number, number];
type GlState = 'pending' | 'ready' | 'unavailable';
type Tone = 1 | 2 | 3 | 4 | 5;

export interface GlobeTestimonial {
  id: string;
  /** One or two sentences. Longer quotes are clamped. */
  quote: string;
  /** Part of the quote to emphasise. Must appear in `quote` exactly. */
  highlight?: string;
  name: string;
  role?: string;
  /** Shown on the card and in the pin's name only when known. */
  city?: string;
  /** Short country code such as "LK". Distinct values feed the country counter. */
  country?: string;
  /** Pin latitude in degrees (south is negative). */
  lat: number;
  /** Pin longitude in degrees (west is negative). */
  lng: number;
  /** Square portrait. Initials are shown when missing or broken. */
  image?: string | null;
  /** Star rating from 1 to 5. */
  rating?: number;
  tone?: Tone;
}

export interface TestimonialGlobeLabels {
  previous: string;
  next: string;
  /** Start of each pin's accessible name, followed by the reviewer. */
  pin: string;
}

export interface TestimonialGlobeProps extends React.ComponentProps<'section'> {
  items: GlobeTestimonial[];
  eyebrow?: string;
  heading?: string;
  caption?: string;
  action?: React.ReactNode;
  autoRotate?: boolean;
  /** Idle spin speed in radians per second. */
  rotationSpeed?: number;
  /** Feature the reviews one by one. Never runs with reduced motion. */
  autoplay?: boolean;
  /** Milliseconds between two featured reviews while autoplay runs. */
  interval?: number;
  /** Largest globe diameter in pixels. */
  size?: number;
  labels?: TestimonialGlobeLabels;
}

const GLOBE_RADIUS = 0.8; // cobe draws the sphere at 0.8 of the half-canvas
const THETA = 0.3;
const PIN_ALTITUDE = 0.05;
const DRAG_FRICTION = 0.92;
const RELEASE_GRACE_MS = 80;
const TEXTURE_RETRY_MS = [150, 600, 1500];
const TURN_MS = 1200;
const SWAP_MS = 220;
const HOLD_MS = 7000;
const DRAG_SLOP = 6;
const SWIPE_MIN = 40;
const WIDE_MIN = 620;
const FRONT_MARGIN = 0.06;
const MAX_CONTENT = 1200;

/** Ring colours, in the brand palette of the auth wallpaper. */
const TONES: Record<Tone, string> = { 1: '#a78bfa', 2: '#fb923c', 3: '#f472b6', 4: '#fbbf24', 5: '#4ade80' };

/** Globe colours on the dark purple panel (0..1 RGB). */
const GLOBE_COLORS = {
  baseColor: [0.24, 0.17, 0.42] as Vec3,
  glowColor: [0.42, 0.26, 0.78] as Vec3,
  markerColor: [1, 1, 1] as Vec3,
};

const DEFAULT_LABELS: TestimonialGlobeLabels = {
  previous: 'Previous review',
  next: 'Next review',
  pin: 'Show the review from',
};

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (t: number) => t * t * (3 - 2 * t);
const toneVar = (tone: Tone) => ({ '--tg-tone': TONES[tone] }) as React.CSSProperties;

function toneOf(item: GlobeTestimonial, index: number): Tone {
  return item.tone ?? (((index % 5) + 1) as Tone);
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();

function toCartesian(lat: number, lng: number): Vec3 {
  const la = (lat * Math.PI) / 180;
  const lo = (lng * Math.PI) / 180 - Math.PI;
  const c = Math.cos(la);
  return [-c * Math.cos(lo), Math.sin(la), c * Math.sin(lo)];
}

// Same rotation cobe applies on the GPU, so the HTML pins stay glued to the map.
function project([x, y, z]: Vec3, phi: number, theta: number, altitude: number) {
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const radius = GLOBE_RADIUS * (1 + altitude);
  const sx = (cp * x + sp * z) * radius;
  const sy = (sp * st * x + ct * y - cp * st * z) * radius;
  const depth = -sp * ct * x + st * y + cp * ct * z;
  return { x: (sx + 1) / 2, y: (1 - sy) / 2, depth, rim: Math.hypot(sx, sy) - GLOBE_RADIUS };
}

/** The rotation that turns a longitude to face the viewer. */
function facingPhi(lng: number) {
  return (3 * Math.PI) / 2 - (lng * Math.PI) / 180;
}

/** The copy of `angle` (mod 2π) closest to `from`, so every turn takes the short way round. */
function nearestTurn(from: number, angle: number) {
  const tau = Math.PI * 2;
  return angle + tau * Math.round((from - angle) / tau);
}

function pinOpacity(depth: number, rim: number) {
  if (depth >= 0) return 0.45 + 0.55 * smooth(clamp01(depth / 0.3));
  const exposed = Math.max(clamp01(rim / 0.04), clamp01(1 + depth * 8));
  return 0.45 * exposed * clamp01(1 + depth * 3);
}

function pinScale(depth: number) {
  return 0.62 + 0.38 * smooth(clamp01((depth + 0.2) / 0.7));
}

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : (1 - Math.pow(2, -10 * t)) / (1 - Math.pow(2, -10));
}

function useDevicePixelRatio() {
  const [dpr, setDpr] = React.useState(() => (typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)));
  React.useEffect(() => {
    if (!window.matchMedia) return;
    let query: MediaQueryList | null = null;
    const watch = () => {
      query?.removeEventListener('change', watch);
      setDpr(Math.min(window.devicePixelRatio || 1, 2));
      query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      query.addEventListener('change', watch);
    };
    watch();
    return () => query?.removeEventListener('change', watch);
  }, []);
  return dpr;
}

function seededStars(count: number) {
  let seed = 11;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const stars: { id: number; left: number; top: number; size: number; delay: number; duration: number }[] = [];
  while (stars.length < count) {
    const x = 0.02 + rand() * 0.96;
    const y = 0.02 + rand() * 0.96;
    if (Math.hypot(x - 0.5, y - 0.5) < 0.44) continue; // keep the sphere clear
    stars.push({ id: stars.length, left: x * 100, top: y * 100, size: rand() < 0.75 ? 1 : 2, delay: rand() * 4, duration: 2.5 + rand() * 3 });
  }
  return stars;
}

const STARS = seededStars(36);

const STAR_POINTS = Array.from({ length: 10 }, (_, k) => {
  const r = k % 2 ? 4.1 : 9.4;
  const a = (k * Math.PI) / 5 - Math.PI / 2;
  return `${(10 + r * Math.cos(a)).toFixed(2)},${(10.6 + r * Math.sin(a)).toFixed(2)}`;
}).join(' ');

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <polygon points={STAR_POINTS} fill="currentColor" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function QuoteMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M9.6 5.5C6.4 6.5 4.4 9.3 4.4 12.9v5.6h6.2v-6.2H7.7c.2-2 1.4-3.6 3.2-4.3L9.6 5.5Zm9.4 0c-3.2 1-5.2 3.8-5.2 7.4v5.6H20v-6.2h-2.9c.2-2 1.4-3.6 3.2-4.3L19 5.5Z" />
    </svg>
  );
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="tg-chevron" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === 'left' ? 'M10 3.5 5.5 8l4.5 4.5' : 'M6 3.5 10.5 8 6 12.5'} />
    </svg>
  );
}

/** Photo, or the reviewer's initials when there is none (or it fails to load). */
function Portrait({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = React.useState(false);
  const [shownSrc, setShownSrc] = React.useState(src);
  if (shownSrc !== src) {
    setShownSrc(src);
    setFailed(false);
  }
  if (!src || failed) {
    return <span className="tg-portrait is-initials">{initials(name)}</span>;
  }
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      referrerPolicy="no-referrer"
      className="tg-portrait"
      onError={() => setFailed(true)}
    />
  );
}

function Quote({ quote, highlight }: { quote: string; highlight?: string }) {
  const at = highlight ? quote.indexOf(highlight) : -1;
  if (at < 0 || !highlight) return <>&ldquo;{quote}&rdquo;</>;
  return (
    <>
      &ldquo;{quote.slice(0, at)}<span className="tg-hl">{highlight}</span>{quote.slice(at + highlight.length)}&rdquo;
    </>
  );
}

interface QuoteCardProps {
  item: GlobeTestimonial;
  index: number;
  tone: Tone;
  roomy: boolean;
  mode: 'current' | 'leaving' | 'sizer';
  ref?: React.Ref<HTMLElement>;
}

const QuoteCard = React.memo(function QuoteCard({ item, index, tone, roomy, mode, ref }: QuoteCardProps) {
  const rating = item.rating === undefined ? null : Math.max(0, Math.min(5, Math.round(item.rating)));
  const hidden = mode !== 'current';
  return (
    <figure
      ref={ref}
      data-quote-card={mode === 'current' ? '' : undefined}
      data-index={mode === 'current' ? index : undefined}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      className={cx('tg-card', roomy && 'is-roomy', mode === 'sizer' && 'is-sizer', mode === 'leaving' && 'is-leaving')}
      style={toneVar(tone)}
    >
      <div className="tg-card-top">
        <QuoteMark className="tg-quote-mark" />
        {rating !== null && (
          <span role="img" aria-label={`Rated ${rating} out of 5`} className="tg-rating">
            {[0, 1, 2, 3, 4].map((k) => (
              <StarIcon key={k} className={cx('tg-rating-star', k < rating && 'is-on')} />
            ))}
          </span>
        )}
      </div>
      <blockquote className="tg-quote">
        <p><Quote quote={item.quote} highlight={item.highlight} /></p>
      </blockquote>
      <figcaption className="tg-person">
        <span className="tg-avatar">{mode !== 'sizer' && <Portrait src={item.image} name={item.name} />}</span>
        <span className="tg-person-text">
          <span className="tg-name">{item.name}</span>
          {item.role && <span className="tg-role">{item.role}</span>}
        </span>
        {item.city && (
          <span className="tg-place">
            <span>{item.city}</span>
            {item.country && <span className="tg-country">{item.country}</span>}
          </span>
        )}
      </figcaption>
    </figure>
  );
});

interface PinProps {
  item: GlobeTestimonial;
  index: number;
  tone: Tone;
  size: number;
  label: string;
  featured: boolean;
  approaching: boolean;
  pressed: boolean;
  tabbable: boolean;
  register: (index: number, el: HTMLButtonElement | null) => void;
  onEnter: (index: number, event: React.PointerEvent) => void;
  onLeave: (index: number, event: React.PointerEvent) => void;
  onPress: (index: number) => void;
  onKey: (index: number, event: React.KeyboardEvent) => void;
  onFocusPin: (index: number, target: HTMLElement) => void;
}

// Position, opacity and depth are written by the animation loop, never through React.
const Pin = React.memo(function Pin({
  item, index, tone, size, label, featured, approaching, pressed, tabbable, register, onEnter, onLeave, onPress, onKey, onFocusPin,
}: PinProps) {
  return (
    <button
      ref={(el) => register(index, el)}
      type="button"
      data-pin={index}
      data-featured={featured ? '' : undefined}
      tabIndex={tabbable ? 0 : -1}
      aria-label={label}
      aria-current={featured ? 'true' : undefined}
      aria-pressed={pressed}
      className="tg-pin"
      style={{ width: size, height: size, ...toneVar(tone) }}
      onPointerEnter={(event) => onEnter(index, event)}
      onPointerLeave={(event) => onLeave(index, event)}
      onClick={() => onPress(index)}
      onKeyDown={(event) => onKey(index, event)}
      onFocus={(event) => onFocusPin(index, event.currentTarget)}
    >
      <span aria-hidden="true" className={cx('tg-pin-ping', (featured || approaching) && 'is-strong')} style={{ animationDelay: `${(index % 5) * 0.6}s` }} />
      <span className={cx('tg-pin-face', featured && 'is-featured')}>
        <Portrait src={item.image} name={item.name} />
      </span>
    </button>
  );
});

interface Turn {
  from: number;
  to: number;
  start: number;
  index: number;
  /** Feature the pin when it arrives (autoplay), instead of right away. */
  commit: boolean;
}

export function TestimonialGlobe({
  items,
  eyebrow,
  heading,
  caption,
  action,
  autoRotate = true,
  rotationSpeed = 0.12,
  autoplay = false,
  interval = 3500,
  size = 440,
  labels,
  className,
  onFocus,
  onBlur,
  ...rest
}: TestimonialGlobeProps) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const count = items.length;
  const headingId = React.useId();
  const rootRef = React.useRef<HTMLElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const globeBoxRef = React.useRef<HTMLDivElement | null>(null);
  const canvasHostRef = React.useRef<HTMLDivElement | null>(null);
  const pinRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const regionRef = React.useRef<HTMLDivElement | null>(null);
  const cardRef = React.useRef<HTMLElement | null>(null);
  const leavingRef = React.useRef<HTMLElement | null>(null);
  const leaderRef = React.useRef<SVGGElement | null>(null);
  const lineRef = React.useRef<SVGLineElement | null>(null);
  const startDotRef = React.useRef<SVGCircleElement | null>(null);
  const endDotRef = React.useRef<SVGCircleElement | null>(null);
  const kickRef = React.useRef(() => {});
  const swipeRef = React.useRef<{ id: number; x: number; y: number } | null>(null);
  const writtenRef = React.useRef<{ el: HTMLElement; opacity: number; z: string; hit: string }[]>([]);

  const [width, setWidth] = React.useState(0);
  const [glState, setGlState] = React.useState<GlState>('pending');
  const [glVersion, setGlVersion] = React.useState(0);
  const [reduced, setReduced] = React.useState(false);
  const [visible, setVisible] = React.useState(true);
  const [internal, setInternal] = React.useState<number | null>(count > 0 ? 0 : null);
  const [pinned, setPinned] = React.useState(false);
  const [hoverPin, setHoverPin] = React.useState<number | null>(null);
  const [cardHover, setCardHover] = React.useState(false);
  const [keyboard, setKeyboard] = React.useState(false);
  const [interacting, setInteracting] = React.useState(false);
  const [target, setTarget] = React.useState<number | null>(null);
  const dpr = useDevicePixelRatio();

  const featured = internal !== null && internal >= 0 && internal < count ? Math.floor(internal) : count > 0 ? 0 : null;

  const pad = width >= 1024 ? 48 : width >= 620 ? 28 : width >= 420 ? 20 : 16;
  const inner = Math.max(0, Math.min(width, MAX_CONTENT) - pad * 2);
  const wide = inner >= WIDE_MIN;
  const diameter = Math.max(
    0,
    Math.round(width === 0 ? Math.min(size, 300) : wide ? Math.min(size, inner * 0.48) : Math.min(size, inner * 0.78)),
  );
  const pinSize = diameter >= 380 ? 44 : diameter >= 300 ? 38 : 34;
  const columnGap = width >= 1024 ? 72 : 36;
  const roomy = wide && Math.min(inner - diameter - columnGap, 544) >= 420;
  const ready = glState !== 'pending';
  const running = autoplay && !reduced && count > 1 && !pinned && hoverPin === null && !cardHover && !keyboard && !interacting && visible;

  // Mutable state the animation loop reads every frame without re-rendering.
  const live = React.useRef({
    phi: 0,
    theta: THETA,
    velocity: 0,
    dragging: false,
    interacting: false,
    pressed: false,
    moved: false,
    pointerId: -1,
    pressX: 0,
    pressY: 0,
    lastX: 0,
    lastMoveAt: 0,
    moveGap: 0,
    turn: null as Turn | null,
    vectors: [] as Vec3[],
    longitudes: [] as number[],
    depths: [] as number[],
    size: diameter,
    pin: pinSize,
    wide,
    featured: null as number | null,
    front: -1,
    spin: false,
    follow: false,
    speed: rotationSpeed,
    reduced: false,
    onScreen: true,
    started: false,
    globeX: 0,
    globeY: 0,
    anchorX: 0,
    anchorY: 0,
    anchored: false,
    leaderShown: false,
    growStart: 0,
    growing: false,
    pinnedNow: false,
  });
  const handlers = React.useRef({
    arrive: (_index: number) => {},
    front: (_index: number) => {},
    settle: () => {},
  });

  const kick = () => kickRef.current();

  const select = React.useCallback((index: number | null) => {
    const s = live.current;
    if (index === s.featured) return;
    s.featured = index;
    s.growStart = performance.now();
    setInternal(index);
  }, []);

  // Turn the globe until a pin faces the viewer; autoplay features it on arrival.
  const turnTo = React.useCallback((index: number, commit: boolean) => {
    const s = live.current;
    const lng = s.longitudes[index];
    if (lng === undefined) return;
    if (s.turn && s.turn.index === index && s.turn.commit === commit) return;
    const to = nearestTurn(s.phi, facingPhi(lng));
    s.velocity = 0;
    if (s.reduced) {
      s.phi = to;
      s.turn = null;
      if (commit) handlers.current.arrive(index);
    } else {
      s.turn = { from: s.phi, to, start: performance.now(), index, commit };
    }
    kickRef.current();
  }, []);

  const go = React.useCallback(
    (index: number) => {
      select(index);
      turnTo(index, false);
    },
    [select, turnTo],
  );

  // Keep the loop's copy of props and state current.
  React.useLayoutEffect(() => {
    const s = live.current;
    if (s.vectors.length !== items.length) {
      s.front = -1;
      s.depths.length = items.length;
    }
    s.vectors = items.map((item) => toCartesian(item.lat, item.lng));
    s.longitudes = items.map((item) => item.lng);
    if (!s.started && diameter > 0) {
      s.started = true;
      const first = featured === null ? undefined : items[featured];
      if (first) s.phi = facingPhi(first.lng);
    }
    if (s.featured !== featured) {
      s.featured = featured;
      s.growStart = performance.now();
    }
    s.size = diameter;
    s.pin = pinSize;
    s.wide = wide;
    s.speed = rotationSpeed;
    s.reduced = reduced;
    s.pinnedNow = pinned;
    s.spin = autoRotate && !reduced && !pinned && !keyboard;
    s.follow = (!autoplay || interacting) && !pinned && hoverPin === null && !keyboard && !cardHover;
    handlers.current = {
      arrive: (index) => {
        setTarget(null);
        select(index);
      },
      front: (index) => select(index),
      settle: () => setInteracting(false),
    };
    kickRef.current();
  });

  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => setWidth(root.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // Where the leader line starts (the globe box) and ends (the card's left edge).
  const measureAnchor = React.useCallback(() => {
    const stage = stageRef.current;
    const box = globeBoxRef.current;
    const region = regionRef.current;
    const s = live.current;
    if (!stage || !box || !region) {
      s.anchored = false;
      return;
    }
    const sr = stage.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    const rr = region.getBoundingClientRect();
    s.globeX = br.left - sr.left;
    s.globeY = br.top - sr.top;
    s.anchorX = rr.left - sr.left;
    s.anchorY = rr.top - sr.top + Math.min(44, rr.height / 2);
    s.anchored = rr.width > 0;
    kickRef.current();
  }, []);

  React.useLayoutEffect(() => {
    measureAnchor();
    const stage = stageRef.current;
    const region = regionRef.current;
    if (!stage || !region || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measureAnchor);
    observer.observe(stage);
    observer.observe(region);
    return () => observer.disconnect();
  }, [measureAnchor, wide, diameter]);

  // Pause off-screen, in background tabs, and for reduced motion.
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const s = live.current;
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMotion = () => {
      const matches = !!motion?.matches;
      s.reduced = matches;
      setReduced(matches);
      kickRef.current();
    };
    const sync = () => {
      setVisible(s.onScreen && !document.hidden);
      kickRef.current();
    };
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      s.onScreen = entry?.isIntersecting ?? true;
      sync();
    });
    onMotion();
    motion?.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', sync);
    observer.observe(root);
    return () => {
      motion?.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', sync);
      observer.disconnect();
    };
  }, []);

  // Positions every pin (and the leader line) for the current rotation.
  const place = React.useCallback((now: number) => {
    const s = live.current;
    const written = writtenRef.current;
    const { vectors, size: d, phi, theta } = s;
    let front = -1;
    let frontDepth = -Infinity;
    let featuredPoint: { x: number; y: number; depth: number; scale: number } | null = null;
    for (let i = 0; i < vectors.length; i++) {
      const vector = vectors[i];
      if (!vector) continue;
      const point = project(vector, phi, theta, PIN_ALTITUDE);
      s.depths[i] = point.depth;
      if (point.depth > frontDepth) {
        frontDepth = point.depth;
        front = i;
      }
      const el = pinRefs.current[i];
      if (!el) continue;
      const isFeatured = i === s.featured;
      const opacity = Math.round(pinOpacity(point.depth, point.rim) * 100) / 100;
      const scale = pinScale(point.depth);
      const z = String((isFeatured ? 100 : 0) + Math.round((point.depth + 1) * 40));
      const hit = opacity > 0.4 ? 'auto' : 'none';
      const prev = written[i]?.el === el ? written[i] : undefined;
      if (!prev || prev.opacity !== opacity) el.style.opacity = String(opacity);
      if (!prev || prev.z !== z) el.style.zIndex = z;
      if (!prev || prev.hit !== hit) el.style.pointerEvents = hit;
      written[i] = { el, opacity, z, hit };
      if (opacity > 0) {
        el.style.transform = `translate3d(${(point.x * d).toFixed(2)}px, ${(point.y * d).toFixed(2)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      }
      if (isFeatured) featuredPoint = { x: point.x * d, y: point.y * d, depth: point.depth, scale };
    }

    // Without autoplay the card follows whichever pin the spin or a drag brings to the front.
    if (front >= 0 && front !== s.front) {
      const current = s.depths[s.front] ?? -Infinity;
      if (s.front < 0) s.front = front;
      else if (frontDepth > current + FRONT_MARGIN) {
        s.front = front;
        if (s.follow && !s.turn) handlers.current.front(front);
      }
    }

    const group = leaderRef.current;
    const line = lineRef.current;
    const startDot = startDotRef.current;
    const endDot = endDotRef.current;
    s.growing = false;
    if (!group || !line || !startDot || !endDot) return;
    const show = s.wide && s.anchored && !s.turn && !!featuredPoint && featuredPoint.depth > 0.15;
    if (show !== s.leaderShown) {
      s.leaderShown = show;
      group.style.opacity = show ? '1' : '0';
      if (show) s.growStart = now;
    }
    if (!show || !featuredPoint) return;
    const x0 = s.globeX + featuredPoint.x;
    const y0 = s.globeY + featuredPoint.y;
    const dx = s.anchorX - x0;
    const dy = s.anchorY - y0;
    const distance = Math.hypot(dx, dy) || 1;
    const gap = (s.pin / 2) * 1.35 * featuredPoint.scale + 6;
    const length = Math.max(0, distance - gap);
    const grow = s.reduced ? 1 : smooth(clamp01((now - s.growStart) / 360));
    s.growing = grow < 1;
    const sx = x0 + (dx / distance) * gap;
    const sy = y0 + (dy / distance) * gap;
    line.style.transform = `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px) rotate(${Math.atan2(dy, dx).toFixed(4)}rad) scaleX(${Math.max(0.001, length * grow).toFixed(2)})`;
    startDot.style.transform = `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px)`;
    endDot.style.transform = `translate(${s.anchorX.toFixed(2)}px, ${s.anchorY.toFixed(2)}px) scale(${grow >= 1 ? 1 : 0})`;
  }, []);

  // Place the pins before the first paint and on every resize, without waiting for WebGL.
  React.useLayoutEffect(() => {
    place(performance.now());
  }, [place, diameter, pinSize, featured, wide, count]);

  const hasSize = diameter > 0;

  // cobe wraps its canvas in its own element, so React owns only the host.
  React.useEffect(() => {
    const host = canvasHostRef.current;
    if (!host || !hasSize) return;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block';
    host.appendChild(canvas);

    const s = live.current;
    let globe: Globe | null = null;
    try {
      globe = createGlobe(canvas, {
        devicePixelRatio: dpr,
        width: s.size,
        height: s.size,
        phi: s.phi,
        theta: s.theta,
        dark: 1,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 6,
        ...GLOBE_COLORS,
        markers: [],
        markerElevation: 0,
      });
    } catch {
      globe = null;
    }
    // cobe hands back a no-op globe when WebGL is missing; reading the context back tells the two apart.
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = globe ? ((canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null) : null;
    } catch {
      gl = null;
    }

    let raf = 0;
    let last = 0;
    let renderedSize = s.size;
    const isBusy = () =>
      s.dragging || s.interacting || s.turn !== null || s.growing || Math.abs(s.velocity) > 1e-4 || (s.spin && s.speed !== 0);

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      const turn = s.turn;
      if (turn) {
        const t = s.reduced ? 1 : clamp01((now - turn.start) / TURN_MS);
        s.phi = turn.from + (turn.to - turn.from) * easeOutExpo(t);
        s.velocity = 0;
        if (t >= 1) {
          s.turn = null;
          s.phi = turn.to;
          if (turn.commit) handlers.current.arrive(turn.index);
        }
      } else if (!s.dragging) {
        if (Math.abs(s.velocity) > 1e-4) {
          const steps = dt * 60;
          s.phi += s.velocity * steps;
          s.velocity *= Math.pow(DRAG_FRICTION, steps);
        } else {
          s.velocity = 0;
          if (s.spin) s.phi += s.speed * dt;
        }
      }
      if (s.interacting && !s.dragging && s.velocity === 0) {
        s.interacting = false;
        handlers.current.settle();
      }
      if (globe) {
        if (s.size !== renderedSize) {
          renderedSize = s.size;
          globe.update({ phi: s.phi, theta: s.theta, width: s.size, height: s.size });
        } else {
          globe.update({ phi: s.phi, theta: s.theta });
        }
      }
      place(now);
      if (isBusy() && s.onScreen && !document.hidden) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    kickRef.current = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    kickRef.current();

    // cobe uploads the land texture on image load without redrawing, so a still globe needs a few late frames.
    const retries = TEXTURE_RETRY_MS.map((ms) => window.setTimeout(() => kickRef.current(), ms));

    const onLost = (event: Event) => {
      event.preventDefault();
      setGlState('unavailable');
    };
    const onRestored = () => setGlVersion((v) => v + 1);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    setGlState(gl ? 'ready' : 'unavailable');

    return () => {
      cancelAnimationFrame(raf);
      retries.forEach((id) => window.clearTimeout(id));
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      kickRef.current = () => {};
      globe?.destroy();
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      host.replaceChildren();
      setGlState('pending');
    };
  }, [hasSize, dpr, glVersion, place]);

  // Autoplay: one interval per review, the turn to the next pin included.
  React.useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => {
      const next = ((live.current.featured ?? -1) + 1) % count;
      setTarget(next);
      turnTo(next, true);
    }, Math.max(0, interval - TURN_MS));
    return () => window.clearTimeout(id);
  }, [running, featured, interval, count, turnTo]);

  // Anything that holds autoplay also cancels a turn it had started.
  React.useEffect(() => {
    if (running) return;
    const s = live.current;
    if (s.turn?.commit) {
      s.turn = null;
      kickRef.current();
    }
  }, [running]);

  // A clicked pin keeps the globe still for a while, then lets it go.
  React.useEffect(() => {
    if (!pinned) return;
    const id = window.setTimeout(() => setPinned(false), HOLD_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPinned(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned, featured]);

  // Card swap: the old card sinks away while the new one rises into place.
  const [cards, setCards] = React.useState({ shown: featured, leaving: null as number | null, key: 0 });
  if (cards.shown !== featured) {
    setCards({ shown: featured, leaving: reduced ? null : cards.shown, key: cards.key + 1 });
  }
  React.useLayoutEffect(() => {
    if (cards.key === 0 || live.current.reduced) return;
    const enter = cardRef.current;
    const exit = leavingRef.current;
    enter?.animate?.(
      [
        { opacity: 0, transform: 'translateY(14px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: SWAP_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
    exit?.animate?.(
      [
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0, transform: 'translateY(12px) scale(0.98)' },
      ],
      { duration: SWAP_MS, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' },
    );
    const key = cards.key;
    const id = window.setTimeout(() => setCards((c) => (c.key === key ? { ...c, leaving: null } : c)), SWAP_MS);
    return () => window.clearTimeout(id);
  }, [cards.key]);

  const step = (delta: number) => {
    if (count === 0) return;
    go(((((featured ?? (delta > 0 ? -1 : 0)) + delta) % count) + count) % count);
  };

  const registerPin = React.useCallback((index: number, el: HTMLButtonElement | null) => {
    pinRefs.current[index] = el;
  }, []);

  const onPinEnter = React.useCallback(
    (index: number, event: React.PointerEvent) => {
      if (event.pointerType === 'touch' || live.current.dragging) return;
      flushSync(() => {
        setHoverPin(index);
        select(index);
      });
    },
    [select],
  );

  const onPinLeave = React.useCallback((index: number, event: React.PointerEvent) => {
    if (event.pointerType === 'touch') return;
    setHoverPin((current) => (current === index ? null : current));
  }, []);

  const onPinKey = React.useCallback(
    (index: number, event: React.KeyboardEvent) => {
      const total = live.current.vectors.length;
      if (event.altKey || event.ctrlKey || event.metaKey || total === 0) return;
      let next: number;
      if (event.key === 'ArrowRight') next = (index + 1) % total;
      else if (event.key === 'ArrowLeft') next = (index - 1 + total) % total;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = total - 1;
      else return;
      event.preventDefault();
      go(next);
      pinRefs.current[next]?.focus({ preventScroll: true });
    },
    [go],
  );

  const onPinPress = React.useCallback(
    (index: number) => {
      const s = live.current;
      if (s.moved) {
        s.moved = false;
        return;
      }
      if (s.pinnedNow && s.featured === index) {
        setPinned(false);
        return;
      }
      select(index);
      setPinned(true);
      turnTo(index, false);
    },
    [select, turnTo],
  );

  const onPinFocus = React.useCallback(
    (index: number, target: HTMLElement) => {
      if (!target.matches(':focus-visible')) return;
      select(index);
      if ((live.current.depths[index] ?? -1) < 0.55) turnTo(index, false);
    },
    [select, turnTo],
  );

  const beginDrag = (event: React.PointerEvent) => {
    const s = live.current;
    s.dragging = true;
    s.interacting = true;
    s.turn = null;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setInteracting(true);
    kick();
  };

  const endDrag = () => {
    const s = live.current;
    s.dragging = false;
    s.pressed = false;
    s.pointerId = -1;
    kick();
  };

  const tabStop = featured ?? 0;
  const avg = (() => {
    const rated = items.filter((item) => typeof item.rating === 'number');
    if (rated.length === 0) return null;
    return (rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) / rated.length).toFixed(1);
  })();
  const countries = new Set(items.map((item) => item.country).filter(Boolean)).size;
  const shownItem = cards.shown === null ? undefined : items[cards.shown];
  const leavingItem = cards.leaving === null ? undefined : items[cards.leaving];

  return (
    <section
      {...rest}
      ref={(el) => {
        rootRef.current = el;
      }}
      data-layout={wide ? 'wide' : 'stacked'}
      data-gl={glState}
      aria-labelledby={rest['aria-labelledby'] ?? (heading ? headingId : undefined)}
      className={cx('tg', wide ? 'is-wide' : 'is-stacked', className)}
      onFocus={(event) => {
        onFocus?.(event);
        if ((event.target as HTMLElement).matches(':focus-visible')) setKeyboard(true);
      }}
      onBlur={(event) => {
        onBlur?.(event);
        const next = event.relatedTarget as Node | null;
        if (!next || !event.currentTarget.contains(next)) setKeyboard(false);
      }}
    >
      <div
        ref={stageRef}
        className="tg-stage"
        style={{
          maxWidth: MAX_CONTENT,
          paddingInline: pad,
          ...(wide ? { gridTemplateColumns: `${diameter}px minmax(0, 34rem)`, columnGap } : {}),
        }}
      >
        <header className="tg-header">
          {eyebrow && <p className="tg-eyebrow">{eyebrow}</p>}
          {heading && <h2 id={headingId} className="tg-heading">{heading}</h2>}
          {caption && <p className="tg-caption">{caption}</p>}
          <div className="tg-stats-row">
            <dl className="tg-stats">
              <div>
                <dt>{count === 1 ? 'review' : 'reviews'}</dt>
                <dd>{count}</dd>
              </div>
              {avg !== null && (
                <>
                  <span aria-hidden="true" className="tg-stats-sep" />
                  <div>
                    <dt>average</dt>
                    <dd><StarIcon className="tg-stats-star" />{avg}</dd>
                  </div>
                </>
              )}
              {countries > 1 && (
                <>
                  <span aria-hidden="true" className="tg-stats-sep" />
                  <div>
                    <dt>countries</dt>
                    <dd>{countries}</dd>
                  </div>
                </>
              )}
            </dl>
            {action}
          </div>
        </header>

        <div
          ref={globeBoxRef}
          className="tg-globe-box"
          style={{ width: diameter, height: diameter }}
          onPointerDown={(event) => {
            if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
            const s = live.current;
            s.pressed = true;
            s.moved = false;
            s.pointerId = event.pointerId;
            s.pressX = s.lastX = event.clientX;
            s.pressY = event.clientY;
            s.lastMoveAt = event.timeStamp;
            s.moveGap = 0;
            s.velocity = 0;
            // A press on the bare globe grabs it at once; a press on a pin waits for the slop so it can still be a click.
            if (!(event.target as Element).closest('[data-pin]')) beginDrag(event);
          }}
          onPointerMove={(event) => {
            const s = live.current;
            if (!s.pressed || event.pointerId !== s.pointerId) return;
            if (!s.dragging) {
              if (Math.hypot(event.clientX - s.pressX, event.clientY - s.pressY) < DRAG_SLOP) return;
              s.moved = true;
              beginDrag(event);
            }
            const now = event.timeStamp;
            const delta = ((event.clientX - s.lastX) / Math.max(s.size, 1)) * Math.PI;
            const elapsed = Math.max(now - s.lastMoveAt, 1);
            s.moveGap = elapsed;
            s.lastX = event.clientX;
            s.lastMoveAt = now;
            s.phi += delta;
            s.velocity = (delta / elapsed) * (1000 / 60);
            if (Math.abs(event.clientX - s.pressX) > DRAG_SLOP) s.moved = true;
          }}
          onPointerUp={(event) => {
            const s = live.current;
            if (event.pointerId !== s.pointerId) return;
            if (s.dragging) {
              const grace = Math.min(250, Math.max(RELEASE_GRACE_MS, s.moveGap * 1.5));
              if (s.reduced || event.timeStamp - s.lastMoveAt > grace) s.velocity = 0;
              if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }
            endDrag();
          }}
          onPointerCancel={() => {
            live.current.velocity = 0;
            endDrag();
          }}
          onLostPointerCapture={(event) => {
            if (event.pointerId === live.current.pointerId) endDrag();
          }}
        >
          <div aria-hidden="true" className="tg-stars">
            {STARS.map((star) => (
              <span
                key={star.id}
                style={{
                  left: `${star.left}%`,
                  top: `${star.top}%`,
                  width: star.size,
                  height: star.size,
                  animationDelay: `${star.delay}s`,
                  animationDuration: `${star.duration}s`,
                }}
              />
            ))}
          </div>

          {glState === 'unavailable' && (
            <div aria-hidden="true" className="tg-fallback">
              <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.6">
                <ellipse cx="50" cy="50" rx="50" ry="14" />
                <ellipse cx="50" cy="50" rx="50" ry="32" />
                <line x1="0" y1="50" x2="100" y2="50" />
                <ellipse cx="50" cy="50" rx="18" ry="50" />
                <ellipse cx="50" cy="50" rx="36" ry="50" />
                <line x1="50" y1="0" x2="50" y2="100" />
              </svg>
            </div>
          )}

          <div ref={canvasHostRef} aria-hidden="true" className={cx('tg-canvas', ready && 'is-ready')} />

          <div className="tg-pins">
            {items.map((item, i) => (
              <Pin
                key={item.id}
                item={item}
                index={i}
                tone={toneOf(item, i)}
                size={pinSize}
                label={`${text.pin} ${item.name}${item.city ? `, ${item.city}` : ''}`}
                featured={i === featured}
                approaching={running && target === i}
                pressed={i === featured && pinned}
                tabbable={i === tabStop}
                register={registerPin}
                onEnter={onPinEnter}
                onLeave={onPinLeave}
                onPress={onPinPress}
                onKey={onPinKey}
                onFocusPin={onPinFocus}
              />
            ))}
          </div>
        </div>

        <div
          className="tg-card-col"
          onPointerEnter={(event) => {
            if (event.pointerType !== 'touch') setCardHover(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType !== 'touch') setCardHover(false);
          }}
        >
          <div
            ref={regionRef}
            aria-live={running ? 'off' : 'polite'}
            aria-atomic="true"
            className="tg-region"
            onPointerDown={(event) => {
              if (event.pointerType === 'mouse') return;
              swipeRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
            }}
            onPointerUp={(event) => {
              const swipe = swipeRef.current;
              if (!swipe || swipe.id !== event.pointerId) return;
              swipeRef.current = null;
              const dx = event.clientX - swipe.x;
              const dy = event.clientY - swipe.y;
              if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
            }}
            onPointerCancel={() => {
              swipeRef.current = null;
            }}
          >
            {/* Invisible copies of every card hold the region at the tallest card's height, so swaps never jump. */}
            {items.map((item, i) => (
              <QuoteCard key={`sizer-${item.id}`} item={item} index={i} tone={toneOf(item, i)} roomy={roomy} mode="sizer" />
            ))}
            {leavingItem && cards.leaving !== null && (
              <QuoteCard key={`leaving-${cards.key}`} ref={leavingRef} item={leavingItem} index={cards.leaving} tone={toneOf(leavingItem, cards.leaving)} roomy={roomy} mode="leaving" />
            )}
            {shownItem && cards.shown !== null && (
              <QuoteCard key={`card-${cards.key}`} ref={cardRef} item={shownItem} index={cards.shown} tone={toneOf(shownItem, cards.shown)} roomy={roomy} mode="current" />
            )}
          </div>
          {count > 1 && (
            <div className={cx('tg-nav', roomy && 'is-roomy')}>
              <button type="button" aria-label={text.previous} className="tg-nav-btn" onClick={() => step(-1)}>
                <Chevron direction="left" />
              </button>
              <span className="tg-nav-count">
                {featured === null ? '–' : featured + 1} / {count}
              </span>
              <button type="button" aria-label={text.next} className="tg-nav-btn" onClick={() => step(1)}>
                <Chevron direction="right" />
              </button>
            </div>
          )}
        </div>

        {wide && (
          <svg aria-hidden="true" className="tg-leader">
            <g ref={leaderRef}>
              <line ref={lineRef} x1="0" y1="0" x2="1" y2="0" stroke="currentColor" strokeOpacity="0.38" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <circle ref={startDotRef} r="2.5" className="tg-leader-start" />
              <circle ref={endDotRef} r="3.5" className="tg-leader-end" strokeWidth="1.2" />
            </g>
          </svg>
        )}
      </div>
    </section>
  );
}

export default TestimonialGlobe;
