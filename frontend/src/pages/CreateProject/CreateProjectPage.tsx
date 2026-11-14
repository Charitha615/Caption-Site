import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileVideo, Sparkles, X, AlertCircle, ArrowRight, RefreshCw, Sliders, WifiOff } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';
import { useUsageStore } from '../../stores/usageStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useProjectStatus } from '../../hooks/useProjectStatus';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Progress } from '../../components/Progress/Progress';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { PhaseTimer, ProcessingSteps, QueueStalledNotice } from '../../features/projects/ProcessingSteps';
import { AiKeyNotice } from '../../features/account/AiKeyNotice';
import { useAiKeyMissing } from '../../stores/aiKeyStore';
import { ChunkedUpload, UploadCancelledError, type UploadProgress } from '../../services/uploadService';
import { captionService } from '../../services/captionService';
import { toAppError } from '../../services/errors';
import { VIDEO_UPLOAD } from '../../config/constants';
import type { Project } from '../../types/project';
import { formatDuration, formatFileSize } from '../../utils/formatters';
import { validateVideoFile } from '../../utils/video';
import './CreateProjectPage.css';

type Stage = 'setup' | 'uploading' | 'upload-error' | 'processing' | 'ready' | 'failed';
type Language = 'si' | 'en' | 'auto';

const LANGUAGES: Array<{ value: Language; flag: string; title: string; sub: string }> = [
  { value: 'si', flag: '🇱🇰', title: 'සිංහල (Sinhala)', sub: 'Sinhala speech' },
  { value: 'en', flag: '🇺🇸', title: 'English', sub: 'English speech' },
  { value: 'auto', flag: '🌐', title: 'Auto / mixed', sub: 'Sinhala + English' },
];

const formatEta = (s: number | null) => (s === null ? 'estimating…' : s < 60 ? `${s}s left` : `${Math.ceil(s / 60)} min left`);

export const CreateProjectPage: React.FC = () => {
  useDocumentTitle('New project');
  const navigate = useNavigate();
  const createProject = useProjectStore((s) => s.createProject);
  const addToast = useToastStore((s) => s.addToast);
  const usage = useUsageStore((s) => s.usage);
  const reloadUsage = useUsageStore((s) => s.load);
  const maxMb = usage?.max_upload_mb ?? VIDEO_UPLOAD.DEFAULT_MAX_MB;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const defaultLanguage = useSettingsStore((st) => st.settings?.default_language);
  const [language, setLanguage] = useState<Language>(defaultLanguage ?? 'si');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const aiKeyMissing = useAiKeyMissing();
  const [stage, setStage] = useState<Stage>('setup');
  const [project, setProject] = useState<Project | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<ChunkedUpload | null>(null);

  const { status, restart } = useProjectStatus(project?.uuid, stage === 'processing', (settled) => {
    if (settled.is_ready) {
      setStage('ready');
      void reloadUsage(true).catch(() => undefined);
      addToast({ type: 'success', title: 'Captions ready', message: `${settled.captions_count} caption lines were generated.` });
    } else if (settled.is_failed) {
      setStage('failed');
      setErrorMessage(settled.error ?? 'Processing failed. Please try again.');
    }
  });

  // Warn before closing the tab mid-upload; abort the upload if the page unmounts.
  useEffect(() => {
    if (stage !== 'uploading') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [stage]);
  useEffect(() => () => uploadRef.current?.abortLocally(), []);

  const selectFile = (selected: File) => {
    const problem = validateVideoFile(selected, maxMb);
    setFileError(problem);
    if (problem) return;
    setFile(selected);
    if (!name.trim()) setName(selected.name.replace(/\.[^/.]+$/, ''));
  };

  const runUpload = async (target: Project, video: File) => {
    setStage('uploading');
    setErrorMessage(null);
    const upload = new ChunkedUpload(target.uuid, video, language, setProgress);
    uploadRef.current = upload;
    try {
      await upload.start();
      setStage('processing');
      restart();
    } catch (err) {
      if (err instanceof UploadCancelledError) return;
      const appErr = toAppError(err, 'The upload failed.');
      setErrorMessage(appErr.message);
      setStage('upload-error');
    } finally {
      uploadRef.current = null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim()) return;
    setIsSubmitting(true);
    try {
      const created = project ?? (await createProject({ name: name.trim(), description: description.trim() || undefined, language }));
      setProject(created);
      await runUpload(created, file);
    } catch (err) {
      addToast({ type: 'error', title: 'Could not create project', message: toAppError(err).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelUpload = async () => {
    setConfirmCancel(false);
    await uploadRef.current?.cancel();
    setProgress(null);
    setStage('setup');
    addToast({ type: 'info', message: 'Upload cancelled.' });
  };

  const retryProcessing = async () => {
    if (!project) return;
    try {
      await captionService.generateCaptions(project.uuid, language);
      setErrorMessage(null);
      setStage('processing');
      restart();
    } catch {
      /* the API client already showed why (e.g. plan limit) */
    }
  };

  const heading: Record<Stage, [string, string]> = {
    setup: ['Create a project', 'Upload a video and we’ll generate Sinhala or English captions you can edit in the studio.'],
    uploading: ['Uploading video', 'Keep this tab open. If your connection drops, the upload resumes where it stopped.'],
    'upload-error': ['Upload interrupted', 'Nothing is lost — resume to send only the remaining parts.'],
    processing: ['Generating captions', 'This usually takes a minute or two. You can leave this page — we’ll keep working.'],
    ready: ['Captions ready', 'Open the studio to review, style and export.'],
    failed: ['Processing failed', 'Your video is uploaded. You can retry caption generation.'],
  };

  return (
    <div className="create-project-layout">
      <div>
        <h2 className="page-heading">{heading[stage][0]}</h2>
        <p className="page-subheading">{heading[stage][1]}</p>
      </div>

      {(stage === 'setup' || stage === 'failed') && <AiKeyNotice />}

      {stage === 'setup' && (
        <form onSubmit={handleSubmit} className="create-form-card" noValidate>
          <div>
            <span className="form-label" id="video-label">
              Video file <span aria-hidden="true" style={{ color: 'var(--brand-accent)' }}>*</span>
            </span>
            <input
              id="video-file-input"
              data-testid="video-file-input"
              aria-labelledby="video-label"
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && selectFile(e.target.files[0])}
              accept={VIDEO_UPLOAD.ACCEPT}
              className="sr-only"
              tabIndex={-1}
            />

            {!file ? (
              <div
                className={`upload-dropzone ${isDragOver ? 'upload-dropzone-active' : ''}`}
                role="button"
                tabIndex={0}
                aria-describedby={fileError ? 'video-error' : 'video-hint'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files?.[0]) selectFile(e.dataTransfer.files[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="upload-icon-circle" aria-hidden="true">
                  <UploadCloud size={28} />
                </div>
                <h3 className="upload-title">Drag &amp; drop your video, or browse</h3>
                <p className="upload-subtitle" id="video-hint">MP4, MOV, WEBM, MKV or AVI · up to {maxMb} MB</p>
                <span className="btn btn-primary btn-sm" aria-hidden="true" style={{ marginTop: 12 }}>
                  Choose video
                </span>
              </div>
            ) : (
              <div className="upload-file-preview">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <FileVideo size={24} aria-hidden="true" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                    <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>{formatFileSize(file.size)}</div>
                  </div>
                </div>
                <button type="button" className="icon-button" onClick={() => setFile(null)} aria-label={`Remove ${file.name}`}>
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            )}

            {fileError && (
              <p id="video-error" className="field-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" /> {fileError}
              </p>
            )}
          </div>

          <Input
            label="Project title"
            placeholder="e.g. සිංහල ට්‍රැවල් ව්ලොග් #1"
            value={name}
            maxLength={255}
            onChange={(e) => setName(e.target.value)}
            required
            helperText="Sinhala and English titles are supported."
          />

          <fieldset className="lang-fieldset">
            <legend className="form-label">Spoken language</legend>
            <div className="lang-selector-grid" role="radiogroup">
              {LANGUAGES.map((opt) => (
                <label key={opt.value} className={`lang-option-card ${language === opt.value ? 'lang-option-card-selected' : ''}`}>
                  <input
                    type="radio"
                    name="language"
                    value={opt.value}
                    checked={language === opt.value}
                    onChange={() => setLanguage(opt.value)}
                    className="sr-only"
                  />
                  <span className="lang-option-flag" aria-hidden="true">{opt.flag}</span>
                  <span className="lang-option-text">
                    <span className="lang-option-title">{opt.title}</span>
                    <span className="lang-option-sub">{opt.sub}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="input-group">
            <label className="input-label" htmlFor="project-description">Description (optional)</label>
            <textarea
              id="project-description"
              className="input-field"
              rows={2}
              maxLength={1000}
              placeholder="Notes about the content or speakers…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={() => navigate('/projects')}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="lg" disabled={!file || !name.trim() || aiKeyMissing} isLoading={isSubmitting} startIcon={<Sparkles size={18} aria-hidden="true" />}>
              Upload &amp; generate captions
            </Button>
          </div>
        </form>
      )}

      {(stage === 'uploading' || stage === 'upload-error') && file && (
        <div className="processing-card">
          <Progress
            label={file.name}
            value={progress?.percent ?? 0}
            tone={stage === 'upload-error' ? 'danger' : 'primary'}
            detail={
              progress
                ? `${progress.percent}% · ${formatFileSize(progress.loaded)} of ${formatFileSize(progress.total)}${
                    stage === 'uploading' && progress.speed > 0 ? ` · ${formatFileSize(progress.speed)}/s · ${formatEta(progress.eta)}` : ''
                  }`
                : 'Preparing…'
            }
          />

          <div aria-live="polite" className="upload-status-line">
            {stage === 'uploading' && progress?.waitingForNetwork && (
              <span className="upload-status-warn"><WifiOff size={15} aria-hidden="true" /> Connection lost — waiting to resume…</span>
            )}
            {stage === 'uploading' && !progress?.waitingForNetwork && (progress?.retrying ?? 0) > 0 && (
              <span className="upload-status-warn"><RefreshCw size={15} aria-hidden="true" /> Retrying a part of the file (attempt {progress?.retrying})…</span>
            )}
            {stage === 'upload-error' && errorMessage && <span className="form-alert" role="alert">{errorMessage}</span>}
          </div>

          <div className="form-actions">
            {stage === 'uploading' ? (
              <Button variant="secondary" onClick={() => setConfirmCancel(true)}>Cancel upload</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setStage('setup')}>Back</Button>
                <Button variant="primary" startIcon={<RefreshCw size={16} aria-hidden="true" />} onClick={() => project && runUpload(project, file)}>
                  Resume upload
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {stage === 'processing' && (
        <div className="processing-card">
          <Progress label={status?.phase_label ?? 'Queued for processing…'} value={status?.progress_percentage} />
          <ProcessingSteps status={status?.status ?? 'uploaded'} />
          <PhaseTimer status={status?.status} phaseSeconds={status?.phase_seconds} durationSeconds={status?.duration} />
          <QueueStalledNotice queuedSeconds={status?.queued_seconds} notice={status?.notice} />
          <div className="form-actions">
            <Button variant="secondary" onClick={() => project && navigate(`/projects/${project.uuid}`)}>
              Continue in the background
            </Button>
          </div>
        </div>
      )}

      {stage === 'failed' && (
        <div className="processing-card processing-card-error">
          <div className="form-alert" role="alert">{errorMessage}</div>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => project && navigate(`/projects/${project.uuid}`)}>Go to project</Button>
            <Button variant="primary" startIcon={<RefreshCw size={16} aria-hidden="true" />} onClick={retryProcessing}>
              Retry caption generation
            </Button>
          </div>
        </div>
      )}

      {stage === 'ready' && project && (
        <div className="ready-success-box">
          <div className="ready-preview-grid">
            <div className="ready-thumbnail-container">
              {status?.thumbnail ? (
                <img src={status.thumbnail} alt="" className="ready-thumbnail-img" />
              ) : (
                <div className="ready-thumbnail-fallback" aria-hidden="true"><FileVideo size={48} /></div>
              )}
              {status?.duration ? <div className="ready-duration-badge">{formatDuration(status.duration)}</div> : null}
            </div>
            <div className="ready-info-col">
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{project.name}</h3>
              <div className="ready-stats-row">
                <div className="ready-stat-chip">
                  <span className="ready-stat-label">Captions</span>
                  <span className="ready-stat-value">{status?.captions_count ?? 0} lines</span>
                </div>
                <div className="ready-stat-chip">
                  <span className="ready-stat-label">Language</span>
                  <span className="ready-stat-value">{LANGUAGES.find((l) => l.value === (status?.language ?? language))?.title}</span>
                </div>
                {status?.width ? (
                  <div className="ready-stat-chip">
                    <span className="ready-stat-label">Resolution</span>
                    <span className="ready-stat-value">{status.width}×{status.height}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="form-actions" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
            <Button variant="secondary" onClick={() => navigate(`/projects/${project.uuid}`)} startIcon={<Sliders size={18} aria-hidden="true" />}>
              Project details
            </Button>
            <Button variant="primary" size="lg" onClick={() => navigate(`/projects/${project.uuid}/editor`)} endIcon={<ArrowRight size={18} aria-hidden="true" />}>
              Open studio editor
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmCancel}
        title="Cancel this upload?"
        message="The parts already sent will be discarded. You can start again at any time."
        confirmLabel="Cancel upload"
        cancelLabel="Keep uploading"
        tone="danger"
        onConfirm={cancelUpload}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
};
