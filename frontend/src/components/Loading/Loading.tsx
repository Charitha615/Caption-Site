import React from 'react';
import { Loader2 } from 'lucide-react';
import './Loading.css';

export interface LoadingProps {
  text?: string;
  size?: number;
  fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  text = 'Loading...',
  size = 32,
  fullScreen = false,
}) => {
  return (
    <div className={`loading-container ${fullScreen ? 'loading-fullscreen' : ''}`}>
      <Loader2 size={size} className="loading-spinner" />
      {text && <span className="loading-text">{text}</span>}
    </div>
  );
};
