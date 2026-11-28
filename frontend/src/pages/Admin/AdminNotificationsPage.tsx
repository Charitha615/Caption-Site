import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Mail, MessageCircle, Send, ShieldAlert } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import {
  notificationService, type AudienceReach, type MessageAudience, type MessageCategory, type MessageChannel, type SentMessage, type WhatsAppRecipient,
} from '../../services/notificationService';
import { toAppError } from '../../services/errors';
import { Button } from '../../components/Button/Button';
import { Modal } from '../../components/Modal/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { CATEGORY_LABELS, NotificationIcon } from '../../components/Notifications/notificationUi';
import { BRAND } from '../../config/brand';
import { safeStorage } from '../../utils/storage';
import { formatDateTime } from '../../utils/formatters';
import '../../components/Notifications/Notifications.css';
import './AdminReviewsPage.css';

const AUDIENCES: Array<{ value: MessageAudience; label: string }> = [
  { value: 'everyone', label: 'All users' },
  { value: 'free', label: 'Free users' },
  { value: 'pro', label: 'All Pro users' },
  { value: 'pro_monthly', label: 'Pro — monthly' },
  { value: 'pro_yearly', label: 'Pro — yearly' },
  { value: 'unlimited', label: 'Unlimited users' },
  { value: 'user', label: 'One user (by email)' },
];

const CHANNELS: Array<{ value: MessageChannel; label: string; icon: React.ReactNode; hint: string }> = [
  { value: 'in_app', label: 'In the app', icon: <Bell size={16} aria-hidden="true" />, hint: 'Shows under 🔔' },
  { value: 'email', label: 'Email', icon: <Mail size={16} aria-hidden="true" />, hint: 'Skips people who turned update emails off' },
  { value: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={16} aria-hidden="true" />, hint: 'People who added a number and agreed. You press send for each.' },
];

const CATEGORIES = Object.keys(CATEGORY_LABELS) as MessageCategory[];
const EMOJI: Record<MessageCategory, string> = { announcement: '📣', update: '✨', offer: '🎁', tip: '💡', important: '⚠️' };

const audienceText = (m: SentMessage) => (m.audience === 'user' ? m.target?.email ?? 'one user' : AUDIENCES.find((a) => a.value === m.audience)?.label ?? m.audience);

/** WhatsApp chats already opened for a message, remembered on this device. */
const doneKey = (id: number) => `admin-wa-done-${id}`;
const readDone = (id: number): number[] => {
  try {
    return JSON.parse(safeStorage.get(doneKey(id)) ?? '[]') as number[];
  } catch {
    return [];
  }
};

/** Admin: send a message to a group of users in the app, by email and/or on WhatsApp. */
export const AdminNotificationsPage: React.FC = () => {
  useDocumentTitle('Send notifications');
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const addToast = useToastStore((s) => s.addToast);
  const [audience, setAudience] = useState<MessageAudience>('everyone');
  const [email, setEmail] = useState('');
  const [channels, setChannels] = useState<MessageChannel[]>(['in_app']);
  const [category, setCategory] = useState<MessageCategory>('announcement');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [buttonLabel, setButtonLabel] = useState('');
  const [preview, setPreview] = useState<MessageChannel>('in_app');
  const [sent, setSent] = useState<SentMessage[] | null>(null);
  const [reach, setReach] = useState<AudienceReach>({});
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [reload, setReload] = useState(0);
  const [waFor, setWaFor] = useState<SentMessage | null>(null);
  const [waList, setWaList] = useState<WhatsAppRecipient[] | null>(null);
  const [waDone, setWaDone] = useState<number[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    notificationService.sentMessages()
      .then((d) => { setSent(d.messages); setReach(d.reach); })
      .catch((err) => setError(toAppError(err, 'Could not load sent messages.').message));
  }, [isAdmin, reload]);

  const openWhatsApp = async (m: SentMessage) => {
    setWaFor(m);
    setWaList(null);
    setWaDone(readDone(m.id));
    try {
      setWaList(await notificationService.whatsAppList(m.id));
    } catch {
      setWaFor(null); // toast shown by the API client
    }
  };

  const markWaDone = (m: SentMessage, userId: number) => {
    const next = [...new Set([...readDone(m.id), userId])];
    safeStorage.set(doneKey(m.id), JSON.stringify(next));
    setWaDone(next);
  };

  const reachOf = (channel: MessageChannel) => (audience === 'user' ? null : reach[audience]?.[channel] ?? 0);
  const toggleChannel = (c: MessageChannel) => setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  const ready = title.trim() !== '' && body.trim() !== '' && channels.length > 0 && (audience !== 'user' || email.trim() !== '');

  const waPreview = useMemo(() => {
    const full = link.startsWith('/') ? `${window.location.origin}${link}` : link;
    return [`${EMOJI[category]} *${title || 'Your title'}*`, '', `Hi Nimal, ${body || 'Your message'}`, ...(full ? ['', `${buttonLabel || 'Open'}: ${full}`] : []), '', `— ${BRAND.titleName}`].join('\n');
  }, [category, title, body, link, buttonLabel]);

  if (!isAdmin) {
    return <div className="admin-reviews"><p className="admin-empty"><ShieldAlert size={18} aria-hidden="true" /> Only admins can send notifications.</p></div>;
  }

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const m = await notificationService.send({
        title: title.trim(), body: body.trim(), category, link: link.trim() || null, button_label: buttonLabel.trim() || null,
        audience, channels, email: audience === 'user' ? email.trim() : undefined,
      });
      const parts = [
        m.channels.includes('in_app') && `${m.recipients} in the app`,
        m.channels.includes('email') && `${m.email_recipients} by email`,
      ].filter(Boolean);
      addToast({ type: 'success', message: parts.length ? `Sending: ${parts.join(', ')}.` : 'Saved.' });
      setTitle('');
      setBody('');
      setLink('');
      setButtonLabel('');
      setEmail('');
      setReload((n) => n + 1);
      if (m.channels.includes('whatsapp') && m.whatsapp_recipients > 0) void openWhatsApp(m);
    } catch (err) {
      const e = toAppError(err);
      setError(Object.values(e.fieldErrors)[0]?.[0] ?? e.message);
    } finally {
      setSending(false);
      setConfirming(false);
    }
  };

  const confirmText = audience === 'user'
    ? `“${title}” will go to ${email}.`
    : `“${title}” will go to ${channels.map((c) => `${reachOf(c)} ${c === 'in_app' ? 'in the app' : c === 'email' ? 'by email' : 'on WhatsApp (you send each)'}`).join(', ')}. It can't be unsent.`;

  return (
    <div className="admin-reviews">
      <div>
        <h2 className="page-heading">Send notifications</h2>
        <p className="page-subheading">Message a group of users in the app, by email or on WhatsApp. Welcome, payment, plan and finished-video notices are sent automatically.</p>
      </div>

      <form className="admin-review admin-campaign-form" onSubmit={(e) => { e.preventDefault(); if (ready) setConfirming(true); }}>
        <div className="admin-campaign-grid">
          <label className="input-label">
            Send to
            <select className="input-field" value={audience} onChange={(e) => setAudience(e.target.value as MessageAudience)}>
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}{a.value !== 'user' && reach[a.value] ? ` (${reach[a.value]!.in_app})` : ''}</option>
              ))}
            </select>
          </label>
          {audience === 'user' && (
            <label className="input-label">
              User&apos;s email
              <input className="input-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
            </label>
          )}
        </div>

        <fieldset className="msg-channels">
          <legend className="input-label">Send by</legend>
          {CHANNELS.map((c) => {
            const n = reachOf(c.value);
            return (
              <label key={c.value} className={`msg-channel ${channels.includes(c.value) ? 'is-on' : ''}`}>
                <input type="checkbox" checked={channels.includes(c.value)} onChange={() => toggleChannel(c.value)} />
                {c.icon}
                <span>
                  <strong>{c.label}</strong>{n !== null && <span className="admin-muted"> · {n} {n === 1 ? 'person' : 'people'}</span>}
                  <small>{c.hint}</small>
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="input-label">
          Type
          <div className="msg-chips" role="radiogroup" aria-label="Type of message">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={category === c} className={`msg-chip ${category === c ? 'is-on' : ''}`} onClick={() => setCategory(c)}>
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        <label className="input-label">
          Title
          <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. New: captions behind the person" required />
        </label>
        <label className="input-label">
          Message
          <textarea className="input-field" rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="What you want to tell them. සිංහල works too." required />
        </label>
        <div className="admin-campaign-grid">
          <label className="input-label">
            Button link (optional)
            <input className="input-field" value={link} onChange={(e) => setLink(e.target.value)} maxLength={255} placeholder="/billing, /projects/create or https://…" />
          </label>
          <label className="input-label">
            Button text
            <input className="input-field" value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} maxLength={40} placeholder="e.g. Get the offer" disabled={!link.trim()} />
          </label>
        </div>

        <div className="admin-campaign-preview">
          <div className="admin-tabs" role="tablist" aria-label="Preview">
            {CHANNELS.map((c) => (
              <button key={c.value} type="button" role="tab" aria-selected={preview === c.value} className={`admin-tab ${preview === c.value ? 'is-on' : ''}`} onClick={() => setPreview(c.value)}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
          {preview === 'in_app' && (
            <div className="notif-item is-unread msg-preview-app">
              <NotificationIcon kind="admin" category={category} />
              <span className="notif-text">
                <span className="notif-title">{title || 'Your title'}</span>
                <span className="notif-body">{body || 'Your message'}</span>
                {link.trim() && <span className="notif-cta">{buttonLabel || 'Open'} →</span>}
              </span>
            </div>
          )}
          {preview === 'email' && (
            <div className="msg-preview-email">
              <p className="msg-email-subject">{EMOJI[category]} {title || 'Your title'}</p>
              <p>Hello Nimal,</p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{body || 'Your message'}</p>
              <span className="msg-email-btn">{link.trim() ? buttonLabel || 'Open' : `Open ${BRAND.name}`}</span>
              <p className="admin-muted">— The {BRAND.name} team</p>
            </div>
          )}
          {preview === 'whatsapp' && <div className="msg-preview-wa">{waPreview}</div>}
        </div>

        {error && <div className="form-alert" role="alert">{error}</div>}
        <div className="admin-review-actions">
          <Button type="submit" disabled={!ready} startIcon={<Send size={15} aria-hidden="true" />}>Send</Button>
        </div>
      </form>

      <h3 className="admin-user-h">Sent messages</h3>
      {sent?.length === 0 && <p className="admin-empty">Nothing sent yet.</p>}
      <ul className="admin-review-list">
        {sent?.map((m) => (
          <li key={m.id} className="admin-review">
            <div className="admin-review-head">
              <NotificationIcon kind="admin" category={m.category} />
              <div>
                <p className="admin-review-name">{m.title}</p>
                <p className="admin-review-role">
                  To {audienceText(m)}{m.created_at && <> · {formatDateTime(m.created_at)}</>}
                </p>
              </div>
            </div>
            <p className="admin-review-body">{m.body}{m.link && <><br /><span className="admin-muted">{m.button_label || 'Open'} → {m.link}</span></>}</p>
            <div className="admin-review-actions">
              {m.channels.includes('in_app') && <span className="msg-badge"><Bell size={13} aria-hidden="true" /> {m.recipients} in app</span>}
              {m.channels.includes('email') && <span className="msg-badge"><Mail size={13} aria-hidden="true" /> {m.email_recipients} emails</span>}
              {m.channels.includes('whatsapp') && (
                <Button size="sm" variant="outline" startIcon={<MessageCircle size={14} aria-hidden="true" />} onClick={() => void openWhatsApp(m)}>
                  WhatsApp list ({m.whatsapp_recipients})
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        isOpen={confirming}
        title="Send this message?"
        message={confirmText}
        confirmLabel="Send"
        isLoading={sending}
        onConfirm={() => void send()}
        onCancel={() => setConfirming(false)}
      />

      <Modal isOpen={waFor !== null} onClose={() => setWaFor(null)} title={waFor ? `WhatsApp: ${waFor.title}` : ''} size="md">
        <p className="admin-review-role">Press <strong>Send on WhatsApp</strong> for each person: WhatsApp opens with the message typed in, then press send there. Ticks are remembered on this device.</p>
        {!waList && <p className="admin-empty">Loading…</p>}
        {waList?.length === 0 && <p className="admin-empty">Nobody in this group has added a WhatsApp number and agreed to messages yet.</p>}
        {waList && waList.length > 0 && (
          <>
            <p className="admin-review-role">{waDone.filter((id) => waList.some((r) => r.id === id)).length} of {waList.length} sent</p>
            <ul className="msg-wa-list">
              {waList.map((r) => {
                const done = waDone.includes(r.id);
                return (
                  <li key={r.id} className={done ? 'is-done' : ''}>
                    <span>
                      <strong>{r.name}</strong>
                      <small>{r.phone} · {r.email}</small>
                    </span>
                    <a
                      className={`btn btn-sm ${done ? 'btn-outline' : 'btn-primary'}`}
                      href={r.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => waFor && markWaDone(waFor, r.id)}
                    >
                      {done ? <><CheckCircle2 size={14} aria-hidden="true" /> Sent</> : <><MessageCircle size={14} aria-hidden="true" /> Send on WhatsApp</>}
                    </a>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Modal>
    </div>
  );
};
