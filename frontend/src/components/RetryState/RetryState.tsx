import React, { useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '../Button/Button';
import '../ErrorState/ErrorState.css';

export interface RetryStateProps {
  title?: string;
  message: string;
  /** Awaited; the button shows a spinner until it settles. */
  onRetry: () => unknown | Promise<unknown>;
  retryLabel?: string;
  offline?: boolean;
}

/** An error that the user can fix by trying again (network blips, timeouts, failed processing). */
export const RetryState: React.FC<RetryStateProps> = ({ title = 'That didn’t work', message, onRetry, retryLabel = 'Try again', offline = false }) => {
  const [busy, setBusy] = useState(false);

  const retry = async () => {
    setBusy(true);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="error-state" role="alert">
      <div className="error-state-icon" aria-hidden="true">
        {offline ? <WifiOff size={28} /> : <RefreshCw size={28} />}
      </div>
      <h3 className="error-state-title">{title}</h3>
      <p className="error-state-message">{message}</p>
      <Button variant="primary" size="sm" startIcon={<RefreshCw size={14} aria-hidden="true" />} onClick={retry} isLoading={busy}>
        {retryLabel}
      </Button>
    </div>
  );
};
