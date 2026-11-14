import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileText, Film, Loader2, RotateCcw, Subtitles, Trash2, X } from 'lucide-react';
import { Modal } from '../../../../components/Modal/Modal';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { apiErrorMessage, exportService } from '../../../../services/exportService';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useEditorProjectStore } from '../../../../stores/editor/editorProjectStore';
import { useSettingsStore } from '../../../../stores/settingsStore';
import { useUIStore } from '../../../../stores/editor/uiStore';
import { useVideoStore } from '../../../../stores/editor/videoStore';
import type { CreateExportPayload, ExportItem, ExportResolution, ExportType } from '../../../../types/export';
import { flush } from '../../services/autosave';

const RESOLUTIONS: Array<{ value: Exclude<ExportResolution, 'source'>; label: string; short: number }> = [
  { value: '720', label: '720p', short: 720 },
  { value: '1080', label: '1080p', short: 1080 },
  { value: '1440', label: '2K', short: 1440 },
  { value: '2160', label: '4K', short: 2160 },
];

const SUBTITLES: Array<{ type: Exclude<ExportType, 'mp4' | 'json'>; label: string; hint: string; Icon: typeof Film }> = [
  { type: 'srt', label: 'SRT', hint: 'YouTube, Facebook, Premiere', Icon: Subtitles },
  { type: 'vtt', label: 'VTT', hint: 'Web players', Icon: Subtitles },
  { type: 'txt', label: 'TXT', hint: 'Plain transcript', Icon: FileText },
];

const ASPECT: Record<string, number> = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 };
const NAMED_RATIOS: Array<[number, string]> = [[16 / 9, '16:9'], [9 / 16, '9:16'], [1, '1:1'], [4 / 5, '4:5'], [4 / 3, '4:3'], [3 / 4, '3:4'], [21 / 9, '21:9']];

const even = (v: number) => Math.max(16, Math.round(v / 2) * 2);

/** Mirrors backend VideoRendererService::outputSize so the dialog shows the real output size. */
function outputSize(srcW: number, srcH: number, aspect: string, short: number): [number, number] {
  const ratio = ASPECT[aspect] ?? srcW / srcH;
  return ratio >= 1 ? [even(short * ratio), even(short)] : [even(short), even(short / ratio)];
}

function ratioLabel(w: number, h: number): string {
  const r = w / h;
  const named = NAMED_RATIOS.find(([v]) => Math.abs(v - r) < 0.02);
  return named ? named[1] : `${w}:${h}`;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.round(s)) % 60).padStart(2, '0')}`;
const isActive = (e: ExportItem) => e.status === 'queued' || e.status === 'processing';
const resLabel = (r?: string) => RESOLUTIONS.find((x) => x.value === r)?.label ?? (r === 'source' ? 'Source' : r ? `${r}p` : '');

/** Big, focused view of one MP4 render: waiting → rendering (progress, time) → ready (download) / failed (retry). */
function RenderPanel({ item, onCancel, onRetry, onDone }: { item: ExportItem; onCancel: () => void; onRetry: () => void; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isActive(item)) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [item]);

  const started = item.started_at ? new Date(item.started_at).getTime() : null;
  const elapsed = started ? (now - started) / 1000 : 0;
  const eta = started && item.progress > 3 ? (elapsed * (100 - item.progress)) / item.progress : null;
  const size = item.options.width ? `${item.options.width}×${item.options.height}` : '';

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      await exportService.download(item.uuid);
    } catch (err) {
      setError(apiErrorMessage(err, 'Download failed.'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className={`ed-render is-${item.status}`} aria-live="polite" aria-label="Video export">
      <div className="ed-render-head">
        <span className="ed-render-icon" aria-hidden="true">
          {item.status === 'completed' ? <CheckCircle2 size={22} /> : item.status === 'failed' ? <AlertTriangle size={22} /> : <Film size={22} />}
        </span>
        <div>
          <h3 className="ed-render-title">
            {item.status === 'queued' && 'Getting ready to render…'}
            {item.status === 'processing' && 'Rendering your video'}
            {item.status === 'completed' && 'Your video is ready'}
            {item.status === 'failed' && 'Rendering failed'}
          </h3>
          <p className="ed-render-sub">
            MP4 · {resLabel(item.options.resolution)} {size && `· ${size}`} {item.options.aspect && item.options.aspect !== 'source' ? `· ${item.options.aspect}` : ''}
          </p>
        </div>
      </div>

      {isActive(item) && (
        <>
          <div className="ed-render-bar" role="progressbar" aria-label="Render progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progress}>
            <div className={item.status === 'queued' ? 'is-waiting' : ''} style={item.status === 'queued' ? undefined : { width: `${Math.max(2, item.progress)}%` }} />
          </div>
          <div className="ed-render-stats">
            <span className="ed-render-pct">{item.status === 'queued' ? 'Queued' : `${item.progress}%`}</span>
            <span>
              {item.status === 'queued' ? 'Waiting for a free renderer' : `${clock(elapsed)} elapsed${eta !== null ? ` · about ${clock(eta)} left` : ''}`}
            </span>
          </div>
          <p className="ed-help">You can keep editing or close this window — rendering continues in the background. Edits made now are not included.</p>
          <div className="ed-render-actions">
            <button type="button" className="ed-btn" onClick={onCancel}>
              <X size={15} aria-hidden="true" /> Cancel render
            </button>
          </div>
        </>
      )}

      {item.status === 'completed' && (
        <>
          <p className="ed-render-sub">{formatBytes(item.file_size)} · {item.download_name}</p>
          {error && <p className="ed-notice is-error"><AlertTriangle size={14} aria-hidden="true" /> {error}</p>}
          <div className="ed-render-actions">
            <button type="button" className="ed-btn" onClick={onDone}>Export another</button>
            <button type="button" className="ed-btn is-accent is-lg" onClick={() => void download()} disabled={downloading}>
              {downloading ? <Loader2 size={16} className="ed-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />} Download MP4
            </button>
          </div>
        </>
      )}

      {item.status === 'failed' && (
        <>
          <p className="ed-notice is-error"><AlertTriangle size={14} aria-hidden="true" /> {item.error_message ?? 'Something went wrong while rendering.'}</p>
          <div className="ed-render-actions">
            <button type="button" className="ed-btn" onClick={onDone}>Back</button>
            <button type="button" className="ed-btn is-accent" onClick={onRetry}>
              <RotateCcw size={15} aria-hidden="true" /> Try again
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export function ExportDialog() {
  const open = useUIStore((s) => s.isExportOpen);
  const projectUuid = useEditorProjectStore((s) => s.projectUuid);
  const isDemo = useEditorProjectStore((s) => s.isDemo);
  const hasServerVideo = useEditorProjectStore((s) => s.hasServerVideo);
  const projectW = useEditorProjectStore((s) => s.sourceWidth);
  const projectH = useEditorProjectStore((s) => s.sourceHeight);
  const isLocalPreview = useVideoStore((s) => s.isLocalPreview);
  const videoW = useVideoStore((s) => s.videoWidth);
  const videoH = useVideoStore((s) => s.videoHeight);
  const aspect = useCaptionStore((s) => s.canvas.aspect);
  const captionCount = useCaptionStore((s) => s.captions.length);
  const preferences = useSettingsStore((st) => st.settings);

  const srcW = (!isLocalPreview && videoW) || projectW || 1920;
  const srcH = (!isLocalPreview && videoH) || projectH || 1080;
  const srcShort = Math.min(srcW, srcH);
  const allowed = (short: number) => short <= 1080 || short <= srcShort;
  const preferred = preferences?.default_export_resolution;
  const initial = RESOLUTIONS.find((r) => r.value === preferred && allowed(r.short))?.value ?? (srcShort >= 1080 ? '1080' : '720');

  const [resolution, setResolution] = useState<Exclude<ExportResolution, 'source'>>(initial);
  const [items, setItems] = useState<ExportItem[]>([]);
  const [focusUuid, setFocusUuid] = useState<string | null>(null);
  const [busy, setBusy] = useState<ExportType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<ExportItem | null>(null);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const close = () => useUIStore.getState().setExportOpen(false);

  const outAspect = aspect === 'source' ? srcW / srcH : ASPECT[aspect];
  const aspectText = aspect === 'source' ? `${ratioLabel(srcW, srcH)} (original)` : aspect;
  const mp4Blocked = !hasServerVideo ? 'Upload a video to this project to export an MP4.' : null;

  const refresh = useCallback(async () => {
    if (!projectUuid) return;
    try {
      const list = await exportService.list(projectUuid);
      setItems(list);
      // Re-opening the dialog during a render goes straight back to its progress.
      const active = list.find((e) => e.type === 'mp4' && isActive(e));
      if (active) setFocusUuid(active.uuid);
    } catch {
      /* the list is secondary; the toast policy handles real outages */
    }
  }, [projectUuid]);

  useEffect(() => {
    if (!open || isDemo) return;
    void refresh();
  }, [open, isDemo, refresh]);

  // Poll active renders while the dialog is open.
  const hasActive = items.some(isActive);
  useEffect(() => {
    if (!open || !hasActive) return;
    const id = setInterval(async () => {
      const active = itemsRef.current.filter(isActive);
      const updates = await Promise.all(active.map((e) => exportService.get(e.uuid).catch(() => null)));
      setItems((prev) => prev.map((e) => updates.find((u) => u?.uuid === e.uuid) ?? e));
    }, 1500);
    return () => clearInterval(id);
  }, [open, hasActive]);

  const start = async (payload: CreateExportPayload) => {
    if (!projectUuid) return;
    setBusy(payload.type);
    setError(null);
    try {
      // Exports read captions/styles from the server, so persist pending edits first.
      await flush();
      if (useEditorProjectStore.getState().saveStatus === 'failed') {
        throw new Error('Your latest changes could not be saved yet. Wait for "Saved" in the top bar, then export.');
      }
      const created = await exportService.create(projectUuid, payload);
      setItems((prev) => [created, ...prev]);
      if (payload.type === 'mp4') {
        setFocusUuid(created.uuid);
      } else if (created.status === 'completed') {
        await exportService.download(created.uuid);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Export failed.'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (item: ExportItem) => {
    setPendingCancel(null);
    try {
      await exportService.remove(item.uuid);
      setItems((prev) => prev.filter((e) => e.uuid !== item.uuid));
      if (focusUuid === item.uuid) setFocusUuid(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not cancel the export.'));
    }
  };

  const exportVideo = () => void start({ type: 'mp4', resolution, quality: preferences?.default_export_quality ?? 'standard', template: null });
  const focused = items.find((e) => e.uuid === focusUuid) ?? null;
  const recentVideos = items.filter((e) => e.type === 'mp4' && e.status === 'completed' && e.uuid !== focusUuid).slice(0, 3);

  return (
    <Modal isOpen={open} onClose={close} title="Export" size="md">
      {isDemo ? (
        <p className="ed-help">Exports are not available in demo mode — open a saved project to export.</p>
      ) : (
        <div className="ed-export2">
          {focused ? (
            <RenderPanel
              item={focused}
              onCancel={() => setPendingCancel(focused)}
              onRetry={() => void start({ type: 'mp4', resolution: (focused.options.resolution as typeof resolution) ?? resolution, quality: focused.options.quality ?? 'standard', template: null })}
              onDone={() => setFocusUuid(null)}
            />
          ) : (
            <section className="ed-export2-card" aria-labelledby="export-video-title">
              <div className="ed-export2-head">
                <h3 id="export-video-title"><Film size={16} aria-hidden="true" /> Video with captions</h3>
                <span className="ed-export2-aspect" title="Output aspect ratio">
                  <span className="ed-export2-aspect-shape" style={{ aspectRatio: String(outAspect) }} aria-hidden="true" />
                  {aspectText}
                </span>
              </div>

              <fieldset className="ed-export2-res" disabled={!!mp4Blocked}>
                <legend className="ed-field-label">Resolution</legend>
                <div className="ed-export2-res-grid">
                  {RESOLUTIONS.map((r) => {
                    const ok = allowed(r.short);
                    const [w, h] = outputSize(srcW, srcH, aspect, r.short);
                    return (
                      <label key={r.value} className={`ed-export2-res-option ${resolution === r.value ? 'is-selected' : ''} ${ok ? '' : 'is-disabled'}`} title={ok ? `${w}×${h}` : `Needs a source video of at least ${r.short}p`}>
                        <input type="radio" name="export-resolution" value={r.value} checked={resolution === r.value} disabled={!ok} onChange={() => setResolution(r.value)} aria-label={ok ? `${r.label}, ${w} by ${h}` : `${r.label}, needs a larger source video`} />
                        <span className="ed-export2-res-label">{r.label}</span>
                        <span className="ed-export2-res-size">{ok ? `${w}×${h}` : 'Source too small'}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {mp4Blocked && <p className="ed-help">{mp4Blocked}</p>}
              <button type="button" className="ed-btn is-accent is-lg ed-export2-cta" onClick={exportVideo} disabled={!!mp4Blocked || captionCount === 0 || busy !== null}>
                {busy === 'mp4' ? <Loader2 size={16} className="ed-spin" aria-hidden="true" /> : <Film size={16} aria-hidden="true" />} Export video
              </button>

              {recentVideos.length > 0 && (
                <ul className="ed-export2-recent" aria-label="Recent videos">
                  {recentVideos.map((e) => (
                    <li key={e.uuid}>
                      <span>MP4 · {resLabel(e.options.resolution)} · {formatBytes(e.file_size)}</span>
                      <button type="button" className="ed-link-btn" onClick={() => void exportService.download(e.uuid).catch((err) => setError(apiErrorMessage(err, 'Download failed.')))}>
                        <Download size={13} aria-hidden="true" /> Download
                      </button>
                      <button type="button" className="ed-icon-btn is-danger" aria-label="Delete this video export" onClick={() => void remove(e)}>
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="ed-export2-card" aria-labelledby="export-subs-title">
            <div className="ed-export2-head">
              <h3 id="export-subs-title"><Subtitles size={16} aria-hidden="true" /> Subtitle files</h3>
              <span className="ed-help">Downloads straight away</span>
            </div>
            <div className="ed-export2-subs">
              {SUBTITLES.map(({ type, label, hint, Icon }) => (
                <button key={type} type="button" className="ed-export2-sub" aria-label={`Download ${label}`} onClick={() => void start({ type })} disabled={captionCount === 0 || busy !== null}>
                  {busy === type ? <Loader2 size={18} className="ed-spin" aria-hidden="true" /> : <Icon size={18} aria-hidden="true" />}
                  <span className="ed-export2-sub-label">{label}</span>
                  <span className="ed-export2-sub-hint">{hint}</span>
                  <Download size={14} className="ed-export2-sub-dl" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>

          {captionCount === 0 && <p className="ed-help">Add captions before exporting.</p>}
          {error && <div className="ed-notice is-error" role="alert"><AlertTriangle size={14} aria-hidden="true" /> <span>{error}</span></div>}
        </div>
      )}
      <ConfirmDialog
        isOpen={!!pendingCancel}
        title="Cancel this render?"
        message="The video stops rendering and the partial file is discarded."
        confirmLabel="Cancel render"
        cancelLabel="Keep rendering"
        tone="danger"
        onConfirm={() => pendingCancel && void remove(pendingCancel)}
        onCancel={() => setPendingCancel(null)}
      />
    </Modal>
  );
}
