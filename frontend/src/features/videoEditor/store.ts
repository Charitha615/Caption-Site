import { create } from 'zustand';
import {
  DEFAULT_FILTER, DEFAULT_TEXT_STYLE, DEFAULT_TRANSFORM, IMAGE_DEFAULT_DURATION, MIN_CLIP_DURATION, TEXT_DEFAULT_DURATION,
  clipEnd, hasSource, sourceLimit, trackKindFor, uid,
  type AspectRatio, type Clip, type Fill, type FilterSettings, type MediaItem, type TextStyle, type Track, type TrackKind, type Transform,
} from './model';

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
}

export interface VideoEditorState extends Snapshot {
  name: string;
  aspect: AspectRatio;
  media: MediaItem[];
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
  addMediaClip: (mediaId: string, at?: { trackId?: string; start?: number }) => void;
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
  ...fields,
});

const initial = () => ({
  name: 'Untitled video',
  aspect: '16:9' as AspectRatio,
  media: [] as MediaItem[],
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
  };
  if (patch.speed !== undefined && patch.speed !== clip.speed && hasSource(clip)) {
    const span = clip.duration * clip.speed;
    next.duration = Math.max(MIN_CLIP_DURATION, Math.min(span / patch.speed, sourceLimit(next, media.find((m) => m.id === clip.mediaId))));
  }
  // Fades can't be longer than the clip.
  next.fadeIn = Math.min(next.fadeIn, next.duration);
  next.fadeOut = Math.min(next.fadeOut, next.duration - next.fadeIn);
  return next;
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
      const track = tracks.find((t) => t.id === at?.trackId && t.kind === kind) ?? tracks.find((t) => t.kind === kind);
      if (!track) return;
      const start = at?.start ?? totalDuration(clips.filter((c) => c.trackId === track.id));
      const clip = newClip({
        trackId: track.id,
        kind: item.kind,
        mediaId,
        start: Math.max(0, start),
        duration: item.kind === 'image' ? IMAGE_DEFAULT_DURATION : item.duration,
      });
      record();
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
        // The fade out moves to the right part, the fade in stays on the left.
        const left: Clip = { ...c, duration: first, fadeOut: 0, fadeIn: Math.min(c.fadeIn, first) };
        const right: Clip = {
          ...c,
          id: uid('clip'),
          start: playhead,
          duration: c.duration - first,
          offset: hasSource(c) ? c.offset + first * c.speed : 0,
          fadeIn: 0,
          fadeOut: Math.min(c.fadeOut, c.duration - first),
          // Text that types or pops in shouldn't replay on the second half.
          style: c.style ? { ...c.style, animation: 'none' } : undefined,
        };
        next.push(left, right);
        if (c.id === selectedId) newSelected = right.id;
      }
      set({ clips: next, selectedId: newSelected });
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
      lastEdit = { id: '', at: 0 };
      set(initial());
    },
  };
});
