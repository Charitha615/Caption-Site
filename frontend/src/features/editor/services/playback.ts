import { useVideoStore } from '../../../stores/editor/videoStore';
import { clamp } from '../utils/time';

/**
 * Single owner of the <video> element.
 *
 * The video element is the source of truth for time while playing; a
 * requestAnimationFrame loop mirrors `video.currentTime` into the store so the
 * playhead moves smoothly (native `timeupdate` only fires ~4×/s). With no video
 * loaded, the same loop runs a simulated clock so captions can still be
 * previewed and timed.
 */

let video: HTMLVideoElement | null = null;
let rafId: number | null = null;
let lastTick = 0;
let detachListeners: (() => void) | null = null;

const store = () => useVideoStore.getState();

function tick(ts: number) {
  const s = store();
  if (video) {
    if (!video.paused) s._set({ currentTime: video.currentTime });
  } else if (s.isPlaying) {
    const next = s.currentTime + ((ts - lastTick) / 1000) * s.playbackRate;
    if (next >= s.duration) {
      s._set({ currentTime: s.duration, isPlaying: false });
      rafId = null;
      return;
    }
    s._set({ currentTime: next });
  }
  lastTick = ts;
  rafId = store().isPlaying ? requestAnimationFrame(tick) : null;
}

function startLoop() {
  if (rafId !== null) return;
  lastTick = performance.now();
  rafId = requestAnimationFrame(tick);
}

function stopLoop() {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
}

function bind(el: HTMLVideoElement) {
  const on = <K extends keyof HTMLMediaElementEventMap>(type: K, fn: () => void) => {
    el.addEventListener(type, fn);
    return () => el.removeEventListener(type, fn);
  };
  const offs = [
    on('play', () => {
      store()._set({ isPlaying: true });
      startLoop();
    }),
    on('pause', () => {
      store()._set({ isPlaying: false, currentTime: el.currentTime });
      stopLoop();
    }),
    on('ended', () => store()._set({ isPlaying: false, currentTime: el.currentTime })),
    on('seeked', () => store()._set({ currentTime: el.currentTime })),
    on('waiting', () => store()._set({ isBuffering: true })),
    on('playing', () => store()._set({ isBuffering: false })),
    on('canplay', () => store()._set({ isBuffering: false })),
    on('loadedmetadata', () => {
      const patch: Parameters<ReturnType<typeof store>['_set']>[0] = {
        videoWidth: el.videoWidth,
        videoHeight: el.videoHeight,
        mediaError: null,
      };
      if (Number.isFinite(el.duration) && el.duration > 0) patch.duration = el.duration;
      store()._set(patch);
      // Restore position after a source swap.
      const t = store().currentTime;
      if (t > 0 && t < el.duration) el.currentTime = t;
    }),
    on('error', () => {
      store()._set({ mediaError: 'This video could not be loaded. Check the file or your connection.', isPlaying: false, isBuffering: false });
    }),
  ];
  return () => offs.forEach((off) => off());
}

export const playback = {
  attach(el: HTMLVideoElement) {
    if (video === el) return;
    detachListeners?.();
    video = el;
    const s = store();
    el.volume = s.volume;
    el.muted = s.isMuted;
    el.playbackRate = s.playbackRate;
    detachListeners = bind(el);
  },

  detach(el: HTMLVideoElement) {
    if (video !== el) return;
    detachListeners?.();
    detachListeners = null;
    video = null;
    stopLoop();
    store()._set({ isPlaying: false, isBuffering: false });
  },

  getElement: () => video,

  play() {
    const s = store();
    if (video) {
      video.play().catch(() => store()._set({ isPlaying: false }));
      return;
    }
    if (s.currentTime >= s.duration - 0.05) s._set({ currentTime: 0 });
    s._set({ isPlaying: true });
    startLoop();
  },

  pause() {
    if (video) video.pause();
    else {
      store()._set({ isPlaying: false });
      stopLoop();
    }
  },

  toggle() {
    if (store().isPlaying) playback.pause();
    else playback.play();
  },

  seek(time: number) {
    const t = clamp(time, 0, store().duration);
    if (video) {
      // fastSeek is keyframe-only (imprecise); captions need exact frames.
      video.currentTime = t;
    }
    store()._set({ currentTime: t });
  },

  seekBy(delta: number) {
    playback.seek(store().currentTime + delta);
  },

  setVolume(volume: number) {
    const v = clamp(volume, 0, 1);
    if (video) {
      video.volume = v;
      video.muted = v === 0;
    }
    store()._set({ volume: v, isMuted: v === 0 });
  },

  setMuted(muted: boolean) {
    if (video) video.muted = muted;
    const patch: { isMuted: boolean; volume?: number } = { isMuted: muted };
    if (!muted && store().volume === 0) {
      patch.volume = 0.8;
      if (video) video.volume = 0.8;
    }
    store()._set(patch);
  },

  setRate(rate: number) {
    if (video) video.playbackRate = rate;
    store()._set({ playbackRate: rate });
  },

  setCaptionsVisible(captionsVisible: boolean) {
    store()._set({ captionsVisible });
  },

  setSource(url: string | null, name: string | null, isLocalPreview = false) {
    const prev = store().videoUrl;
    if (prev && prev.startsWith('blob:') && prev !== url) URL.revokeObjectURL(prev);
    store()._set({ videoUrl: url, sourceName: name, isLocalPreview, mediaError: null, isPlaying: false });
  },

  setFallbackDuration(duration: number) {
    if (!video || !Number.isFinite(video.duration)) store()._set({ duration: Math.max(1, duration) });
  },
};
