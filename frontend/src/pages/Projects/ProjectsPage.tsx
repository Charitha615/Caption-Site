import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Search, Trash2 } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Modal } from '../../components/Modal/Modal';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { Skeleton } from '../../components/Skeleton/Skeleton';
import { ProjectCard } from '../../features/projects/ProjectCard';
import type { Project } from '../../types/project';
import './ProjectsPage.css';

export const ProjectsPage: React.FC = () => {
  useDocumentTitle('Projects Library');
  const navigate = useNavigate();

  const {
    projects,
    counts,
    pagination,
    selectedStatus,
    searchQuery,
    setStatusFilter,
    setSearchQuery,
    loadProjects,
    deleteProject,
    isLoading,
  } = useProjectStore();

  const { addToast } = useToastStore();
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadProjects(1).catch(console.error);
  }, [loadProjects]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadProjects(1);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete.uuid);
      addToast({
        type: 'success',
        title: 'Project Deleted',
        message: `"${projectToDelete.name}" was successfully removed.`,
      });
      setProjectToDelete(null);
    } catch {
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Could not delete project.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="projects-page-container">
      {/* Top Header & CTA */}
      <div className="projects-top-bar">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Projects Library</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Browse, manage and export all captioning projects
          </p>
        </div>

        <Button
          variant="primary"
          startIcon={<PlusCircle size={18} />}
          onClick={() => navigate('/projects/create')}
        >
          New Project
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="projects-filters-row">
        <form onSubmit={handleSearchSubmit} className="projects-search-wrapper">
          <Input
            placeholder="Search projects by title or description..."
            value={searchQuery}
            onChange={handleSearchChange}
            startIcon={<Search size={18} />}
          />
        </form>

        <div className="filter-pills-group">
          <button
            className={`filter-pill ${selectedStatus === 'all' ? 'filter-pill-active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({counts.all})
          </button>
          <button
            className={`filter-pill ${selectedStatus === 'processing' ? 'filter-pill-active' : ''}`}
            onClick={() => setStatusFilter('processing')}
          >
            Processing ({counts.processing})
          </button>
          <button
            className={`filter-pill ${selectedStatus === 'completed' ? 'filter-pill-active' : ''}`}
            onClick={() => setStatusFilter('completed')}
          >
            Completed ({counts.completed})
          </button>
          <button
            className={`filter-pill ${selectedStatus === 'draft' ? 'filter-pill-active' : ''}`}
            onClick={() => setStatusFilter('draft')}
          >
            Draft ({counts.draft})
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading && projects.length === 0 ? (
        <div className="projects-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card" style={{ padding: '16px' }}>
              <Skeleton height="160px" style={{ marginBottom: '12px', borderRadius: '10px' }} />
              <Skeleton height="20px" width="70%" style={{ marginBottom: '8px' }} />
              <Skeleton height="16px" width="40%" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects found"
          description={
            searchQuery
              ? `No projects matching "${searchQuery}". Try clearing search filter.`
              : 'You haven’t created any caption projects in this view.'
          }
          action={
            <Button
              variant="primary"
              startIcon={<PlusCircle size={16} />}
              onClick={() => navigate('/projects/create')}
            >
              Create New Project
            </Button>
          }
        />
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <ProjectCard
              key={project.uuid}
              project={project}
              onDelete={(p) => setProjectToDelete(p)}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination && pagination.last_page > 1 && (
        <div className="projects-pagination">
          <Button
            variant="secondary"
            size="sm"
            disabled={pagination.current_page <= 1}
            onClick={() => loadProjects(pagination.current_page - 1)}
          >
            Previous
          </Button>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Page {pagination.current_page} of {pagination.last_page}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={pagination.current_page >= pagination.last_page}
            onClick={() => loadProjects(pagination.current_page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        title="Delete Project?"
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
              startIcon={<Trash2 size={16} />}
              onClick={handleDeleteConfirm}
              isLoading={isDeleting}
            >
              Confirm Delete
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-main)', fontSize: '0.925rem' }}>
          Are you sure you want to delete <strong>&ldquo;{projectToDelete?.name}&rdquo;</strong>?
          This action will delete all timed captions associated with this project.
        </p>
      </Modal>
    </div>
  );
};
