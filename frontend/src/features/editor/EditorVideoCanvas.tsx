import React, { useRef, useEffect, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Subtitles,
  Gauge,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { Dropdown } from '../../components/Dropdown/Dropdown';
import { formatDuration } from '../../utils/formatters';
import './EditorVideoCanvas.css';

export const EditorVideoCanvas: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    aspectRatio,
    currentTime,
    duration,
    isPlaying,
    volume,
    isMuted,
    playbackRate,
    isCaptionVisible,
    videoUrl,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setVolume,
    setIsMuted,
    setPlaybackRate,
    setIsCaptionVisible,
    captions,
    selectedCaptionId,
    setSelectedCaptionId,
    activeCaptionIndex,
    style,
  } = useEditorStore();

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync play / pause
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch(() => setIsPlaying(false));
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, setIsPlaying]);

  // Sync seek when currentTime changed from timeline or external scrub
  useEffect(() => {
    if (!videoRef.current) return;
    if (Math.abs(videoRef.current.currentTime - currentTime) > 0.25) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // Sync volume & mute
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = isMuted ? 0 : volume;
    videoRef.current.muted = isMuted;
  }, [volume, isMuted]);

  // Sync playback speed
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 15.0);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const currentSegment = captions.find(
    (c) => currentTime >= c.start && currentTime <= c.end
  ) || captions[activeCaptionIndex];

  const isSegmentActive =
    currentSegment && currentTime >= currentSegment.start && currentTime <= currentSegment.end;

  const speedOptions = [
    { key: '0.5', label: '0.5x Slow', onClick: () => setPlaybackRate(0.5) },
    { key: '0.75', label: '0.75x', onClick: () => setPlaybackRate(0.75) },
    { key: '1.0', label: '1.0x Normal', onClick: () => setPlaybackRate(1.0) },
    { key: '1.25', label: '1.25x', onClick: () => setPlaybackRate(1.25) },
    { key: '1.5', label: '1.5x Fast', onClick: () => setPlaybackRate(1.5) },
    { key: '2.0', label: '2.0x Double', onClick: () => setPlaybackRate(2.0) },
  ];

  // Aspect ratio classes
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case '9:16':
        return 'aspect-vertical';
      case '1:1':
        return 'aspect-square';
      case '16:9':
      default:
        return 'aspect-landscape';
    }
  };

  // Build active styling for on-canvas subtitle box
  const getSubtitleContainerStyle = (): React.CSSProperties => {
    // Override styling if current segment has custom styleOverride
    const activeStyle = currentSegment?.styleOverride
      ? { ...style, ...currentSegment.styleOverride }
      : style;

    // Background color with opacity
    let bg = activeStyle.backgroundColor;
    if (bg && bg.startsWith('#')) {
      const hex = bg.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      bg = `rgba(${r}, ${g}, ${b}, ${activeStyle.backgroundOpacity / 100})`;
    }

    return {
      fontFamily: activeStyle.fontFamily,
      fontSize: `${activeStyle.fontSize}px`,
      fontWeight: activeStyle.fontWeight,
      color: activeStyle.textColor,
      backgroundColor: bg,
      padding: `${activeStyle.padding}px ${activeStyle.padding * 1.5}px`,
      borderRadius: `${activeStyle.borderRadius}px`,
      WebkitTextStroke: activeStyle.outlineWidth > 0 ? `${activeStyle.outlineWidth}px ${activeStyle.outlineColor}` : 'none',
      textShadow: activeStyle.shadowBlur > 0 ? `${activeStyle.shadowOffsetX}px ${activeStyle.shadowOffsetY}px ${activeStyle.shadowBlur}px ${activeStyle.shadowColor}` : 'none',
      textAlign: activeStyle.textAlign,
      transform: `translate(${activeStyle.positionX * 2}px, ${activeStyle.positionY * 2}px) scale(${activeStyle.scale / 28})`,
      cursor: 'pointer',
    };
  };

  return (
    <div className="editor-video-canvas-stage" ref={containerRef}>
      {/* Video Viewport Frame */}
      <div className={`video-viewport-wrapper ${getAspectRatioClass()}`}>
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="video-element"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            playsInline
          />
        ) : (
          <div className="video-empty-placeholder">
            <div className="video-empty-pattern" />
            <div style={{ zIndex: 2, textAlign: 'center' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#E2E8F0', marginBottom: '4px' }}>
                Video Preview Ready
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                Upload or select a video from the Media tab
              </div>
            </div>
          </div>
        )}

        {/* Subtitle Rendering Layer */}
        {isCaptionVisible && currentSegment && (
          <div
            className={`canvas-caption-overlay position-${style.alignMatrix}`}
            style={{ opacity: isSegmentActive ? 1 : 0.35 }}
            onClick={() => setSelectedCaptionId(currentSegment.id)}
            title="Click to select caption"
          >
            <div
              className={`caption-rendered-box ${selectedCaptionId === currentSegment.id ? 'caption-box-selected' : ''}`}
              style={getSubtitleContainerStyle()}
            >
              {/* Word-level karaoke animation if available */}
              {style.animation === 'karaoke' && currentSegment.words && currentSegment.words.length > 0 ? (
                currentSegment.words.map((w, wIdx) => {
                  const isWordActive = currentTime >= w.start && currentTime <= w.end;
                  return (
                    <span
                      key={wIdx}
                      style={{
                        color: isWordActive ? style.highlightColor : style.textColor,
                        display: 'inline-block',
                        marginRight: '6px',
                        transform: isWordActive ? 'scale(1.08)' : 'scale(1)',
                        transition: 'color 0.1s ease, transform 0.1s ease',
                      }}
                    >
                      {w.text}
                    </span>
                  );
                })
              ) : (
                <span>{currentSegment.text}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modern Player Controls Bar */}
      <div className="canvas-playback-bar">
        {/* Left: Play/Pause, Jogs, Time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="playback-btn playback-btn-primary"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause size={17} /> : <Play size={17} />}
          </button>

          <button
            type="button"
            className="playback-btn playback-btn-subtle"
            onClick={() => {
              if (videoRef.current) {
                const target = Math.max(0, currentTime - 1.0);
                videoRef.current.currentTime = target;
                setCurrentTime(target);
              }
            }}
            title="Back 1 second (←)"
          >
            <SkipBack size={15} />
          </button>

          <button
            type="button"
            className="playback-btn playback-btn-subtle"
            onClick={() => {
              if (videoRef.current) {
                const target = Math.min(duration, currentTime + 1.0);
                videoRef.current.currentTime = target;
                setCurrentTime(target);
              }
            }}
            title="Forward 1 second (→)"
          >
            <SkipForward size={15} />
          </button>

          <div className="playback-time-badge">
            <span style={{ color: '#FFFFFF', fontWeight: 700 }}>
              {formatDuration(currentTime)}.{Math.floor((currentTime % 1) * 10)}
            </span>
            <span style={{ color: '#6B7280' }}>/</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Right: Volume, Speed, CC, Fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Volume Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="playback-btn playback-btn-subtle"
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="volume-slider"
              title={`Volume ${Math.round(volume * 100)}%`}
            />
          </div>

          {/* Speed Selector */}
          <Dropdown
            items={speedOptions}
            align="right"
            trigger={
              <button
                type="button"
                className="playback-btn playback-btn-subtle"
                title="Playback Speed"
              >
                <Gauge size={15} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{playbackRate}x</span>
              </button>
            }
          />

          {/* Subtitles Visibility (CC) */}
          <button
            type="button"
            className={`playback-btn playback-btn-subtle ${isCaptionVisible ? 'playback-btn-active' : ''}`}
            onClick={() => setIsCaptionVisible(!isCaptionVisible)}
            title={isCaptionVisible ? 'Hide Captions (C)' : 'Show Captions (C)'}
          >
            <Subtitles size={16} />
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            className="playback-btn playback-btn-subtle"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};
