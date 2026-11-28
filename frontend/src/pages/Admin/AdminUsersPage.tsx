import React, { useEffect, useState } from 'react';
import { KeyRound, LogOut, RotateCcw, Search, ShieldAlert, Trash2, UserCog } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { adminUserService, type AdminUser, type AdminUserList } from '../../services/adminUserService';
import { toAppError } from '../../services/errors';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import { Modal } from '../../components/Modal/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { formatDate, formatTimeAgo } from '../../utils/formatters';
import './AdminReviewsPage.css';

const PLAN_BADGE: Record<string, 'gray' | 'orange' | 'purple'> = { free: 'gray', pro: 'orange', unlimited: 'purple' };

type Confirm = 'usage' | 'signout' | 'projects';

const CONFIRM_TEXT: Record<Confirm, { title: string; message: string; label: string; danger: boolean }> = {
  usage: {
    title: 'Give a fresh month?',
    message: "Caption minutes, renders, exports and today's AI requests go back to 0. Past usage is kept in the records.",
    label: 'Reset usage',
    danger: false,
  },
  signout: { title: 'Sign out every device?', message: 'The user will need to sign in again everywhere. Their password stays the same.', label: 'Sign out', danger: false },
  projects: {
    title: 'Delete all their projects?',
    message: 'Every video, caption and export this user has will be deleted for good. The account stays. This cannot be undone.',
    label: 'Delete all projects',
    danger: true,
  },
};

/** "2026-12-28" for a date input, from an ISO date. */
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

/** Admin: everyone who has registered, their plan (incl. Unlimited, which is only given here), and account resets. */
export const AdminUsersPage: React.FC = () => {
  useDocumentTitle('Users');
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const addToast = useToastStore((s) => s.addToast);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminUserList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [plan, setPlan] = useState('free');
  const [expiresAt, setExpiresAt] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  // Search after the admin stops typing.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    adminUserService.list({ search: query || undefined, plan: planFilter || undefined, page })
      .then((list) => {
        if (!active) return;
        setData(list);
        setError(null);
      })
      .catch((err) => active && setError(toAppError(err, 'Could not load users.').message));
    return () => { active = false; };
  }, [isAdmin, query, planFilter, page, reload]);

  const open = async (user: AdminUser) => {
    setSelected(user);
    setPlan(user.plan);
    setExpiresAt(toDateInput(user.plan_expires_at));
    setPassword('');
    setFormError(null);
    try {
      setSelected(await adminUserService.get(user.uuid));
    } catch {
      /* toast shown by the API client */
    }
  };

  const updated = (user: AdminUser, message: string) => {
    setSelected(user);
    setPlan(user.plan);
    setExpiresAt(toDateInput(user.plan_expires_at));
    setReload((n) => n + 1);
    addToast({ type: 'success', message });
  };

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    setFormError(null);
    try {
      await task();
    } catch (err) {
      const e = toAppError(err);
      setFormError(Object.values(e.fieldErrors)[0]?.[0] ?? e.message);
    } finally {
      setBusy(null);
    }
  };

  const savePlan = () => run('plan', async () => {
    if (!selected) return;
    const user = await adminUserService.setPlan(selected.uuid, plan, plan === 'free' ? null : expiresAt || null);
    updated(user, `${user.name} is now on ${user.plan_label}${user.plan_expires_at ? ` until ${formatDate(user.plan_expires_at)}` : ''}.`);
  });

  const savePassword = () => run('password', async () => {
    if (!selected) return;
    await adminUserService.resetPassword(selected.uuid, password);
    setPassword('');
    addToast({ type: 'success', message: `New password set for ${selected.name}. Send it to them; they were signed out everywhere.` });
  });

  const runConfirm = () => {
    const action = confirm;
    if (!selected || !action) return;
    void run(action, async () => {
      if (action === 'usage') {
        updated(await adminUserService.resetUsage(selected.uuid), `${selected.name} has a fresh month.`);
      } else if (action === 'signout') {
        const n = await adminUserService.signOut(selected.uuid);
        addToast({ type: 'success', message: `Signed out of ${n} ${n === 1 ? 'device' : 'devices'}.` });
      } else {
        const n = await adminUserService.deleteProjects(selected.uuid);
        updated(await adminUserService.get(selected.uuid), `Deleted ${n} ${n === 1 ? 'project' : 'projects'}.`);
      }
    }).finally(() => setConfirm(null));
  };

  if (!isAdmin) {
    return (
      <div className="admin-reviews">
        <p className="admin-empty"><ShieldAlert size={18} aria-hidden="true" /> Only admins can manage users.</p>
      </div>
    );
  }

  const usage = selected?.usage;
  const meter = (m?: { used: number; limit: number | null }) => (m ? `${m.used} / ${m.limit ?? '∞'}` : '—');

  return (
    <div className="admin-reviews">
      <div>
        <h2 className="page-heading">Users</h2>
        <p className="page-subheading">
          Everyone who has registered. Change a plan, or give <strong>Unlimited</strong> to special users. It is never sold on the pricing page.
        </p>
      </div>

      <div className="admin-user-filters">
        <label className="admin-user-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" aria-label="Search users" />
        </label>
        <select className="input-field admin-user-select" value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }} aria-label="Filter by plan">
          <option value="">All plans</option>
          {data?.plans.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        {data && <span className="admin-user-total">{data.meta.total} {data.meta.total === 1 ? 'user' : 'users'}</span>}
      </div>

      {error && <div className="form-alert" role="alert">{error}</div>}

      <ul className="admin-review-list">
        {data?.users.length === 0 && <li className="admin-empty">No users found.</li>}
        {data?.users.map((u) => (
          <li key={u.uuid} className="admin-review admin-user-row">
            <span className="admin-avatar" aria-hidden="true">{u.name.charAt(0).toUpperCase()}</span>
            <div className="admin-user-main">
              <p className="admin-review-name">
                {u.name} {u.role === 'admin' && <Badge variant="blue" size="sm">Admin</Badge>}
              </p>
              <p className="admin-review-role">{u.email}</p>
              <p className="admin-review-role">
                {u.projects_count} {u.projects_count === 1 ? 'project' : 'projects'}
                {u.created_at && <> · joined {formatDate(u.created_at)}</>}
                {u.last_active_at && <> · active {formatTimeAgo(u.last_active_at)}</>}
              </p>
            </div>
            <div className="admin-user-plan">
              <Badge variant={PLAN_BADGE[u.plan] ?? 'gray'} size="sm">{u.plan_label}</Badge>
              <span className="admin-review-role">
                {u.plan === 'free' ? (u.stored_plan && u.stored_plan !== 'free' ? `${u.stored_plan} ended` : '') : u.plan_expires_at ? `until ${formatDate(u.plan_expires_at)}` : 'no end date'}
              </span>
            </div>
            <Button size="sm" variant="outline" startIcon={<UserCog size={15} aria-hidden="true" />} onClick={() => void open(u)}>Manage</Button>
          </li>
        ))}
      </ul>

      {data && data.meta.last_page > 1 && (
        <div className="admin-review-actions">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="admin-user-total">Page {data.meta.current_page} of {data.meta.last_page}</span>
          <Button size="sm" variant="outline" disabled={page >= data.meta.last_page} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      <Modal isOpen={selected !== null} onClose={() => setSelected(null)} title={selected ? selected.name : ''} description={selected?.email} size="md" dismissible={busy === null}>
        {selected && (
          <div className="admin-user-manage">
            <p className="admin-review-role">{selected.email}</p>

            <section aria-labelledby="plan-title">
              <h3 id="plan-title" className="admin-user-h">Plan</h3>
              <div className="admin-user-form">
                <label className="input-label">
                  Plan
                  <select className="input-field" value={plan} onChange={(e) => setPlan(e.target.value)}>
                    {data?.plans.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </label>
                {plan !== 'free' && (
                  <label className="input-label">
                    Ends on
                    <input type="date" className="input-field" value={expiresAt} min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} onChange={(e) => setExpiresAt(e.target.value)} />
                  </label>
                )}
                <Button size="sm" isLoading={busy === 'plan'} disabled={busy !== null} onClick={() => void savePlan()}>Save plan</Button>
              </div>
              <p className="ed-help admin-review-role">
                {plan === 'unlimited'
                  ? 'Unlimited: no limits and every Pro feature. Leave the end date empty to keep it for good.'
                  : plan === 'free'
                    ? 'Free has no end date.'
                    : 'Leave the end date empty to keep the plan with no end date.'}
              </p>
            </section>

            <section aria-labelledby="usage-title">
              <h3 id="usage-title" className="admin-user-h">This month</h3>
              <dl className="admin-user-usage">
                <div><dt>Caption minutes</dt><dd>{meter(usage?.caption_minutes)}</dd></div>
                <div><dt>Video renders</dt><dd>{meter(usage?.renders)}</dd></div>
                <div><dt>Subtitle exports</dt><dd>{meter(usage?.exports)}</dd></div>
                <div><dt>AI requests today</dt><dd>{meter(usage?.ai_requests_today)}</dd></div>
                <div><dt>Storage (MB)</dt><dd>{meter(usage?.storage_mb)}</dd></div>
              </dl>
              {selected.usage_reset_at && <p className="admin-review-role">Usage last reset {formatDate(selected.usage_reset_at)}.</p>}
            </section>

            <section aria-labelledby="pw-title">
              <h3 id="pw-title" className="admin-user-h">Reset password</h3>
              <div className="admin-user-form">
                <label className="input-label">
                  New password
                  <input type="text" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 letters and numbers" autoComplete="new-password" />
                </label>
                <Button size="sm" variant="outline" startIcon={<KeyRound size={15} aria-hidden="true" />} isLoading={busy === 'password'} disabled={busy !== null || password.length < 8} onClick={() => void savePassword()}>
                  Set password
                </Button>
              </div>
              <p className="admin-review-role">Send the new password to the user. They are signed out of every device.</p>
            </section>

            {formError && <div className="form-alert" role="alert">{formError}</div>}

            <section aria-labelledby="reset-title">
              <h3 id="reset-title" className="admin-user-h">Reset account</h3>
              <div className="admin-review-actions">
                <Button size="sm" variant="outline" startIcon={<RotateCcw size={15} aria-hidden="true" />} disabled={busy !== null} onClick={() => setConfirm('usage')}>Reset this month&apos;s usage</Button>
                <Button size="sm" variant="outline" startIcon={<LogOut size={15} aria-hidden="true" />} disabled={busy !== null} onClick={() => setConfirm('signout')}>Sign out all devices</Button>
                <Button size="sm" variant="danger" startIcon={<Trash2 size={15} aria-hidden="true" />} disabled={busy !== null || selected.projects_count === 0} onClick={() => setConfirm('projects')}>
                  Delete all projects ({selected.projects_count})
                </Button>
              </div>
            </section>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirm !== null}
        title={confirm ? CONFIRM_TEXT[confirm].title : ''}
        message={confirm ? `${selected?.name}: ${CONFIRM_TEXT[confirm].message}` : ''}
        confirmLabel={confirm ? CONFIRM_TEXT[confirm].label : 'Confirm'}
        tone={confirm && CONFIRM_TEXT[confirm].danger ? 'danger' : 'default'}
        isLoading={busy !== null}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};
