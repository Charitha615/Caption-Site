import React from 'react';
import './Progress.css';

export interface ProgressProps {
  /** 0–100; omit for an indeterminate bar. */
  value?: number;
  label: string;
  /** Visible text beside the label, e.g. "42% · 3.1 MB/s". */
  detail?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

/** Accessible progress bar (role="progressbar"); the label is always available to screen readers. */
export const Progress: React.FC<ProgressProps> = ({ value, label, detail, tone = 'primary', size = 'md', showLabel = true }) => {
  const indeterminate = value === undefined;
  const pct = indeterminate ? 0 : Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className={`progress progress-${size}`}>
      {showLabel && (
        <div className="progress-header">
          <span className="progress-label">{label}</span>
          {detail && <span className="progress-detail">{detail}</span>}
        </div>
      )}
      <div
        className={`progress-track ${indeterminate ? 'progress-indeterminate' : ''}`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : pct}
        aria-valuetext={detail}
      >
        <div className={`progress-fill progress-fill-${tone}`} style={indeterminate ? undefined : { width: `${pct}%` }} />
      </div>
    </div>
  );
};
