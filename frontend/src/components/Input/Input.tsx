import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './Input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  required?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  startIcon,
  endIcon,
  type = 'text',
  required = false,
  className = '',
  id,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const autoId = useId();
  const inputId = id || autoId;
  const messageId = `${inputId}-message`;
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={`input-group ${className}`}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
          {required && <span className="input-required" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="input-wrapper">
        {startIcon && <div className="input-icon-start">{startIcon}</div>}

        <input
          id={inputId}
          type={effectiveType}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helperText ? messageId : undefined}
          className={`input-field ${startIcon ? 'input-has-start-icon' : ''} ${
            endIcon || isPassword ? 'input-has-end-icon' : ''
          } ${error ? 'input-error-field' : ''}`}
          {...props}
        />

        {isPassword ? (
          <button
            type="button"
            className="input-icon-end input-icon-button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        ) : (
          endIcon && <div className="input-icon-end">{endIcon}</div>
        )}
      </div>

      {error ? (
        <span id={messageId} className="input-error-text" role="alert">{error}</span>
      ) : helperText ? (
        <span id={messageId} className="input-helper-text">{helperText}</span>
      ) : null}
    </div>
  );
};
