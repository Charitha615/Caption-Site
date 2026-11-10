import React, { memo, useMemo, useRef } from 'react';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useEditorStore } from '../../../../stores/editor/editorStore';
import { useActiveCaptionId } from '../../../../stores/editor/selectors';
import { useTimelineStore } from '../../../../stores/editor/timelineStore';
import { useVideoStore } from '../../../../stores/editor/videoStore';
import { neighbourBounds } from '../../model/captionOps';
import { MIN_CAPTION_DURATION, type CaptionSegment } from '../../model/types';
import { selectAndSeek } from '../../services/commands';
import { playback } from '../../services/playback';
import { TEXT_INPUT_ID } from '../../shortcuts';
import { snapTo } from './timelineMath';

type Edge = 'move' | 'start' | 'end';

interface DragState {
  id: string;
  edge: Edge;
  pointerId: number;
  startX: number;
  origStart: number;
  origEnd: number;
  min: number;
  max: number;
  candidates: number[];
  moved: boolean;
  wasSelected: boolean;
}

const DRAG_THRESHOLD_PX = 3;
const SNAP_PX = 8;
const OVERSCAN_PX = 400;
const LABELS: Record<Edge, string> = { move: 'Move caption', start: 'Trim caption start', end: 'Trim caption end' };

const CaptionBlock = memo(function CaptionBlock({
  caption,
  index,
  zoom,
  selected,
  active,
  dragging,
}: {
  caption: CaptionSegment;
  index: number;
  zoom: number;
  selected: boolean;
  active: boolean;
  dragging: boolean;
}) {
  const left = caption.start * zoom;
  const width = Math.max(6, (caption.end - caption.start) * zoom);
  const narrow = width < 48;
  return (
    <div
      data-cap-id={caption.id}
      className={`tl-block ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''} ${dragging ? 'is-dragging' : ''} ${narrow ? 'is-narrow' : ''} ${caption.styleOverride ? 'has-override' : ''}`}
      style={{ transform: `translate3d(${left}px,0,0)`, width }}
      lang={caption.language === 'en' ? 'en' : 'si'}
      aria-label={`Caption ${index + 1}: ${caption.text}`}
      aria-selected={selected}
      role="option"
    >
      <div className="tl-handle tl-handle-start" data-edge="start" title="Drag to change start" />
      {!narrow && (
        <div className="tl-block-body">
          <span className="tl-block-idx">{index + 1}</span>
          <span className="tl-block-text">{caption.text || <em>Empty caption</em>}</span>
        </div>
      )}
      <div className="tl-handle tl-handle-end" data-edge="end" title="Drag to change end" />
    </div>
  );
});

export const CaptionTrack = memo(function CaptionTrack({
  zoom,
  viewLeft,
  viewWidth,
  interactive = true,
}: {
  zoom: number;
  viewLeft: number;
  viewWidth: number;
  interactive?: boolean;
}) {
  const captions = useCaptionStore((s) => s.captions);
  const selectedId = useEditorStore((s) => s.selectedCaptionId);
  const draggingId = useTimelineStore((s) => s.draggingId);
  const activeId = useActiveCaptionId();
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);

  // Virtualisation: only blocks intersecting the visible window (+overscan) are mounted.
  const visible = useMemo(() => {
    const from = (viewLeft - OVERSCAN_PX) / zoom;
    const to = (viewLeft + viewWidth + OVERSCAN_PX) / zoom;
    const out: Array<{ caption: CaptionSegment; index: number }> = [];
    captions.forEach((caption, index) => {
      if (caption.end >= from && caption.start <= to) out.push({ caption, index });
    });
    return out;
  }, [captions, viewLeft, viewWidth, zoom]);

  const timeAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left) / zoom);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const blockEl = target.closest<HTMLElement>('[data-cap-id]');
    if (!blockEl) {
      playback.seek(timeAt(e.clientX));
      return;
    }
    const id = blockEl.dataset.capId!;
    const edge = (target.closest<HTMLElement>('[data-edge]')?.dataset.edge as Edge | undefined) ?? 'move';
    const { captions: all } = useCaptionStore.getState();
    const caption = all.find((c) => c.id === id);
    if (!caption) return;

    const wasSelected = useEditorStore.getState().selectedCaptionId === id;
    useEditorStore.getState().select(id);
    // Touch: first tap selects; dragging requires the block to be selected already (keeps scrolling usable).
    if (!interactive || (e.pointerType === 'touch' && !wasSelected)) {
      drag.current = null;
      if (e.pointerType === 'touch') selectAndSeek(id);
      return;
    }

    const duration = useVideoStore.getState().duration;
    const bounds = useTimelineStore.getState().preventOverlap
      ? neighbourBounds(all, id, duration)
      : { min: 0, max: duration };
    const candidates = [0, duration, useVideoStore.getState().currentTime];
    for (const c of all) if (c.id !== id) candidates.push(c.start, c.end);

    drag.current = {
      id,
      edge,
      pointerId: e.pointerId,
      startX: e.clientX,
      origStart: caption.start,
      origEnd: caption.end,
      min: bounds.min,
      max: bounds.max,
      candidates,
      moved: false,
      wasSelected,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    if (!d.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      d.moved = true;
      useCaptionStore.getState().beginTransaction(LABELS[d.edge]);
      useTimelineStore.getState().setDraggingId(d.id);
    }
    const dt = dx / zoom;
    const snapping = useTimelineStore.getState().snapping && !e.altKey;
    const threshold = SNAP_PX / zoom;
    let start = d.origStart;
    let end = d.origEnd;
    let guide: number | null = null;

    if (d.edge === 'move') {
      const length = d.origEnd - d.origStart;
      start = Math.min(Math.max(d.origStart + dt, d.min), d.max - length);
      if (snapping) {
        const s = snapTo(start, d.candidates, threshold);
        const en = snapTo(start + length, d.candidates, threshold);
        const ds = s.guide === null ? Infinity : Math.abs(s.value - start);
        const de = en.guide === null ? Infinity : Math.abs(en.value - (start + length));
        if (ds <= de && s.guide !== null) {
          start = s.value;
          guide = s.guide;
        } else if (en.guide !== null) {
          start = en.value - length;
          guide = en.guide;
        }
        start = Math.min(Math.max(start, d.min), d.max - length);
      }
      end = start + length;
    } else if (d.edge === 'start') {
      start = Math.min(Math.max(d.origStart + dt, d.min), d.origEnd - MIN_CAPTION_DURATION);
      if (snapping) {
        const s = snapTo(start, d.candidates, threshold);
        if (s.guide !== null && s.value >= d.min && s.value <= d.origEnd - MIN_CAPTION_DURATION) {
          start = s.value;
          guide = s.guide;
        }
      }
    } else {
      end = Math.max(Math.min(d.origEnd + dt, d.max), d.origStart + MIN_CAPTION_DURATION);
      if (snapping) {
        const s = snapTo(end, d.candidates, threshold);
        if (s.guide !== null && s.value <= d.max && s.value >= d.origStart + MIN_CAPTION_DURATION) {
          end = s.value;
          guide = s.guide;
        }
      }
    }

    useTimelineStore.getState().setSnapGuide(guide);
    useCaptionStore.getState().setTiming(d.id, start, end, LABELS[d.edge]);
  };

  const finish = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    if (d.moved) {
      if (cancelled) useCaptionStore.getState().cancelTransaction();
      else useCaptionStore.getState().endTransaction();
      useTimelineStore.getState().setDraggingId(null);
      useTimelineStore.getState().setSnapGuide(null);
    } else if (!cancelled && d.edge === 'move') {
      // Plain click: seek to the caption (clicking an already-selected caption keeps the playhead if inside it).
      const t = useVideoStore.getState().currentTime;
      if (!d.wasSelected || t < d.origStart || t >= d.origEnd) selectAndSeek(d.id);
    }
  };

  return (
    <div
      className="tl-track tl-track-captions"
      ref={trackRef}
      role="listbox"
      aria-label="Caption track"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
      onDoubleClick={(e) => {
        const blockEl = (e.target as HTMLElement).closest<HTMLElement>('[data-cap-id]');
        if (blockEl) {
          document.getElementById(TEXT_INPUT_ID)?.focus();
        } else if (interactive) {
          useCaptionStore.getState().addCaption(timeAt(e.clientX));
        }
      }}
    >
      {visible.map(({ caption, index }) => (
        <CaptionBlock
          key={caption.id}
          caption={caption}
          index={index}
          zoom={zoom}
          selected={caption.id === selectedId}
          active={caption.id === activeId}
          dragging={caption.id === draggingId}
        />
      ))}
      {captions.length === 0 && (
        <div className="tl-track-empty" style={{ left: viewLeft + 16 }}>
          No captions yet — double-click the track or press <kbd className="ed-kbd">A</kbd> to add one.
        </div>
      )}
    </div>
  );
});
