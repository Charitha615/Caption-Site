import React from 'react';
import { Loader2 } from 'lucide-react';
import './Button.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  startIcon,
  endIcon,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${fullWidth ? 'btn-full' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} className="btn-spinner" />
      ) : (
        startIcon
      )}
      <span>{children}</span>
      {!isLoading && endIcon}
    </button>
  );
};
