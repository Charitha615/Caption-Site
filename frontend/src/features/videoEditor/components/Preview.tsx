import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { previewAudioContext, voiceChain } from '../audio';
import { setRate } from '../exporter';
import { ASPECTS, clipEnd, fadeLevel, sourceTime, type Clip, type MediaItem } from '../model';
import { drawFrame } from '../render';
import { previewLookup, previewVideos } from '../sources';
import { useVideoEditorStore } from '../store';

/** Clips that start this soon get their element ready ahead of time, so cuts don't flash. */
const PRELOAD_SECONDS = 2;

/** Keeps a <video>/<audio> element in step with the timeline (time, speed, volume with fades). */
function useSyncedMedia(ref: React.RefObject<HTMLMediaElement | null>, clip: Clip, muted: boolean) {
  const playhead = useVideoEditorStore((s) => s.playhead);
  const playing = useVideoEditorStore((s) => s.playing);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const active = playhead >= clip.start && playhead < clipEnd(clip);
    const target = active ? sourceTime(clip, playhead) : clip.offset;
    setRate(el, clip.speed);
    el.volume = Math.min(1, clip.volume * fadeLevel(clip, playhead));
    el.muted = muted || !active;
    if (playing && active) {
      // Let the element play on its own; only correct it when it drifts.
      if (Math.abs(el.currentTime - target) > 0.3 * Math.max(1, clip.speed)) el.currentTime = target;
      if (clip.denoise) void previewAudioContext()?.resume().catch(() => undefined);
      if (el.paused) void el.play().catch(() => undefined);
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - target) > 0.02) el.currentTime = target;
    }
  }, [ref, clip, playhead, playing, muted]);
}

/**
 * Sends the element's sound through the voice clean-up chain. An element can be routed only once,
 * so the elements are keyed by the clean-up setting and re-created when it changes.
 */
function useVoiceCleanup(ref: React.RefObject<HTMLMediaElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    const el = ref.current;
    const ctx = enabled ? previewAudioContext() : null;
    if (!el || !ctx) return;
    let source: MediaElementAudioSourceNode;
    try {
      source = ctx.createMediaElementSource(el);
    } catch {
      return;
    }
    const chain = voiceChain(ctx);
    source.connect(chain.input);
    chain.output.connect(ctx.destination);
    return () => {
      source.disconnect();
      chain.output.disconnect();
    };
  }, [ref, enabled]);
}

function VideoSource({ clip, media, muted }: { clip: Clip; media: MediaItem; muted: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useSyncedMedia(ref, clip, muted);
  useVoiceCleanup(ref, clip.denoise);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    previewVideos.set(clip.id, el);
    return () => {
      if (previewVideos.get(clip.id) === el) previewVideos.delete(clip.id);
    };
  }, [clip.id]);
  return <video ref={ref} src={media.url} playsInline preload="auto" />;
}

function AudioSource({ clip, media, muted }: { clip: Clip; media: MediaItem; muted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useSyncedMedia(ref, clip, muted);
  useVoiceCleanup(ref, clip.denoise);
  return <audio ref={ref} src={media.url} preload="auto" />;
}

export function Preview() {
  const aspect = useVideoEditorStore((s) => s.aspect);
  const tracks = useVideoEditorStore((s) => s.tracks);
  const clips = useVideoEditorStore((s) => s.clips);
  const media = useVideoEditorStore((s) => s.media);
  const playhead = useVideoEditorStore((s) => s.playhead);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const ratio = ASPECTS.find((a) => a.value === aspect)?.ratio ?? 16 / 9;
  const width = Math.floor(Math.min(box.width, box.height * ratio));
  const height = Math.floor(width / ratio);

  // Redraw every frame: videos keep decoding while playing, and seeks land a moment after the playhead moves.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    const draw = () => {
      const s = useVideoEditorStore.getState();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(width * dpr));
      const h = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const urls = new Map(s.media.map((m) => [m.id, m.url]));
      drawFrame(ctx, w, h, s.playhead, s, previewLookup(urls));
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  const byId = new Map(media.map((m) => [m.id, m]));
  const mutedTrack = new Map(tracks.map((t) => [t.id, t.muted]));
  // Elements for clips under the playhead or starting soon.
  const sources = clips.filter((c) => (c.kind === 'video' || c.kind === 'audio') && clipEnd(c) > playhead && c.start < playhead + PRELOAD_SECONDS);

  return (
    <div ref={boxRef} className="ve-preview-box">
      <canvas ref={canvasRef} className="ve-stage" style={{ width, height }} aria-label="Video preview" role="img" />
      {clips.length === 0 && (
        <div className="ve-stage-empty" style={{ width: width || undefined, height: height || undefined }}>
          <strong>Your video shows here</strong>
          <span>Import media on the left and add it to the timeline.</span>
        </div>
      )}
      <div className="ve-sources" aria-hidden="true">
        {sources.map((clip) => {
          const item = clip.mediaId ? byId.get(clip.mediaId) : undefined;
          if (!item) return null;
          const muted = (mutedTrack.get(clip.trackId) ?? false) || !!clip.muted;
          return clip.kind === 'video'
            ? <VideoSource key={`${clip.id}-${clip.denoise}`} clip={clip} media={item} muted={muted} />
            : <AudioSource key={`${clip.id}-${clip.denoise}`} clip={clip} media={item} muted={muted} />;
        })}
      </div>
    </div>
  );
}
