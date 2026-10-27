import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileVideo,
  Sparkles,
  X,
  Check,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import type { ProjectStatusResponse, Project } from '../../types/project';
import { formatDuration } from '../../utils/formatters';
import './CreateProjectPage.css';

type WizardStage = 'setup' | 'uploading' | 'processing' | 'ready' | 'error';

export const CreateProjectPage: React.FC = () => {
  useDocumentTitle('Create Project — Video & Captions');
  const navigate = useNavigate();

  const { createProject, uploadVideo, checkStatus } = useProjectStore();
  const { addToast } = useToastStore();

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState<'si' | 'en' | 'auto'>('si');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Flow State
  const [stage, setStage] = useState<WizardStage>('setup');
  const [uploadPercent, setUploadPercent] = useState(0);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [statusData, setStatusData] = useState<ProjectStatusResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingTimerRef = useRef<number | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        window.clearTimeout(pollingTimerRef.current);
      }
    };
  }, []);

  const validateVideoFile = (file: File): boolean => {
    setValidationError(null);
    const validExtensions = ['mp4', 'mov', 'webm', 'avi', 'mkv'];
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

    if (!validExtensions.includes(fileExt)) {
      setValidationError(`Unsupported format (.${fileExt}). Please select MP4, MOV, WebM, AVI, or MKV.`);
      return false;
    }

    const maxSizeInBytes = 500 * 1024 * 1024; // 500 MB
    if (file.size > maxSizeInBytes) {
      setValidationError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 500MB.`);
      return false;
    }

    return true;
  };

  const handleFileSelection = (file: File) => {
    if (validateVideoFile(file)) {
      setSelectedFile(file);
      if (!name.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        setName(cleanName);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  // Poll project status until ready or failed
  const startStatusPolling = (projectUuid: string) => {
    const poll = async () => {
      try {
        const res = await checkStatus(projectUuid);
        setStatusData(res);

        if (res.is_ready) {
          setStage('ready');
          addToast({
            type: 'success',
            title: 'Captions Ready!',
            message: `Generated ${res.captions_count} timed captions. You can now open the project in the editor.`,
          });
          return;
        }

        if (res.is_failed) {
          setStage('error');
          addToast({
            type: 'error',
            title: 'Processing Failed',
            message: 'Video processing failed. Please retry.',
          });
          return;
        }

        // Continue polling every 1.5 seconds while still processing
        pollingTimerRef.current = window.setTimeout(poll, 1500);
      } catch (err) {
        console.error('Status check error:', err);
        pollingTimerRef.current = window.setTimeout(poll, 2500);
      }
    };

    poll();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      addToast({
        type: 'warning',
        title: 'Title Required',
        message: 'Please provide a title for your video project.',
      });
      return;
    }

    if (!selectedFile) {
      addToast({
        type: 'warning',
        title: 'Video Required',
        message: 'Please select or drop a video file to upload.',
      });
      return;
    }

    try {
      // Step 1: Create project record
      const project = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        language,
        settings: {
          language,
          caption_style: 'default',
        },
      });

      setActiveProject(project);

      // Step 2: Upload video with progress
      setStage('uploading');
      setUploadPercent(0);

      await uploadVideo(project.uuid, selectedFile, language, (percent) => {
        setUploadPercent(percent);
      });

      // Step 3: Transition to processing stage and start polling status
      setStage('processing');
      startStatusPolling(project.uuid);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setStage('setup');
      const errorMsg = err?.response?.data?.message || 'Failed to upload video. Please check your connection and try again.';
      addToast({
        type: 'error',
        title: 'Upload Failed',
        message: errorMsg,
      });
    }
  };

  const retryProcessing = async () => {
    if (!activeProject) return;
    try {
      setStage('processing');
      startStatusPolling(activeProject.uuid);
    } catch {
      setStage('error');
    }
  };

  return (
    <div className="create-project-layout">
      <div>
        <h2 style={{ fontSize: '1.65rem', fontWeight: 700, marginBottom: '6px' }}>
          {stage === 'ready' ? 'Captions Ready!' : stage === 'processing' ? 'Processing Video & Captions' : 'Create & Upload Video'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem' }}>
          {stage === 'ready'
            ? 'Your AI-powered captions and audio transcription have been generated successfully.'
            : stage === 'processing'
            ? 'Our speech pipeline is extracting audio, analyzing timestamps, and formatting captions.'
            : 'Upload a video to extract speech, generate accurate Sinhala or English captions, and edit in the studio.'}
        </p>
      </div>

      {/* STAGE 1: SETUP & UPLOAD */}
      {stage === 'setup' && (
        <form onSubmit={handleSubmit} className="create-form-card">
          {/* Upload Dropzone */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>
              Video File <span style={{ color: 'var(--brand-accent)' }}>*</span>
            </label>

            <input
              id="video-file-input"
              data-testid="video-file-input"
              aria-label="Upload video file"
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska,.mkv,.avi,.mov,.mp4,.webm"
              style={{ display: 'none' }}
            />

            {!selectedFile ? (
              <div
                className={`upload-dropzone ${isDragOver ? 'upload-dropzone-active' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="upload-icon-circle">
                  <UploadCloud size={28} />
                </div>
                <h4 className="upload-title">Drag & drop your video here, or browse</h4>
                <p className="upload-subtitle">
                  High-definition video processing supported up to 500MB
                </p>
                <button
                  type="button"
                  style={{
                    marginTop: '12px',
                    padding: '8px 18px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--brand-primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Browse Video Files
                </button>
                <div className="upload-badge-row">
                  <span className="upload-badge-tag">MP4</span>
                  <span className="upload-badge-tag">MOV</span>
                  <span className="upload-badge-tag">WEBM</span>
                  <span className="upload-badge-tag">AVI</span>
                  <span className="upload-badge-tag">MKV</span>
                </div>
              </div>
            ) : (
              <div className="upload-file-preview">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FileVideo size={24} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{selectedFile.name}</div>
                    <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>
                      {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • {selectedFile.type || 'Video'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  style={{
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '50%',
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                  }}
                  aria-label="Remove selected file"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {validationError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '0.825rem', marginTop: '8px' }}>
                <AlertCircle size={16} />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          {/* Project Title */}
          <Input
            label="Project Title"
            placeholder="e.g. සිංහල ට්‍රැවල් ව්ලොග් #1 or AI Tech Review"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            helperText="Unicode Sinhala and English characters are fully supported."
          />

          {/* Target Language Selection */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>
              Spoken Audio Language
            </label>
            <div className="lang-selector-grid">
              <div
                className={`lang-option-card ${language === 'si' ? 'lang-option-card-selected' : ''}`}
                onClick={() => setLanguage('si')}
              >
                <span className="lang-option-flag">🇱🇰</span>
                <div className="lang-option-text">
                  <span className="lang-option-title">සිංහල (Sinhala)</span>
                  <span className="lang-option-sub">Sinhala Speech & Transcripts</span>
                </div>
                {language === 'si' && <Check size={18} style={{ marginLeft: 'auto', color: 'var(--brand-primary)' }} />}
              </div>

              <div
                className={`lang-option-card ${language === 'en' ? 'lang-option-card-selected' : ''}`}
                onClick={() => setLanguage('en')}
              >
                <span className="lang-option-flag">🇺🇸</span>
                <div className="lang-option-text">
                  <span className="lang-option-title">English</span>
                  <span className="lang-option-sub">Standard English recognition</span>
                </div>
                {language === 'en' && <Check size={18} style={{ marginLeft: 'auto', color: 'var(--brand-primary)' }} />}
              </div>

              <div
                className={`lang-option-card ${language === 'auto' ? 'lang-option-card-selected' : ''}`}
                onClick={() => setLanguage('auto')}
              >
                <span className="lang-option-flag">🌐</span>
                <div className="lang-option-text">
                  <span className="lang-option-title">Auto / Mixed</span>
                  <span className="lang-option-sub">Bilingual Singlish speech</span>
                </div>
                {language === 'auto' && <Check size={18} style={{ marginLeft: 'auto', color: 'var(--brand-primary)' }} />}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="input-group">
            <label className="input-label">Description (Optional)</label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="Add notes about content, context or speech speakers..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Submit Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/projects')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={!selectedFile || !name.trim()}
              startIcon={<Sparkles size={18} />}
            >
              Create & Upload Video
            </Button>
          </div>
        </form>
      )}

      {/* STAGE 2: UPLOADING */}
      {stage === 'uploading' && (
        <div className="processing-card">
          <div className="processing-hero">
            <div className="processing-pulsing-badge">
              <span className="pulsing-dot" />
              <span>Uploading Video...</span>
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>
              Transferring media to secure storage
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '480px' }}>
              Please keep this tab open while your file is securely uploaded and registered.
            </p>
          </div>

          <div className="upload-progress-container" style={{ maxWidth: '620px', margin: '0 auto', width: '100%' }}>
            <div className="upload-progress-header">
              <span>{selectedFile?.name || 'video_media.mp4'}</span>
              <span>{uploadPercent}%</span>
            </div>
            <div className="upload-progress-bar-bg">
              <div
                className="upload-progress-bar-fill"
                style={{ width: `${uploadPercent}%` }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>{(selectedFile ? (selectedFile.size / (1024 * 1024)).toFixed(1) : '0')} MB Total</span>
              <span>{uploadPercent === 100 ? 'Finalizing upload...' : 'Sending bytes...'}</span>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 3: REAL-TIME PROCESSING STEPPER */}
      {stage === 'processing' && (
        <div className="processing-card">
          <div className="processing-hero">
            <div className="processing-pulsing-badge">
              <span className="pulsing-dot" />
              <span>{statusData?.phase_label || 'Analyzing video and extracting audio...'}</span>
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>
              AI Caption Generation in Progress
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '520px' }}>
              Our background pipeline is processing speech streams, generating word alignments, and preparing your studio timeline.
            </p>
          </div>

          {/* Stepper Steps */}
          <div className="stepper-list">
            {/* Step 1: Upload */}
            <div className="stepper-item stepper-item-completed">
              <div className="stepper-icon-box stepper-icon-completed">
                <Check size={18} />
              </div>
              <div className="stepper-content">
                <div className="stepper-title">Video Uploaded</div>
                <div className="stepper-desc">File validated and stored securely</div>
              </div>
            </div>

            {/* Step 2: Metadata */}
            <div className={`stepper-item ${['extracting_audio', 'transcribing', 'generating_captions', 'ready'].includes(statusData?.status || '') ? 'stepper-item-completed' : ''}`}>
              <div className={`stepper-icon-box ${['extracting_audio', 'transcribing', 'generating_captions', 'ready'].includes(statusData?.status || '') ? 'stepper-icon-completed' : statusData?.status === 'processing' ? 'stepper-icon-active' : 'stepper-icon-pending'}`}>
                {['extracting_audio', 'transcribing', 'generating_captions', 'ready'].includes(statusData?.status || '') ? <Check size={18} /> : '2'}
              </div>
              <div className="stepper-content">
                <div className="stepper-title">Analyze Video & Extract Metadata</div>
                <div className="stepper-desc">
                  {statusData?.width && statusData?.height
                    ? `${statusData.width}x${statusData.height} @ ${statusData.fps || 30}fps (${formatDuration(statusData.duration || 0)})`
                    : 'Extracting resolution, duration, and frame rate via FFprobe'}
                </div>
              </div>
            </div>

            {/* Step 3: Audio Extraction */}
            <div className={`stepper-item ${['transcribing', 'generating_captions', 'ready'].includes(statusData?.status || '') ? 'stepper-item-completed' : ''}`}>
              <div className={`stepper-icon-box ${['transcribing', 'generating_captions', 'ready'].includes(statusData?.status || '') ? 'stepper-icon-completed' : statusData?.status === 'extracting_audio' ? 'stepper-icon-active' : 'stepper-icon-pending'}`}>
                {['transcribing', 'generating_captions', 'ready'].includes(statusData?.status || '') ? <Check size={18} /> : '3'}
              </div>
              <div className="stepper-content">
                <div className="stepper-title">Extract Audio Stream</div>
                <div className="stepper-desc">16kHz speech-optimized audio extraction via FFmpeg</div>
              </div>
            </div>

            {/* Step 4: AI Transcription */}
            <div className={`stepper-item ${['generating_captions', 'ready'].includes(statusData?.status || '') ? 'stepper-item-completed' : ''}`}>
              <div className={`stepper-icon-box ${['generating_captions', 'ready'].includes(statusData?.status || '') ? 'stepper-icon-completed' : statusData?.status === 'transcribing' ? 'stepper-icon-active' : 'stepper-icon-pending'}`}>
                {['generating_captions', 'ready'].includes(statusData?.status || '') ? <Check size={18} /> : '4'}
              </div>
              <div className="stepper-content">
                <div className="stepper-title">AI Speech Transcription (Gemini)</div>
                <div className="stepper-desc">Translating audio waves into {language === 'si' ? 'Sinhala Unicode' : 'English'} text</div>
              </div>
            </div>

            {/* Step 5: Caption Timings */}
            <div className="stepper-item">
              <div className={`stepper-icon-box ${statusData?.status === 'generating_captions' ? 'stepper-icon-active' : 'stepper-icon-pending'}`}>
                {statusData?.status === 'ready' ? <Check size={18} /> : '5'}
              </div>
              <div className="stepper-content">
                <div className="stepper-title">Generate Timed Captions & Word Alignments</div>
                <div className="stepper-desc">Computing subtitle chunks, start/end timestamps, and karaoke cues</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 4: READY STATE */}
      {stage === 'ready' && (
        <div className="ready-success-box">
          <div className="ready-preview-grid">
            <div className="ready-thumbnail-container">
              {statusData?.thumbnail ? (
                <img
                  src={statusData.thumbnail}
                  alt={activeProject?.name || 'Project thumbnail'}
                  className="ready-thumbnail-img"
                  onError={(e) => {
                    // Fallback to placeholder on image error
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="170" viewBox="0 0 300 170"><rect width="300" height="170" fill="%231e293b"/><text x="50%" y="50%" fill="%2394a3b8" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14">Thumbnail Ready</text></svg>';
                  }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                  <FileVideo size={48} />
                </div>
              )}
              {statusData?.duration && (
                <div className="ready-duration-badge">
                  <Clock size={12} />
                  <span>{formatDuration(statusData.duration)}</span>
                </div>
              )}
            </div>

            <div className="ready-info-col">
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Generation Complete
              </span>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0 }}>
                {activeProject?.name}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                Video analysis, audio separation, and speech captioning completed with full word-level timings.
              </p>

              <div className="ready-stats-row">
                <div className="ready-stat-chip">
                  <span className="ready-stat-label">Captions</span>
                  <span className="ready-stat-value">{statusData?.captions_count || 0} lines</span>
                </div>
                <div className="ready-stat-chip">
                  <span className="ready-stat-label">Language</span>
                  <span className="ready-stat-value">{language === 'si' ? '🇱🇰 Sinhala' : '🇺🇸 English'}</span>
                </div>
                <div className="ready-stat-chip">
                  <span className="ready-stat-label">Resolution</span>
                  <span className="ready-stat-value">
                    {statusData?.width ? `${statusData.width}x${statusData.height}` : '1080p'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <Button
              variant="secondary"
              onClick={() => navigate(`/projects/${activeProject?.uuid}`)}
              startIcon={<Sliders size={18} />}
            >
              Project Details
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate(`/projects/${activeProject?.uuid}/editor`)}
              endIcon={<ArrowRight size={18} />}
            >
              Open Studio Editor
            </Button>
          </div>
        </div>
      )}

      {/* STAGE 5: ERROR STATE */}
      {stage === 'error' && (
        <div className="processing-card" style={{ borderColor: '#ef4444' }}>
          <div className="processing-hero">
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={30} />
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#b91c1c' }}>
              Video Processing Could Not Complete
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '520px' }}>
              We encountered an issue while extracting or transcribing your video file. You can retry generating captions, or navigate to project details.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
            <Button
              variant="secondary"
              onClick={() => navigate(`/projects/${activeProject?.uuid || ''}`)}
            >
              Go to Project
            </Button>
            <Button
              variant="primary"
              onClick={retryProcessing}
              startIcon={<RefreshCw size={18} />}
            >
              Retry Caption Generation
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
