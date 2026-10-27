import React from 'react';
import { Sparkles } from 'lucide-react';
import './EmptyState.css';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <Sparkles size={28} />,
  title,
  description,
  action,
}) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
};
