import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clapperboard, KeyRound, FolderOpen, Loader, Mic, MousePointer2, Music2, Play, Plus, Scissors, Type, UploadCloud, Wand2, Download } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useProjectStore } from '../../stores/projectStore';
import { useUsageStore } from '../../stores/usageStore';
import { useToastStore } from '../../stores/toastStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Button } from '../../components/Button/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { RetryState } from '../../components/RetryState/RetryState';
import { Skeleton } from '../../components/Skeleton/Skeleton';
import { SplineScene } from '../../components/SplineScene/SplineScene';
import { Spotlight } from '../../components/Spotlight/Spotlight';
import { ProjectCard } from '../../features/projects/ProjectCard';
import { AiKeyNotice } from '../../features/account/AiKeyNotice';
import { toAppError } from '../../services/errors';
import { VIDEO_EDITOR_PATH } from '../../features/videoEditor/paths';
import type { Project } from '../../types/project';
import './DashboardPage.css';

const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="dash-stat">
    <span className="dash-stat-icon" aria-hidden="true">{icon}</span>
    <div>
      <div className="dash-stat-value">{value}</div>
      <div className="dash-stat-label">{label}</div>
    </div>
  </div>
);

interface ToolCardProps {
  title: string;
  description: string;
  /** Where the card goes; without it the card is shown but can't be opened. */
  to?: string;
  /** Small pill above the title, e.g. "New" or "Soon". */
  badge?: string;
  theme: 'captions' | 'editor';
  art: React.ReactNode;
}

const ToolCard: React.FC<ToolCardProps> = ({ title, description, to, badge, theme, art }) => {
  const body = (
    <>
      <span className="dash-tool-text">
        {badge && <span className="dash-tool-badge">{badge}</span>}
        <span className="dash-tool-title">{title}</span>
        <span className="dash-tool-desc">{description}</span>
      </span>
      <span className="dash-tool-art" aria-hidden="true">{art}</span>
    </>
  );
  return to
    ? <Link to={to} className={`dash-tool is-${theme}`}>{body}</Link>
    : <div className={`dash-tool is-${theme} is-disabled`} aria-disabled="true">{body}</div>;
};

/** Caption studio artwork: a video frame with a CC tag, a mic bubble, a waveform and caption lines. */
const CaptionsArt = () => (
  <>
    <span className="art-frame">
      <span className="art-scene" />
      <span className="art-play"><Play size={14} /></span>
      <span className="art-wave">{[5, 11, 7, 15, 9, 13, 6, 12, 8, 14, 5, 10].map((h, i) => <i key={i} style={{ height: h }} />)}</span>
    </span>
    <span className="art-chip art-cc">CC</span>
    <span className="art-chip art-mic"><Mic size={16} /></span>
    <span className="art-lines"><i /><i /></span>
    <Sparkle className="art-spark s1" />
    <Sparkle className="art-spark s2" />
  </>
);

/** Video editor artwork: a preview with a play button, a tool rail and a timeline strip. */
const EditorArt = () => (
  <>
    <span className="art-rail"><Scissors size={14} /><Music2 size={14} /><Type size={14} /><Music2 size={14} /></span>
    <span className="art-frame is-editor">
      <span className="art-scene is-sunset" />
      <span className="art-play"><Play size={14} /></span>
    </span>
    <span className="art-timeline">
      <i className="t1" /><i className="t2" /><i className="t3" /><i className="t4" />
      <span className="art-playhead" />
    </span>
    <span className="art-cursor"><MousePointer2 size={18} /></span>
    <Sparkle className="art-spark s1" />
    <Sparkle className="art-spark s3" />
  </>
);

const Sparkle = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" width="14" height="14"><path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" fill="currentColor" /></svg>
);

const HERO_SCENE = 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode';

export const DashboardPage: React.FC = () => {
  useDocumentTitle('Dashboard');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { dashboardData, loadDashboard, deleteProject } = useProjectStore();
  const setUsage = useUsageStore((s) => s.set);
  const addToast = useToastStore((s) => s.addToast);

  const [error, setError] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setError(null);
    try {
      await loadDashboard();
    } catch (err) {
      setError(toAppError(err).message);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dashboardData?.usage) setUsage(dashboardData.usage);
  }, [dashboardData, setUsage]);

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    setDeleting(true);
    try {
      await deleteProject(projectToDelete.uuid);
      addToast({ type: 'success', message: `“${projectToDelete.name}” was deleted.` });
      setProjectToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  if (error && !dashboardData) {
    return <RetryState title="Could not load your dashboard" message={error} onRetry={load} />;
  }

  const summary = dashboardData?.summary;
  const maxUploadMb = dashboardData?.usage?.max_upload_mb;
  const projects = dashboardData?.recent_projects ?? [];
  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="dash">
      <section className="dash-hero" aria-labelledby="dash-hero-title">
        <Spotlight />
        <div className="dash-hero-copy">
          <p className="dash-greeting">Welcome back{firstName ? `, ${firstName}` : ''}</p>
          <h2 id="dash-hero-title" className="dash-hero-title">What will you caption today?</h2>
          <p className="dash-hero-text">
            Upload a video and get accurately timed Sinhala or English captions, then style and export them in the studio.
          </p>
          <Button variant="accent" startIcon={<Plus size={18} aria-hidden="true" />} onClick={() => navigate('/projects/create')}>
            New project
          </Button>
        </div>
        <div className="dash-hero-scene" aria-hidden="true">
          <SplineScene scene={HERO_SCENE} className="dash-hero-canvas" />
        </div>
      </section>

      <AiKeyNotice />

      <section aria-labelledby="tools-title">
        <div className="dash-section-head">
          <h3 id="tools-title">Tools</h3>
        </div>
        <div className="dash-tools">
          <ToolCard
            theme="captions"
            title="Auto Captions"
            description="Fast, accurate Sinhala and English captions"
            to="/projects/create"
            art={<CaptionsArt />}
          />
          <ToolCard
            theme="editor"
            badge="New"
            title="Video Editor"
            description="Simple yet powerful editing tools"
            to={VIDEO_EDITOR_PATH}
            art={<EditorArt />}
          />
        </div>
      </section>

      <section className="dash-stats" aria-label="Project summary">
        {summary ? (
          <>
            <StatTile icon={<FolderOpen size={18} />} label="Projects" value={summary.total_projects} />
            <StatTile icon={<Loader size={18} />} label="Processing" value={summary.processing_projects} />
            <StatTile icon={<CheckCircle2 size={18} />} label="Ready" value={summary.completed_projects} />
            <StatTile icon={<Clapperboard size={18} />} label="Videos rendered" value={summary.rendered_videos_count} />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={78} />)
        )}
      </section>

      <section className="dash-card dash-howto" aria-labelledby="howto-title">
        <h3 id="howto-title" className="dash-card-head">Getting started</h3>
        <ol className="dash-steps">
          <li><KeyRound size={18} aria-hidden="true" /> <span><strong>Add</strong> your Google AI key in <Link to="/profile#ai-key">Account &amp; usage</Link></span></li>
          <li><UploadCloud size={18} aria-hidden="true" /> <span><strong>Upload</strong> a video (resumable, up to {maxUploadMb ?? 500} MB)</span></li>
          <li><Wand2 size={18} aria-hidden="true" /> <span><strong>Review</strong> the captions in the studio editor</span></li>
          <li><Download size={18} aria-hidden="true" /> <span><strong>Export</strong> SRT, VTT, TXT or a captioned MP4</span></li>
        </ol>
      </section>

      <section aria-labelledby="recent-title">
        <div className="dash-section-head">
          <h3 id="recent-title">Recent projects</h3>
          {projects.length > 0 && <Link to="/projects">View all</Link>}
        </div>
        {!dashboardData ? (
          <div className="dash-projects">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} height={240} />)}</div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<UploadCloud size={28} />}
            title="No projects yet"
            description="Upload your first video and get timed Sinhala or English captions in minutes."
            action={<Button onClick={() => navigate('/projects/create')} startIcon={<Plus size={16} aria-hidden="true" />}>Create your first project</Button>}
          />
        ) : (
          <div className="dash-projects">
            {projects.map((p) => <ProjectCard key={p.uuid} project={p} onDelete={setProjectToDelete} />)}
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={!!projectToDelete}
        title="Delete project?"
        message={<p><strong>{projectToDelete?.name}</strong> and its video, captions and exports will be removed permanently.</p>}
        confirmLabel="Delete project"
        tone="danger"
        isLoading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setProjectToDelete(null)}
      />
    </div>
  );
};
