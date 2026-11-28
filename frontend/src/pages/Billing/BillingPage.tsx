import React, { useCallback, useEffect, useId, useState } from 'react';
import { Check, CheckCircle2, Clock, Copy, Crown, FileUp, MessageCircle, XCircle } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { billingService } from '../../services/billingService';
import { toAppError } from '../../services/errors';
import { useToastStore } from '../../stores/toastStore';
import { useUsageStore } from '../../stores/usageStore';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/Button/Button';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { RetryState } from '../../components/RetryState/RetryState';
import { PRICING_PLANS, YEARLY_SAVING_LABEL } from '../../config/pricing';
import { formatDate, formatDateTime } from '../../utils/formatters';
import type { BillingInfo, BillingPeriod, Payment } from '../../types/auth';
import './BillingPage.css';

const money = (currency: string, amount: number) => `${currency} ${new Intl.NumberFormat('en-US').format(amount)}`;
const PERIOD_LABEL: Record<BillingPeriod, string> = { monthly: 'Monthly', yearly: 'Yearly' };
const SLIP_TYPES = 'image/jpeg,image/png,image/webp,image/heic,application/pdf';

function CopyRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const addToast = useToastStore((s) => s.addToast);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      addToast({ type: 'success', message: `${label} copied.`, duration: 1800 });
    } catch {
      /* clipboard blocked: the value is still on screen */
    }
  };
  return (
    <div className={`billing-row ${strong ? 'is-strong' : ''}`}>
      <dt>{label}</dt>
      <dd>
        <span>{value}</span>
        <button type="button" className="billing-copy" onClick={() => void copy()} aria-label={`Copy ${label.toLowerCase()}`} title="Copy">
          <Copy size={14} aria-hidden="true" />
        </button>
      </dd>
    </div>
  );
}

function StatusBadge({ status }: { status: Payment['status'] }) {
  const map = {
    pending: { icon: <Clock size={14} aria-hidden="true" />, label: 'Checking' },
    approved: { icon: <CheckCircle2 size={14} aria-hidden="true" />, label: 'Approved' },
    rejected: { icon: <XCircle size={14} aria-hidden="true" />, label: 'Not confirmed' },
  } as const;
  return <span className={`billing-status is-${status}`}>{map[status].icon} {map[status].label}</span>;
}

/** Upgrade to Pro (or renew): pick monthly / yearly, transfer to the bank, send the slip. */
export const BillingPage: React.FC = () => {
  useDocumentTitle('Upgrade to Pro');
  const addToast = useToastStore((s) => s.addToast);
  const loadUsage = useUsageStore((s) => s.load);
  const userName = useAuthStore((s) => s.user?.name);
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>('yearly');
  const [slip, setSlip] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const slipId = useId();

  const fetchInfo = useCallback(
    () => billingService.get().then((data) => { setInfo(data); setError(null); }).catch((err) => setError(toAppError(err).message)),
    [],
  );
  const load = useCallback(() => {
    setError(null);
    return fetchInfo();
  }, [fetchInfo]);

  useEffect(() => {
    void fetchInfo();
  }, [fetchInfo]);

  // Pro is on (e.g. just approved): refresh the plan's limits used elsewhere in the app.
  const planKey = info?.plan.key;
  useEffect(() => {
    if (planKey && planKey !== 'free') void loadUsage(true).catch(() => undefined);
  }, [planKey, loadUsage]);

  if (error) return <RetryState title="Could not load your plan" message={error} onRetry={load} />;
  if (!info) return <LoadingState label="Loading your plan…" />;

  const { billing, plan, payments } = info;
  const pending = payments.find((p) => p.status === 'pending');
  const isPro = plan.key !== 'free';
  /** Given by an admin, never sold: nothing to pay or renew. */
  const isUnlimited = plan.key === 'unlimited';
  const amount = billing.prices[period];
  const proPlan = PRICING_PLANS.find((p) => p.key === 'pro');
  const whatsappText = (p?: Payment) =>
    `Hi! Here is my Pro payment slip.\nReference: ${billing.reference}\nPlan: Pro ${PERIOD_LABEL[p?.period ?? period].toLowerCase()} (${money(billing.currency, p?.amount ?? amount)})${userName ? `\nName: ${userName}` : ''}`;
  const whatsappUrl = (p?: Payment) => `${billing.whatsapp_link}?text=${encodeURIComponent(whatsappText(p))}`;

  const submit = async (via: 'slip' | 'whatsapp') => {
    setFormError(null);
    if (via === 'slip' && !slip) {
      setFormError('Choose the photo or PDF of your bank slip first.');
      return;
    }
    if (via === 'whatsapp') window.open(whatsappUrl(), '_blank', 'noopener');
    setSending(true);
    try {
      await billingService.submit(period, via === 'slip' ? slip : null, via === 'whatsapp' ? 'Slip sent on WhatsApp' : undefined);
      setSlip(null);
      addToast({ type: 'success', message: 'Thank you! We will check your payment and switch Pro on soon.' });
      await load();
    } catch (err) {
      const e = toAppError(err);
      setFormError(Object.values(e.fieldErrors)[0]?.[0] ?? e.message);
    } finally {
      setSending(false);
    }
  };

  const addSlip = async (payment: Payment, file: File) => {
    try {
      await billingService.attachSlip(payment.uuid, file);
      addToast({ type: 'success', message: 'Slip added. Thank you!' });
      await load();
    } catch (err) {
      addToast({ type: 'error', message: toAppError(err, 'Could not upload the slip.').message });
    }
  };

  return (
    <div className="billing">
      <div>
        <h2 className="page-heading">{isUnlimited ? 'Your Unlimited plan' : isPro ? 'Your Pro plan' : 'Upgrade to Pro'}</h2>
        <p className="page-subheading">
          {isUnlimited
            ? <>Every feature with no limits, from the සිංSub team{plan.expires_at ? <>, until <strong>{formatDate(plan.expires_at)}</strong></> : ''}. There is nothing to pay.</>
            : isPro && plan.expires_at
            ? <>Pro is active until <strong>{formatDate(plan.expires_at)}</strong>. Renew any time: the new time is added after this date.</>
            : 'Pay by bank transfer. Pro turns on as soon as we confirm your payment.'}
        </p>
      </div>

      {isUnlimited ? null : pending ? (
        <section className="billing-card billing-pending" aria-labelledby="pending-title">
          <h3 id="pending-title"><Clock size={20} aria-hidden="true" /> We are checking your payment</h3>
          <p>
            {money(pending.currency, pending.amount)} for Pro {PERIOD_LABEL[pending.period].toLowerCase()}, sent {formatDateTime(pending.created_at)}.
            We will email you as soon as Pro is on — usually within a few hours.
          </p>
          {!pending.has_slip && (
            <div className="billing-pending-slip">
              <p>Haven&apos;t sent the slip yet? Upload it here or send it on WhatsApp.</p>
              <div className="billing-actions">
                <label className="btn btn-outline btn-sm billing-file">
                  <FileUp size={15} aria-hidden="true" /> Upload slip
                  <input type="file" accept={SLIP_TYPES} onChange={(e) => e.target.files?.[0] && void addSlip(pending, e.target.files[0])} />
                </label>
                <a className="btn btn-outline btn-sm" href={whatsappUrl(pending)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={15} aria-hidden="true" /> WhatsApp {billing.whatsapp}
                </a>
              </div>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="billing-card" aria-labelledby="step-1">
            <h3 id="step-1"><span className="billing-step">1</span> Choose how long</h3>
            <div className="billing-periods" role="radiogroup" aria-label="Billing period">
              {(['monthly', 'yearly'] as const).map((p) => (
                <label key={p} className={`billing-period ${period === p ? 'is-on' : ''}`}>
                  <input type="radio" name="period" value={p} checked={period === p} onChange={() => setPeriod(p)} />
                  <span className="billing-period-name">{PERIOD_LABEL[p]}{p === 'yearly' && <span className="billing-save">{YEARLY_SAVING_LABEL}</span>}</span>
                  <span className="billing-period-price">{money(billing.currency, billing.prices[p])}<small>{p === 'monthly' ? ' / month' : ' / year'}</small></span>
                  {p === 'yearly' && <span className="billing-period-hint">about {money(billing.currency, Math.round(billing.prices.yearly / 12))} a month</span>}
                </label>
              ))}
            </div>
          </section>

          <section className="billing-card" aria-labelledby="step-2">
            <h3 id="step-2"><span className="billing-step">2</span> Transfer {money(billing.currency, amount)}</h3>
            {billing.bank_ready ? (
              <dl className="billing-bank">
                <CopyRow label="Amount" value={String(amount)} strong />
                {billing.bank.bank_name && <CopyRow label="Bank" value={billing.bank.bank_name} />}
                <CopyRow label="Account name" value={billing.bank.account_name} />
                <CopyRow label="Account number" value={billing.bank.account_number} strong />
                {billing.bank.branch && <CopyRow label="Branch" value={billing.bank.branch} />}
                <CopyRow label="Reference (write in the remarks)" value={billing.reference} strong />
              </dl>
            ) : (
              <p className="billing-note">
                Our bank details will appear here soon. For now, message us on WhatsApp at{' '}
                <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">{billing.whatsapp}</a> and we&apos;ll send them.
                Your reference is <strong>{billing.reference}</strong>.
              </p>
            )}
            <p className="billing-note">Write the reference <strong>{billing.reference}</strong> in the transfer&apos;s remarks / description so we can find your payment quickly.</p>
          </section>

          <section className="billing-card" aria-labelledby="step-3">
            <h3 id="step-3"><span className="billing-step">3</span> Send us the slip</h3>
            <label htmlFor={slipId} className={`billing-drop ${slip ? 'has-file' : ''}`}>
              <FileUp size={22} aria-hidden="true" />
              <span>{slip ? slip.name : 'Choose a photo or PDF of the bank slip / receipt'}</span>
              <input id={slipId} type="file" accept={SLIP_TYPES} onChange={(e) => setSlip(e.target.files?.[0] ?? null)} />
            </label>
            {formError && <div className="form-alert" role="alert">{formError}</div>}
            <div className="billing-actions">
              <Button type="button" variant="primary" isLoading={sending} disabled={!slip} startIcon={<Check size={16} aria-hidden="true" />} onClick={() => void submit('slip')}>
                Send for checking
              </Button>
              <span className="billing-or">or</span>
              <Button type="button" variant="outline" disabled={sending} startIcon={<MessageCircle size={16} aria-hidden="true" />} onClick={() => void submit('whatsapp')}>
                Send it on WhatsApp ({billing.whatsapp})
              </Button>
            </div>
          </section>
        </>
      )}

      {proPlan && !isPro && (
        <section className="billing-card" aria-labelledby="pro-includes">
          <h3 id="pro-includes"><Crown size={20} aria-hidden="true" /> Pro includes</h3>
          <ul className="billing-features">
            {proPlan.features.map((f) => <li key={f}><Check size={15} aria-hidden="true" /> {f}</li>)}
          </ul>
        </section>
      )}

      {payments.length > 0 && (
        <section className="billing-card" aria-labelledby="history-title">
          <h3 id="history-title">Your payments</h3>
          <ul className="billing-history">
            {payments.map((p) => (
              <li key={p.uuid}>
                <div>
                  <p className="billing-history-main">Pro {PERIOD_LABEL[p.period].toLowerCase()} · {money(p.currency, p.amount)}</p>
                  <p className="billing-history-meta">
                    Sent {formatDate(p.created_at)} · {p.reference}
                    {p.status === 'approved' && p.period_end && <> · Pro until {formatDate(p.period_end)}</>}
                  </p>
                  {p.status === 'rejected' && p.admin_note && <p className="billing-history-reason">{p.admin_note}</p>}
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
