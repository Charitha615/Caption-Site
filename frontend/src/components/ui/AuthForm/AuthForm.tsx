import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './AuthForm.css';

/** Icon badge with a soft glow, title and subtitle at the top of a sign-in / sign-up form. */
export function AuthHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="auth-head">
      <div className="auth-head-badge" aria-hidden="true">
        <span className="auth-head-glow" />
        <span className="auth-head-icon">{icon}</span>
      </div>
      <div className="auth-head-text">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Shown at the right end of the label row (e.g. "Forgot password?"). */
  labelAside?: React.ReactNode;
}

/** Label + input + error/hint, wired for screen readers. */
export function AuthField({ id, label, error, hint, labelAside, className = '', ...input }: FieldProps) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="auth-field">
      <div className="auth-field-label-row">
        <label htmlFor={id}>{label}</label>
        {labelAside}
      </div>
      <input id={id} className={`auth-input ${error ? 'has-error' : ''} ${className}`} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {error ? <p id={`${id}-error`} className="auth-field-error" role="alert">{error}</p> : hint ? <p id={`${id}-hint`} className="auth-field-hint">{hint}</p> : null}
    </div>
  );
}

/** Password field with a show / hide toggle inside the input. */
export function PasswordField(props: Omit<FieldProps, 'type'>) {
  const [visible, setVisible] = useState(false);
  const { id, label, error, hint, labelAside, ...input } = props;
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="auth-field">
      <div className="auth-field-label-row">
        <label htmlFor={id}>{label}</label>
        {labelAside}
      </div>
      <div className={`auth-input-group ${error ? 'has-error' : ''}`}>
        <input id={id} type={visible ? 'text' : 'password'} className="auth-input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
        <button type="button" className="auth-input-addon" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
      {error ? <p id={`${id}-error`} className="auth-field-error" role="alert">{error}</p> : hint ? <p id={`${id}-hint`} className="auth-field-hint">{hint}</p> : null}
    </div>
  );
}

export function AuthCheckbox({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="auth-check" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function AuthDivider({ children = 'or continue with' }: { children?: React.ReactNode }) {
  return <div className="auth-divider"><span>{children}</span></div>;
}

/** Google's "G" mark (brand colours). */
export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28V6.61H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4.01-3.11z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.94 11.94 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77z" />
    </svg>
  );
}

export function SocialButton({ icon, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: React.ReactNode }) {
  return (
    <button type="button" className="auth-social" {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
