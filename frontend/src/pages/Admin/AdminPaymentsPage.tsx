import React, { useEffect, useState } from 'react';
import { Check, FileText, ShieldAlert, X } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { billingService, type AdminPaymentList } from '../../services/billingService';
import { toAppError } from '../../services/errors';
import { Button } from '../../components/Button/Button';
import { Modal } from '../../components/Modal/Modal';
import { formatDate, formatDateTime } from '../../utils/formatters';
import type { Payment, PaymentStatus } from '../../types/auth';
import './AdminReviewsPage.css';

const TABS: Array<{ status: PaymentStatus; label: string }> = [
  { status: 'pending', label: 'To check' },
  { status: 'approved', label: 'Approved' },
  { status: 'rejected', label: 'Rejected' },
];

const money = (p: Payment) => `${p.currency} ${new Intl.NumberFormat('en-US').format(p.amount)}`;

/** Admin: match bank transfers to Pro payments, then approve (Pro turns on) or reject with a reason. */
export const AdminPaymentsPage: React.FC = () => {
  useDocumentTitle('Payments');
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const addToast = useToastStore((s) => s.addToast);
  const [status, setStatus] = useState<PaymentStatus>('pending');
  const [data, setData] = useState<AdminPaymentList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [slip, setSlip] = useState<{ payment: Payment; url: string; isPdf: boolean } | null>(null);
  const [rejecting, setRejecting] = useState<Payment | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    billingService.adminList(status)
      .then((list) => {
        if (!active) return;
        setData(list);
        setError(null);
      })
      .catch((err) => active && setError(toAppError(err, 'Could not load payments.').message));
    return () => { active = false; };
  }, [isAdmin, status, reload]);

  // Free the slip's object URL when the viewer closes.
  useEffect(() => () => { if (slip) URL.revokeObjectURL(slip.url); }, [slip]);

  const openSlip = async (payment: Payment) => {
    try {
      const blob = await billingService.slip(payment.uuid);
      setSlip({ payment, url: URL.createObjectURL(blob), isPdf: blob.type === 'application/pdf' });
    } catch {
      /* toast shown by the API client */
    }
  };

  const approve = async (payment: Payment) => {
    setBusy(payment.uuid);
    try {
      const done = await billingService.approve(payment.uuid);
      addToast({ type: 'success', message: `Pro is on for ${payment.user?.name ?? 'the user'} until ${done.period_end ? formatDate(done.period_end) : '—'}.` });
      setSlip(null);
      setReload((n) => n + 1);
    } catch {
      /* toast shown by the API client */
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!rejecting || !reason.trim()) return;
    setBusy(rejecting.uuid);
    try {
      await billingService.reject(rejecting.uuid, reason.trim());
      addToast({ type: 'success', message: 'Payment rejected. The user was emailed the reason.' });
      setRejecting(null);
      setReason('');
      setSlip(null);
      setReload((n) => n + 1);
    } catch (err) {
      addToast({ type: 'error', message: toAppError(err, 'Could not reject the payment.').message });
    } finally {
      setBusy(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="admin-reviews">
        <p className="admin-empty"><ShieldAlert size={18} aria-hidden="true" /> Only admins can manage payments.</p>
      </div>
    );
  }

  return (
    <div className="admin-reviews">
      <div>
        <h2 className="page-heading">Payments</h2>
        <p className="page-subheading">Pro requests from WhatsApp. Reply with the bank details, find the transfer by its reference and amount, then approve it to turn Pro on.</p>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Payment status">
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
        {data?.payments.length === 0 && <li className="admin-empty">Nothing here.</li>}
        {data?.payments.map((p) => (
          <li key={p.uuid} className="admin-review">
            <div className="admin-review-head">
              <span className="admin-avatar" aria-hidden="true">{(p.user?.name ?? '?').charAt(0).toUpperCase()}</span>
              <div>
                <p className="admin-review-name">{p.user?.name}</p>
                <p className="admin-review-role">{p.user?.email}</p>
              </div>
              <p className="admin-payment-amount">{money(p)}</p>
            </div>
            <p className="admin-review-body">
              Pro {p.period} · reference <strong>{p.reference}</strong> · sent {formatDateTime(p.created_at)}
              {p.note && <><br />Note: {p.note}</>}
              {p.status === 'approved' && p.period_end && <><br />Pro until {formatDate(p.period_end)}</>}
              {p.status === 'rejected' && p.admin_note && <><br />Reason: {p.admin_note}</>}
              {p.status === 'pending' && p.user?.plan === 'pro' && p.user.plan_expires_at && (
                <><br />Already on Pro until {formatDate(p.user.plan_expires_at)}: the new time is added after that.</>
              )}
            </p>
            <div className="admin-review-actions">
              {p.has_slip
                ? <Button size="sm" variant="outline" startIcon={<FileText size={15} aria-hidden="true" />} onClick={() => void openSlip(p)}>View slip</Button>
                : <span className="admin-payment-noslip">No slip uploaded (check WhatsApp)</span>}
              {p.status === 'pending' && (
                <>
                  <Button size="sm" variant="primary" isLoading={busy === p.uuid} startIcon={<Check size={15} aria-hidden="true" />} onClick={() => void approve(p)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === p.uuid} startIcon={<X size={15} aria-hidden="true" />} onClick={() => setRejecting(p)}>
                    Reject
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Modal isOpen={slip !== null} onClose={() => setSlip(null)} title={slip ? `Slip · ${slip.payment.reference} · ${money(slip.payment)}` : ''} size="lg">
        {slip && (slip.isPdf
          ? <iframe className="admin-slip" src={slip.url} title="Payment slip" />
          : <img className="admin-slip" src={slip.url} alt={`Payment slip for ${slip.payment.reference}`} />)}
      </Modal>

      <Modal isOpen={rejecting !== null} onClose={() => setRejecting(null)} title="Reject this payment?">
        <label className="input-label" htmlFor="reject-reason">Reason (emailed to the user)</label>
        <textarea
          id="reject-reason"
          className="input-field"
          style={{ width: '100%', resize: 'vertical' }}
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. We couldn't find a transfer with this reference."
        />
        <div className="admin-review-actions" style={{ marginTop: 12 }}>
          <Button variant="danger" disabled={!reason.trim()} isLoading={busy === rejecting?.uuid} onClick={() => void reject()}>Reject payment</Button>
          <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
        </div>
      </Modal>
    </div>
  );
};
