import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { authService } from '../../services/authService';
import { fieldError, toAppError, type AppError } from '../../services/errors';
import { FancyButton } from '../../components/ui/FancyButton/FancyButton';
import { AuthField, AuthHeader } from '../../components/ui/AuthForm/AuthForm';

/** "Forgot password": asks for the account email and sends a reset link to it. */
export const ForgotPasswordPage: React.FC = () => {
  useDocumentTitle('Forgot password');
  const id = useId();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setBusy(true);
    try {
      setSentMessage(await authService.forgotPassword(email.trim()));
    } catch (err) {
      setError(toAppError(err, 'Could not send the reset link. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const formMessage = error && !fieldError(error, 'email') ? error.message : null;

  return (
    <div>
      <AuthHeader
        icon={<KeyRound size={24} />}
        title="Forgot your password?"
        subtitle="Enter your account email and we'll send you a link to reset it."
      />

      {sentMessage ? (
        <div className="auth-form">
          <div className="auth-alert auth-alert-success" role="status">{sentMessage}</div>
          <p className="auth-note">The link expires in 60 minutes. Check your spam folder if you don't see it.</p>
          <button type="button" className="auth-social" onClick={() => setSentMessage(null)}>
            Send to a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {formMessage && <div className="auth-alert" role="alert">{formMessage}</div>}
          <AuthField
            id={`${id}-email`}
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldError(error, 'email')}
            required
            autoFocus
          />
          <FancyButton type="submit" size="lg" fullWidth isLoading={busy} disabled={!email.trim()}>
            Send reset link
          </FancyButton>
        </form>
      )}

      <p className="auth-switch">
        <span>Remembered it?</span>
        <Link to="/login" className="auth-link">Back to sign in</Link>
      </p>
    </div>
  );
};
