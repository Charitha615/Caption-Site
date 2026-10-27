import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../Button/Button';
import './ErrorState.css';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We encountered an error while loading this content. Please try again.',
  onRetry,
}) => {
  return (
    <div className="error-state">
      <div className="error-state-icon">
        <AlertTriangle size={28} />
      </div>
      <h3 className="error-state-title">{title}</h3>
      <p className="error-state-message">{message}</p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          startIcon={<RefreshCw size={14} />}
          onClick={onRetry}
        >
          Try Again
        </Button>
      )}
    </div>
  );
};
