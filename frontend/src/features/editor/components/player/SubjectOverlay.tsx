import { memo, useEffect, useRef } from 'react';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useVideoStore } from '../../../../stores/editor/videoStore';
import { useActiveCaptionId } from '../../../../stores/editor/selectors';
import { drawSubjectCutout, isSubjectSegmenterReady, loadSubjectSegmenter, subjectMaskOf, type SubjectMask } from '../../../../utils/subjectMask';

/**
 * "Captions behind the person" (Pro) in the preview: a layer above the captions that redraws the
 * person from the current video frame, so the caption looks like it sits behind them.
 */
export const SubjectOverlay = memo(function SubjectOverlay({ video, width, height }: { video: HTMLVideoElement | null; width: number; height: number }) {
  const enabled = useCaptionStore((s) => !!s.style.behindSubject);
  const activeId = useActiveCaptionId();
  const visible = useVideoStore((s) => s.captionsVisible);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const show = enabled && visible && activeId !== null;

  useEffect(() => {
    if (enabled) void loadSubjectSegmenter().catch(() => undefined);
  }, [enabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!show || !canvas || !ctx || !video) {
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    let raf = 0;
    let lastTime = -1;
    let mask: SubjectMask | null = null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const w = Math.max(1, Math.round(width * dpr));
      const h = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        lastTime = -1;
      }
      if (!isSubjectSegmenterReady() || video.readyState < 2 || !video.videoWidth) return;
      // A new frame (playing or seeked): find the person again.
      if (video.currentTime !== lastTime) {
        try {
          mask = subjectMaskOf(video);
        } catch {
          mask = null; // e.g. the video can't be read (cross-origin): show captions normally
        }
        lastTime = video.currentTime;
      }
      ctx.clearRect(0, 0, w, h);
      if (!mask) return;
      // The video is shown with object-fit: contain.
      const fit = Math.min(w / video.videoWidth, h / video.videoHeight);
      const dw = video.videoWidth * fit;
      const dh = video.videoHeight * fit;
      drawSubjectCutout(ctx, video, mask, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [show, video, width, height]);

  if (!enabled) return null;
  return <canvas ref={canvasRef} className="ed-subject-layer" aria-hidden="true" />;
});
