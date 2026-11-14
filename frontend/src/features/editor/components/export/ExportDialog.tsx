import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettingsStore } from '../../../../stores/settingsStore';
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Film,
  Loader2,
  RotateCcw,
  Subtitles,
  Trash2,
} from 'lucide-react';
import { Modal } from '../../../../components/Modal/Modal';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { apiErrorMessage, exportService } from '../../../../services/exportService';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useEditorProjectStore } from '../../../../stores/editor/editorProjectStore';
import { useTemplateStore } from '../../../../stores/editor/templateStore';
import { useUIStore } from '../../../../stores/editor/uiStore';
import { useVideoStore } from '../../../../stores/editor/videoStore';
import type { CreateExportPayload, ExportItem, ExportQuality, ExportResolution, ExportType } from '../../../../types/export';
import { flush } from '../../services/autosave';
import { Segmented } from '../controls';

const FORMATS: Array<{ type: ExportType; title: string; desc: string; Icon: typeof Film }> = [
  { type: 'mp4', title: 'MP4 video', desc: 'Captions burned in with your styles and animations', Icon: Film },
  { type: 'srt', title: 'SRT', desc: 'YouTube, Facebook, Premiere, VLC', Icon: Subtitles },
  { type: 'vtt', title: 'WebVTT', desc: 'HTML5 and web video players', Icon: Subtitles },
  { type: 'txt', title: 'Text', desc: 'Plain transcript, no timings', Icon: FileText },
  { type: 'json', title: 'JSON', desc: 'Timings, words and styles for developers', Icon: Braces },
];

const QUALITY_LABEL: Record<ExportQuality, string> = { high: 'High', standard: 'Standard', small: 'Small file' };
const ASPECT: Record<string, number> = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 };

/** Mirrors backend VideoRendererService::outputSize so the dialog shows the real output size. */
function outputSize(srcW: number, srcH: number, aspect: string, resolution: ExportResolution): [number, number] {
  const ratio = ASPECT[aspect] ?? srcW / srcH;
  const even = (v: number) => Math.max(16, Math.round(v / 2) * 2);
  if (resolution === 'source' && aspect === 'source') return [even(srcW), even(srcH)];
  const short = resolution === 'source' ? Math.min(srcW, srcH) : Number(resolution);
  return ratio >= 1 ? [even(short * ratio), even(short)] : [even(short), even(short / ratio)];
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

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

const isActive = (e: ExportItem) => e.status === 'queued' || e.status === 'processing';

function describe(e: ExportItem) {
  if (e.type !== 'mp4') return e.type.toUpperCase();
  const res = e.options.resolution === '2160' ? '4K' : e.options.resolution === 'source' ? 'Source' : `${e.options.resolution}p`;
  return `MP4 · ${res}${e.options.width ? ` · ${e.options.width}×${e.options.height}` : ''}`;
}

function ExportRow({ item, onRetry, onDelete }: { item: ExportItem; onRetry: (e: ExportItem) => void; onDelete: (e: ExportItem) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      await exportService.download(item.uuid);
    } catch (err) {
      setError(apiErrorMessage(err, 'Download failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`ed-export-row is-${item.status}`}>
      <div className="ed-export-row-main">
        <span className="ed-export-row-title">{describe(item)}</span>
        <span className="ed-export-row-meta">
          {item.options.template && <>{item.options.template} · </>}
          {item.status === 'completed' && formatBytes(item.file_size) && <>{formatBytes(item.file_size)} · </>}
          {timeAgo(item.created_at)}
        </span>
        {item.status === 'queued' && (
          <span className="ed-export-status"><Clock size={13} /> Exporting… waiting for a renderer</span>
        )}
        {item.status === 'processing' && (
          <>
            <span className="ed-export-status"><Loader2 size={13} className="ed-spin" /> Rendering… {item.progress}%</span>
            <div className="ed-progress" role="progressbar" aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${Math.max(2, item.progress)}%` }} />
            </div>
          </>
        )}
        {item.status === 'completed' && <span className="ed-export-status is-ok"><CheckCircle2 size={13} /> Completed</span>}
        {item.status === 'failed' && (
          <span className="ed-export-status is-error"><AlertTriangle size={13} /> Failed — {item.error_message ?? 'unknown error'}</span>
        )}
        {error && <span className="ed-export-status is-error">{error}</span>}
      </div>
      <div className="ed-export-row-actions">
        {item.status === 'completed' && (
          <button type="button" className="ed-btn is-primary" onClick={() => void download()} disabled={busy}>
            {busy ? <Loader2 size={14} className="ed-spin" /> : <Download size={14} />} Download
          </button>
        )}
        {item.status === 'failed' && (
          <button type="button" className="ed-btn" onClick={() => onRetry(item)}>
            <RotateCcw size={14} /> Retry
          </button>
        )}
        <button
          type="button"
          className="ed-icon-btn is-danger"
          onClick={() => onDelete(item)}
          aria-label={isActive(item) ? 'Cancel export' : 'Delete export'}
          data-tip={isActive(item) ? 'Cancel' : 'Delete'}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
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
  const templates = useTemplateStore((s) => s.templates);
  const loadTemplates = useTemplateStore((s) => s.load);

  const [type, setType] = useState<ExportType>('mp4');
  const preferences = useSettingsStore((st) => st.settings);
  const [resolution, setResolution] = useState<ExportResolution>(preferences?.default_export_resolution ?? '1080');
  const [quality, setQuality] = useState<ExportQuality>(preferences?.default_export_quality ?? 'standard');
  const [template, setTemplate] = useState<string>('');
  const [items, setItems] = useState<ExportItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const close = () => useUIStore.getState().setExportOpen(false);

  // Source size: what the browser decoded (server video), else what the server probed.
  const srcW = (!isLocalPreview && videoW) || projectW || 1920;
  const srcH = (!isLocalPreview && videoH) || projectH || 1080;
  const can4k = Math.min(srcW, srcH) >= 2160;
  const mp4Blocked = !hasServerVideo ? 'Upload a video to this project to render an MP4.' : null;
  const effectiveType = type === 'mp4' && mp4Blocked ? 'srt' : type;
  const [outW, outH] = outputSize(srcW, srcH, aspect, resolution === '2160' && !can4k ? '1080' : resolution);

  const refresh = useCallback(async () => {
    if (!projectUuid) return;
    try {
      setItems(await exportService.list(projectUuid));
      setListError(null);
    } catch (err) {
      setListError(apiErrorMessage(err, 'Could not load exports.'));
    }
  }, [projectUuid]);

  useEffect(() => {
    if (!open || isDemo) return;
    void refresh();
    void loadTemplates();
  }, [open, isDemo, refresh, loadTemplates]);

  // Poll active exports while the dialog is open.
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
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Export reads captions/styles from the server, so persist pending edits first.
      await flush();
      if (useEditorProjectStore.getState().saveStatus === 'failed') {
        throw new Error('Your latest changes could not be saved. Fix saving (top bar) before exporting.');
      }
      const created = await exportService.create(projectUuid, payload);
      setItems((prev) => [created, ...prev]);
      if (created.status === 'completed' && payload.type !== 'mp4') {
        await exportService.download(created.uuid);
      }
    } catch (err) {
      setSubmitError(apiErrorMessage(err, 'Export failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const [pendingCancel, setPendingCancel] = useState<ExportItem | null>(null);

  const remove = async (item: ExportItem, confirmed = false) => {
    if (isActive(item) && !confirmed) {
      setPendingCancel(item);
      return;
    }
    setPendingCancel(null);
    try {
      await exportService.remove(item.uuid);
      setItems((prev) => prev.filter((e) => e.uuid !== item.uuid));
    } catch (err) {
      setListError(apiErrorMessage(err, 'Could not delete export.'));
    }
  };

  const retry = (item: ExportItem) =>
    void start({
      type: item.type,
      resolution: item.options.resolution,
      quality: item.options.quality,
    });

  const systemTemplates = useMemo(() => templates.filter((t) => t.is_system), [templates]);
  const myTemplates = useMemo(() => templates.filter((t) => !t.is_system), [templates]);
  const format = FORMATS.find((f) => f.type === effectiveType)!;

  return (
    <Modal isOpen={open} onClose={close} title="Export" size="lg">
      {isDemo ? (
        <p className="ed-help">Exports are not available in demo mode — open a saved project to export.</p>
      ) : (
        <div className="ed-export">
          <div className="ed-export-formats" role="radiogroup" aria-label="Format">
            {FORMATS.map(({ type: t, title, desc, Icon }) => {
              const disabled = t === 'mp4' && !!mp4Blocked;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={effectiveType === t}
                  disabled={disabled}
                  className={`ed-export-format ${effectiveType === t ? 'is-selected' : ''}`}
                  onClick={() => setType(t)}
                  title={disabled ? mp4Blocked ?? '' : undefined}
                >
                  <Icon size={18} />
                  <span className="ed-export-format-title">{title}</span>
                  <span className="ed-export-format-desc">{disabled ? mp4Blocked : desc}</span>
                </button>
              );
            })}
          </div>

          {effectiveType === 'mp4' && (
            <div className="ed-export-options">
              <div className="ed-field">
                <span className="ed-field-label">Resolution</span>
                <Segmented<ExportResolution>
                  ariaLabel="Resolution"
                  value={resolution === '2160' && !can4k ? '1080' : resolution}
                  onChange={setResolution}
                  options={[
                    { value: '720', label: '720p' },
                    { value: '1080', label: '1080p' },
                    ...(can4k ? [{ value: '2160' as const, label: '4K' }] : []),
                    { value: 'source', label: 'Source', tip: `${srcW}×${srcH}` },
                  ]}
                />
                {!can4k && <span className="ed-help">4K needs a source video of at least 2160p.</span>}
              </div>
              <div className="ed-field">
                <span className="ed-field-label">Quality</span>
                <Segmented<ExportQuality>
                  ariaLabel="Quality"
                  value={quality}
                  onChange={setQuality}
                  options={(['high', 'standard', 'small'] as const).map((q) => ({ value: q, label: QUALITY_LABEL[q] }))}
                />
              </div>
              <div className="ed-field">
                <label className="ed-field-label" htmlFor="export-style">Caption style</label>
                <select id="export-style" className="ed-input" value={template} onChange={(e) => setTemplate(e.target.value)}>
                  <option value="">Project style (as in the editor)</option>
                  {systemTemplates.length > 0 && (
                    <optgroup label="Presets">
                      {systemTemplates.map((t) => <option key={t.uuid} value={t.uuid}>{t.name}</option>)}
                    </optgroup>
                  )}
                  {myTemplates.length > 0 && (
                    <optgroup label="My templates">
                      {myTemplates.map((t) => <option key={t.uuid} value={t.uuid}>{t.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
              <p className="ed-export-summary">
                <strong>{outW} × {outH}</strong> · MP4 (H.264 + AAC) · {aspect === 'source' ? 'source' : aspect} canvas · {captionCount} captions
              </p>
            </div>
          )}

          {submitError && (
            <div className="ed-notice is-error"><AlertTriangle size={14} /> <span>{submitError}</span></div>
          )}

          <div className="ed-export-actions">
            <span className="ed-help">
              {effectiveType === 'mp4'
                ? 'Rendering runs in the background — you can keep editing. Later edits are not included.'
                : 'Generated from your saved captions and downloaded right away.'}
            </span>
            <button
              type="button"
              className="ed-btn is-accent"
              disabled={submitting || captionCount === 0}
              onClick={() =>
                void start(
                  effectiveType === 'mp4'
                    ? { type: 'mp4', resolution: resolution === '2160' && !can4k ? '1080' : resolution, quality, template: template || null }
                    : { type: effectiveType }
                )
              }
            >
              {submitting ? <Loader2 size={15} className="ed-spin" /> : <format.Icon size={15} />}
              {effectiveType === 'mp4' ? 'Render MP4' : `Export ${format.title}`}
            </button>
          </div>

          <section className="ed-export-history" aria-label="Recent exports">
            <h4>Recent exports</h4>
            {listError && <p className="ed-help is-error">{listError}</p>}
            {items.length === 0 ? (
              <p className="ed-help">Nothing exported yet.</p>
            ) : (
              <ul>
                {items.map((item) => <ExportRow key={item.uuid} item={item} onRetry={retry} onDelete={remove} />)}
              </ul>
            )}
          </section>
        </div>
      )}
      <ConfirmDialog
        isOpen={!!pendingCancel}
        title="Cancel this render?"
        message="The video stops rendering and the partial file is discarded."
        confirmLabel="Cancel render"
        cancelLabel="Keep rendering"
        tone="danger"
        onConfirm={() => pendingCancel && void remove(pendingCancel, true)}
        onCancel={() => setPendingCancel(null)}
      />
    </Modal>
  );
}
