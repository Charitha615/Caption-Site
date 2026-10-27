import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Crown,
  X,
  ArrowRight,
  Play,
  Film,
  Music,
  FileText,
  Clock,
  Layers,
  Wand2,
  Share2,
  Trash2,
  CheckCircle2,
  FolderOpen,
  Plus,
  Search,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';
import { useBrand } from '../../hooks/useBrand';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Button } from '../../components/Button/Button';
import { Modal } from '../../components/Modal/Modal';
import { Skeleton } from '../../components/Skeleton/Skeleton';
import { formatDuration, getLanguageLabel } from '../../utils/formatters';
import type { Project } from '../../types/project';
import './DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const brand = useBrand();
  useDocumentTitle('Dashboard');
  const navigate = useNavigate();

  const { user } = useAuthStore();
  const { dashboardData, loadDashboard, deleteProject, isLoading } = useProjectStore();
  const { addToast } = useToastStore();

  const [activeMediaTab, setActiveMediaTab] = useState<'video' | 'audio' | 'scripts' | 'completed'>('video');
  const [showTrialBanner, setShowTrialBanner] = useState(true);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    loadDashboard().catch((err) => {
      console.error('Failed to load dashboard:', err);
    });
  }, [loadDashboard]);

  const projects = useMemo(() => {
    return dashboardData?.recent_projects || [];
  }, [dashboardData]);

  const summary = dashboardData?.summary || {
    total_projects: 0,
    processing_projects: 0,
    completed_projects: 0,
    draft_projects: 0,
    caption_minutes_used: 5.5,
    caption_minutes_limit: 120,
    rendered_videos_count: 0,
  };

  // Filter projects by media tab and search
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // Search matching
      if (searchFilter && !p.name.toLowerCase().includes(searchFilter.toLowerCase())) {
        return false;
      }

      if (activeMediaTab === 'completed') {
        return p.status === 'completed';
      }
      if (activeMediaTab === 'audio') {
        return p.name.toLowerCase().includes('podcast') || p.name.toLowerCase().includes('audio');
      }
      if (activeMediaTab === 'scripts') {
        return (p.captions_count || 0) > 0;
      }
      // 'video' is default view (all or video projects)
      return true;
    });
  }, [projects, activeMediaTab, searchFilter]);

  // Latest project for quick editor open
  const latestProject = projects[0];

  const handleOpenEditor = () => {
    if (latestProject) {
      navigate(`/projects/${latestProject.uuid}`);
    } else {
      navigate('/projects/create');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete.uuid);
      addToast({
        type: 'success',
        title: 'Project Removed',
        message: `"${projectToDelete.name}" was successfully removed.`,
      });
      setProjectToDelete(null);
    } catch {
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Could not remove project. Please try again.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* 1. Header Greeting Bar */}
      <div className="dashboard-header-bar">
        <div className="header-greeting-col">
          <div className="header-welcome-line">
            <span className="greeting-emoji">👋</span>
            <span className="greeting-text">
              Welcome back, <strong>{user?.name || 'Creator'}</strong>!
            </span>
          </div>
          <h1 className="header-main-headline">What will you create today?</h1>
        </div>

        <div className="header-quick-actions">
          <Button
            variant="accent"
            size="md"
            startIcon={<Plus size={18} />}
            onClick={() => navigate('/projects/create')}
          >
            New Project
          </Button>
        </div>
      </div>

      {/* 2. Free Trial / Plan Quota Bar */}
      {showTrialBanner && (
        <div className="trial-notification-banner">
          <div className="trial-banner-left">
            <div className="trial-crown-icon">
              <Crown size={16} />
            </div>
            <div className="trial-banner-text">
              <span className="trial-title-tag">FREE TRIAL</span>
              <span className="trial-message">
                You&apos;re on <strong>{brand.name} Pro</strong>: free trial, 7 days left.
                Pick a plan any time to keep unlimited AI features and 4K Sinhala caption exports unlocked.
              </span>
            </div>
          </div>

          <div className="trial-banner-actions">
            <button
              type="button"
              className="trial-cta-btn"
              onClick={() => navigate('/profile')}
            >
              Keep Pro
            </button>
            <button
              type="button"
              className="trial-close-btn"
              onClick={() => setShowTrialBanner(false)}
              aria-label="Dismiss banner"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 3. Hero Feature Banners (Dual Bento Showcase) */}
      <section className="hero-bento-grid">
        {/* Card 1: AI Auto-Caption Editor */}
        <div className="bento-card bento-card-captions">
          <div className="bento-card-content">
            <div className="bento-tag bento-tag-gold">
              <Sparkles size={12} />
              <span>AUTO CAPTION EDITOR</span>
            </div>
            <h2 className="bento-title">Auto Captions</h2>
            <p className="bento-description">
              Turn every spoken moment into precise Sinhala & English captions with frame-accurate timing.
            </p>
            <button
              type="button"
              className="bento-cta-btn bento-cta-gold"
              onClick={() => navigate('/projects/create')}
            >
              <ArrowRight size={16} />
              <span>Start captioning</span>
            </button>
          </div>

          {/* Visual Showcase: Animated Sinhala Caption Bubble Preview */}
          <div className="bento-visual bento-visual-captions">
            <div className="visual-media-scene">
              <div className="scene-overlay-backdrop" />
              <div className="floating-caption-box">
                <div className="caption-live-indicator">
                  <span className="live-dot" />
                  <span>AI SYNC · 00:02.15</span>
                </div>
                <div className="caption-sinhala-text">
                  &ldquo;මේක තමයි සුපිරිම <span className="highlight-word">AI Captions</span> ටූල් එක!&rdquo;
                </div>
                <div className="caption-sub-en">
                  &ldquo;This is the ultimate AI caption tool!&rdquo;
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Full Studio Timeline Video Editor */}
        <div className="bento-card bento-card-editor">
          <div className="bento-card-content">
            <div className="bento-tag bento-tag-cyan">
              <Film size={12} />
              <span>VIDEO STUDIO</span>
              <span className="bento-pill-badge">PRO WORKSPACE</span>
            </div>
            <h2 className="bento-title">Edit the whole story.</h2>
            <p className="bento-description">
              Layer video tracks, audio waveforms and Sinhala captions on a responsive non-linear timeline.
            </p>
            <button
              type="button"
              className="bento-cta-btn bento-cta-glass"
              onClick={handleOpenEditor}
            >
              <Play size={15} fill="currentColor" />
              <span>Open editor</span>
            </button>
          </div>

          {/* Visual Showcase: Timeline Tracks Graphic */}
          <div className="bento-visual bento-visual-editor">
            <div className="mini-timeline-graphic">
              <div className="timeline-header-mini">
                <div className="timeline-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="timeline-mini-title">SampleCap Timeline v2.4</span>
              </div>
              <div className="mini-track-row track-video">
                <span className="track-label">VIDEO</span>
                <div className="track-bar bar-video">
                  <span className="track-bar-label">Video_Layer_4K.mp4</span>
                </div>
              </div>
              <div className="mini-track-row track-audio">
                <span className="track-label">AUDIO</span>
                <div className="track-bar bar-audio">
                  <div className="waveform-spikes">
                    {[40, 75, 20, 85, 95, 60, 45, 80, 100, 70, 30, 90, 85, 40, 70, 95, 50, 80, 60, 40].map((h, i) => (
                      <span key={i} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mini-track-row track-subtitles">
                <span className="track-label">CAPTION</span>
                <div className="track-bar bar-subtitles">
                  <span className="sub-block sub-1">සිංහල උපසිරැසි</span>
                  <span className="sub-block sub-2">Sinhala Auto AI</span>
                </div>
              </div>
              <div className="timeline-playhead" />
            </div>
          </div>
        </div>
      </section>

      {/* 4. AI Suite Tools Grid (4 Quick Creation Bento Cards) */}
      <section className="suite-tools-grid">
        {/* Tool 1 */}
        <div
          className="suite-tool-card"
          onClick={() => navigate('/projects/create')}
          role="button"
          tabIndex={0}
        >
          <div className="suite-tool-icon-box icon-captions">
            <FileText size={20} />
          </div>
          <div className="suite-tool-body">
            <div className="suite-tool-title-row">
              <h3 className="suite-tool-title">Captions</h3>
              <span className="suite-tag-pill">AI FAST</span>
            </div>
            <p className="suite-tool-sub">Transcribe and style Sinhala captions.</p>
          </div>
        </div>

        {/* Tool 2 */}
        <div
          className="suite-tool-card"
          onClick={() => navigate('/projects/create')}
          role="button"
          tabIndex={0}
        >
          <div className="suite-tool-icon-box icon-ai-studio">
            <Wand2 size={20} />
          </div>
          <div className="suite-tool-body">
            <div className="suite-tool-title-row">
              <h3 className="suite-tool-title">AI Studio</h3>
              <Crown size={13} className="crown-badge-icon" />
            </div>
            <p className="suite-tool-sub">Voice, translation and scripts.</p>
          </div>
        </div>

        {/* Tool 3 */}
        <div
          className="suite-tool-card"
          onClick={handleOpenEditor}
          role="button"
          tabIndex={0}
        >
          <div className="suite-tool-icon-box icon-photo-editor">
            <Layers size={20} />
          </div>
          <div className="suite-tool-body">
            <div className="suite-tool-title-row">
              <h3 className="suite-tool-title">Aspect & Canvas</h3>
              <span className="suite-beta-badge">BETA</span>
              <Crown size={13} className="crown-badge-icon" />
            </div>
            <p className="suite-tool-sub">Reels 9:16, 16:9 safe zones and text overlays.</p>
          </div>
        </div>

        {/* Tool 4 */}
        <div
          className="suite-tool-card"
          onClick={() => navigate('/projects')}
          role="button"
          tabIndex={0}
        >
          <div className="suite-tool-icon-box icon-social-kit">
            <Share2 size={20} />
          </div>
          <div className="suite-tool-body">
            <div className="suite-tool-title-row">
              <h3 className="suite-tool-title">Social Kit</h3>
              <Crown size={13} className="crown-badge-icon" />
            </div>
            <p className="suite-tool-sub">Burn-in MP4 subtitles, SRT, VTT and TXT exports.</p>
          </div>
        </div>
      </section>

      {/* 5. "My Projects" Rack Section */}
      <section className="my-projects-section">
        <div className="my-projects-header-row">
          <div className="my-projects-title-col">
            <h2 className="my-projects-title">My Projects</h2>
            <span className="my-projects-count-badge">{projects.length}</span>
          </div>

          <div className="projects-controls-group">
            {/* Quick Filter Input */}
            <div className="projects-filter-input-wrap">
              <Search size={14} className="filter-search-icon" />
              <input
                type="text"
                placeholder="Search..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="projects-filter-input"
              />
              {searchFilter && (
                <button
                  type="button"
                  className="filter-clear-btn"
                  onClick={() => setSearchFilter('')}
                  aria-label="Clear filter"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Media Format Filter Tabs */}
            <div className="projects-filter-tabs">
              <button
                type="button"
                className={`filter-tab-btn ${activeMediaTab === 'video' ? 'filter-tab-btn-active' : ''}`}
                onClick={() => setActiveMediaTab('video')}
              >
                <Film size={14} />
                <span>Video {projects.length}</span>
              </button>
              <button
                type="button"
                className={`filter-tab-btn ${activeMediaTab === 'audio' ? 'filter-tab-btn-active' : ''}`}
                onClick={() => setActiveMediaTab('audio')}
              >
                <Music size={14} />
                <span>Audio</span>
              </button>
              <button
                type="button"
                className={`filter-tab-btn ${activeMediaTab === 'scripts' ? 'filter-tab-btn-active' : ''}`}
                onClick={() => setActiveMediaTab('scripts')}
              >
                <FileText size={14} />
                <span>Scripts</span>
              </button>
              <button
                type="button"
                className={`filter-tab-btn ${activeMediaTab === 'completed' ? 'filter-tab-btn-active' : ''}`}
                onClick={() => setActiveMediaTab('completed')}
              >
                <CheckCircle2 size={14} />
                <span>Completed ({summary.completed_projects})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        {isLoading && projects.length === 0 ? (
          <div className="projects-rack-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="project-rack-skeleton">
                <Skeleton height="140px" style={{ borderRadius: '12px', marginBottom: '10px' }} />
                <Skeleton height="18px" width="80%" style={{ marginBottom: '6px' }} />
                <Skeleton height="14px" width="50%" />
              </div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="projects-empty-card">
            <div className="empty-icon-box">
              <FolderOpen size={36} />
            </div>
            <h3 className="empty-title">
              {activeMediaTab === 'completed'
                ? 'No completed projects yet'
                : 'No projects found in this tab'}
            </h3>
            <p className="empty-desc">
              Upload your video or audio recording to generate frame-perfect Sinhala & English subtitles.
            </p>
            <Button
              variant="accent"
              size="md"
              startIcon={<Plus size={16} />}
              onClick={() => navigate('/projects/create')}
            >
              Create New Project
            </Button>
          </div>
        ) : (
          <div className="projects-rack-grid">
            {filteredProjects.map((project) => {
              const langInfo = getLanguageLabel(project.language);
              const durationFormatted = formatDuration(project.duration || 0);
              const linesCount = project.captions_count || (project.duration ? Math.round(project.duration / 3) : 24);

              return (
                <div
                  key={project.uuid}
                  className="project-rack-card"
                  onClick={() => navigate(`/projects/${project.uuid}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/projects/${project.uuid}`);
                  }}
                >
                  {/* Thumbnail / Video Slate */}
                  <div className="rack-thumbnail-wrapper">
                    <div className="rack-thumbnail-fallback">
                      <Film size={34} className="slate-icon" />
                    </div>
                    {project.thumbnail && (
                      <img
                        src={project.thumbnail}
                        alt={project.name}
                        className="rack-thumbnail-img"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}

                    {/* Delete 'x' Button on Top Right (like reference screenshot) */}
                    <button
                      type="button"
                      className="rack-delete-btn"
                      title="Delete project"
                      aria-label="Delete project"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(project);
                      }}
                    >
                      <X size={14} />
                    </button>

                    {/* Status Badge Top Left */}
                    <div className="rack-status-tag">
                      {project.status === 'completed' ? (
                        <span className="status-pill status-ready">Ready</span>
                      ) : project.status === 'processing' ? (
                        <span className="status-pill status-processing">Generating</span>
                      ) : (
                        <span className="status-pill status-draft">Draft</span>
                      )}
                    </div>

                    {/* Duration Bottom Right */}
                    <div className="rack-duration-pill">
                      <Clock size={11} />
                      <span>{durationFormatted}</span>
                    </div>

                    {/* Hover Play Glow */}
                    <div className="rack-hover-overlay">
                      <div className="rack-play-circle">
                        <Play size={18} fill="#000000" />
                      </div>
                      <span className="rack-open-text">Open in Studio</span>
                    </div>
                  </div>

                  {/* Project Details Below Thumbnail */}
                  <div className="rack-card-info">
                    <h4 className="rack-project-name" title={project.name}>
                      {project.name}
                    </h4>
                    <div className="rack-project-meta">
                      <span className="rack-meta-item">
                        {durationFormatted} · {linesCount} lines
                      </span>
                      <span className="rack-meta-lang" title={langInfo.label}>
                        {langInfo.flag} {langInfo.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        title="Remove Project?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setProjectToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              isLoading={isDeleting}
              startIcon={<Trash2 size={16} />}
            >
              Delete Project
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-main)', fontSize: '0.925rem', lineHeight: 1.5 }}>
          Are you sure you want to delete <strong>&ldquo;{projectToDelete?.name}&rdquo;</strong>?
          This will remove the project, media assets, and generated Sinhala/English captions.
        </p>
      </Modal>
    </div>
  );
};
