import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clapperboard, FolderOpen, Loader, Plus, Timer, UploadCloud, Wand2, Download } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useProjectStore } from '../../stores/projectStore';
import { useUsageStore, meterPercent } from '../../stores/usageStore';
import { useToastStore } from '../../stores/toastStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Button } from '../../components/Button/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { RetryState } from '../../components/RetryState/RetryState';
import { Skeleton } from '../../components/Skeleton/Skeleton';
import { Progress } from '../../components/Progress/Progress';
import { ProjectCard } from '../../features/projects/ProjectCard';
import { toAppError } from '../../services/errors';
import type { Project, UsageMeter } from '../../types/project';
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

const Meter: React.FC<{ label: string; meter: UsageMeter; unit?: string }> = ({ label, meter, unit = '' }) => {
  const pct = meterPercent(meter.used, meter.limit);
  const detail = meter.limit === null ? `${meter.used}${unit} · unlimited` : `${meter.used}${unit} of ${meter.limit}${unit}`;
  return pct === null ? (
    <div className="dash-meter-unlimited"><span>{label}</span><span>{detail}</span></div>
  ) : (
    <Progress label={label} value={pct} detail={detail} size="sm" tone={pct >= 90 ? 'warning' : 'primary'} />
  );
};

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
  const usage = dashboardData?.usage;
  const projects = dashboardData?.recent_projects ?? [];
  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <p className="dash-greeting">Welcome back{firstName ? `, ${firstName}` : ''}</p>
          <h2 className="page-heading">What will you caption today?</h2>
        </div>
        <Button variant="accent" startIcon={<Plus size={18} aria-hidden="true" />} onClick={() => navigate('/projects/create')}>
          New project
        </Button>
      </header>

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

      <div className="dash-grid">
        <section className="dash-card" aria-labelledby="usage-title">
          <div className="dash-card-head">
            <h3 id="usage-title"><Timer size={16} aria-hidden="true" /> This month</h3>
            {usage && <span className="dash-plan-chip">{usage.plan.label} plan</span>}
          </div>
          {usage ? (
            <div className="dash-meters">
              <Meter label="Caption minutes" meter={usage.caption_minutes} />
              <Meter label="AI requests today" meter={usage.ai_requests_today} />
              <Meter label="Video renders" meter={usage.renders} />
              <Meter label="Storage" meter={usage.storage_mb} unit=" MB" />
            </div>
          ) : (
            <Skeleton height={150} />
          )}
          <Link to="/profile" className="dash-card-link">See usage details</Link>
        </section>

        <section className="dash-card dash-howto" aria-labelledby="howto-title">
          <h3 id="howto-title" className="dash-card-head">Three steps to captions</h3>
          <ol className="dash-steps">
            <li><UploadCloud size={18} aria-hidden="true" /> <span><strong>Upload</strong> a video (resumable, up to {usage?.max_upload_mb ?? 500} MB)</span></li>
            <li><Wand2 size={18} aria-hidden="true" /> <span><strong>Review</strong> the AI captions in the studio editor</span></li>
            <li><Download size={18} aria-hidden="true" /> <span><strong>Export</strong> SRT, VTT, TXT or a captioned MP4</span></li>
          </ol>
        </section>
      </div>

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
