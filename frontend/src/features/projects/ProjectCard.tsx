import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MoreVertical,
  Clock,
  Trash2,
  ExternalLink,
  Film,
} from 'lucide-react';
import type { Project } from '../../types/project';
import { formatDuration, formatDate, getLanguageLabel } from '../../utils/formatters';
import { Badge } from '../../components/Badge/Badge';
import { Dropdown } from '../../components/Dropdown/Dropdown';
import './ProjectCard.css';

export interface ProjectCardProps {
  project: Project;
  onDelete?: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onDelete }) => {
  const navigate = useNavigate();
  const langInfo = getLanguageLabel(project.language);

  const getStatusBadge = (status: Project['status']) => {
    switch (status) {
      case 'ready':
      case 'completed':
        return (
          <Badge variant="green" hasDot>
            Ready
          </Badge>
        );
      case 'uploaded':
        return (
          <Badge variant="blue" hasDot>
            Uploaded
          </Badge>
        );
      case 'processing':
      case 'extracting_audio':
      case 'transcribing':
      case 'generating_captions':
        return (
          <Badge variant="purple" hasDot>
            {status === 'extracting_audio'
              ? 'Audio Extracted'
              : status === 'transcribing'
              ? 'Transcribing...'
              : status === 'generating_captions'
              ? 'Captions...'
              : 'Processing...'}
          </Badge>
        );
      case 'rendering':
        return (
          <Badge variant="amber" hasDot>
            Rendering...
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="red" hasDot>
            Failed
          </Badge>
        );
      case 'draft':
      default:
        return <Badge variant="gray">Draft</Badge>;
    }
  };

  const actionItems = [
    {
      key: 'editor',
      label: 'Open editor',
      icon: <ExternalLink size={15} />,
      onClick: () => navigate(`/projects/${project.uuid}/editor`),
    },
    {
      key: 'details',
      label: 'Project details',
      icon: <Film size={15} />,
      onClick: () => navigate(`/projects/${project.uuid}`),
    },
    {
      key: 'delete',
      label: 'Delete project',
      icon: <Trash2 size={15} />,
      danger: true,
      onClick: () => onDelete?.(project),
    },
  ];

  return (
    // The whole card is clickable for pointer users; keyboard users reach the title link
    // and the actions menu (no nested interactive roles).
    <article className="project-card" onClick={() => navigate(`/projects/${project.uuid}`)}>
      {/* Video Thumbnail */}
      <div className="project-thumbnail-wrapper">
        <div className="project-thumbnail-fallback">
          <Film size={36} aria-hidden="true" />
        </div>

        {project.thumbnail && (
          <img
            src={project.thumbnail}
            alt=""
            className="project-thumbnail-img"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}

        <div className="project-status-top">{getStatusBadge(project.status)}</div>

        {project.duration !== undefined && project.duration !== null && (
          <div className="project-duration-badge">
            <Clock size={12} aria-hidden="true" />
            <span><span className="sr-only">Duration </span>{formatDuration(project.duration)}</span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="project-content">
        <div className="project-title-row">
          <h3 className="project-title" title={project.name}>
            <Link to={`/projects/${project.uuid}`} className="project-title-link" onClick={(e) => e.stopPropagation()}>
              {project.name}
            </Link>
          </h3>

          <div onClick={(e) => e.stopPropagation()}>
            <Dropdown
              items={actionItems}
              align="right"
              label={`Actions for ${project.name}`}
              triggerClassName="project-actions-btn"
              trigger={<MoreVertical size={16} aria-hidden="true" />}
            />
          </div>
        </div>

        <div className="project-meta-row">
          <span title={`Language: ${langInfo.label}`}>
            {langInfo.flag} {langInfo.label}
          </span>
          <span>{formatDate(project.created_at)}</span>
        </div>
      </div>
    </article>
  );
};
