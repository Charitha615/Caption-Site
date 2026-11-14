import React, { useEffect, useState } from 'react';
import { Key, Save, Gauge } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { useUsageStore, meterPercent } from '../../stores/usageStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { accountService } from '../../services/accountService';
import { fieldError, toAppError, type AppError } from '../../services/errors';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Progress } from '../../components/Progress/Progress';
import { Skeleton } from '../../components/Skeleton/Skeleton';
import { passwordProblem } from '../../utils/validation';
import { formatDate } from '../../utils/formatters';
import type { UsageMeter } from '../../types/project';
import './ProfilePage.css';

const UsageRow: React.FC<{ label: string; meter: UsageMeter; unit?: string }> = ({ label, meter, unit = '' }) => {
  const pct = meterPercent(meter.used, meter.limit);
  const detail = meter.limit === null ? `${meter.used}${unit} used · unlimited` : `${meter.used}${unit} of ${meter.limit}${unit}`;
  return <Progress label={label} value={pct ?? 0} detail={detail} size="sm" tone={pct !== null && pct >= 90 ? 'warning' : 'primary'} />;
};

export const ProfilePage: React.FC = () => {
  useDocumentTitle('Account');
  const { user, setUser } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const { usage, load: loadUsage } = useUsageStore();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profileError, setProfileError] = useState<AppError | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<AppError | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    void loadUsage(true).catch(() => undefined);
  }, [loadUsage]);

  const profileDirty = !!user && (name.trim() !== user.name || email.trim().toLowerCase() !== user.email);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setSavingProfile(true);
    try {
      const updated = await accountService.updateProfile({ name: name.trim(), email: email.trim() });
      setUser(updated);
      addToast({ type: 'success', message: 'Profile updated.' });
    } catch (err) {
      setProfileError(toAppError(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const newPwProblem = newPassword ? passwordProblem(newPassword) : null;
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (newPwProblem || mismatch || !currentPassword) return;
    setSavingPw(true);
    try {
      await accountService.changePassword({ current_password: currentPassword, password: newPassword, password_confirmation: confirmPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      addToast({ type: 'success', title: 'Password updated', message: 'Other devices have been signed out.' });
    } catch (err) {
      setPwError(toAppError(err));
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-header-card">
        <div className="profile-avatar-large" aria-hidden="true">{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</div>
        <div className="profile-details">
          <h2 className="profile-name">{user?.name}</h2>
          <span className="profile-email">{user?.email}</span>
          {user?.created_at && <span className="profile-since">Member since {formatDate(user.created_at)}</span>}
        </div>
      </div>

      <section className="card profile-card" aria-labelledby="usage-heading">
        <h3 id="usage-heading" className="profile-card-title"><Gauge size={18} aria-hidden="true" /> Plan &amp; usage</h3>
        {usage ? (
          <>
            <p className="profile-card-sub">
              <strong>{usage.plan.label}</strong> plan · resets on {formatDate(new Date(new Date(usage.period.end).getTime() + 86400000).toISOString())}
            </p>
            <div className="profile-usage-grid">
              <UsageRow label="Caption minutes" meter={usage.caption_minutes} />
              <UsageRow label="AI requests today" meter={usage.ai_requests_today} />
              <UsageRow label="Subtitle exports" meter={usage.exports} />
              <UsageRow label="Video renders" meter={usage.renders} />
              <UsageRow label="Storage" meter={usage.storage_mb} unit=" MB" />
            </div>
            <p className="profile-card-sub">
              Uploads up to {usage.max_upload_mb ?? '∞'} MB
              {usage.max_video_minutes ? ` and ${usage.max_video_minutes} minutes` : ''} per video.
            </p>
          </>
        ) : (
          <Skeleton height={180} />
        )}
      </section>

      <section className="card profile-card" aria-labelledby="profile-heading">
        <h3 id="profile-heading" className="profile-card-title">Profile</h3>
        <form onSubmit={saveProfile} className="profile-form" noValidate>
          {profileError && !Object.keys(profileError.fieldErrors).length && <div className="form-alert" role="alert">{profileError.message}</div>}
          <Input label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={fieldError(profileError, 'name')} required />
          <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldError(profileError, 'email')} required />
          <div className="form-actions">
            <Button type="submit" variant="primary" disabled={!profileDirty || !name.trim() || !email.trim()} isLoading={savingProfile} startIcon={<Save size={16} aria-hidden="true" />}>
              Save profile
            </Button>
          </div>
        </form>
      </section>

      <section className="card profile-card" aria-labelledby="password-heading">
        <h3 id="password-heading" className="profile-card-title">Password</h3>
        <p className="profile-card-sub">Changing your password signs you out on other devices.</p>
        <form onSubmit={savePassword} className="profile-form" noValidate>
          {pwError && !Object.keys(pwError.fieldErrors).length && <div className="form-alert" role="alert">{pwError.message}</div>}
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            error={fieldError(pwError, 'current_password')}
            required
          />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={fieldError(pwError, 'password') ?? newPwProblem ?? undefined}
            helperText="At least 8 characters with letters and numbers."
            required
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={mismatch ? 'Passwords do not match.' : undefined}
            required
          />
          <div className="form-actions">
            <Button
              type="submit"
              variant="primary"
              isLoading={savingPw}
              disabled={!currentPassword || !newPassword || !!newPwProblem || mismatch || !confirmPassword}
              startIcon={<Key size={16} aria-hidden="true" />}
            >
              Update password
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
};
