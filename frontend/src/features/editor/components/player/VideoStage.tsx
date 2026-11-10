import { memo, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, Film, Loader2 } from 'lucide-react';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useUIStore } from '../../../../stores/editor/uiStore';
import { useVideoStore } from '../../../../stores/editor/videoStore';
import { useEditorStore } from '../../../../stores/editor/editorStore';
import { useElementSize } from '../../hooks/layout';
import type { CanvasAspect } from '../../model/types';
import { playback } from '../../services/playback';
import { frameScale } from '../../utils/captionStyle';
import { CaptionOverlay } from './CaptionOverlay';

const ASPECT_VALUES: Record<Exclude<CanvasAspect, 'source'>, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:5': 4 / 5,
};

export const VideoStage = memo(function VideoStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { width, height } = useElementSize(stageRef);

  const videoUrl = useVideoStore((s) => s.videoUrl);
  const videoWidth = useVideoStore((s) => s.videoWidth);
  const videoHeight = useVideoStore((s) => s.videoHeight);
  const isBuffering = useVideoStore((s) => s.isBuffering);
  const mediaError = useVideoStore((s) => s.mediaError);
  const aspectSetting = useCaptionStore((s) => s.canvas.aspect);
  const showSafeArea = useUIStore((s) => s.showSafeArea);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    playback.attach(el);
    return () => playback.detach(el);
  }, [videoUrl]);

  const aspect = aspectSetting === 'source'
    ? videoWidth > 0 && videoHeight > 0 ? videoWidth / videoHeight : 16 / 9
    : ASPECT_VALUES[aspectSetting];

  const frame = useMemo(() => {
    const pad = 24;
    const w = Math.max(0, width - pad * 2);
    const h = Math.max(0, height - pad * 2);
    const fw = Math.min(w, h * aspect);
    return { width: Math.floor(fw), height: Math.floor(fw / aspect) };
  }, [width, height, aspect]);

  const scale = frameScale(frame.width, frame.height);

  return (
    <div className="ed-stage" ref={stageRef} onPointerDown={(e) => {
      // Clicking empty canvas clears the selection, like most editors.
      if (e.target === e.currentTarget) useEditorStore.getState().select(null);
    }}>
      <div className="ed-frame" style={{ width: frame.width, height: frame.height }}>
        {videoUrl ? (
          <video
            key={videoUrl}
            ref={videoRef}
            src={videoUrl}
            className="ed-video"
            playsInline
            preload="auto"
            onClick={() => playback.toggle()}
          />
        ) : (
          <div className="ed-video-empty" onClick={() => playback.toggle()}>
            <Film size={28} />
            <strong>No video attached</strong>
            <span>Captions still play on a silent clock. Add a video from the Media tab.</span>
          </div>
        )}
        {showSafeArea && (
          <div className="ed-safe-area" aria-hidden>
            <div className="ed-safe-action" />
            <div className="ed-safe-title" />
          </div>
        )}
        <CaptionOverlay scale={scale} />
        {isBuffering && !mediaError && (
          <div className="ed-stage-status"><Loader2 className="ed-spin" size={22} /></div>
        )}
        {mediaError && (
          <div className="ed-stage-status is-error">
            <AlertTriangle size={20} />
            <span>{mediaError}</span>
          </div>
        )}
      </div>
    </div>
  );
});
