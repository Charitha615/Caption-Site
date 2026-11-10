import { create } from 'zustand';

/**
 * Video/playback state. `currentTime` changes ~60×/s while playing, so only
 * subscribe to it from components that truly need it (playhead, clock,
 * timed caption animations) — prefer the derived selectors in ./selectors.
 *
 * Mutations go through `playback` (features/editor/services/playback.ts),
 * which owns the <video> element. Components should not call these setters.
 */
interface VideoState {
  videoUrl: string | null;
  sourceName: string | null;
  isLocalPreview: boolean;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isBuffering: boolean;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  captionsVisible: boolean;
  videoWidth: number;
  videoHeight: number;
  mediaError: string | null;

  _set: (patch: Partial<Omit<VideoState, '_set' | 'reset'>>) => void;
  reset: () => void;
}

const initial = {
  videoUrl: null,
  sourceName: null,
  isLocalPreview: false,
  currentTime: 0,
  duration: 30,
  isPlaying: false,
  isBuffering: false,
  volume: 1,
  isMuted: false,
  playbackRate: 1,
  captionsVisible: true,
  videoWidth: 0,
  videoHeight: 0,
  mediaError: null,
};

export const useVideoStore = create<VideoState>()((set) => ({
  ...initial,
  _set: (patch) => set(patch),
  reset: () => set(initial),
}));
