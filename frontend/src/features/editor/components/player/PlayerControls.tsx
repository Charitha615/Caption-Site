import React, { memo, useEffect, useRef, useState } from 'react';
import {
  ChevronFirst,
  ChevronLast,
  Gauge,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Subtitles,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useVideoStore } from '../../../../stores/editor/videoStore';
import { playback } from '../../services/playback';
import { selectRelative } from '../../services/commands';
import { tip } from '../../shortcuts';
import { formatTimecode } from '../../utils/time';
import { IconButton } from '../controls';

const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

/** Clock text updated straight from the store subscription — zero React renders while playing. */
export function TimeReadout({ className = '' }: { className?: string }) {
  const currentRef = useRef<HTMLSpanElement>(null);
  const duration = useVideoStore((s) => s.duration);
  useEffect(() => {
    const write = (t: number) => {
      if (currentRef.current) currentRef.current.textContent = formatTimecode(t, 2);
    };
    write(useVideoStore.getState().currentTime);
    return useVideoStore.subscribe((s, p) => {
      if (s.currentTime !== p.currentTime) write(s.currentTime);
    });
  }, []);
  return (
    <span className={`ed-clock ${className}`}>
      <span ref={currentRef} className="ed-clock-now">00:00.00</span>
      <span className="ed-clock-sep">/</span>
      <span>{formatTimecode(duration, 2)}</span>
    </span>
  );
}

/** Thin scrubbable progress bar; position written imperatively. */
function SeekBar() {
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const write = () => {
      const { currentTime, duration } = useVideoStore.getState();
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${duration ? currentTime / duration : 0})`;
    };
    write();
    return useVideoStore.subscribe(write);
  }, []);

  const seekFromEvent = (clientX: number) => {
    const rect = barRef.current!.getBoundingClientRect();
    playback.seek(((clientX - rect.left) / rect.width) * useVideoStore.getState().duration);
  };

  return (
    <div
      className="ed-seekbar"
      ref={barRef}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={-1}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        seekFromEvent(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromEvent(e.clientX);
      }}
    >
      <div className="ed-seekbar-fill" ref={fillRef} />
    </div>
  );
}

export const PlayerControls = memo(function PlayerControls({
  fullscreenTarget,
  compact = false,
}: {
  fullscreenTarget: React.RefObject<HTMLElement | null>;
  compact?: boolean;
}) {
  const isPlaying = useVideoStore((s) => s.isPlaying);
  const volume = useVideoStore((s) => s.volume);
  const isMuted = useVideoStore((s) => s.isMuted);
  const rate = useVideoStore((s) => s.playbackRate);
  const captionsVisible = useVideoStore((s) => s.captionsVisible);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === fullscreenTarget.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [fullscreenTarget]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void fullscreenTarget.current?.requestFullscreen?.();
  };

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="ed-player-controls">
      <SeekBar />
      <div className="ed-player-row">
        <div className="ed-player-group">
          <IconButton tip={tip('Previous caption', 'prevCaption')} tipSide="top" onClick={() => selectRelative(-1)}>
            <ChevronFirst size={17} />
          </IconButton>
          <button
            type="button"
            className="ed-play-btn"
            onClick={() => playback.toggle()}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            data-tip={tip(isPlaying ? 'Pause' : 'Play', 'playPause')}
            data-tip-side="top"
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <IconButton tip={tip('Next caption', 'nextCaption')} tipSide="top" onClick={() => selectRelative(1)}>
            <ChevronLast size={17} />
          </IconButton>
          <TimeReadout />
        </div>

        <div className="ed-player-group">
          {!compact && (
            <div className="ed-volume">
              <IconButton tip={isMuted ? 'Unmute' : 'Mute'} tipSide="top" onClick={() => playback.setMuted(!isMuted)}>
                <VolumeIcon size={17} />
              </IconButton>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => playback.setVolume(Number(e.target.value))}
                aria-label="Volume"
                style={{ ['--pct' as string]: `${(isMuted ? 0 : volume) * 100}%` }}
              />
            </div>
          )}
          <div className="ed-popover-anchor">
            <button
              type="button"
              className="ed-chip-btn"
              onClick={() => setRateOpen(!rateOpen)}
              aria-haspopup="menu"
              aria-expanded={rateOpen}
              data-tip="Playback speed"
              data-tip-side="top"
            >
              <Gauge size={14} />
              {rate}×
            </button>
            {rateOpen && (
              <>
                <div className="ed-popover-scrim" onClick={() => setRateOpen(false)} />
                <div className="ed-popover ed-popover-up" role="menu">
                  {RATES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="menuitemradio"
                      aria-checked={r === rate}
                      className={r === rate ? 'is-active' : ''}
                      onClick={() => {
                        playback.setRate(r);
                        setRateOpen(false);
                      }}
                    >
                      {r}×{r === 1 && <span className="ed-muted"> normal</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <IconButton
            tip={tip(captionsVisible ? 'Hide captions' : 'Show captions', 'toggleCaptions')}
            tipSide="top"
            active={captionsVisible}
            onClick={() => playback.setCaptionsVisible(!captionsVisible)}
          >
            <Subtitles size={17} />
          </IconButton>
          <IconButton tip={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} tipSide="top" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </IconButton>
        </div>
      </div>
    </div>
  );
});
