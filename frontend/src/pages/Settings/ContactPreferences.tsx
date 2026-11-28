import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { accountService } from '../../services/accountService';
import { toAppError } from '../../services/errors';
import { Button } from '../../components/Button/Button';

/** "+94 77 123 4567" for a stored "94771234567". */
const display = (digits?: string | null) => (digits ? `+${digits}` : '');

/** How the team may contact the user: update emails, and WhatsApp (optional number, with consent). */
export const ContactPreferences: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const addToast = useToastStore((s) => s.addToast);
  const [number, setNumber] = useState(display(user?.whatsapp_number));
  const [optIn, setOptIn] = useState(!!user?.whatsapp_opt_in);
  const [emailUpdates, setEmailUpdates] = useState(user?.email_updates !== false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (patch: Parameters<typeof accountService.updateProfile>[0]) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await accountService.updateProfile(patch);
      useAuthStore.setState({ user: updated });
      setNumber(display(updated.whatsapp_number));
      setOptIn(!!updated.whatsapp_opt_in);
      setEmailUpdates(updated.email_updates !== false);
      addToast({ type: 'success', message: 'Preference saved.', duration: 2000 });
    } catch (err) {
      const e = toAppError(err);
      setError(Object.values(e.fieldErrors)[0]?.[0] ?? e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="contact-prefs">
      <label className="contact-pref-row">
        <input type="checkbox" checked={emailUpdates} disabled={saving} onChange={(e) => void save({ email_updates: e.target.checked })} />
        <span>
          <strong>News and offers by email</strong>
          <small>New features, tips and offers from the team. Emails about your payments and account are always sent.</small>
        </span>
      </label>

      <div className="contact-pref-whatsapp">
        <label className="input-label" htmlFor="whatsapp-number">WhatsApp number</label>
        <div className="contact-pref-inline">
          <input id="whatsapp-number" className="input-field" type="tel" inputMode="tel" autoComplete="tel" placeholder="077 123 4567" value={number} onChange={(e) => setNumber(e.target.value)} />
          <Button size="sm" variant="outline" isLoading={saving} onClick={() => void save({ whatsapp_number: number.trim() || null, whatsapp_opt_in: number.trim() ? optIn : false })}>
            Save
          </Button>
        </div>
        <label className="contact-pref-row">
          <input type="checkbox" checked={optIn} disabled={saving || !user?.whatsapp_number} onChange={(e) => void save({ whatsapp_opt_in: e.target.checked })} />
          <span>
            <strong>News and offers on WhatsApp</strong>
            <small>{user?.whatsapp_number ? 'We message you only now and then, never share your number, and you can turn this off here.' : 'Save your number first.'}</small>
          </span>
        </label>
      </div>
      {error && <div className="form-alert" role="alert">{error}</div>}
    </div>
  );
};
