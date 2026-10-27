import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  Plus,
  Scissors,
  ZoomIn,
  ZoomOut,
  Magnet,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { formatDuration } from '../../utils/formatters';
import './EditorTimeline.css';

export const EditorTimeline: React.FC = () => {
  const {
    currentTime,
    duration,
    isPlaying,
    setIsPlaying,
    setCurrentTime,
    captions,
    selectedCaptionId,
    activeCaptionIndex,
    setSelectedCaptionId,
    setActiveCaptionIndex,
    updateCaptionTiming,
    addCaptionSegment,
    splitCaptionAtCurrentTime,
    selectPrevCaption,
    selectNextCaption,
    zoomLevel,
    setZoomLevel,
    isSnappingEnabled,
    setIsSnappingEnabled,
  } = useEditorStore();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);

  // Dragging state
  const [isScrubbingPlayhead, setIsScrubbingPlayhead] = useState(false);
  const [draggingCaptionId, setDraggingCaptionId] = useState<string | null>(null);

  // Pixels per second (zoomLevel: 20px/s to 200px/s)
  const pxPerSec = zoomLevel;
  const totalWidth = Math.max(1400, (duration + 5) * pxPerSec);

  // Draw Audio Waveform on Canvas
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = totalWidth;
    canvas.height = 36;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#10B981'; // Green audio wave color

    const barWidth = 3;
    const gap = 2;
    const step = barWidth + gap;
    const barsCount = Math.floor(totalWidth / step);
    const midY = canvas.height / 2;

    for (let i = 0; i < barsCount; i++) {
      const x = i * step;
      const noise =
        Math.sin(i * 0.14) * 0.4 +
        Math.sin(i * 0.38) * 0.35 +
        Math.cos(i * 0.75) * 0.2;
      const magnitude = Math.max(3, Math.abs(noise) * (canvas.height * 0.8));
      ctx.fillRect(x, midY - magnitude / 2, barWidth, magnitude);
    }
  }, [totalWidth]);

  // Snapping helper: checks snapping to nearby caption edges or playhead
  const applySnapping = useCallback(
    (targetTime: number, excludeId?: string): number => {
      if (!isSnappingEnabled) return targetTime;
      const snapThresholdSec = 10 / pxPerSec; // 10 pixels threshold

      // Snap to playhead
      if (Math.abs(targetTime - currentTime) < snapThresholdSec) {
        return currentTime;
      }

      // Snap to nearby caption starts or ends
      for (const cap of captions) {
        if (cap.id === excludeId) continue;
        if (Math.abs(targetTime - cap.start) < snapThresholdSec) {
          return cap.start;
        }
        if (Math.abs(targetTime - cap.end) < snapThresholdSec) {
          return cap.end;
        }
      }

      return targetTime;
    },
    [captions, currentTime, isSnappingEnabled, pxPerSec]
  );

  // Playhead scrubber drag
  const handleScrubStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsScrubbingPlayhead(true);

    const updateTimeFromMouse = (moveEvent: MouseEvent) => {
      if (!scrollContainerRef.current) return;
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const x = moveEvent.clientX - rect.left + scrollLeft;
      const newTime = Math.max(0, Math.min(duration, x / pxPerSec));
      setCurrentTime(newTime);
    };

    updateTimeFromMouse(e.nativeEvent);

    const onMouseMove = (moveEvent: MouseEvent) => {
      updateTimeFromMouse(moveEvent);
    };

    const onMouseUp = () => {
      setIsScrubbingPlayhead(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Drag Whole Caption Block (Shift Timing)
  const handleCaptionDragStart = (
    e: React.MouseEvent,
    capId: string,
    initialStart: number,
    initialEnd: number
  ) => {
    e.stopPropagation();
    setSelectedCaptionId(capId);
    setDraggingCaptionId(capId);

    const startX = e.clientX;
    const blockDuration = initialEnd - initialStart;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaPx = moveEvent.clientX - startX;
      let newStart = initialStart + deltaPx / pxPerSec;
      newStart = Math.max(0, Math.min(duration - blockDuration, newStart));

      // Snapping
      newStart = applySnapping(newStart, capId);
      const newEnd = newStart + blockDuration;

      updateCaptionTiming(capId, newStart, newEnd);
    };

    const onMouseUp = () => {
      setDraggingCaptionId(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Dragging Resize Handles
  const handleResizeStart = (
    e: React.MouseEvent,
    id: string,
    edge: 'left' | 'right',
    currentStart: number,
    currentEnd: number
  ) => {
    e.stopPropagation();
    setSelectedCaptionId(id);
    const startMouseX = e.clientX;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaPx = moveEvent.clientX - startMouseX;
      const deltaSec = deltaPx / pxPerSec;

      if (edge === 'left') {
        let newStart = Math.max(0, Math.min(currentEnd - 0.2, currentStart + deltaSec));
        newStart = applySnapping(newStart, id);
        updateCaptionTiming(id, newStart, currentEnd);
      } else {
        let newEnd = Math.max(currentStart + 0.2, currentEnd + deltaSec);
        newEnd = applySnapping(newEnd, id);
        updateCaptionTiming(id, currentStart, newEnd);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Generate ruler tick marks
  const rulerTicks = [];
  const maxSeconds = Math.ceil(duration) + 5;
  for (let sec = 0; sec <= maxSeconds; sec++) {
    rulerTicks.push(
      <div
        key={sec}
        className="ruler-tick-mark"
        style={{ left: `${sec * pxPerSec}px` }}
      >
        <span className="ruler-second-text">{sec}s</span>
        <div className="ruler-second-line" />
      </div>
    );
  }

  const playheadX = currentTime * pxPerSec;

  return (
    <div className="editor-timeline-panel">
      {/* Timeline Controls & Navigation Header */}
      <div className="timeline-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Play/Pause */}
          <button
            type="button"
            className="timeline-tool-btn"
            onClick={() => setIsPlaying(!isPlaying)}
            title="Play / Pause (Space)"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>

          {/* Prev/Next Caption Navigation */}
          <button
            type="button"
            className="timeline-tool-btn"
            onClick={selectPrevCaption}
            title="Previous Caption"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            className="timeline-tool-btn"
            onClick={selectNextCaption}
            title="Next Caption"
          >
            <ChevronRight size={15} />
          </button>

          {/* Split Caption */}
          <button
            type="button"
            className="timeline-tool-btn"
            onClick={() => splitCaptionAtCurrentTime()}
            title="Split Caption at Playhead (S)"
          >
            <Scissors size={14} />
          </button>

          {/* Add Caption */}
          <button
            type="button"
            className="timeline-tool-btn"
            onClick={() => addCaptionSegment(currentTime)}
            title="Add Caption at Playhead (A)"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Center Hint */}
        <div className="timeline-hint-text">
          <span>DRAG CAPTION TO SHIFT TIMING • DRAG EDGES TO RESIZE</span>
        </div>

        {/* Right Tools: Snapping, Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className={`timeline-tool-btn ${isSnappingEnabled ? 'timeline-tool-btn-active' : ''}`}
            onClick={() => setIsSnappingEnabled(!isSnappingEnabled)}
            title={isSnappingEnabled ? 'Snapping Enabled (Auto-align)' : 'Snapping Disabled'}
          >
            <Magnet size={14} />
            <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Snap</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="timeline-tool-btn"
              onClick={() => setZoomLevel(zoomLevel - 15)}
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <input
              type="range"
              min="25"
              max="150"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="timeline-zoom-slider"
              title={`Zoom: ${zoomLevel}px/s`}
            />
            <button
              type="button"
              className="timeline-tool-btn"
              onClick={() => setZoomLevel(zoomLevel + 15)}
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Track Grid Area */}
      <div className="timeline-tracks-wrapper">
        {/* Track Headers */}
        <div className="timeline-track-headers">
          <div className="track-header-item" style={{ height: '24px' }}>
            RULER
          </div>
          <div className="track-header-item">VIDEO</div>
          <div className="track-header-item">AUDIO</div>
          <div className="track-header-item">CAPTIONS</div>
        </div>

        {/* Scrollable Canvas Tracks Container */}
        <div className="timeline-scroll-container" ref={scrollContainerRef}>
          <div className="tracks-content-area" style={{ width: `${totalWidth}px` }}>
            {/* Playhead Scrubber Line */}
            <div
              className={`timeline-playhead-line ${isScrubbingPlayhead ? 'playhead-active' : ''}`}
              style={{ left: `${playheadX}px` }}
              onMouseDown={handleScrubStart}
            >
              <div className="playhead-head-knob" />
            </div>

            {/* Time Ruler (Click or scrub to seek) */}
            <div className="time-ruler-bar" onMouseDown={handleScrubStart}>
              {rulerTicks}
            </div>

            {/* Track 1: Video File Track */}
            <div className="track-video-row">
              <div
                className="track-video-block"
                style={{
                  left: '0px',
                  width: `${duration * pxPerSec}px`,
                }}
              >
                <span>Video Track ({formatDuration(duration)})</span>
              </div>
            </div>

            {/* Track 2: Audio Waveform Track */}
            <div className="track-audio-row">
              <canvas ref={waveformCanvasRef} className="audio-waveform-canvas" />
            </div>

            {/* Track 3: Captions Blocks Track */}
            <div className="track-captions-row">
              {captions.map((cap, idx) => {
                const isSelected = cap.id === selectedCaptionId;
                const isActive = idx === activeCaptionIndex;
                const isDragging = draggingCaptionId === cap.id;

                const left = cap.start * pxPerSec;
                const width = Math.max(34, (cap.end - cap.start) * pxPerSec);

                return (
                  <div
                    key={cap.id}
                    className={`timeline-caption-block ${isSelected ? 'timeline-caption-selected' : ''} ${isActive ? 'timeline-caption-active' : ''} ${isDragging ? 'timeline-caption-dragging' : ''}`}
                    style={{
                      left: `${left}px`,
                      width: `${width}px`,
                    }}
                    onMouseDown={(e) => handleCaptionDragStart(e, cap.id, cap.start, cap.end)}
                    onClick={() => {
                      setSelectedCaptionId(cap.id);
                      setActiveCaptionIndex(idx);
                      setCurrentTime(cap.start);
                    }}
                    title={`${cap.text} (${formatDuration(cap.start)} - ${formatDuration(cap.end)})`}
                  >
                    {/* Left Resize Handle */}
                    <div
                      className="caption-resize-handle caption-resize-handle-left"
                      onMouseDown={(e) => handleResizeStart(e, cap.id, 'left', cap.start, cap.end)}
                      title="Drag to resize start time"
                    />

                    {/* Content preview */}
                    <div className="caption-block-text">
                      <span className="caption-block-seq">#{idx + 1}</span>
                      <span>{cap.text}</span>
                    </div>

                    {/* Right Resize Handle */}
                    <div
                      className="caption-resize-handle caption-resize-handle-right"
                      onMouseDown={(e) => handleResizeStart(e, cap.id, 'right', cap.start, cap.end)}
                      title="Drag to resize end time"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
