import React, { useEffect, useState } from 'react';
import { Check, ShieldAlert, X } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { reviewService, type AdminReviewList, type ReviewStatus } from '../../services/reviewService';
import { toAppError } from '../../services/errors';
import { Button } from '../../components/Button/Button';
import { Stars } from '../../components/ui/StarRating/StarRating';
import './AdminReviewsPage.css';

const TABS: Array<{ status: ReviewStatus; label: string }> = [
  { status: 'pending', label: 'Waiting' },
  { status: 'approved', label: 'Published' },
  { status: 'rejected', label: 'Not published' },
];

/** Admin: approve creator reviews before they appear on the sign-in / sign-up pages. */
export const AdminReviewsPage: React.FC = () => {
  useDocumentTitle('Reviews');
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const addToast = useToastStore((s) => s.addToast);
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [data, setData] = useState<AdminReviewList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    reviewService.adminList(status)
      .then((list) => {
        if (!active) return;
        setData(list);
        setError(null);
      })
      .catch((err) => active && setError(toAppError(err, 'Could not load reviews.').message));
    return () => { active = false; };
  }, [isAdmin, status, reload]);

  const moderate = async (uuid: string, next: 'approved' | 'rejected') => {
    setBusy(uuid);
    try {
      await reviewService.moderate(uuid, next);
      addToast({ type: 'success', message: next === 'approved' ? 'Review published.' : 'Review hidden.' });
      setReload((n) => n + 1);
    } catch (err) {
      addToast({ type: 'error', message: toAppError(err, 'Could not update the review.').message });
    } finally {
      setBusy(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="admin-reviews">
        <p className="admin-empty"><ShieldAlert size={18} aria-hidden="true" /> Only admins can manage reviews.</p>
      </div>
    );
  }

  return (
    <div className="admin-reviews">
      <div>
        <h2 className="page-heading">Reviews</h2>
        <p className="page-subheading">Published reviews are shown on the sign-in and sign-up pages with the reviewer&apos;s name and photo.</p>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Review status">
        {TABS.map((t) => (
          <button
            key={t.status}
            type="button"
            role="tab"
            aria-selected={status === t.status}
            className={`admin-tab ${status === t.status ? 'is-on' : ''}`}
            onClick={() => setStatus(t.status)}
          >
            {t.label} <span className="admin-tab-count">{data?.counts?.[t.status] ?? 0}</span>
          </button>
        ))}
      </div>

      {error && <div className="form-alert" role="alert">{error}</div>}

      <ul className="admin-review-list" role="tabpanel">
        {data?.reviews.length === 0 && <li className="admin-empty">Nothing here.</li>}
        {data?.reviews.map((r) => (
          <li key={r.uuid} className="admin-review">
            <div className="admin-review-head">
              {r.avatar_url
                ? <img className="admin-avatar" src={r.avatar_url} alt="" referrerPolicy="no-referrer" />
                : <span className="admin-avatar" aria-hidden="true">{(r.name ?? '?').charAt(0).toUpperCase()}</span>}
              <div>
                <p className="admin-review-name">{r.name}</p>
                {r.role && <p className="admin-review-role">{r.role}</p>}
              </div>
              <Stars value={r.rating} />
            </div>
            <p className="admin-review-body">{r.body}</p>
            <div className="admin-review-actions">
              {r.status !== 'approved' && (
                <Button size="sm" variant="primary" isLoading={busy === r.uuid} startIcon={<Check size={15} aria-hidden="true" />} onClick={() => void moderate(r.uuid, 'approved')}>
                  Publish
                </Button>
              )}
              {r.status !== 'rejected' && (
                <Button size="sm" variant="outline" disabled={busy === r.uuid} startIcon={<X size={15} aria-hidden="true" />} onClick={() => void moderate(r.uuid, 'rejected')}>
                  {r.status === 'approved' ? 'Unpublish' : 'Reject'}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
