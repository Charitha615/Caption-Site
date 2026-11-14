import React, { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, KeyRound, ShieldCheck, Trash2, AlertTriangle, CircleHelp } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { Skeleton } from '../../components/Skeleton/Skeleton';
import { useAiKeyStore } from '../../stores/aiKeyStore';
import { useToastStore } from '../../stores/toastStore';
import { accountService } from '../../services/accountService';
import { fieldError, toAppError, type AppError } from '../../services/errors';
import type { AiKeyStatus } from '../../types/auth';
import { formatDate } from '../../utils/formatters';
import './AiKeyCard.css';

const AI_STUDIO_URL = 'https://aistudio.google.com/app/api-keys';

const STATUS: Record<NonNullable<AiKeyStatus['status']>, { label: string; icon: React.ReactNode; tone: string }> = {
  valid: { label: 'Verified', icon: <CheckCircle2 size={14} aria-hidden="true" />, tone: 'ok' },
  unverified: { label: 'Not verified yet', icon: <CircleHelp size={14} aria-hidden="true" />, tone: 'warn' },
  invalid: { label: 'Rejected by Google', icon: <AlertTriangle size={14} aria-hidden="true" />, tone: 'error' },
};

/**
 * "Google AI API key" section of Account & usage: users paste the key from Google AI
 * Studio, Save (verified with Google before it is stored), Verify again, or Remove.
 */
export const AiKeyCard: React.FC = () => {
  const { aiKey, load, set } = useAiKeyStore();
  const addToast = useToastStore((s) => s.addToast);

  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<'save' | 'verify' | 'remove' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    void load(true).catch(() => undefined);
  }, [load]);

  // Arriving from "Add API key" links (/profile#ai-key): bring the section into view.
  useEffect(() => {
    if (aiKey && window.location.hash === '#ai-key') {
      document.getElementById('ai-key')?.scrollIntoView({ block: 'start' });
    }
  }, [aiKey]);

  const helpUrl = aiKey?.help_url ?? AI_STUDIO_URL;
  const showForm = !aiKey?.configured || editing;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy('save');
    try {
      const { aiKey: next, verification } = await accountService.saveAiKey(value.trim());
      set(next);
      setValue('');
      setEditing(false);
      setNotice({ tone: verification.result === 'valid' ? 'ok' : 'warn', text: verification.message });
      addToast({ type: verification.result === 'valid' ? 'success' : 'warning', message: verification.result === 'valid' ? 'Google AI key saved and verified.' : 'Key saved, but not verified yet.' });
    } catch (err) {
      setError(toAppError(err, 'Could not save the key.'));
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    setNotice(null);
    setBusy('verify');
    try {
      const { aiKey: next, verification } = await accountService.verifyAiKey();
      set(next);
      setNotice({ tone: verification.result === 'valid' ? 'ok' : verification.result === 'invalid' ? 'error' : 'warn', text: verification.message });
    } catch (err) {
      setNotice({ tone: 'error', text: toAppError(err, 'Could not verify the key.').message });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('remove');
    try {
      set(await accountService.removeAiKey());
      setNotice(null);
      addToast({ type: 'info', message: 'Google AI key removed.' });
    } finally {
      setBusy(null);
      setConfirmRemove(false);
    }
  };

  const status = aiKey?.status ? STATUS[aiKey.status] : null;

  return (
    <section id="ai-key" className="card profile-card" aria-labelledby="ai-key-heading">
      <div className="aikey-head">
        <h3 id="ai-key-heading" className="profile-card-title">
          <KeyRound size={18} aria-hidden="true" /> Google AI API key
        </h3>
        {aiKey?.configured && status && (
          <span className={`aikey-badge aikey-badge-${status.tone}`}>
            {status.icon} {status.label}
          </span>
        )}
      </div>

      <p className="profile-card-sub">
        Captions are generated with <strong>your own</strong> Google Gemini key, so AI usage is billed to your Google account.
        {aiKey?.required && !aiKey.configured && ' You need to add one before uploading videos.'}
      </p>

      <ol className="aikey-steps">
        <li>
          Open{' '}
          <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="aikey-link">
            Google AI Studio → API keys <ExternalLink size={13} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>{' '}
          and sign in with your Google account.
        </li>
        <li>Click <strong>Create API key</strong> and copy it.</li>
        <li>Paste it below and press <strong>Save &amp; verify</strong>.</li>
      </ol>

      {!aiKey ? (
        <Skeleton height={90} />
      ) : (
        <>
          {aiKey.configured && !editing && (
            <div className="aikey-saved">
              <div className="aikey-saved-key">
                <ShieldCheck size={18} aria-hidden="true" />
                <span>
                  <span className="sr-only">Saved key ending in </span>
                  <code aria-hidden="true">••••••••••••{aiKey.hint}</code>
                  {aiKey.checked_at && <span className="aikey-checked"> · checked {formatDate(aiKey.checked_at)}</span>}
                </span>
              </div>
              <div className="form-actions">
                <Button variant="secondary" size="sm" onClick={verify} isLoading={busy === 'verify'} disabled={!!busy} startIcon={<CheckCircle2 size={15} aria-hidden="true" />}>
                  Verify
                </Button>
                <Button variant="secondary" size="sm" onClick={() => { setEditing(true); setNotice(null); }} disabled={!!busy}>
                  Replace key
                </Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmRemove(true)} disabled={!!busy} startIcon={<Trash2 size={15} aria-hidden="true" />}>
                  Remove
                </Button>
              </div>
            </div>
          )}

          {showForm && (
            <form onSubmit={save} className="profile-form" noValidate>
              <Input
                label="API key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="AIza…"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                error={fieldError(error, 'api_key') ?? (error && !Object.keys(error.fieldErrors).length ? error.message : undefined)}
                helperText="Stored encrypted. Only the last 4 characters are ever shown."
                required
              />
              <div className="form-actions">
                {editing && (
                  <Button type="button" variant="secondary" onClick={() => { setEditing(false); setValue(''); setError(null); }} disabled={busy === 'save'}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" variant="primary" isLoading={busy === 'save'} disabled={value.trim().length < 20} startIcon={<ShieldCheck size={16} aria-hidden="true" />}>
                  Save &amp; verify
                </Button>
              </div>
            </form>
          )}

          {notice && (
            <p className={`aikey-notice aikey-notice-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
              {notice.text}
            </p>
          )}
          {aiKey.status === 'invalid' && !notice && (
            <p className="aikey-notice aikey-notice-error" role="alert">
              Google rejected this key the last time it was used. Replace it with a new key from Google AI Studio.
            </p>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={confirmRemove}
        title="Remove your Google AI key?"
        message="You won’t be able to generate captions until you add a key again. Existing captions are not affected."
        confirmLabel="Remove key"
        tone="danger"
        isLoading={busy === 'remove'}
        onConfirm={remove}
        onCancel={() => setConfirmRemove(false)}
      />
    </section>
  );
};
