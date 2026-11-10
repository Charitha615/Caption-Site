import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Combine,
  Copy,
  Crosshair,
  Magnet,
  Maximize,
  Pause,
  Play,
  Plus,
  Scissors,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useEditorStore } from '../../../../stores/editor/editorStore';
import { getTargetCaptionId } from '../../../../stores/editor/selectors';
import { MAX_ZOOM, MIN_ZOOM, useTimelineStore } from '../../../../stores/editor/timelineStore';
import { useVideoStore } from '../../../../stores/editor/videoStore';
import { selectRelative } from '../../services/commands';
import { playback } from '../../services/playback';
import { tip } from '../../shortcuts';
import { formatRulerLabel } from '../../utils/time';
import { IconButton } from '../controls';
import { TimeReadout } from '../player/PlayerControls';
import { CaptionTrack } from './CaptionTrack';
import { pickTickInterval } from './timelineMath';

const END_PADDING_PX = 160;

/* ------------------------------------------------------------------ ruler */

const Ruler = memo(function Ruler({
  zoom,
  duration,
  viewLeft,
  viewWidth,
  width,
}: {
  zoom: number;
  duration: number;
  viewLeft: number;
  viewWidth: number;
  width: number;
}) {
  const { major, minor } = pickTickInterval(zoom);
  const first = Math.max(0, Math.floor(viewLeft / zoom / major) * major);
  const last = Math.min(duration + major, (viewLeft + viewWidth) / zoom + major);
  const labels: number[] = [];
  for (let t = first; t <= last; t += major) labels.push(Math.round(t * 1000) / 1000);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const wasPlaying = useVideoStore.getState().isPlaying;
    if (wasPlaying) playback.pause();
    const seek = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      playback.seek((clientX - rect.left) / zoom);
    };
    seek(e.clientX);
    const move = (ev: PointerEvent) => seek(ev.clientX);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (wasPlaying) playback.play();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  return (
    <div
      className="tl-ruler"
      style={{ width, ['--minor' as string]: `${minor * zoom}px`, ['--end' as string]: `${duration * zoom}px` }}
      onPointerDown={onPointerDown}
      title="Click or drag to seek"
    >
      {labels.map((t) => (
        <div key={t} className="tl-tick" style={{ transform: `translateX(${t * zoom}px)` }}>
          <span>{formatRulerLabel(t, major)}</span>
        </div>
      ))}
    </div>
  );
});

/* --------------------------------------------------------------- playhead */

/** Positioned imperatively from a store subscription — never re-renders while playing. */
function Playhead({ zoom, scrollerRef }: { zoom: number; scrollerRef: React.RefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);

  useEffect(() => {
    const place = (t: number, isPlaying: boolean, seeked: boolean) => {
      const x = t * zoomRef.current;
      if (ref.current) ref.current.style.transform = `translate3d(${x}px,0,0)`;
      const sc = scrollerRef.current;
      if (!sc || !useTimelineStore.getState().followPlayhead || useTimelineStore.getState().draggingId) return;
      const left = sc.scrollLeft;
      const width = sc.clientWidth;
      if (isPlaying && x > left + width - 48) sc.scrollLeft = x - 48; // page-turn while playing
      else if (seeked && (x < left || x > left + width)) sc.scrollLeft = Math.max(0, x - width * 0.3);
    };
    const s = useVideoStore.getState();
    place(s.currentTime, false, false);
    return useVideoStore.subscribe((st, prev) => {
      if (st.currentTime === prev.currentTime) return;
      place(st.currentTime, st.isPlaying, !st.isPlaying);
    });
  }, [scrollerRef]);

  useLayoutEffect(() => {
    zoomRef.current = zoom;
    if (ref.current) ref.current.style.transform = `translate3d(${useVideoStore.getState().currentTime * zoom}px,0,0)`;
  }, [zoom]);

  return (
    <div className="tl-playhead" ref={ref} aria-hidden>
      <div className="tl-playhead-knob" />
    </div>
  );
}

function SnapGuide({ zoom }: { zoom: number }) {
  const guide = useTimelineStore((s) => s.snapGuide);
  if (guide === null) return null;
  return <div className="tl-snap-guide" style={{ transform: `translateX(${guide * zoom}px)` }} />;
}

/* ---------------------------------------------------------------- toolbar */

const zoomToSlider = (z: number) => Math.log(z / MIN_ZOOM) / Math.log(MAX_ZOOM / MIN_ZOOM);
const sliderToZoom = (v: number) => MIN_ZOOM * Math.pow(MAX_ZOOM / MIN_ZOOM, v);

const TimelineToolbar = memo(function TimelineToolbar({ onFit, compact }: { onFit: () => void; compact: boolean }) {
  const isPlaying = useVideoStore((s) => s.isPlaying);
  const zoom = useTimelineStore((s) => s.zoom);
  const snapping = useTimelineStore((s) => s.snapping);
  const follow = useTimelineStore((s) => s.followPlayhead);
  const hasSelection = useEditorStore((s) => s.selectedCaptionId !== null);
  const hasCaptions = useCaptionStore((s) => s.captions.length > 0);

  const run = (fn: (id: string) => void) => () => {
    const id = getTargetCaptionId();
    if (id) fn(id);
  };
  const store = useCaptionStore.getState;

  return (
    <div className="tl-toolbar">
      <div className="tl-toolbar-group">
        <IconButton tip={tip(isPlaying ? 'Pause' : 'Play', 'playPause')} onClick={() => playback.toggle()} tipSide="top">
          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
        </IconButton>
        {!compact && (
          <>
            <IconButton tip={tip('Previous caption', 'prevCaption')} tipSide="top" onClick={() => selectRelative(-1)}>
              <ChevronLeft size={16} />
            </IconButton>
            <IconButton tip={tip('Next caption', 'nextCaption')} tipSide="top" onClick={() => selectRelative(1)}>
              <ChevronRight size={16} />
            </IconButton>
            <TimeReadout className="tl-clock" />
          </>
        )}
        <span className="tl-divider" />
        <IconButton tip={tip('Add caption at playhead', 'add')} tipSide="top" onClick={() => store().addCaption(useVideoStore.getState().currentTime)}>
          <Plus size={16} />
        </IconButton>
        <IconButton tip={tip('Split at playhead', 'split')} tipSide="top" disabled={!hasCaptions} onClick={run((id) => store().splitAt(id, useVideoStore.getState().currentTime))}>
          <Scissors size={15} />
        </IconButton>
        {!compact && (
          <>
            <IconButton tip={tip('Merge with next', 'merge')} tipSide="top" disabled={!hasCaptions} onClick={run((id) => store().mergeWithNext(id))}>
              <Combine size={15} />
            </IconButton>
            <IconButton tip={tip('Duplicate', 'duplicate')} tipSide="top" disabled={!hasCaptions} onClick={run((id) => store().duplicate(id))}>
              <Copy size={15} />
            </IconButton>
          </>
        )}
        <IconButton tip={tip('Delete selected', 'delete')} tipSide="top" disabled={!hasSelection} onClick={run((id) => store().deleteCaption(id))} className="is-danger">
          <Trash2 size={15} />
        </IconButton>
      </div>

      <div className="tl-toolbar-group">
        {!compact && (
          <>
            <IconButton
              tip={snapping ? 'Snapping on (hold Alt to bypass)' : 'Snapping off'}
              tipSide="top"
              active={snapping}
              onClick={() => useTimelineStore.getState().setSnapping(!snapping)}
            >
              <Magnet size={15} />
            </IconButton>
            <IconButton
              tip={follow ? 'Follow playhead: on' : 'Follow playhead: off'}
              tipSide="top"
              active={follow}
              onClick={() => useTimelineStore.getState().setFollowPlayhead(!follow)}
            >
              <Crosshair size={15} />
            </IconButton>
            <span className="tl-divider" />
          </>
        )}
        <IconButton tip={tip('Zoom out', 'zoomOut')} tipSide="top" onClick={() => useTimelineStore.getState().zoomBy(0.8)}>
          <ZoomOut size={15} />
        </IconButton>
        {!compact && (
          <input
            type="range"
            className="tl-zoom"
            min={0}
            max={1}
            step={0.001}
            value={zoomToSlider(zoom)}
            onChange={(e) => useTimelineStore.getState().setZoom(sliderToZoom(Number(e.target.value)))}
            aria-label="Timeline zoom"
            style={{ ['--pct' as string]: `${zoomToSlider(zoom) * 100}%` }}
          />
        )}
        <IconButton tip={tip('Zoom in', 'zoomIn')} tipSide="top" onClick={() => useTimelineStore.getState().zoomBy(1.25)}>
          <ZoomIn size={15} />
        </IconButton>
        <IconButton tip="Fit whole video" tipSide="top" onClick={onFit}>
          <Maximize size={14} />
        </IconButton>
      </div>
    </div>
  );
});

/* --------------------------------------------------------------- timeline */

export const Timeline = memo(function Timeline({ compact = false }: { compact?: boolean }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const zoom = useTimelineStore((s) => s.zoom);
  const duration = useVideoStore((s) => s.duration);
  const sourceName = useVideoStore((s) => s.sourceName);
  const [view, setView] = useState({ left: 0, width: 1000 });
  const anchor = useRef<{ time: number; offset: number } | null>(null);
  const prevZoom = useRef(zoom);

  const contentWidth = Math.max(duration * zoom + END_PADDING_PX, view.width);

  // Track the visible window for virtualisation (rAF-throttled).
  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      setView((v) => (v.left === sc.scrollLeft && v.width === sc.clientWidth ? v : { left: sc.scrollLeft, width: sc.clientWidth }));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    sc.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(sc);
    return () => {
      sc.removeEventListener('scroll', onScroll);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Ctrl/⌘ + wheel (or trackpad pinch) zooms around the cursor; plain vertical wheel scrolls horizontally.
  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = sc.getBoundingClientRect();
        const offset = e.clientX - rect.left;
        const z = useTimelineStore.getState().zoom;
        anchor.current = { time: (sc.scrollLeft + offset) / z, offset };
        useTimelineStore.getState().zoomBy(Math.exp(-e.deltaY * 0.01));
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        sc.scrollLeft += e.deltaY;
      }
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    return () => sc.removeEventListener('wheel', onWheel);
  }, []);

  // Keep the zoom anchor (cursor, else playhead) fixed on screen when zoom changes.
  useLayoutEffect(() => {
    const sc = scrollerRef.current;
    if (!sc || prevZoom.current === zoom) return;
    const a = anchor.current ?? (() => {
      const t = useVideoStore.getState().currentTime;
      const offset = t * prevZoom.current - sc.scrollLeft;
      return offset >= 0 && offset <= sc.clientWidth ? { time: t, offset } : { time: sc.scrollLeft / prevZoom.current, offset: 0 };
    })();
    sc.scrollLeft = Math.max(0, a.time * zoom - a.offset);
    anchor.current = null;
    prevZoom.current = zoom;
  }, [zoom]);

  const fit = useCallback(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    anchor.current = { time: 0, offset: 0 };
    useTimelineStore.getState().setZoom((sc.clientWidth - 24) / Math.max(1, useVideoStore.getState().duration));
  }, []);

  return (
    <section className={`tl ${compact ? 'is-compact' : ''}`} aria-label="Timeline">
      <TimelineToolbar onFit={fit} compact={compact} />
      <div className="tl-body">
        {!compact && (
          <div className="tl-heads" aria-hidden>
            <div className="tl-head tl-head-ruler" />
            <div className="tl-head">Video</div>
            <div className="tl-head tl-head-captions">Captions</div>
          </div>
        )}
        <div className="tl-scroller" ref={scrollerRef}>
          <div className="tl-content" style={{ width: contentWidth }}>
            <Ruler zoom={zoom} duration={duration} viewLeft={view.left} viewWidth={view.width} width={contentWidth} />
            {!compact && (
              <div className="tl-track tl-track-video">
                <div className="tl-video-bar" style={{ width: duration * zoom }}>
                  <span>{sourceName || 'No video'}</span>
                </div>
              </div>
            )}
            <CaptionTrack zoom={zoom} viewLeft={view.left} viewWidth={view.width} />
            <div className="tl-out-of-range" style={{ left: duration * zoom }} />
            <SnapGuide zoom={zoom} />
            <Playhead zoom={zoom} scrollerRef={scrollerRef} />
          </div>
        </div>
      </div>
    </section>
  );
});
