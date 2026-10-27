import React from 'react';
import './Badge.css';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'purple' | 'orange' | 'green' | 'amber' | 'red' | 'gray' | 'blue';
  size?: 'sm' | 'md';
  hasDot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'gray',
  size = 'sm',
  hasDot = false,
  className = '',
}) => {
  return (
    <span className={`badge badge-${variant} badge-${size} ${className}`}>
      {hasDot && <span className="badge-dot" />}
      {children}
    </span>
  );
};
