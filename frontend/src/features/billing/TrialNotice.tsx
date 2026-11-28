import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Gift, Sparkles, X } from 'lucide-react';
import { useUsageStore } from '../../stores/usageStore';
import { useToastStore } from '../../stores/toastStore';
import { billingService } from '../../services/billingService';
import { toAppError } from '../../services/errors';
import { Button } from '../../components/Button/Button';
import { formatDate } from '../../utils/formatters';
import { safeStorage } from '../../utils/storage';
import './TrialNotice.css';

const DISMISS_KEY = 'samplecap_trial_notice_dismissed';
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

/**
 * The free Pro trial on the dashboard and the Pro plan page: an offer for accounts that can start
 * one, days left during it, and a nudge to keep Pro after it ends.
 */
export const TrialNotice: React.FC<{ placement?: 'dashboard' | 'billing'; onStarted?: () => void }> = ({ placement = 'dashboard', onStarted }) => {
  const usage = useUsageStore((s) => s.usage);
  const loadUsage = useUsageStore((s) => s.load);
  const addToast = useToastStore((s) => s.addToast);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(() => safeStorage.get(DISMISS_KEY) === '1');
  const trial = usage?.trial;
  if (!trial || !usage) return null;

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const { ends_at, days } = await billingService.startTrial();
      await loadUsage(true);
      onStarted?.();
      addToast({ type: 'success', message: `Pro is on for ${days} days, until ${formatDate(ends_at)}. Enjoy!` });
    } catch (err) {
      const e = toAppError(err, 'Could not start the trial.');
      setError(Object.values(e.fieldErrors)[0]?.[0] ?? e.message);
    } finally {
      setStarting(false);
    }
  };

  if (trial.active && trial.ends_at) {
    const left = daysLeft(trial.ends_at);
    return (
      <section className="trial-notice is-active" aria-label="Pro trial">
        <span className="trial-notice-icon" aria-hidden="true"><Crown size={20} /></span>
        <div className="trial-notice-text">
          <strong>Pro trial: {left <= 1 ? 'ends today' : `${left} days left`}</strong>
          <span>Everything in Pro until {formatDate(trial.ends_at)}. Keep it from LKR 490 a month; paying now adds the time after your trial.</span>
          <div className="trial-progress" role="progressbar" aria-label="Trial days used" aria-valuemin={0} aria-valuemax={trial.days} aria-valuenow={trial.days - left}>
            <span style={{ width: `${Math.min(100, ((trial.days - left) / trial.days) * 100)}%` }} />
          </div>
        </div>
        {placement === 'dashboard' && <Link to="/billing" className="btn btn-accent btn-sm">Keep Pro</Link>}
      </section>
    );
  }

  if (trial.eligible) {
    if (dismissed && placement === 'dashboard') return null;
    return (
      <section className="trial-notice is-offer" aria-label="Free Pro trial">
        <span className="trial-notice-icon" aria-hidden="true"><Gift size={20} /></span>
        <div className="trial-notice-text">
          <strong>Try Pro free for {trial.days} days</strong>
          <span>600 caption minutes, 4K with no watermark, every caption style and the AI tools. No payment, no card. One trial per email.</span>
          {error && <span className="trial-notice-error" role="alert">{error}</span>}
        </div>
        <Button variant="accent" size="sm" isLoading={starting} startIcon={<Sparkles size={15} aria-hidden="true" />} onClick={() => void start()}>
          Start free trial
        </Button>
        {placement === 'dashboard' && (
          <button
            type="button"
            className="trial-notice-close"
            aria-label="Hide this offer"
            title="Hide"
            onClick={() => {
              safeStorage.set(DISMISS_KEY, '1');
              setDismissed(true);
            }}
          >
            <X size={15} />
          </button>
        )}
      </section>
    );
  }

  // Trial over and back on Free: a gentle nudge on the dashboard.
  if (placement === 'dashboard' && trial.used && usage.plan.key === 'free' && trial.ends_at && daysLeft(trial.ends_at) === 0 && Date.now() - new Date(trial.ends_at).getTime() < 14 * 86_400_000) {
    return (
      <section className="trial-notice is-ended" aria-label="Pro trial ended">
        <span className="trial-notice-icon" aria-hidden="true"><Crown size={20} /></span>
        <div className="trial-notice-text">
          <strong>Your Pro trial has ended</strong>
          <span>Your projects are safe on Free. Get Pro back from LKR 490 a month, or LKR 3,990 a year.</span>
        </div>
        <Link to="/billing" className="btn btn-accent btn-sm">Get Pro</Link>
      </section>
    );
  }
  return null;
};
