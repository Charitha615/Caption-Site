import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuthStore } from '../../stores/authStore';
import { adminSignupService, type SignupPeriod, type SignupReport } from '../../services/adminSignupService';
import { toAppError } from '../../services/errors';
import './AdminReviewsPage.css';

const PERIODS: Array<{ days: SignupPeriod; label: string }> = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All time' },
];

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

/** Admin: which platforms, posts and creators bring sign-ups, and how many of them go Pro. */
export const AdminSignupsPage: React.FC = () => {
  useDocumentTitle('Sign-ups');
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const [days, setDays] = useState<SignupPeriod>(30);
  const [data, setData] = useState<SignupReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    adminSignupService.report(days)
      .then((report) => {
        if (!active) return;
        setData(report);
        setError(null);
      })
      .catch((err) => active && setError(toAppError(err, 'Could not load sign-ups.').message));
    return () => { active = false; };
  }, [isAdmin, days]);

  if (!isAdmin) {
    return (
      <div className="admin-reviews">
        <p className="admin-empty"><ShieldAlert size={18} aria-hidden="true" /> Only admins can see sign-up sources.</p>
      </div>
    );
  }

  return (
    <div className="admin-reviews">
      <div>
        <h2 className="page-heading">Sign-ups</h2>
        <p className="page-subheading">
          Where new users came from. Tag your links like <code>sinsub.cc/?utm_source=tiktok&amp;utm_campaign=launch</code>, or give a creator <code>sinsub.cc/?ref=theirname</code>.
        </p>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Period">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            role="tab"
            aria-selected={days === p.days}
            className={`admin-tab ${days === p.days ? 'is-on' : ''}`}
            onClick={() => setDays(p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && <div className="form-alert" role="alert">{error}</div>}

      {data && (
        <>
          <div className="admin-stats">
            <div className="admin-stat"><span className="admin-stat-value">{data.totals.signups}</span><span className="admin-stat-label">Sign-ups</span></div>
            <div className="admin-stat"><span className="admin-stat-value">{data.totals.paid}</span><span className="admin-stat-label">Went Pro ({percent(data.totals.paid, data.totals.signups)})</span></div>
            <div className="admin-stat"><span className="admin-stat-value">{percent(data.totals.tracked, data.totals.signups)}</span><span className="admin-stat-label">With a known source</span></div>
          </div>

          {data.sources.length === 0
            ? <p className="admin-empty">No sign-ups in this period.</p>
            : (
              <div className="admin-table-wrap" role="tabpanel">
                <table className="admin-table">
                  <thead>
                    <tr><th scope="col">Source</th><th scope="col">Medium</th><th scope="col">Campaign</th><th scope="col">Sign-ups</th><th scope="col">Went Pro</th></tr>
                  </thead>
                  <tbody>
                    {data.sources.map((row) => (
                      <tr key={`${row.source}|${row.medium}|${row.campaign}`}>
                        <td>{row.source ?? <span className="admin-muted">(direct / unknown)</span>}</td>
                        <td>{row.medium ?? '—'}</td>
                        <td>{row.campaign ?? '—'}</td>
                        <td>{row.signups}</td>
                        <td>{row.paid} <span className="admin-muted">({percent(row.paid, row.signups)})</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </>
      )}
    </div>
  );
};
