import React, { useCallback, useEffect, useState } from 'react';
import { Check, CheckCircle2, Clock, Crown, FileUp, MessageCircle, XCircle } from 'lucide-react';
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
import { TrialNotice } from '../../features/billing/TrialNotice';
import type { BillingInfo, BillingPeriod, Payment } from '../../types/auth';
import './BillingPage.css';

const money = (currency: string, amount: number) => `${currency} ${new Intl.NumberFormat('en-US').format(amount)}`;
const PERIOD_LABEL: Record<BillingPeriod, string> = { monthly: 'Monthly', yearly: 'Yearly' };
const SLIP_TYPES = 'image/jpeg,image/png,image/webp,image/heic,application/pdf';

function StatusBadge({ status }: { status: Payment['status'] }) {
  const map = {
    pending: { icon: <Clock size={14} aria-hidden="true" />, label: 'Checking' },
    approved: { icon: <CheckCircle2 size={14} aria-hidden="true" />, label: 'Approved' },
    rejected: { icon: <XCircle size={14} aria-hidden="true" />, label: 'Not confirmed' },
  } as const;
  return <span className={`billing-status is-${status}`}>{map[status].icon} {map[status].label}</span>;
}

/**
 * Upgrade to Pro (or renew): pick monthly / yearly, then message us on WhatsApp with the account's
 * email and the plan. We reply with the bank details; an admin approves the request once paid.
 */
export const BillingPage: React.FC = () => {
  useDocumentTitle('Upgrade to Pro');
  const addToast = useToastStore((s) => s.addToast);
  const loadUsage = useUsageStore((s) => s.load);
  const userName = useAuthStore((s) => s.user?.name);
  const userEmail = useAuthStore((s) => s.user?.email);
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>('yearly');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
  const proPlan = PRICING_PLANS.find((p) => p.key === 'pro');
  const whatsappText = (p?: Payment) => {
    const chosen = p?.period ?? period;
    return [
      'Hi! I would like to upgrade to සිංSub Pro.',
      `Email: ${userEmail ?? '-'}`,
      ...(userName ? [`Name: ${userName}`] : []),
      `Plan: Pro ${PERIOD_LABEL[chosen].toLowerCase()} (${money(billing.currency, p?.amount ?? billing.prices[chosen])})`,
      `Reference: ${p?.reference ?? billing.reference}`,
      'Please send me the bank details.',
    ].join('\n');
  };
  const whatsappUrl = (p?: Payment) => `${billing.whatsapp_link}?text=${encodeURIComponent(whatsappText(p))}`;

  /** Opens WhatsApp with the request, and saves it so an admin can approve it once paid. */
  const requestOnWhatsApp = async () => {
    setFormError(null);
    window.open(whatsappUrl(), '_blank', 'noopener'); // before any await, or pop-up blockers stop it
    setSending(true);
    try {
      await billingService.submit(period, null, 'Requested on WhatsApp');
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
            : 'Message us on WhatsApp. We send you the bank details, and Pro turns on as soon as we confirm your payment.'}
        </p>
      </div>

      {!isUnlimited && <TrialNotice placement="billing" onStarted={() => void load()} />}

      {isUnlimited ? null : pending ? (
        <section className="billing-card billing-pending" aria-labelledby="pending-title">
          <h3 id="pending-title"><Clock size={20} aria-hidden="true" /> We got your Pro request</h3>
          <p>
            {money(pending.currency, pending.amount)} for Pro {PERIOD_LABEL[pending.period].toLowerCase()}, requested {formatDateTime(pending.created_at)}.
            We will reply on WhatsApp ({billing.whatsapp}) with the bank details. After you pay, send the slip and we switch Pro on —
            usually within a few hours. We also email you when it&apos;s on.
          </p>
          {!pending.has_slip && (
            <div className="billing-pending-slip">
              <p>Paid already? Send the slip on WhatsApp, or upload it here.</p>
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
            <h3 id="step-2"><span className="billing-step">2</span> Message us on WhatsApp</h3>
            <p className="billing-note">
              WhatsApp opens with your email (<strong>{userEmail}</strong>) and the plan you chose. We reply with the bank details.
              After you pay, send the slip in the same chat and we switch your account to Pro.
            </p>
            <pre className="billing-message" aria-label="Message we will send">{whatsappText()}</pre>
            {formError && <div className="form-alert" role="alert">{formError}</div>}
            <div className="billing-actions">
              <Button type="button" variant="primary" isLoading={sending} startIcon={<MessageCircle size={16} aria-hidden="true" />} onClick={() => void requestOnWhatsApp()}>
                Request Pro on WhatsApp ({billing.whatsapp})
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
