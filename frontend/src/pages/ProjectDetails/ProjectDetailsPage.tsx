import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Sliders, Sparkles, Clock, FileVideo, Trash2, Edit2, Check, X, AlertCircle, UploadCloud, RefreshCw } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';
import { useUsageStore } from '../../stores/usageStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useProjectStatus } from '../../hooks/useProjectStatus';
import { captionService } from '../../services/captionService';
import { ChunkedUpload, UploadCancelledError, type UploadProgress } from '../../services/uploadService';
import { toAppError, type AppError } from '../../services/errors';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import { Modal } from '../../components/Modal/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { Progress } from '../../components/Progress/Progress';
import { PhaseTimer, ProcessingSteps, QueueStalledNotice } from '../../features/projects/ProcessingSteps';
import { AiKeyNotice } from '../../features/account/AiKeyNotice';
import { useAiKeyMissing } from '../../stores/aiKeyStore';
import { validateVideoFile } from '../../utils/video';
import { PROCESSING_STATUSES, VIDEO_UPLOAD } from '../../config/constants';
import type { Caption, Project } from '../../types/project';
import { formatDuration, formatDate, getLanguageLabel, formatFileSize } from '../../utils/formatters';
import './ProjectDetailsPage.css';

type Language = 'si' | 'en' | 'auto';
const VISIBLE_CAPTIONS = 300;

const isProcessing = (p: Project | null) => !!p && (PROCESSING_STATUSES as readonly string[]).includes(p.status);

function statusBadge(status: Project['status']) {
  if (status === 'ready' || status === 'completed') return <Badge variant="green" hasDot>Ready</Badge>;
  if (status === 'failed') return <Badge variant="red" hasDot>Failed</Badge>;
  if (status === 'draft') return <Badge variant="gray">Draft — no video</Badge>;
  return <Badge variant="purple" hasDot>Processing</Badge>;
}

export const ProjectDetailsPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const { currentProject: project, loadProject, deleteProject } = useProjectStore();
  const addToast = useToastStore((s) => s.addToast);
  const usage = useUsageStore((s) => s.usage);

  const [loadError, setLoadError] = useState<AppError | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [captionsLoading, setCaptionsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const [regenOpen, setRegenOpen] = useState(false);
  const [targetLang, setTargetLang] = useState<Language>('si');
  const [regenerating, setRegenerating] = useState(false);

  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [captionToDelete, setCaptionToDelete] = useState<Caption | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [upload, setUpload] = useState<UploadProgress | null>(null);
  const uploadRef = useRef<ChunkedUpload | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const aiKeyMissing = useAiKeyMissing();
  const isCurrent = project?.uuid === uuid;
  useDocumentTitle(isCurrent && project ? project.name : 'Project');

  const loadCaptions = useCallback(async (id: string) => {
    setCaptionsLoading(true);
    try {
      const res = await captionService.getCaptions(id);
      setCaptions(res.captions ?? []);
    } catch {
      /* toast already shown */
    } finally {
      setCaptionsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (!uuid) return;
    setLoadError(null);
    try {
      const p = await loadProject(uuid);
      setTargetLang((['si', 'en', 'auto'].includes(p.language) ? p.language : 'si') as Language);
      await loadCaptions(uuid);
    } catch (err) {
      setLoadError(toAppError(err, 'We could not load this project.'));
    }
  }, [uuid, loadProject, loadCaptions]);

  useEffect(() => {
    void load();
    return () => uploadRef.current?.abortLocally();
  }, [load]);

  const polling = isCurrent && isProcessing(project);
  // When processing finishes, reload captions and the full project (thumbnail, video URL).
  const { status, restart } = useProjectStatus(uuid, polling, () => void load());

  const startRegenerate = async () => {
    if (!uuid) return;
    setRegenerating(true);
    try {
      await captionService.generateCaptions(uuid, targetLang);
      setRegenOpen(false);
      await loadProject(uuid);
      restart();
      addToast({ type: 'info', title: 'Generating captions', message: 'This usually takes a minute or two.' });
    } catch {
      /* API client toasts the reason (limit, already processing, …) */
    } finally {
      setRegenerating(false);
    }
  };

  const startUpload = async (file: File) => {
    if (!uuid || !project) return;
    const problem = validateVideoFile(file, usage?.max_upload_mb ?? VIDEO_UPLOAD.DEFAULT_MAX_MB);
    if (problem) {
      addToast({ type: 'warning', title: 'Cannot upload this file', message: problem });
      return;
    }
    const job = new ChunkedUpload(uuid, file, targetLang, setUpload);
    uploadRef.current = job;
    try {
      await job.start();
      await loadProject(uuid);
      restart();
    } catch (err) {
      if (!(err instanceof UploadCancelledError)) {
        addToast({ type: 'error', title: 'Upload failed', message: `${toAppError(err).message} Choose the same file again to resume.` });
      }
    } finally {
      uploadRef.current = null;
      setUpload(null);
    }
  };

  const saveCaptionText = async (caption: Caption) => {
    if (!uuid) return;
    const text = editingText.trim();
    if (!text) return;
    try {
      const updated = await captionService.updateCaption(uuid, caption.uuid, { text });
      setCaptions((prev) => prev.map((c) => (c.uuid === caption.uuid ? { ...c, text: updated.text } : c)));
      setEditingUuid(null);
    } catch {
      /* toast shown */
    }
  };

  const confirmDeleteCaption = async () => {
    if (!uuid || !captionToDelete) return;
    try {
      await captionService.deleteCaption(uuid, captionToDelete.uuid);
      setCaptions((prev) => prev.filter((c) => c.uuid !== captionToDelete.uuid));
    } finally {
      setCaptionToDelete(null);
    }
  };

  const confirmDeleteProject = async () => {
    if (!uuid) return;
    setDeleting(true);
    try {
      await deleteProject(uuid);
      addToast({ type: 'success', message: 'Project deleted.' });
      navigate('/projects');
    } catch {
      setDeleting(false);
    }
  };

  if (loadError) {
    return (
      <ErrorState
        title={loadError.status === 404 ? 'Project not found' : loadError.status === 403 ? 'No access' : 'Could not load project'}
        message={loadError.message}
        onRetry={loadError.status === 404 || loadError.status === 403 ? undefined : load}
        action={<Link to="/projects" className="btn btn-secondary btn-sm">Back to projects</Link>}
      />
    );
  }
  if (!project || !isCurrent) return <LoadingState label="Loading project…" />;

  const lang = getLanguageLabel(project.language);
  const hasVideo = !!project.video_url;
  const visibleCaptions = showAll ? captions : captions.slice(0, VISIBLE_CAPTIONS);

  return (
    <div className="project-details-page">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} startIcon={<ArrowLeft size={16} aria-hidden="true" />}>
          Back to projects
        </Button>
      </div>

      {polling && (
        <section className="status-panel" aria-label="Processing status">
          <Progress label={status?.phase_label ?? 'Queued for processing…'} value={status?.progress_percentage} />
          <ProcessingSteps status={status?.status ?? project.status} />
          <PhaseTimer status={status?.status} phaseSeconds={status?.phase_seconds} durationSeconds={status?.duration} />
          <QueueStalledNotice queuedSeconds={status?.queued_seconds} />
        </section>
      )}

      {(project.status === 'failed' || project.status === 'draft' || captions.length === 0) && !polling && <AiKeyNotice compact />}

      {project.status === 'failed' && (
        <div className="status-failed-banner" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div style={{ flex: 1 }}>
            <strong>Processing failed.</strong> {project.processing_error ?? 'Please try again.'}
          </div>
          {hasVideo && (
            <Button size="sm" variant="primary" startIcon={<RefreshCw size={14} aria-hidden="true" />} onClick={() => setRegenOpen(true)}>
              Retry
            </Button>
          )}
        </div>
      )}

      <div className="project-header-card">
        <div className="project-title-col">
          <div className="project-title-row">
            <h1 className="project-title">{project.name}</h1>
            {statusBadge(project.status)}
            <Badge variant="blue">
              <span aria-hidden="true">{lang.flag}</span> {lang.label}
            </Badge>
          </div>
          <div className="project-meta-row">
            <span>Created {formatDate(project.created_at)}</span>
            {project.duration ? <span>Duration {formatDuration(project.duration)}</span> : null}
            <span>{captions.length} captions</span>
          </div>
        </div>

        <div className="project-actions-row">
          {hasVideo && (
            <Button variant="secondary" onClick={() => setRegenOpen(true)} disabled={polling || aiKeyMissing} startIcon={<Sparkles size={16} aria-hidden="true" />}>
              Regenerate captions
            </Button>
          )}
          <Button variant="primary" size="lg" onClick={() => navigate(`/projects/${project.uuid}/editor`)} disabled={polling} startIcon={<Sliders size={18} aria-hidden="true" />}>
            Open studio editor
          </Button>
        </div>
      </div>

      <div className="project-overview-grid">
        <div className="project-media-card">
          <div className="project-player-container">
            {hasVideo ? (
              <video src={project.video_url ?? undefined} controls preload="metadata" className="project-video-player" poster={project.thumbnail || undefined} />
            ) : (
              <div className="project-no-video">
                <FileVideo size={40} aria-hidden="true" />
                <span>No video uploaded yet</span>
              </div>
            )}
          </div>

          {!hasVideo && !polling && (
            <div className="project-upload-box">
              <input
                ref={fileInput}
                type="file"
                accept={VIDEO_UPLOAD.ACCEPT}
                className="sr-only"
                tabIndex={-1}
                aria-label="Choose a video to upload"
                onChange={(e) => e.target.files?.[0] && startUpload(e.target.files[0])}
              />
              {upload ? (
                <>
                  <Progress label="Uploading video" value={upload.percent} detail={`${upload.percent}% · ${formatFileSize(upload.loaded)} of ${formatFileSize(upload.total)}`} />
                  <Button variant="secondary" size="sm" onClick={() => uploadRef.current?.cancel()}>Cancel upload</Button>
                </>
              ) : (
                <Button variant="primary" disabled={aiKeyMissing} startIcon={<UploadCloud size={16} aria-hidden="true" />} onClick={() => fileInput.current?.click()}>
                  Upload a video
                </Button>
              )}
            </div>
          )}

          <dl className="project-specs-grid">
            <div className="project-spec-item">
              <dt className="spec-item-label">Duration</dt>
              <dd className="spec-item-val">{project.duration ? formatDuration(project.duration) : '—'}</dd>
            </div>
            <div className="project-spec-item">
              <dt className="spec-item-label">Resolution</dt>
              <dd className="spec-item-val">{project.width && hasVideo ? `${project.width} × ${project.height}` : '—'}</dd>
            </div>
            <div className="project-spec-item">
              <dt className="spec-item-label">Frame rate</dt>
              <dd className="spec-item-val">{project.fps && hasVideo ? `${project.fps} fps` : '—'}</dd>
            </div>
            <div className="project-spec-item">
              <dt className="spec-item-label">Language</dt>
              <dd className="spec-item-val">{lang.label}</dd>
            </div>
          </dl>

          {project.description && <p className="project-description">{project.description}</p>}

          <div className="project-danger-row">
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)} startIcon={<Trash2 size={16} aria-hidden="true" />}>
              Delete project
            </Button>
          </div>
        </div>

        <section className="project-captions-card" aria-labelledby="captions-heading">
          <div className="captions-card-header">
            <h2 id="captions-heading" className="captions-header-title">
              <Sparkles size={20} color="var(--brand-primary)" aria-hidden="true" />
              Captions ({captions.length})
            </h2>
            <Button variant="secondary" size="sm" onClick={() => loadCaptions(project.uuid)} isLoading={captionsLoading} startIcon={<RefreshCw size={14} aria-hidden="true" />}>
              Refresh
            </Button>
          </div>

          {captions.length === 0 ? (
            <EmptyState
              icon={<AlertCircle size={28} />}
              title={polling ? 'Captions are on their way' : 'No captions yet'}
              description={
                polling
                  ? 'They will appear here as soon as processing finishes.'
                  : hasVideo
                    ? 'Generate captions with AI, or add them by hand in the editor.'
                    : 'Upload a video to generate captions automatically.'
              }
              action={
                hasVideo && !polling ? (
                  <Button variant="primary" onClick={() => setRegenOpen(true)} startIcon={<Sparkles size={16} aria-hidden="true" />}>
                    Generate captions
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ol className="captions-list-scroll">
              {visibleCaptions.map((cap) => {
                const isEditing = editingUuid === cap.uuid;
                const words = cap.metadata?.words ?? [];
                return (
                  <li key={cap.uuid} className="caption-row-card">
                    <span className="caption-seq-badge" aria-hidden="true">#{cap.sequence}</span>
                    <div className="caption-content-col">
                      <div className="caption-row-head">
                        <span className="caption-time-pill">
                          <Clock size={12} aria-hidden="true" />
                          <span className="sr-only">From </span>{formatDuration(cap.start_time)}
                          <span aria-hidden="true"> → </span><span className="sr-only"> to </span>{formatDuration(cap.end_time)}
                        </span>
                        <div className="caption-row-actions">
                          {isEditing ? (
                            <>
                              <button type="button" className="icon-button icon-button-sm" onClick={() => saveCaptionText(cap)} aria-label="Save caption">
                                <Check size={16} aria-hidden="true" />
                              </button>
                              <button type="button" className="icon-button icon-button-sm" onClick={() => setEditingUuid(null)} aria-label="Cancel editing">
                                <X size={16} aria-hidden="true" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="icon-button icon-button-sm"
                                onClick={() => {
                                  setEditingUuid(cap.uuid);
                                  setEditingText(cap.text);
                                }}
                                aria-label={`Edit caption ${cap.sequence}`}
                              >
                                <Edit2 size={14} aria-hidden="true" />
                              </button>
                              <button type="button" className="icon-button icon-button-sm icon-button-danger" onClick={() => setCaptionToDelete(cap)} aria-label={`Delete caption ${cap.sequence}`}>
                                <Trash2 size={14} aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void saveCaptionText(cap);
                            if (e.key === 'Escape') setEditingUuid(null);
                          }}
                          className="input-field"
                          rows={2}
                          maxLength={2000}
                          aria-label={`Text of caption ${cap.sequence}`}
                          autoFocus
                        />
                      ) : (
                        <p className="caption-text-content" lang={cap.language === 'si' ? 'si' : undefined}>{cap.text}</p>
                      )}

                      {words.length > 0 && !isEditing && (
                        <div className="caption-words-wrap" aria-hidden="true">
                          {words.slice(0, 40).map((w, i) => (
                            <span key={i} className="caption-word-chip" title={`${w.start.toFixed(2)}s – ${w.end.toFixed(2)}s`}>
                              {w.word}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {captions.length > VISIBLE_CAPTIONS && !showAll && (
            <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
              Show all {captions.length} captions
            </Button>
          )}
        </section>
      </div>

      <Modal
        isOpen={regenOpen}
        onClose={() => setRegenOpen(false)}
        dismissible={!regenerating}
        title="Generate captions with AI"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRegenOpen(false)} disabled={regenerating}>Cancel</Button>
            <Button variant="primary" onClick={startRegenerate} isLoading={regenerating} startIcon={<Sparkles size={16} aria-hidden="true" />}>
              Generate
            </Button>
          </>
        }
      >
        <fieldset className="regen-fieldset">
          <legend className="form-label">Spoken language</legend>
          {([
            ['si', '🇱🇰', 'සිංහල (Sinhala)'],
            ['en', '🇺🇸', 'English'],
            ['auto', '🌐', 'Auto / mixed'],
          ] as const).map(([value, flag, label]) => (
            <label key={value} className={`regen-option ${targetLang === value ? 'regen-option-selected' : ''}`}>
              <input type="radio" name="regen-language" value={value} checked={targetLang === value} onChange={() => setTargetLang(value)} />
              <span aria-hidden="true">{flag}</span>
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        {captions.length > 0 && (
          <p className="regen-warning">
            <AlertCircle size={14} aria-hidden="true" /> This replaces the current {captions.length} captions, including your edits.
          </p>
        )}
        {usage && usage.caption_minutes.limit !== null && (
          <p className="regen-usage">
            Uses about {Math.ceil((project.duration ?? 0) / 60)} of your remaining {Math.max(0, usage.caption_minutes.limit - usage.caption_minutes.used)} caption minutes.
          </p>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!captionToDelete}
        title="Delete this caption?"
        message={<p lang={captionToDelete?.language === 'si' ? 'si' : undefined}>“{captionToDelete?.text}”</p>}
        confirmLabel="Delete caption"
        tone="danger"
        onConfirm={confirmDeleteCaption}
        onCancel={() => setCaptionToDelete(null)}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        title="Delete project?"
        message={
          <>
            <p><strong>{project.name}</strong> will be deleted.</p>
            <p>Its video, captions and exports are removed permanently. This cannot be undone.</p>
          </>
        }
        confirmLabel="Delete project"
        tone="danger"
        isLoading={deleting}
        onConfirm={confirmDeleteProject}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
};
