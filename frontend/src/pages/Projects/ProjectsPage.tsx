import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PlusCircle, Search, X } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Button } from '../../components/Button/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { RetryState } from '../../components/RetryState/RetryState';
import { Skeleton } from '../../components/Skeleton/Skeleton';
import { ProjectCard } from '../../features/projects/ProjectCard';
import { projectService } from '../../services/projectService';
import { toAppError } from '../../services/errors';
import type { Project, ProjectsListResponse } from '../../types/project';
import './ProjectsPage.css';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'processing', label: 'Processing' },
  { key: 'ready', label: 'Ready' },
  { key: 'draft', label: 'Draft' },
  { key: 'failed', label: 'Failed' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

/** Project library. The URL (?status, ?search, ?page) is the source of truth, so links and Back work. */
export const ProjectsPage: React.FC = () => {
  useDocumentTitle('Projects');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (FILTERS.some((f) => f.key === params.get('status')) ? params.get('status') : 'all') as FilterKey;
  const search = params.get('search') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const deleteProject = useProjectStore((s) => s.deleteProject);
  const addToast = useToastStore((s) => s.addToast);

  const [data, setData] = useState<ProjectsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(search);
  const [reloadKey, setReloadKey] = useState(0);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Keep the box in sync when the search comes from the navbar.
  const [lastSearch, setLastSearch] = useState(search);
  if (search !== lastSearch) {
    setLastSearch(search);
    setDraft(search);
  }

  const update = (next: { status?: string; search?: string; page?: number }) => {
    const merged = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined || v === '' || v === 'all' || (k === 'page' && v === 1)) merged.delete(k);
      else merged.set(k, String(v));
    }
    setParams(merged, { replace: next.search !== undefined && next.page === undefined });
  };

  // Debounced search-as-you-type.
  useEffect(() => {
    if (draft === search) return;
    const t = window.setTimeout(() => update({ search: draft.trim(), page: 1 }), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    projectService
      .getProjects({ status: status === 'all' ? undefined : status, search: search || undefined, page })
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(toAppError(err).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [status, search, page, reloadKey]);

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    setDeleting(true);
    try {
      await deleteProject(projectToDelete.uuid);
      addToast({ type: 'success', message: `“${projectToDelete.name}” was deleted.` });
      setProjectToDelete(null);
      setReloadKey((k) => k + 1);
    } finally {
      setDeleting(false);
    }
  };

  const projects = data?.projects ?? [];
  const pagination = data?.pagination;

  return (
    <div className="projects-page-container">
      <div className="projects-top-bar">
        <div>
          <h2 className="page-heading">Projects</h2>
          <p className="page-subheading">Browse, open and manage your caption projects.</p>
        </div>
        <Button variant="primary" startIcon={<PlusCircle size={18} aria-hidden="true" />} onClick={() => navigate('/projects/create')}>
          New project
        </Button>
      </div>

      <div className="projects-filters-row">
        <form role="search" className="projects-search-wrapper" onSubmit={(e) => { e.preventDefault(); update({ search: draft.trim(), page: 1 }); }}>
          <label htmlFor="project-search" className="sr-only">Search projects</label>
          <div className="input-wrapper">
            <span className="input-icon-start" aria-hidden="true"><Search size={18} /></span>
            <input
              id="project-search"
              type="search"
              className="input-field input-has-start-icon"
              placeholder="Search by title or description…"
              value={draft}
              maxLength={100}
              onChange={(e) => setDraft(e.target.value)}
            />
            {draft && (
              <button type="button" className="input-icon-end input-icon-button" aria-label="Clear search" onClick={() => { setDraft(''); update({ search: '', page: 1 }); }}>
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </form>

        <div className="filter-pills-group" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`filter-pill ${status === f.key ? 'filter-pill-active' : ''}`}
              aria-pressed={status === f.key}
              onClick={() => update({ status: f.key, page: 1 })}
            >
              {f.label}
              {data && <span className="filter-pill-count"> ({data.counts[f.key]})</span>}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {!loading && data ? `${pagination?.total ?? 0} projects found` : ''}
      </div>

      {error ? (
        <RetryState title="Could not load projects" message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : loading && !data ? (
        <div className="projects-grid">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={250} />)}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title={search || status !== 'all' ? 'No matching projects' : 'No projects yet'}
          description={search ? `Nothing matches “${search}”. Try another search or clear the filters.` : status !== 'all' ? 'No projects have this status.' : 'Create a project and upload a video to get started.'}
          action={
            search || status !== 'all' ? (
              <Button variant="secondary" onClick={() => { setDraft(''); setParams(new URLSearchParams()); }}>Clear filters</Button>
            ) : (
              <Button variant="primary" startIcon={<PlusCircle size={16} aria-hidden="true" />} onClick={() => navigate('/projects/create')}>New project</Button>
            )
          }
        />
      ) : (
        <div className="projects-grid" aria-busy={loading}>
          {projects.map((project) => <ProjectCard key={project.uuid} project={project} onDelete={setProjectToDelete} />)}
        </div>
      )}

      {pagination && pagination.last_page > 1 && (
        <nav className="projects-pagination" aria-label="Pagination">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>Previous</Button>
          <span aria-current="page" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Page {pagination.current_page} of {pagination.last_page}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= pagination.last_page} onClick={() => update({ page: page + 1 })}>Next</Button>
        </nav>
      )}

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
