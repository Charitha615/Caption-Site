import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Film, Image as ImageIcon, Music, Palette, Sparkles, Trash2, Type, Volume2, VolumeX, X } from 'lucide-react';
import { ANIM_PROPS, clipEnd, formatTime, trackGaps, type Clip, type MediaItem, type Track, type TrackKind } from '../model';
import { totalDuration, useVideoEditorStore } from '../store';
import { useImportFiles } from '../useImportFiles';

export const MEDIA_DRAG_TYPE = 'application/x-video-editor-media';
const SNAP_PX = 8;
const TICK_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
/** Empty space kept after the last clip, so clips can be dragged further right. */
const TAIL_SECONDS = 20;

const TRACK_ICON = { text: Type, video: Film, audio: Music } as const;

/** Snaps a time to the nearest edge (0, playhead, other clips) within a few pixels. */
function snapTime(time: number, edges: number[], zoom: number): number {
  let best = time;
  let bestGap = SNAP_PX / zoom;
  for (const edge of edges) {
    const gap = Math.abs(edge - time);
    if (gap < bestGap) {
      best = edge;
      bestGap = gap;
    }
  }
  return best;
}

/** Canvases wider than this are drawn at a lower resolution and stretched. */
const MAX_WAVE_PX = 4096;

/** The part of the media's waveform this clip plays. */
function Waveform({ clip, media, width }: { clip: Clip; media: MediaItem; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { peaks, peaksPerSecond = 50 } = media;
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !peaks?.length) return;
    const w = Math.max(1, Math.min(MAX_WAVE_PX, Math.round(width)));
    const h = 40;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = getComputedStyle(canvas).color || '#a78bfa';
    const from = clip.offset * peaksPerSecond;
    const span = clip.duration * clip.speed * peaksPerSecond;
    for (let x = 0; x < w; x++) {
      // Loudest peak under this pixel column.
      const a = Math.floor(from + (x / w) * span);
      const b = Math.max(a + 1, Math.floor(from + ((x + 1) / w) * span));
      let peak = 0;
      for (let i = a; i < b && i < peaks.length; i++) peak = Math.max(peak, peaks[i]!);
      const bar = Math.max(1, peak * clip.volume * (h - 2));
      ctx.fillRect(x, (h - bar) / 2, 1, bar);
    }
  }, [peaks, peaksPerSecond, clip.offset, clip.duration, clip.speed, clip.volume, width]);
  if (!peaks?.length) return <span className="ve-clip-wave" aria-hidden="true" />;
  return <canvas ref={ref} className="ve-clip-waveform" aria-hidden="true" />;
}

/** Small diamonds where the clip has keyframes. */
function KeyMarks({ clip, zoom }: { clip: Clip; zoom: number }) {
  const times = new Set<number>();
  for (const prop of ANIM_PROPS) clip.keyframes[prop]?.forEach((k) => k.t >= 0 && k.t <= clip.duration && times.add(Math.round(k.t * 100) / 100));
  if (times.size === 0) return null;
  return (
    <>
      {[...times].map((t) => <span key={t} className="ve-keymark" style={{ left: t * zoom }} aria-hidden="true" />)}
    </>
  );
}

function ClipBody({ clip, media, zoom }: { clip: Clip; media?: MediaItem; zoom: number }) {
  const fades = (
    <>
      {clip.fadeIn > 0 && <span className="ve-clip-fade is-in" style={{ width: clip.fadeIn * zoom }} aria-hidden="true" />}
      {clip.fadeOut > 0 && <span className="ve-clip-fade is-out" style={{ width: clip.fadeOut * zoom }} aria-hidden="true" />}
    </>
  );
  if (clip.kind === 'text') {
    return <>{fades}<KeyMarks clip={clip} zoom={zoom} /><span className="ve-clip-label"><Type size={12} aria-hidden="true" /> {clip.text || 'Text'}</span></>;
  }
  if (clip.kind === 'color') {
    const bg = clip.fill?.to ? `linear-gradient(90deg, ${clip.fill.from}, ${clip.fill.to})` : clip.fill?.from;
    return <><span className="ve-clip-fill" style={{ background: bg }} aria-hidden="true" />{fades}<span className="ve-clip-label"><Palette size={12} aria-hidden="true" /> {clip.label ?? 'Background'}</span></>;
  }
  const Icon = clip.kind === 'audio' ? Music : clip.kind === 'image' ? ImageIcon : Film;
  return (
    <>
      {media?.thumb && clip.kind !== 'audio' && <span className="ve-clip-thumbs" style={{ backgroundImage: `url("${media.thumb}")` }} aria-hidden="true" />}
      {clip.kind === 'audio' && (media ? <Waveform clip={clip} media={media} width={clip.duration * zoom} /> : <span className="ve-clip-wave" aria-hidden="true" />)}
      {fades}
      <KeyMarks clip={clip} zoom={zoom} />
      <span className="ve-clip-label">
        <Icon size={12} aria-hidden="true" /> {media?.name ?? 'Missing media'}
        {clip.speed !== 1 && <span className="ve-clip-badge">{clip.speed}×</span>}
        {clip.filter.preset !== 'none' && <span className="ve-clip-badge"><Sparkles size={10} aria-hidden="true" /></span>}
        {clip.chroma.enabled && <span className="ve-clip-badge" title="Green screen">GS</span>}
        {clip.denoise && <span className="ve-clip-badge" title="Voice clean-up">NR</span>}
      </span>
    </>
  );
}

export function Timeline() {
  const tracks = useVideoEditorStore((s) => s.tracks);
  const clips = useVideoEditorStore((s) => s.clips);
  const media = useVideoEditorStore((s) => s.media);
  const zoom = useVideoEditorStore((s) => s.zoom);
  const playhead = useVideoEditorStore((s) => s.playhead);
  const playing = useVideoEditorStore((s) => s.playing);
  const selectedId = useVideoEditorStore((s) => s.selectedId);
  const snap = useVideoEditorStore((s) => s.snap);
  const {
    setPlayhead, select, commit, moveClip, trimClip, addMediaClip, addTrack, toggleTrack, toggleClipMute, removeTrack, moveClipToNewTrack, closeGap,
  } = useVideoEditorStore.getState();
  /** While a clip is dragged: whether it is over one of the "new track" areas. */
  const [newTrackHint, setNewTrackHint] = useState<'top' | 'bottom' | null>(null);
  const [draggingClip, setDraggingClip] = useState(false);
  const { importFiles } = useImportFiles();

  const scrollRef = useRef<HTMLDivElement>(null);
  const headsRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);

  const total = totalDuration(clips);
  const width = (total + TAIL_SECONDS) * zoom;
  const step = TICK_STEPS.find((s) => s * zoom >= 64) ?? 300;
  const ticks = Array.from({ length: Math.ceil((total + TAIL_SECONDS) / step) + 1 }, (_, i) => i * step);
  const byId = new Map(media.map((m) => [m.id, m]));

  const timeAt = (clientX: number) => {
    const left = lanesRef.current?.getBoundingClientRect().left ?? 0;
    return Math.max(0, (clientX - left) / zoom);
  };

  // Keep the playhead in view while playing.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !playing) return;
    const x = playhead * zoom;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 140) el.scrollLeft = Math.max(0, x - 140);
  }, [playhead, playing, zoom]);

  /** Runs `onMove` for every pointer move until the button is released, then `onUp`. */
  const drag = (onMove: (event: PointerEvent) => void, onUp?: (event: PointerEvent) => void) => {
    const up = (event: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      onUp?.(event);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const startScrub = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    select(null);
    setPlayhead(timeAt(event.clientX));
    drag((e) => setPlayhead(timeAt(e.clientX)));
  };

  const edgesExcept = (id: string) => (!snap ? [] : [0, playhead, ...clips.filter((c) => c.id !== id).flatMap((c) => [c.start, clipEnd(c)])]);

  const startMove = (event: React.PointerEvent, clip: Clip) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    select(clip.id);
    commit();
    const grabOffset = timeAt(event.clientX) - clip.start;
    const edges = edgesExcept(clip.id);
    let hint: 'top' | 'bottom' | null = null;
    setDraggingClip(true);
    drag((e) => {
      const raw = timeAt(e.clientX) - grabOffset;
      // Snap whichever edge (start or end) is closer to something.
      const byStart = snapTime(raw, edges, zoom);
      const byEnd = snapTime(raw + clip.duration, edges, zoom) - clip.duration;
      const gapStart = byStart === raw ? Infinity : Math.abs(byStart - raw);
      const gapEnd = byEnd === raw ? Infinity : Math.abs(byEnd - raw);
      const start = gapStart === Infinity && gapEnd === Infinity ? raw : gapStart <= gapEnd ? byStart : byEnd;
      const under = document.elementFromPoint(e.clientX, e.clientY);
      // Over the ruler or the empty area below the tracks: it will get a new track of its own.
      const zone = under?.closest<HTMLElement>('[data-new-track]')?.dataset.newTrack as 'top' | 'bottom' | undefined;
      hint = zone ?? null;
      setNewTrackHint(hint);
      moveClip(clip.id, start, zone ? undefined : under?.closest<HTMLElement>('[data-track-id]')?.dataset.trackId);
    }, (e) => {
      setDraggingClip(false);
      setNewTrackHint(null);
      if (hint && e.type === 'pointerup') moveClipToNewTrack(clip.id, hint);
    });
  };

  const startTrim = (event: React.PointerEvent, clip: Clip, edge: 'start' | 'end') => {
    if (event.button !== 0) return;
    event.stopPropagation();
    select(clip.id);
    commit();
    const edges = edgesExcept(clip.id);
    drag((e) => trimClip(clip.id, edge, snapTime(timeAt(e.clientX), edges, zoom)));
  };

  const onDrop = (event: React.DragEvent, track: Track) => {
    const start = timeAt(event.clientX);
    const mediaId = event.dataTransfer.getData(MEDIA_DRAG_TYPE);
    if (mediaId) {
      event.preventDefault();
      addMediaClip(mediaId, { trackId: track.id, start });
      return;
    }
    if (event.dataTransfer.files.length === 0) return;
    // Files from the computer: import them and place them here, one after another. (The page sees
    // the drop is handled and only hides its overlay.)
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    void importFiles(files).then((ids) => {
      let at = start;
      for (const id of ids) {
        useVideoEditorStore.getState().addMediaClip(id, { trackId: track.id, start: at });
        const added = useVideoEditorStore.getState().clips.at(-1);
        if (added?.mediaId === id) at = clipEnd(added);
      }
    });
  };

  return (
    <div className="ve-timeline">
      <div ref={headsRef} className="ve-track-heads">
        <div className="ve-ruler-spacer">
          <select
            className="ve-add-track"
            value=""
            aria-label="Add a track"
            title="Add a track (layer)"
            onChange={(e) => {
              if (!e.target.value) return;
              commit();
              addTrack(e.target.value as TrackKind, 'top');
            }}
          >
            <option value="">+ Track</option>
            <option value="video">Video track</option>
            <option value="audio">Audio track</option>
            <option value="text">Text track</option>
          </select>
        </div>
        {tracks.map((track) => {
          const Icon = TRACK_ICON[track.kind];
          return (
            <div key={track.id} className={`ve-track-head is-${track.kind}`}>
              <Icon size={14} aria-hidden="true" />
              <span className="ve-track-name">{track.name}</span>
              {track.kind !== 'text' ? (
                <button type="button" className="ve-icon-btn" aria-pressed={track.muted} aria-label={`${track.muted ? 'Unmute' : 'Mute'} ${track.name}`} onClick={() => toggleTrack(track.id, 'muted')}>
                  {track.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              ) : null}
              {track.kind !== 'audio' && (
                <button type="button" className="ve-icon-btn" aria-pressed={track.hidden} aria-label={`${track.hidden ? 'Show' : 'Hide'} ${track.name}`} onClick={() => toggleTrack(track.id, 'hidden')}>
                  {track.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              )}
              {!clips.some((c) => c.trackId === track.id) && tracks.filter((t) => t.kind === track.kind).length > 1 && (
                <button type="button" className="ve-icon-btn" aria-label={`Remove empty track ${track.name}`} title="Remove this empty track" onClick={() => removeTrack(track.id)}>
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}
        <div className="ve-track-head is-new" aria-hidden="true" />
      </div>

      <div
        ref={scrollRef}
        className="ve-timeline-scroll"
        onScroll={(e) => {
          if (headsRef.current) headsRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
      >
        <div ref={lanesRef} className="ve-lanes" style={{ width }}>
          <div className={`ve-ruler ${newTrackHint === 'top' ? 'is-new-target' : ''}`} onPointerDown={startScrub} data-new-track={draggingClip ? 'top' : undefined}>
            {newTrackHint === 'top' && <span className="ve-new-track-label">Drop for a new track on top</span>}
            {ticks.map((t) => (
              <span key={t} className="ve-tick" style={{ left: t * zoom }}>{formatTime(t, step < 1)}</span>
            ))}
          </div>

          {tracks.map((track) => (
            <div
              key={track.id}
              data-track-id={track.id}
              className={`ve-lane is-${track.kind}`}
              onPointerDown={startScrub}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(MEDIA_DRAG_TYPE) || e.dataTransfer.types.includes('Files')) e.preventDefault();
              }}
              onDrop={(e) => onDrop(e, track)}
            >
              {trackGaps(clips, track.id).map(([from, to]) => (
                <div key={`gap-${from}`} className="ve-gap" style={{ left: from * zoom, width: (to - from) * zoom }}>
                  {(to - from) * zoom >= 26 && (
                    <button
                      type="button"
                      className="ve-gap-btn"
                      aria-label={`Remove the ${(to - from).toFixed(1)} second gap on ${track.name}`}
                      title="Remove this gap"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeGap(track.id, from, to);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
              {clips.filter((c) => c.trackId === track.id).map((clip) => (
                <div
                  key={clip.id}
                  className={`ve-clip is-${clip.kind} ${clip.id === selectedId ? 'is-selected' : ''} ${clip.muted ? 'is-muted' : ''}`}
                  style={{ left: clip.start * zoom, width: Math.max(4, clip.duration * zoom) }}
                  onPointerDown={(e) => startMove(e, clip)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={clip.id === selectedId}
                  aria-label={`${clip.kind} clip ${clip.kind === 'text' ? clip.text : byId.get(clip.mediaId ?? '')?.name ?? ''}, ${formatTime(clip.start)} to ${formatTime(clipEnd(clip))}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      select(clip.id);
                    }
                  }}
                >
                  <ClipBody clip={clip} media={clip.mediaId ? byId.get(clip.mediaId) : undefined} zoom={zoom} />
                  {(clip.kind === 'video' || clip.kind === 'audio') && clip.duration * zoom >= 48 && (
                    <button
                      type="button"
                      className={`ve-clip-mute ${clip.muted ? 'is-muted' : ''}`}
                      aria-pressed={!!clip.muted}
                      aria-label={`${clip.muted ? 'Unmute' : 'Mute'} ${clip.kind === 'video' ? 'video' : 'audio'} clip ${byId.get(clip.mediaId ?? '')?.name ?? ''}`}
                      title={clip.muted ? 'Unmute this clip' : 'Mute this clip'}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleClipMute(clip.id);
                      }}
                    >
                      {clip.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                    </button>
                  )}
                  <span className="ve-trim is-start" onPointerDown={(e) => startTrim(e, clip, 'start')} aria-hidden="true" />
                  <span className="ve-trim is-end" onPointerDown={(e) => startTrim(e, clip, 'end')} aria-hidden="true" />
                </div>
              ))}
            </div>
          ))}

          <div
            className={`ve-lane-new ${draggingClip ? 'is-dragging' : ''} ${newTrackHint === 'bottom' ? 'is-new-target' : ''}`}
            data-new-track="bottom"
            onPointerDown={startScrub}
          >
            {draggingClip && <span className="ve-new-track-label">Drop here for a new track</span>}
          </div>

          <div className="ve-playhead" style={{ left: playhead * zoom }} aria-hidden="true">
            <span className="ve-playhead-knob" />
          </div>
        </div>
      </div>
    </div>
  );
}
