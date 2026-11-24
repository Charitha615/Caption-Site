import { create } from 'zustand';
import { forgetDecodedAudio } from './ai/timelineAudio';
import { forgetCustomFonts, type CustomFont } from './customFonts';
import {
  DEFAULT_CHROMA, DEFAULT_FILTER, DEFAULT_TEXT_STYLE, DEFAULT_TRANSFORM, IMAGE_DEFAULT_DURATION, KEY_EPSILON, MIN_CLIP_DURATION,
  NO_TRANSITION, TEXT_DEFAULT_DURATION,
  clipEnd, hasSource, retimeKeyframes, sourceLimit, splitKeyframes, trackKindFor, transformAt, uid, withKeyframe,
  type AnimProp, type AspectRatio, type ChromaKey, type Clip, type Fill, type FilterSettings, type Keyframes, type MediaItem,
  type ClipWord, type Stabilization, type TextStyle, type Track, type TrackKind, type Transform, type Transition,
} from './model';

/** A subtitle line to place: timeline seconds, with optional word timings (also timeline seconds). */
export interface SubtitleLine {
  start: number;
  end: number;
  text: string;
  words?: { word: string; start: number; end: number }[];
}

export const SUBTITLE_STYLE: Partial<TextStyle> = {
  fontSize: 58, y: 0.84, outline: true, bold: true, animation: 'none', captionMode: 'line', highlight: '#facc15',
};

/** The part of the state that undo / redo restores. */
interface Snapshot {
  tracks: Track[];
  clips: Clip[];
}

const HISTORY_LIMIT = 100;
/** Slider drags send many updates; changes to one clip this close together share one undo step. */
const EDIT_MERGE_MS = 800;

const defaultTracks = (): Track[] => [
  { id: 'track-text', kind: 'text', name: 'Text', muted: false, hidden: false },
  { id: 'track-video', kind: 'video', name: 'Video', muted: false, hidden: false },
  { id: 'track-audio', kind: 'audio', name: 'Audio', muted: false, hidden: false },
];

export interface ClipPatch {
  text?: string;
  volume?: number;
  speed?: number;
  fadeIn?: number;
  fadeOut?: number;
  label?: string;
  style?: Partial<TextStyle>;
  filter?: Partial<FilterSettings>;
  transform?: Partial<Transform>;
  fill?: Partial<Fill>;
  /** Replaces the keyframes of the properties it names (an empty list removes them). */
  keyframes?: Keyframes;
  transitionIn?: Partial<Transition>;
  transitionOut?: Partial<Transition>;
  chroma?: Partial<ChromaKey>;
  denoise?: boolean;
  /** Shake correction for a video clip; null turns it off. */
  stabilize?: Stabilization | null;
}

export interface VideoEditorState extends Snapshot {
  name: string;
  aspect: AspectRatio;
  media: MediaItem[];
  /** Fonts the user uploaded this session. */
  fonts: CustomFont[];
  playhead: number;
  playing: boolean;
  /** Timeline zoom in pixels per second. */
  zoom: number;
  snap: boolean;
  selectedId: string | null;
  past: Snapshot[];
  future: Snapshot[];

  setName: (name: string) => void;
  setAspect: (aspect: AspectRatio) => void;
  addMedia: (item: MediaItem) => void;
  removeMedia: (id: string) => void;
  /** Stores the waveform of a media item once it has been worked out. */
  setMediaPeaks: (id: string, peaks: number[], peaksPerSecond: number) => void;
  addFont: (font: CustomFont) => void;
  setPlayhead: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setZoom: (zoom: number) => void;
  toggleSnap: () => void;
  select: (id: string | null) => void;

  /** Saves the current tracks and clips for undo. Call once before a change (or a drag). */
  commit: () => void;
  undo: () => void;
  redo: () => void;

  /** Places media on the timeline: on the given track and time, or after the last clip of the first fitting track. */
  addMediaClip: (mediaId: string, at?: { trackId?: string; start?: number; freeTrack?: boolean; volume?: number; fadeOut?: number }) => void;
  /** Adds text at the playhead, on a text track that is free there (a new one if needed). */
  addTextClip: (text: string, style?: Partial<TextStyle>, duration?: number) => void;
  /** Adds a colour or gradient at the playhead, on a video track that is free there (a new one if needed). */
  addColorClip: (fill: Fill, label: string, duration?: number) => void;
  /** A background with a title over it, as one undo step. */
  addTitleCard: (fill: Fill, label: string, text: string, style?: Partial<TextStyle>, duration?: number) => void;
  /** Live update while dragging (no history entry; call `commit` first). */
  moveClip: (id: string, start: number, trackId?: string) => void;
  trimClip: (id: string, edge: 'start' | 'end', time: number) => void;
  updateClip: (id: string, patch: ClipPatch) => void;
  /** Applies the same change to every clip of the given kinds (e.g. a filter to all pictures). */
  updateAll: (kinds: Clip['kind'][], patch: ClipPatch) => void;
  splitAtPlayhead: () => void;
  /** Sets `prop` at the playhead as a keyframe (the playhead is clamped into the clip). */
  setKeyframe: (id: string, prop: AnimProp, value: number) => void;
  /** Removes the keyframe of `prop` at the playhead. */
  removeKeyframe: (id: string, prop: AnimProp) => void;
  /** Removes all keyframes (or those of one property), keeping the value under the playhead. */
  clearKeyframes: (id: string, prop?: AnimProp) => void;
  /** A slow zoom across the whole clip (the "Ken Burns" look). */
  addZoomMotion: (id: string, direction: 'in' | 'out') => void;
  /** Copies a video clip's sound to its own audio clip and silences the video clip. */
  detachAudio: (id: string) => void;
  /**
   * Puts subtitle lines on a subtitles track as one undo step. Replaces the clips of `replaceTrackId`
   * when given; otherwise uses a new track (hiding other subtitle tracks). Returns the track id.
   */
  setSubtitles: (lines: SubtitleLine[], opts?: { name?: string; style?: Partial<TextStyle>; replaceTrackId?: string }) => string;
  /** Restyles every clip on a subtitles track (all subtitle tracks when no id is given). */
  styleSubtitles: (style: Partial<TextStyle>, trackId?: string) => void;
  /** Cuts these time ranges out of every track and closes the gaps (silence removal, keeping highlights). */
  removeRanges: (ranges: [number, number][]) => void;
  /** Points a clip at another media item with the same timing (e.g. a cleaned-up recording), optionally from a new in-point. */
  replaceClipMedia: (id: string, mediaId: string, offset?: number) => void;
  /** Adds text clips one after another (e.g. a script) as one undo step, each on a text track free at its time. */
  addTextSequence: (items: { text: string; start: number; duration: number }[], style?: Partial<TextStyle>) => void;
  deleteSelected: () => void;
  /** Deletes the selected clip and pulls later clips on its track left to close the hole. */
  rippleDeleteSelected: () => void;
  duplicateSelected: () => void;
  /** Packs the clips of a track (the selected clip's, or the main video track) one after another from 0. */
  closeGaps: () => void;
  addTrack: (kind: TrackKind) => string;
  toggleTrack: (id: string, key: 'muted' | 'hidden') => void;
  reset: () => void;
}

export const totalDuration = (clips: Clip[]) => clips.reduce((max, clip) => Math.max(max, clipEnd(clip)), 0);

const newClip = (fields: Pick<Clip, 'trackId' | 'kind' | 'start' | 'duration'> & Partial<Clip>): Clip => ({
  id: uid('clip'),
  offset: 0,
  speed: 1,
  volume: 1,
  fadeIn: 0,
  fadeOut: 0,
  filter: { ...DEFAULT_FILTER },
  transform: { ...DEFAULT_TRANSFORM },
  keyframes: {},
  transitionIn: { ...NO_TRANSITION },
  transitionOut: { ...NO_TRANSITION },
  chroma: { ...DEFAULT_CHROMA },
  denoise: false,
  ...fields,
});

const initial = () => ({
  name: 'Untitled video',
  aspect: '16:9' as AspectRatio,
  media: [] as MediaItem[],
  fonts: [] as CustomFont[],
  tracks: defaultTracks(),
  clips: [] as Clip[],
  playhead: 0,
  playing: false,
  zoom: 60,
  snap: true,
  selectedId: null as string | null,
  past: [] as Snapshot[],
  future: [] as Snapshot[],
});

/** Merges a patch into a clip, keeping the source span when the speed changes. */
function applyPatch(clip: Clip, patch: ClipPatch, media: MediaItem[]): Clip {
  const next: Clip = {
    ...clip,
    ...patch,
    style: patch.style && clip.style ? { ...clip.style, ...patch.style } : clip.style,
    filter: patch.filter ? { ...clip.filter, ...patch.filter } : clip.filter,
    transform: patch.transform ? { ...clip.transform, ...patch.transform } : clip.transform,
    fill: patch.fill && clip.fill ? { ...clip.fill, ...patch.fill } : clip.fill,
    keyframes: patch.keyframes ? withoutEmpty({ ...clip.keyframes, ...patch.keyframes }) : clip.keyframes,
    transitionIn: patch.transitionIn ? { ...clip.transitionIn, ...patch.transitionIn } : clip.transitionIn,
    transitionOut: patch.transitionOut ? { ...clip.transitionOut, ...patch.transitionOut } : clip.transitionOut,
    chroma: patch.chroma ? { ...clip.chroma, ...patch.chroma } : clip.chroma,
    words: patch.text !== undefined && patch.text !== clip.text ? undefined : clip.words,
    stabilize: patch.stabilize === null ? undefined : patch.stabilize ?? clip.stabilize,
  };
  if (patch.speed !== undefined && patch.speed !== clip.speed && hasSource(clip)) {
    const span = clip.duration * clip.speed;
    next.duration = Math.max(MIN_CLIP_DURATION, Math.min(span / patch.speed, sourceLimit(next, media.find((m) => m.id === clip.mediaId))));
    // The motion stays with the picture: keys stretch with the clip.
    const factor = next.duration / clip.duration;
    next.keyframes = retimeKeyframes(next.keyframes, (t) => t * factor);
  }
  // Fades can't be longer than the clip.
  next.fadeIn = Math.min(next.fadeIn, next.duration);
  next.fadeOut = Math.min(next.fadeOut, next.duration - next.fadeIn);
  return next;
}

/** Word timings moved `by` seconds earlier (after cutting the start off a clip); words before the new start are dropped. */
function shiftWords(words: ClipWord[] | undefined, by: number): ClipWord[] | undefined {
  return words?.filter((w) => w.e > by).map((w) => ({ text: w.text, t: Math.max(0, w.t - by), e: w.e - by }));
}

/** Sorted, merged copies of the ranges, clipped to start at 0. */
export function mergeRanges(ranges: [number, number][]): [number, number][] {
  const sorted = ranges.map(([a, b]) => [Math.max(0, a), b] as [number, number]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** Pieces of [from, to) left after removing the (merged) ranges. */
function keptPieces(from: number, to: number, ranges: [number, number][]): [number, number][] {
  const pieces: [number, number][] = [];
  let cursor = from;
  for (const [a, b] of ranges) {
    if (b <= cursor) continue;
    if (a >= to) break;
    if (a > cursor) pieces.push([cursor, Math.min(a, to)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < to) pieces.push([cursor, to]);
  return pieces.filter(([a, b]) => b - a >= MIN_CLIP_DURATION / 2);
}

function withoutEmpty(keyframes: Keyframes): Keyframes {
  const out: Keyframes = {};
  for (const [prop, keys] of Object.entries(keyframes) as [AnimProp, Keyframes[AnimProp]][]) {
    if (keys?.length) out[prop] = keys;
  }
  return out;
}

export const useVideoEditorStore = create<VideoEditorState>()((set, get) => {
  const snapshot = (): Snapshot => ({ tracks: get().tracks, clips: get().clips });
  const record = () => set((s) => ({ past: [...s.past, snapshot()].slice(-HISTORY_LIMIT), future: [] }));
  let lastEdit = { id: '', at: 0 };
  const mapClip = (id: string, fn: (clip: Clip) => Clip) => set((s) => ({ clips: s.clips.map((c) => (c.id === id ? fn(c) : c)) }));

  /** A track of this kind with nothing in [start, start + duration), created on top of its kind when none is free. */
  const freeTrack = (kind: TrackKind, start: number, duration: number): string => {
    const { tracks, clips } = get();
    const free = tracks.find(
      (t) => t.kind === kind && !clips.some((c) => c.trackId === t.id && c.start < start + duration && clipEnd(c) > start),
    );
    return free?.id ?? get().addTrack(kind);
  };

  const placeText = (text: string, style: Partial<TextStyle> | undefined, duration: number) => {
    const { playhead } = get();
    const trackId = freeTrack('text', playhead, duration);
    const clip = newClip({ trackId, kind: 'text', start: playhead, duration, text, style: { ...DEFAULT_TEXT_STYLE, ...style } });
    set((s) => ({ clips: [...s.clips, clip], selectedId: clip.id }));
  };

  const placeColor = (fill: Fill, label: string, duration: number) => {
    const { playhead } = get();
    const trackId = freeTrack('video', playhead, duration);
    const clip = newClip({ trackId, kind: 'color', start: playhead, duration, fill: { ...fill }, label });
    set((s) => ({ clips: [...s.clips, clip], selectedId: clip.id }));
  };

  return {
    ...initial(),

    setName: (name) => set({ name }),
    setAspect: (aspect) => set({ aspect }),
    addMedia: (item) => set((s) => ({ media: [...s.media, item] })),
    removeMedia: (id) => {
      const item = get().media.find((m) => m.id === id);
      if (!item) return;
      record();
      URL.revokeObjectURL(item.url);
      set((s) => ({
        media: s.media.filter((m) => m.id !== id),
        clips: s.clips.filter((c) => c.mediaId !== id),
        selectedId: s.clips.some((c) => c.id === s.selectedId && c.mediaId === id) ? null : s.selectedId,
      }));
    },
    setMediaPeaks: (id, peaks, peaksPerSecond) =>
      set((s) => ({ media: s.media.map((m) => (m.id === id ? { ...m, peaks, peaksPerSecond } : m)) })),
    addFont: (font) => set((s) => ({ fonts: [...s.fonts, font] })),
    setPlayhead: (time) => set({ playhead: Math.max(0, time) }),
    setPlaying: (playing) => set({ playing }),
    setZoom: (zoom) => set({ zoom: Math.min(400, Math.max(4, zoom)) }),
    toggleSnap: () => set((s) => ({ snap: !s.snap })),
    select: (selectedId) => set({ selectedId }),

    commit: record,
    undo: () => {
      const prev = get().past.at(-1);
      if (!prev) return;
      set((s) => ({ ...prev, past: s.past.slice(0, -1), future: [snapshot(), ...s.future], selectedId: null }));
    },
    redo: () => {
      const next = get().future[0];
      if (!next) return;
      set((s) => ({ ...next, future: s.future.slice(1), past: [...s.past, snapshot()], selectedId: null }));
    },

    addMediaClip: (mediaId, at) => {
      const { media, tracks, clips } = get();
      const item = media.find((m) => m.id === mediaId);
      if (!item) return;
      const kind = trackKindFor(item.kind);
      const duration = item.kind === 'image' ? IMAGE_DEFAULT_DURATION : item.duration;
      let trackId = at?.freeTrack ? undefined : (tracks.find((t) => t.id === at?.trackId && t.kind === kind) ?? tracks.find((t) => t.kind === kind))?.id;
      if (!at?.freeTrack && !trackId) return;
      record();
      // A free track may be a new one, so it is picked after the history entry.
      trackId ??= freeTrack(kind, Math.max(0, at?.start ?? 0), duration);
      const start = at?.start ?? totalDuration(clips.filter((c) => c.trackId === trackId));
      const clip = newClip({
        trackId, kind: item.kind, mediaId, start: Math.max(0, start), duration, volume: at?.volume ?? 1, fadeOut: Math.min(at?.fadeOut ?? 0, duration),
      });
      set((s) => ({ clips: [...s.clips, clip], selectedId: clip.id }));
    },

    addTextClip: (text, style, duration = TEXT_DEFAULT_DURATION) => {
      record();
      placeText(text, style, duration);
    },

    addColorClip: (fill, label, duration = IMAGE_DEFAULT_DURATION) => {
      record();
      placeColor(fill, label, duration);
    },

    addTitleCard: (fill, label, text, style, duration = TEXT_DEFAULT_DURATION) => {
      record();
      placeColor(fill, label, duration);
      placeText(text, style, duration);
    },

    moveClip: (id, start, trackId) => {
      const target = trackId ? get().tracks.find((t) => t.id === trackId) : undefined;
      mapClip(id, (c) => ({
        ...c,
        start: Math.max(0, start),
        trackId: target && target.kind === trackKindFor(c.kind) ? target.id : c.trackId,
      }));
    },

    trimClip: (id, edge, time) => {
      const media = get().media;
      mapClip(id, (c) => {
        const item = media.find((m) => m.id === c.mediaId);
        if (edge === 'end') {
          const duration = Math.min(sourceLimit(c, item), Math.max(MIN_CLIP_DURATION, time - c.start));
          return { ...c, duration, fadeOut: Math.min(c.fadeOut, duration) };
        }
        // Start edge: the end stays put; a sourced clip can't reveal more than its in-point.
        const end = clipEnd(c);
        const earliest = hasSource(c) ? Math.max(0, c.start - c.offset / c.speed) : 0;
        const start = Math.min(end - MIN_CLIP_DURATION, Math.max(earliest, time));
        const shift = start - c.start;
        return {
          ...c,
          start,
          duration: end - start,
          offset: hasSource(c) ? Math.max(0, c.offset + shift * c.speed) : 0,
          fadeIn: Math.min(c.fadeIn, end - start),
          // Keys stay on the same moments of the picture.
          keyframes: shift ? retimeKeyframes(c.keyframes, (t) => t - shift) : c.keyframes,
          words: shift ? shiftWords(c.words, shift) : c.words,
        };
      });
    },

    updateClip: (id, patch) => {
      const now = Date.now();
      if (lastEdit.id !== id || now - lastEdit.at > EDIT_MERGE_MS) record();
      lastEdit = { id, at: now };
      const media = get().media;
      mapClip(id, (c) => applyPatch(c, patch, media));
    },

    updateAll: (kinds, patch) => {
      record();
      const media = get().media;
      set((s) => ({ clips: s.clips.map((c) => (kinds.includes(c.kind) ? applyPatch(c, patch, media) : c)) }));
    },

    splitAtPlayhead: () => {
      const { clips, playhead, selectedId } = get();
      const inside = (c: Clip) => playhead > c.start + MIN_CLIP_DURATION && playhead < clipEnd(c) - MIN_CLIP_DURATION;
      // The selected clip if the playhead is on it, otherwise every clip under the playhead.
      const selected = clips.find((c) => c.id === selectedId && inside(c));
      const targets = selected ? [selected] : clips.filter(inside);
      if (targets.length === 0) return;
      record();
      const ids = new Set(targets.map((c) => c.id));
      const next: Clip[] = [];
      let newSelected = selectedId;
      for (const c of clips) {
        if (!ids.has(c.id)) {
          next.push(c);
          continue;
        }
        const first = playhead - c.start;
        const [leftKeys, rightKeys] = splitKeyframes(c.keyframes, first);
        // Fades and transitions out move to the right part; those coming in stay on the left.
        const left: Clip = {
          ...c, duration: first, fadeOut: 0, fadeIn: Math.min(c.fadeIn, first), keyframes: leftKeys, transitionOut: { ...NO_TRANSITION },
          words: c.words?.filter((w) => w.t < first),
        };
        const right: Clip = {
          ...c,
          id: uid('clip'),
          start: playhead,
          duration: c.duration - first,
          offset: hasSource(c) ? c.offset + first * c.speed : 0,
          fadeIn: 0,
          fadeOut: Math.min(c.fadeOut, c.duration - first),
          keyframes: rightKeys,
          transitionIn: { ...NO_TRANSITION },
          words: shiftWords(c.words?.filter((w) => w.t >= first), first),
          // Text that types or pops in shouldn't replay on the second half.
          style: c.style ? { ...c.style, animation: 'none' } : undefined,
        };
        next.push(left, right);
        if (c.id === selectedId) newSelected = right.id;
      }
      set({ clips: next, selectedId: newSelected });
    },

    setKeyframe: (id, prop, value) => {
      const clip = get().clips.find((c) => c.id === id);
      if (!clip) return;
      const rel = Math.min(clip.duration, Math.max(0, get().playhead - clip.start));
      get().updateClip(id, { keyframes: { [prop]: withKeyframe(clip.keyframes[prop], rel, value) } });
    },

    removeKeyframe: (id, prop) => {
      const clip = get().clips.find((c) => c.id === id);
      const keys = clip?.keyframes[prop];
      if (!clip || !keys) return;
      const rel = get().playhead - clip.start;
      const rest = keys.filter((k) => Math.abs(k.t - rel) > KEY_EPSILON);
      if (rest.length === keys.length) return;
      record();
      lastEdit = { id: '', at: 0 };
      // The last key going away leaves the property at the value it had there.
      const transform = rest.length === 0 ? { [prop]: keys[0]!.v } : undefined;
      mapClip(id, (c) => applyPatch(c, { keyframes: { [prop]: rest }, transform }, get().media));
    },

    clearKeyframes: (id, prop) => {
      const clip = get().clips.find((c) => c.id === id);
      if (!clip || Object.keys(clip.keyframes).length === 0) return;
      record();
      lastEdit = { id: '', at: 0 };
      const now = transformAt(clip, Math.min(clipEnd(clip), Math.max(clip.start, get().playhead)));
      const props = prop ? [prop] : (Object.keys(clip.keyframes) as AnimProp[]);
      const transform: Partial<Transform> = {};
      const keyframes: Keyframes = {};
      for (const p of props) {
        transform[p] = now[p];
        keyframes[p] = [];
      }
      mapClip(id, (c) => applyPatch(c, { keyframes, transform }, get().media));
    },

    addZoomMotion: (id, direction) => {
      const clip = get().clips.find((c) => c.id === id);
      if (!clip) return;
      record();
      lastEdit = { id: '', at: 0 };
      const base = clip.transform.scale;
      const [from, to] = direction === 'in' ? [base, base * 1.25] : [base * 1.25, base];
      mapClip(id, (c) => applyPatch(c, { keyframes: { scale: [{ t: 0, v: from }, { t: c.duration, v: to }] } }, get().media));
    },

    detachAudio: (id) => {
      const clip = get().clips.find((c) => c.id === id);
      if (!clip || clip.kind !== 'video') return;
      record();
      lastEdit = { id: '', at: 0 };
      const trackId = freeTrack('audio', clip.start, clip.duration);
      const audio = newClip({
        trackId,
        kind: 'audio',
        mediaId: clip.mediaId,
        start: clip.start,
        duration: clip.duration,
        offset: clip.offset,
        speed: clip.speed,
        volume: clip.volume,
        fadeIn: clip.fadeIn,
        fadeOut: clip.fadeOut,
        denoise: clip.denoise,
      });
      set((s) => ({ clips: [...s.clips.map((c) => (c.id === id ? { ...c, volume: 0 } : c)), audio], selectedId: audio.id }));
    },

    setSubtitles: (lines, opts = {}) => {
      record();
      lastEdit = { id: '', at: 0 };
      let trackId = opts.replaceTrackId && get().tracks.some((t) => t.id === opts.replaceTrackId) ? opts.replaceTrackId : undefined;
      if (!trackId) {
        const n = get().tracks.filter((t) => t.subtitles).length;
        const track: Track = { id: uid('track'), kind: 'text', name: opts.name ?? (n ? `Subtitles ${n + 1}` : 'Subtitles'), muted: false, hidden: false, subtitles: true };
        trackId = track.id;
        // On top of everything, and the only subtitles showing.
        set((s) => ({ tracks: [track, ...s.tracks.map((t) => (t.subtitles ? { ...t, hidden: true } : t))] }));
      }
      const id = trackId;
      const style = { ...DEFAULT_TEXT_STYLE, ...SUBTITLE_STYLE, ...opts.style };
      const placed = lines
        .filter((l) => l.text.trim() !== '' && l.end > l.start)
        .sort((a, b) => a.start - b.start)
        .map((l, i, all) => {
          // Lines never overlap on one track: each ends where the next begins.
          const end = Math.max(l.start + MIN_CLIP_DURATION, Math.min(l.end, all[i + 1]?.start ?? l.end));
          return newClip({
            trackId: id,
            kind: 'text',
            start: l.start,
            duration: end - l.start,
            text: l.text.trim(),
            style: { ...style },
            words: l.words?.map((w) => ({ text: w.word, t: Math.max(0, w.start - l.start), e: Math.max(0, w.end - l.start) })),
          });
        });
      set((s) => ({ clips: [...s.clips.filter((c) => c.trackId !== id), ...placed], selectedId: null }));
      return id;
    },

    styleSubtitles: (style, trackId) => {
      const ids = new Set(get().tracks.filter((t) => t.subtitles && (!trackId || t.id === trackId)).map((t) => t.id));
      if (!get().clips.some((c) => ids.has(c.trackId))) return;
      record();
      lastEdit = { id: '', at: 0 };
      set((s) => ({ clips: s.clips.map((c) => (ids.has(c.trackId) && c.style ? { ...c, style: { ...c.style, ...style } } : c)) }));
    },

    removeRanges: (input) => {
      const ranges = mergeRanges(input);
      if (ranges.length === 0) return;
      record();
      lastEdit = { id: '', at: 0 };
      /** Timeline time after the cuts. */
      const moved = (t: number) => t - ranges.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, t) - a), 0);
      const next: Clip[] = [];
      for (const c of get().clips) {
        const end = clipEnd(c);
        keptPieces(c.start, end, ranges).forEach(([a, b], i) => {
          const shift = a - c.start;
          const length = b - a;
          next.push({
            ...c,
            id: i === 0 ? c.id : uid('clip'),
            start: moved(a),
            duration: length,
            offset: hasSource(c) ? c.offset + shift * c.speed : c.offset,
            fadeIn: a === c.start ? Math.min(c.fadeIn, length) : 0,
            fadeOut: b === end ? Math.min(c.fadeOut, length) : 0,
            transitionIn: a === c.start ? c.transitionIn : { ...NO_TRANSITION },
            transitionOut: b === end ? c.transitionOut : { ...NO_TRANSITION },
            keyframes: shift ? retimeKeyframes(c.keyframes, (t) => t - shift) : c.keyframes,
            words: (shift ? shiftWords(c.words, shift) : c.words)?.filter((w) => w.t < length),
            style: c.style && i > 0 ? { ...c.style, animation: 'none' } : c.style,
          });
        });
      }
      const { selectedId, playhead } = get();
      set({ clips: next, selectedId: next.some((c) => c.id === selectedId) ? selectedId : null, playhead: moved(playhead) });
    },

    replaceClipMedia: (id, mediaId, offset) => {
      if (!get().media.some((m) => m.id === mediaId)) return;
      record();
      lastEdit = { id: '', at: 0 };
      mapClip(id, (c) => ({ ...c, mediaId, offset: offset ?? c.offset }));
    },

    addTextSequence: (items, style) => {
      if (items.length === 0) return;
      record();
      lastEdit = { id: '', at: 0 };
      for (const item of items) {
        const trackId = freeTrack('text', item.start, item.duration);
        const clip = newClip({ trackId, kind: 'text', start: item.start, duration: item.duration, text: item.text, style: { ...DEFAULT_TEXT_STYLE, ...style } });
        set((s) => ({ clips: [...s.clips, clip] }));
      }
    },

    deleteSelected: () => {
      const { selectedId, clips } = get();
      if (!selectedId || !clips.some((c) => c.id === selectedId)) return;
      record();
      set((s) => ({ clips: s.clips.filter((c) => c.id !== selectedId), selectedId: null }));
    },

    rippleDeleteSelected: () => {
      const { selectedId, clips } = get();
      const gone = clips.find((c) => c.id === selectedId);
      if (!gone) return;
      record();
      set({
        selectedId: null,
        clips: clips
          .filter((c) => c.id !== gone.id)
          .map((c) => (c.trackId === gone.trackId && c.start >= clipEnd(gone) - 1e-6 ? { ...c, start: Math.max(0, c.start - gone.duration) } : c)),
      });
    },

    duplicateSelected: () => {
      const { selectedId, clips } = get();
      const original = clips.find((c) => c.id === selectedId);
      if (!original) return;
      record();
      const copy: Clip = { ...original, id: uid('clip'), start: clipEnd(original) };
      // Make room: later clips on the same track move right by the copy's length.
      set({
        selectedId: copy.id,
        clips: [
          ...clips.map((c) => (c.trackId === original.trackId && c.id !== original.id && c.start >= clipEnd(original) - 1e-6 ? { ...c, start: c.start + copy.duration } : c)),
          copy,
        ],
      });
    },

    closeGaps: () => {
      const { selectedId, clips, tracks } = get();
      const trackId = clips.find((c) => c.id === selectedId)?.trackId ?? tracks.find((t) => t.kind === 'video')?.id;
      if (!trackId) return;
      const onTrack = clips.filter((c) => c.trackId === trackId).sort((a, b) => a.start - b.start);
      let cursor = 0;
      const moved = new Map<string, number>();
      for (const c of onTrack) {
        moved.set(c.id, cursor);
        cursor += c.duration;
      }
      if (onTrack.every((c) => Math.abs(moved.get(c.id)! - c.start) < 1e-6)) return;
      record();
      set({ clips: clips.map((c) => (moved.has(c.id) ? { ...c, start: moved.get(c.id)! } : c)) });
    },

    addTrack: (kind) => {
      const n = get().tracks.filter((t) => t.kind === kind).length + 1;
      const track: Track = { id: uid('track'), kind, name: `${kind[0]!.toUpperCase()}${kind.slice(1)} ${n}`, muted: false, hidden: false };
      set((s) => {
        // Visual tracks go above existing ones of their kind (higher = drawn on top); audio goes to the bottom.
        if (kind === 'audio') return { tracks: [...s.tracks, track] };
        const at = s.tracks.findIndex((t) => t.kind === kind);
        const tracks = [...s.tracks];
        tracks.splice(at < 0 ? 0 : at, 0, track);
        return { tracks };
      });
      return track.id;
    },

    toggleTrack: (id, key) => set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, [key]: !t[key] } : t)) })),

    reset: () => {
      get().media.forEach((m) => URL.revokeObjectURL(m.url));
      forgetCustomFonts();
      forgetDecodedAudio();
      lastEdit = { id: '', at: 0 };
      set(initial());
    },
  };
});
