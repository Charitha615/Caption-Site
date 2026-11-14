import React from 'react';
import { Loader2 } from 'lucide-react';
import '../Loading/Loading.css';

export interface LoadingStateProps {
  label?: string;
  fullScreen?: boolean;
  size?: number;
}

/** Announced politely to screen readers; spinner respects reduced-motion via Loading.css. */
export const LoadingState: React.FC<LoadingStateProps> = ({ label = 'Loading…', fullScreen = false, size = 32 }) => (
  <div className={`loading-container ${fullScreen ? 'loading-fullscreen' : ''}`} role="status" aria-live="polite">
    <Loader2 size={size} className="loading-spinner" aria-hidden="true" />
    <span className="loading-text">{label}</span>
  </div>
);
