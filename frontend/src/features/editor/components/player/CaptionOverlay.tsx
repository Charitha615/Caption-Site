import React, { memo, useRef, useState } from 'react';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useEditorStore } from '../../../../stores/editor/editorStore';
import { useActiveCaptionId, useCaption, useResolvedStyle } from '../../../../stores/editor/selectors';
import { useVideoStore } from '../../../../stores/editor/videoStore';
import { captionAnchorStyle } from '../../utils/captionStyle';
import { clamp } from '../../utils/time';
import { CaptionBox } from './CaptionBox';

const SNAP_PCT = 1.5;

/**
 * Caption layer on top of the video. Re-renders only when the active caption,
 * the selection or styles change — not on every frame.
 *
 * When paused between captions, the selected caption is shown as a dimmed
 * "ghost" so it can be styled and positioned without seeking.
 * Drag the caption to reposition it (snaps to the frame's centre lines).
 */
export const CaptionOverlay = memo(function CaptionOverlay({ scale }: { scale: number }) {
  const activeId = useActiveCaptionId();
  const selectedId = useEditorStore((s) => s.selectedCaptionId);
  const isPlaying = useVideoStore((s) => s.isPlaying);
  const visible = useVideoStore((s) => s.captionsVisible);

  const shownId = activeId ?? (isPlaying ? null : selectedId);
  const caption = useCaption(shownId);
  const style = useResolvedStyle(caption);
  const layerRef = useRef<HTMLDivElement>(null);
  const [guides, setGuides] = useState<{ x: boolean; y: boolean } | null>(null);

  if (!visible || !caption) return <div className="cap-overlay" ref={layerRef} />;

  const isGhost = !activeId;
  const isSelected = caption.id === selectedId;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    useEditorStore.getState().select(caption.id);
    const layer = layerRef.current?.getBoundingClientRect();
    if (!layer) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const origin = { x: style.positionX, y: style.positionY };
    const target = useEditorStore.getState().styleScope === 'caption' ? caption.id : null;
    const store = useCaptionStore.getState();
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - startX) / layer.width) * 100;
      const dy = ((ev.clientY - startY) / layer.height) * 100;
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 3) return;
      if (!moved) {
        moved = true;
        store.beginTransaction('Move caption position');
      }
      let x = clamp(origin.x + dx, 0, 100);
      let y = clamp(origin.y + dy, 0, 100);
      const snapX = !ev.altKey && Math.abs(x - 50) < SNAP_PCT;
      const snapY = !ev.altKey && Math.abs(y - 50) < SNAP_PCT;
      if (snapX) x = 50;
      if (snapY) y = 50;
      setGuides({ x: snapX, y: snapY });
      useCaptionStore.getState().updateStyle({ positionX: Math.round(x * 10) / 10, positionY: Math.round(y * 10) / 10 }, target);
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      setGuides(null);
      if (moved) useCaptionStore.getState().endTransaction();
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  };

  return (
    <div className="cap-overlay" ref={layerRef}>
      {guides?.x && <div className="cap-guide cap-guide-v" />}
      {guides?.y && <div className="cap-guide cap-guide-h" />}
      <div
        className={`cap-anchor ${isGhost ? 'is-ghost' : ''} ${isSelected ? 'is-selected' : ''}`}
        style={captionAnchorStyle(style)}
        onPointerDown={onPointerDown}
        title="Drag to reposition · click to select"
      >
        {/* key restarts the entrance animation for each new caption */}
        <CaptionBox key={caption.id} caption={caption} style={style} scale={scale} animate={!isGhost} />
      </div>
    </div>
  );
});
