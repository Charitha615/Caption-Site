import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, X } from 'lucide-react';
import { exportVideo, pickExportFormat, type ExportQuality } from '../exporter';
import { formatTime } from '../model';
import { frameSize } from '../render';
import { downloadBlob, fileBase } from '../sources';
import { totalDuration, useVideoEditorStore } from '../store';
import { Link } from 'react-router-dom';
import { usePlan } from '../../../hooks/usePlan';
import { BRAND } from '../../../config/brand';

type Phase =
  | { kind: 'setup' }
  | { kind: 'running'; progress: number }
  | { kind: 'done'; blob: Blob }
  | { kind: 'error'; message: string };

const QUALITIES: { value: ExportQuality; label: string; hint: string }[] = [
  { value: 480, label: '480p', hint: 'Small file, quick to share' },
  { value: 720, label: '720p', hint: 'Good for social media' },
  { value: 1080, label: '1080p', hint: 'Full HD, best quality' },
];

const sizeLabel = (bytes: number) => (bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`);

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const name = useVideoEditorStore((s) => s.name);
  const aspect = useVideoEditorStore((s) => s.aspect);
  const total = useVideoEditorStore((s) => totalDuration(s.clips));
  const format = useMemo(() => pickExportFormat(), []);
  const plan = usePlan();
  const proOnly = (q: ExportQuality) => plan.known && q > plan.features.max_export_height;
  const [chosen, setQuality] = useState<ExportQuality>(1080);
  // Free plan: 720p at most (once the plan is known).
  const quality: ExportQuality = proOnly(chosen) ? 720 : chosen;
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' });
  const abortRef = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileName = `${fileBase(name)}.${format?.extension ?? 'webm'}`;
  const size = frameSize(aspect, quality);

  // Cancel a running export when the dialog goes away.
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const start = async () => {
    if (!format) return;
    const s = useVideoEditorStore.getState();
    s.setPlaying(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: 'running', progress: 0 });
    let shown = 0;
    try {
      const blob = await exportVideo({
        aspect: s.aspect,
        quality,
        fps: 30,
        tracks: s.tracks,
        clips: s.clips,
        media: s.media,
        format,
        signal: controller.signal,
        watermark: plan.features.watermark ? BRAND.titleName : undefined,
        onProgress: (done) => {
          // A state update per percent is plenty.
          const pct = Math.floor(done * 100);
          if (pct !== shown) {
            shown = pct;
            setPhase({ kind: 'running', progress: done });
          }
        },
      });
      setPhase({ kind: 'done', blob });
      downloadBlob(blob, fileName);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') setPhase({ kind: 'setup' });
      else setPhase({ kind: 'error', message: err instanceof Error ? err.message : 'The export failed.' });
    } finally {
      abortRef.current = null;
    }
  };

  const running = phase.kind === 'running';
  const close = () => {
    abortRef.current?.abort();
    onClose();
  };

  return (
    <div className="ve-modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && !running && close()}>
      <div
        ref={dialogRef}
        className="ve-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ve-export-title"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !running) close();
          e.stopPropagation();
        }}
      >
        <div className="ve-modal-head">
          <h2 id="ve-export-title">Export video</h2>
          <button type="button" className="ve-icon-btn" onClick={close} aria-label="Close" disabled={running}><X size={16} /></button>
        </div>

        {!format ? (
          <p className="ve-modal-error"><AlertTriangle size={16} aria-hidden="true" /> This browser can&apos;t record video. Try the latest Chrome, Edge or Firefox.</p>
        ) : phase.kind === 'setup' || phase.kind === 'error' ? (
          <>
            <fieldset className="ve-quality">
              <legend>Quality</legend>
              {QUALITIES.map((q) => (
                <label key={q.value} className={`${quality === q.value ? 'is-on' : ''} ${proOnly(q.value) ? 'is-locked' : ''}`} title={proOnly(q.value) ? 'Available on Pro' : undefined}>
                  <input type="radio" name="ve-quality" value={q.value} checked={quality === q.value} disabled={proOnly(q.value)} onChange={() => setQuality(q.value)} />
                  <strong>{q.label}{proOnly(q.value) && <span className="ve-pro-badge">Pro</span>}</strong>
                  <span>{proOnly(q.value) ? 'Available on Pro' : q.hint}</span>
                </label>
              ))}
            </fieldset>
            <dl className="ve-export-facts">
              <div><dt>Format</dt><dd>{format.label}</dd></div>
              <div><dt>Size</dt><dd>{size.width} × {size.height}</dd></div>
              <div><dt>Length</dt><dd>{formatTime(total)}</dd></div>
            </dl>
            {plan.known && plan.features.watermark && (
              <p className="ve-panel-hint ve-pro-note">
                Free exports are up to 720p with a small {BRAND.titleName} mark in the corner. <Link to="/billing">Pro</Link> exports Full HD without it.
              </p>
            )}
            <p className="ve-panel-hint">
              The video is recorded as it plays, so this takes about {formatTime(total, false)}. Keep this tab open and in front until it finishes.
            </p>
            {phase.kind === 'error' && <p className="ve-modal-error" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {phase.message}</p>}
            <div className="ve-modal-actions">
              <button type="button" className="ve-secondary-btn" onClick={close}>Cancel</button>
              <button type="button" className="ve-export" onClick={() => void start()} disabled={total === 0}>
                <Download size={16} aria-hidden="true" /> Export {QUALITIES.find((q) => q.value === quality)?.label}
              </button>
            </div>
          </>
        ) : phase.kind === 'running' ? (
          <>
            <div className="ve-progress" role="progressbar" aria-label="Export progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(phase.progress * 100)}>
              <span style={{ width: `${phase.progress * 100}%` }} />
            </div>
            <p className="ve-progress-text">
              <strong>{Math.round(phase.progress * 100)}%</strong> · {formatTime(phase.progress * total, false)} of {formatTime(total, false)}
            </p>
            <p className="ve-panel-hint">Keep this tab in front while the video records.</p>
            <div className="ve-modal-actions">
              <button type="button" className="ve-secondary-btn" onClick={() => abortRef.current?.abort()}>Stop export</button>
            </div>
          </>
        ) : (
          <>
            <p className="ve-modal-done"><CheckCircle2 size={18} aria-hidden="true" /> Your video is ready · {sizeLabel(phase.blob.size)}</p>
            <p className="ve-panel-hint">The download started. If it didn&apos;t, use the button below.</p>
            <div className="ve-modal-actions">
              <button type="button" className="ve-secondary-btn" onClick={() => setPhase({ kind: 'setup' })}>Export again</button>
              <button type="button" className="ve-export" onClick={() => downloadBlob(phase.blob, fileName)}>
                <Download size={16} aria-hidden="true" /> Download {fileName}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
