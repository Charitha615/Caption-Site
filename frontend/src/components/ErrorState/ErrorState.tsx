import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../Button/Button';
import './ErrorState.css';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  action?: React.ReactNode;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We encountered an error while loading this content. Please try again.',
  onRetry,
  action,
}) => (
  <div className="error-state" role="alert">
    <div className="error-state-icon" aria-hidden="true">
      <AlertTriangle size={28} />
    </div>
    <h3 className="error-state-title">{title}</h3>
    <p className="error-state-message">{message}</p>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
      {onRetry && (
        <Button variant="secondary" size="sm" startIcon={<RefreshCw size={14} aria-hidden="true" />} onClick={onRetry}>
          Try again
        </Button>
      )}
      {action}
    </div>
  </div>
);
