import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sliders,
  Sparkles,
  Clock,
  FileVideo,
  RotateCw,
  Trash2,
  Edit2,
  Check,
  X,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { captionService } from '../../services/captionService';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import { Modal } from '../../components/Modal/Modal';
import type { Caption, ProjectStatusResponse } from '../../types/project';
import { formatDuration, formatDate, getLanguageLabel } from '../../utils/formatters';
import './ProjectDetailsPage.css';

export const ProjectDetailsPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();

  const { currentProject, loadProject, checkStatus, deleteProject } = useProjectStore();
  const { addToast } = useToastStore();

  const [captions, setCaptions] = useState<Caption[]>([]);
  const [isLoadingCaptions, setIsLoadingCaptions] = useState(false);
  const [statusData, setStatusData] = useState<ProjectStatusResponse | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [targetLang, setTargetLang] = useState<'si' | 'en' | 'auto'>('si');
  const [editingCaptionUuid, setEditingCaptionUuid] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const pollingRef = useRef<number | null>(null);

  useDocumentTitle(
    currentProject?.name ? `${currentProject.name} — Project Details` : 'Project Details'
  );

  const loadCaptionsData = async (projectUuid: string) => {
    setIsLoadingCaptions(true);
    try {
      const res = await captionService.getCaptions(projectUuid);
      setCaptions(res.captions || []);
    } catch (err) {
      console.warn('Failed to fetch captions:', err);
    } finally {
      setIsLoadingCaptions(false);
    }
  };

  useEffect(() => {
    if (!uuid) return;

    loadProject(uuid)
      .then((proj) => {
        setTargetLang((proj.language as any) || 'si');
        loadCaptionsData(uuid);
      })
      .catch((err) => {
        console.error('Project load error:', err);
      });

    // Check status
    checkStatus(uuid)
      .then((status) => {
        setStatusData(status);
        if (status.is_processing) {
          startStatusPolling(uuid);
        }
      })
      .catch(console.error);

    return () => {
      if (pollingRef.current) {
        window.clearTimeout(pollingRef.current);
      }
    };
  }, [uuid, loadProject, checkStatus]);

  const startStatusPolling = (projectUuid: string) => {
    const poll = async () => {
      try {
        const res = await checkStatus(projectUuid);
        setStatusData(res);

        if (res.is_ready || res.is_failed) {
          loadCaptionsData(projectUuid);
          loadProject(projectUuid);
          return;
        }

        pollingRef.current = window.setTimeout(poll, 2000);
      } catch {
        pollingRef.current = window.setTimeout(poll, 3000);
      }
    };

    poll();
  };

  const handleStartRegenerate = async () => {
    if (!uuid) return;
    setIsRegenerating(true);
    setShowRegenerateModal(false);

    try {
      await captionService.generateCaptions(uuid, targetLang);
      addToast({
        type: 'info',
        title: 'Caption Generation Started',
        message: 'Speech recognition pipeline started with Gemini.',
      });

      startStatusPolling(uuid);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Generation Failed',
        message: err?.response?.data?.message || 'Failed to start AI caption generation.',
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSaveCaptionText = async (caption: Caption) => {
    if (!uuid || !editingText.trim()) return;

    try {
      const updated = await captionService.updateCaption(uuid, caption.uuid, {
        text: editingText.trim(),
      });
      setCaptions((prev) =>
        prev.map((c) => (c.uuid === caption.uuid ? { ...c, text: updated.text } : c))
      );
      setEditingCaptionUuid(null);
      addToast({
        type: 'success',
        title: 'Caption Saved',
        message: 'Text updated successfully.',
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: 'Could not update caption text.',
      });
    }
  };

  const handleDeleteCaption = async (captionUuid: string) => {
    if (!uuid) return;
    try {
      await captionService.deleteCaption(uuid, captionUuid);
      setCaptions((prev) => prev.filter((c) => c.uuid !== captionUuid));
      addToast({
        type: 'info',
        title: 'Caption Removed',
        message: 'Caption segment deleted.',
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Could not delete caption.',
      });
    }
  };

  const handleDeleteProject = async () => {
    if (!uuid) return;
    setIsDeleting(true);
    try {
      await deleteProject(uuid);
      addToast({
        type: 'success',
        title: 'Project Deleted',
        message: 'Project and all media were deleted.',
      });
      navigate('/projects');
    } catch {
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete project.',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (!currentProject) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading project details...
      </div>
    );
  }

  const langInfo = getLanguageLabel(currentProject.language);

  return (
    <div className="project-details-page">
      {/* Back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/projects')}
          startIcon={<ArrowLeft size={16} />}
        >
          Back to Projects
        </Button>
      </div>

      {/* Processing Live Status Banner */}
      {statusData?.is_processing && (
        <div className="status-alert-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <RotateCw size={20} className="spin-animation" />
            <div>
              <div style={{ fontWeight: 700 }}>{statusData.phase_label}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                Status: {statusData.status} • Progress: {statusData.progress_percentage}%
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.85rem' }}>Auto-updating...</div>
        </div>
      )}

      {/* Header Card */}
      <div className="project-header-card">
        <div className="project-title-col">
          <div className="project-title-row">
            <h1 className="project-title">{currentProject.name}</h1>
            <Badge variant={currentProject.status === 'ready' || currentProject.status === 'completed' ? 'green' : currentProject.status === 'failed' ? 'red' : 'purple'} hasDot>
              {currentProject.status.toUpperCase()}
            </Badge>
            <Badge variant="blue">{langInfo.flag} {langInfo.label}</Badge>
          </div>
          <div className="project-meta-row">
            <span>Created {formatDate(currentProject.created_at)}</span>
            {currentProject.duration && (
              <span>Duration: {formatDuration(currentProject.duration)}</span>
            )}
            <span>{captions.length} Captions Generated</span>
          </div>
        </div>

        <div className="project-actions-row">
          <Button
            variant="secondary"
            onClick={() => setShowRegenerateModal(true)}
            startIcon={<Sparkles size={16} />}
          >
            Re-generate Captions
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate(`/projects/${currentProject.uuid}/editor`)}
            startIcon={<Sliders size={18} />}
          >
            Open in Studio Editor
          </Button>
        </div>
      </div>

      {/* Main Grid: Left Media & Specs, Right Captions List */}
      <div className="project-overview-grid">
        {/* Left Column: Media & Specs */}
        <div className="project-media-card">
          <div className="project-player-container">
            {currentProject.video_url ? (
              <video
                src={currentProject.video_url}
                controls
                className="project-video-player"
                poster={currentProject.thumbnail || undefined}
              />
            ) : currentProject.thumbnail ? (
              <img
                src={currentProject.thumbnail}
                alt={currentProject.name}
                className="project-thumbnail-img"
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                <FileVideo size={48} />
                <span style={{ fontSize: '0.85rem' }}>Video Preview</span>
              </div>
            )}
          </div>

          <div className="project-specs-grid">
            <div className="project-spec-item">
              <span className="spec-item-label">Duration</span>
              <span className="spec-item-val">{formatDuration(currentProject.duration || 0)}</span>
            </div>
            <div className="project-spec-item">
              <span className="spec-item-label">Resolution</span>
              <span className="spec-item-val">{currentProject.width ? `${currentProject.width} x ${currentProject.height}` : '1920 x 1080'}</span>
            </div>
            <div className="project-spec-item">
              <span className="spec-item-label">Frame Rate</span>
              <span className="spec-item-val">{currentProject.fps ? `${currentProject.fps} fps` : '30 fps'}</span>
            </div>
            <div className="project-spec-item">
              <span className="spec-item-label">Language</span>
              <span className="spec-item-val">{langInfo.flag} {langInfo.label}</span>
            </div>
          </div>

          {currentProject.description && (
            <div style={{ marginTop: '8px', padding: '12px 14px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.875rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>DESCRIPTION</div>
              <div>{currentProject.description}</div>
            </div>
          )}

          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              startIcon={<Trash2 size={16} />}
            >
              Delete Project
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/projects/${currentProject.uuid}/editor`)}
              endIcon={<ExternalLink size={14} />}
            >
              Editor View
            </Button>
          </div>
        </div>

        {/* Right Column: Captions List */}
        <div className="project-captions-card">
          <div className="captions-card-header">
            <div className="captions-header-title">
              <Sparkles size={20} color="var(--brand-primary)" />
              <span>AI Captions & Word Alignments ({captions.length})</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadCaptionsData(currentProject.uuid)}
              startIcon={<RotateCw size={14} />}
              disabled={isLoadingCaptions}
            >
              Refresh
            </Button>
          </div>

          {captions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', background: 'var(--bg-main)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
              <AlertCircle size={36} style={{ margin: '0 auto 12px', opacity: 0.6 }} />
              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                No captions generated yet
              </div>
              <p style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                Trigger AI caption generation to transcribe speech into timed Sinhala or English subtitles.
              </p>
              <Button
                variant="primary"
                onClick={() => setShowRegenerateModal(true)}
                startIcon={<Sparkles size={16} />}
              >
                Generate Captions Now
              </Button>
            </div>
          ) : (
            <div className="captions-list-scroll">
              {captions.map((cap) => {
                const isEditing = editingCaptionUuid === cap.uuid;
                const words = cap.metadata?.words || [];

                return (
                  <div key={cap.uuid} className="caption-row-card">
                    <span className="caption-seq-badge">#{cap.sequence}</span>

                    <div className="caption-content-col">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="caption-time-pill">
                          <Clock size={12} />
                          {formatDuration(cap.start_time)} ➔ {formatDuration(cap.end_time)}
                        </span>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          {!isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCaptionUuid(cap.uuid);
                                  setEditingText(cap.text);
                                }}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}
                                title="Edit text"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCaption(cap.uuid)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px 4px' }}
                                title="Delete caption"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveCaptionText(cap)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#10b981', padding: '2px 4px' }}
                                title="Save"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCaptionUuid(null)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="input-field"
                          rows={2}
                          style={{ marginTop: '6px' }}
                        />
                      ) : (
                        <div className="caption-text-content">{cap.text}</div>
                      )}

                      {/* Word Alignments Preview */}
                      {words.length > 0 && !isEditing && (
                        <div className="caption-words-wrap">
                          {words.map((w, wIdx) => (
                            <span key={wIdx} className="caption-word-chip" title={`${w.start.toFixed(2)}s - ${w.end.toFixed(2)}s`}>
                              {w.word}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Re-generate Modal */}
      <Modal
        isOpen={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
        title="Re-generate Captions with AI"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRegenerateModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleStartRegenerate}
              isLoading={isRegenerating}
              startIcon={<Sparkles size={16} />}
            >
              Start Generation
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Choose the target spoken language. Existing captions will be cleanly replaced with new timestamps and word alignments.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: targetLang === 'si' ? '2px solid var(--brand-primary)' : '1px solid var(--border-color)',
                cursor: 'pointer',
                background: targetLang === 'si' ? 'var(--brand-primary-light)' : 'var(--bg-surface)',
              }}
              onClick={() => setTargetLang('si')}
            >
              <span style={{ fontSize: '1.4rem' }}>🇱🇰</span>
              <div>
                <div style={{ fontWeight: 600 }}>සිංහල (Sinhala)</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Native Sinhala Unicode transcription</div>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: targetLang === 'en' ? '2px solid var(--brand-primary)' : '1px solid var(--border-color)',
                cursor: 'pointer',
                background: targetLang === 'en' ? 'var(--brand-primary-light)' : 'var(--bg-surface)',
              }}
              onClick={() => setTargetLang('en')}
            >
              <span style={{ fontSize: '1.4rem' }}>🇺🇸</span>
              <div>
                <div style={{ fontWeight: 600 }}>English</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Global speech recognition</div>
              </div>
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete Project Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Project?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteProject}
              isLoading={isDeleting}
            >
              Confirm Delete
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-main)', fontSize: '0.925rem' }}>
          Are you sure you want to permanently delete <strong>{currentProject.name}</strong>?
          All uploaded video media, audio streams, and captions will be removed.
        </p>
      </Modal>
    </div>
  );
};
