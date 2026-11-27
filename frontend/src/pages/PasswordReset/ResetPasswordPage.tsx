import React, { useId, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { authService } from '../../services/authService';
import { fieldError, toAppError, type AppError } from '../../services/errors';
import { passwordProblem } from '../../utils/validation';
import { FancyButton } from '../../components/ui/FancyButton/FancyButton';
import { AuthHeader, PasswordField } from '../../components/ui/AuthForm/AuthForm';

/** Opened from the reset email (?token=…&email=…): sets a new password. */
export const ResetPasswordPage: React.FC = () => {
  useDocumentTitle('Set a new password');
  const id = useId();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const pwProblem = password ? passwordProblem(password) : null;
  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm;
  const linkBroken = !token || !email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || pwProblem || mismatch || password !== passwordConfirm) return;
    setError(null);
    setBusy(true);
    try {
      setDone(await authService.resetPassword({ token, email, password, password_confirmation: passwordConfirm }));
    } catch (err) {
      setError(toAppError(err, 'Could not reset the password. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  // An expired or used link comes back as a "token" error: offer a fresh link.
  const tokenError = fieldError(error, 'token') ?? fieldError(error, 'email');
  const formMessage = tokenError ?? (error && !fieldError(error, 'password') ? error.message : null);

  if (linkBroken) {
    return (
      <div>
        <AuthHeader icon={<LockKeyhole size={24} />} title="Reset link is incomplete" subtitle="Open the link from your email again, or request a new one." />
        <div className="auth-form">
          <Link to="/forgot-password" className="auth-social">Request a new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AuthHeader icon={<LockKeyhole size={24} />} title="Set a new password" subtitle={`For ${email}`} />

      {done ? (
        <div className="auth-form">
          <div className="auth-alert auth-alert-success" role="status">{done}</div>
          <FancyButton type="button" size="lg" fullWidth onClick={() => navigate('/login', { replace: true })}>
            Go to sign in
          </FancyButton>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {formMessage && (
            <div className="auth-alert" role="alert">
              {formMessage}
              {tokenError && <> <Link to="/forgot-password" className="auth-link">Request a new link</Link></>}
            </div>
          )}
          <PasswordField
            id={`${id}-password`}
            label="New password"
            autoComplete="new-password"
            placeholder="Create a new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldError(error, 'password') ?? pwProblem ?? undefined}
            hint="At least 8 characters with letters and numbers."
            required
            autoFocus
          />
          <PasswordField
            id={`${id}-confirm`}
            label="Confirm new password"
            autoComplete="new-password"
            placeholder="Re-enter password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            error={mismatch ? 'Passwords do not match.' : undefined}
            required
          />
          <FancyButton type="submit" size="lg" fullWidth isLoading={busy} disabled={!password || !passwordConfirm || !!pwProblem || mismatch}>
            Reset password
          </FancyButton>
        </form>
      )}

      <p className="auth-switch">
        <Link to="/login" className="auth-link">Back to sign in</Link>
      </p>
    </div>
  );
};
