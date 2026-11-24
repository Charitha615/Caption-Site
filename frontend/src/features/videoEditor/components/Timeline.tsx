import { useEffect, useRef } from 'react';
import { Eye, EyeOff, Film, Image as ImageIcon, Music, Palette, Plus, Sparkles, Type, Volume2, VolumeX } from 'lucide-react';
import { clipEnd, formatTime, type Clip, type MediaItem, type Track } from '../model';
import { totalDuration, useVideoEditorStore } from '../store';

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

function ClipBody({ clip, media, zoom }: { clip: Clip; media?: MediaItem; zoom: number }) {
  const fades = (
    <>
      {clip.fadeIn > 0 && <span className="ve-clip-fade is-in" style={{ width: clip.fadeIn * zoom }} aria-hidden="true" />}
      {clip.fadeOut > 0 && <span className="ve-clip-fade is-out" style={{ width: clip.fadeOut * zoom }} aria-hidden="true" />}
    </>
  );
  if (clip.kind === 'text') {
    return <>{fades}<span className="ve-clip-label"><Type size={12} aria-hidden="true" /> {clip.text || 'Text'}</span></>;
  }
  if (clip.kind === 'color') {
    const bg = clip.fill?.to ? `linear-gradient(90deg, ${clip.fill.from}, ${clip.fill.to})` : clip.fill?.from;
    return <><span className="ve-clip-fill" style={{ background: bg }} aria-hidden="true" />{fades}<span className="ve-clip-label"><Palette size={12} aria-hidden="true" /> {clip.label ?? 'Background'}</span></>;
  }
  const Icon = clip.kind === 'audio' ? Music : clip.kind === 'image' ? ImageIcon : Film;
  return (
    <>
      {media?.thumb && <span className="ve-clip-thumbs" style={{ backgroundImage: `url("${media.thumb}")` }} aria-hidden="true" />}
      {clip.kind === 'audio' && <span className="ve-clip-wave" aria-hidden="true" />}
      {fades}
      <span className="ve-clip-label">
        <Icon size={12} aria-hidden="true" /> {media?.name ?? 'Missing media'}
        {clip.speed !== 1 && <span className="ve-clip-badge">{clip.speed}×</span>}
        {clip.filter.preset !== 'none' && <span className="ve-clip-badge"><Sparkles size={10} aria-hidden="true" /></span>}
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
  const { setPlayhead, select, commit, moveClip, trimClip, addMediaClip, addTrack, toggleTrack } = useVideoEditorStore.getState();

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

  /** Runs `onMove` for every pointer move until the button is released. */
  const drag = (onMove: (event: PointerEvent) => void) => {
    const up = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
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
    drag((e) => {
      const raw = timeAt(e.clientX) - grabOffset;
      // Snap whichever edge (start or end) is closer to something.
      const byStart = snapTime(raw, edges, zoom);
      const byEnd = snapTime(raw + clip.duration, edges, zoom) - clip.duration;
      const gapStart = byStart === raw ? Infinity : Math.abs(byStart - raw);
      const gapEnd = byEnd === raw ? Infinity : Math.abs(byEnd - raw);
      const start = gapStart === Infinity && gapEnd === Infinity ? raw : gapStart <= gapEnd ? byStart : byEnd;
      const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-track-id]');
      moveClip(clip.id, start, row?.dataset.trackId);
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
    const mediaId = event.dataTransfer.getData(MEDIA_DRAG_TYPE);
    if (!mediaId) return;
    event.preventDefault();
    addMediaClip(mediaId, { trackId: track.id, start: timeAt(event.clientX) });
  };

  return (
    <div className="ve-timeline">
      <div ref={headsRef} className="ve-track-heads">
        <div className="ve-ruler-spacer">
          <button type="button" className="ve-icon-btn" onClick={() => { commit(); addTrack('video'); }} title="Add a video track" aria-label="Add a video track"><Plus size={14} /></button>
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
            </div>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        className="ve-timeline-scroll"
        onScroll={(e) => {
          if (headsRef.current) headsRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
      >
        <div ref={lanesRef} className="ve-lanes" style={{ width }}>
          <div className="ve-ruler" onPointerDown={startScrub}>
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
                if (e.dataTransfer.types.includes(MEDIA_DRAG_TYPE)) e.preventDefault();
              }}
              onDrop={(e) => onDrop(e, track)}
            >
              {clips.filter((c) => c.trackId === track.id).map((clip) => (
                <div
                  key={clip.id}
                  className={`ve-clip is-${clip.kind} ${clip.id === selectedId ? 'is-selected' : ''}`}
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
                  <span className="ve-trim is-start" onPointerDown={(e) => startTrim(e, clip, 'start')} aria-hidden="true" />
                  <span className="ve-trim is-end" onPointerDown={(e) => startTrim(e, clip, 'end')} aria-hidden="true" />
                </div>
              ))}
            </div>
          ))}

          <div className="ve-playhead" style={{ left: playhead * zoom }} aria-hidden="true">
            <span className="ve-playhead-knob" />
          </div>
        </div>
      </div>
    </div>
  );
}
