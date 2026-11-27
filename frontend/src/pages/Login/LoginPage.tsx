import React, { useId, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, UserRound } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { fieldError, toAppError, type AppError } from '../../services/errors';
import { safeNextPath } from '../../utils/navigation';
import { FancyButton } from '../../components/ui/FancyButton/FancyButton';
import { AuthCheckbox, AuthDivider, AuthField, AuthHeader, GoogleIcon, PasswordField, SocialButton } from '../../components/ui/AuthForm/AuthForm';
import { useGoogleSignIn } from '../../features/auth/useGoogleSignIn';
import './LoginPage.css';

// Shown in development unless turned off, and in production only when VITE_SHOW_DEMO_LOGIN=true.
const SHOW_DEMO = import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true' || (import.meta.env.DEV && import.meta.env.VITE_SHOW_DEMO_LOGIN !== 'false');
const DEMO = { email: 'demo@samplecap.com', password: 'password123' };

export const LoginPage: React.FC = () => {
  useDocumentTitle('Sign in');
  const id = useId();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const goNext = () => navigate(safeNextPath(params.get('next')), { replace: true });
  const google = useGoogleSignIn(goNext, remember);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login({ email: email.trim(), password }, remember);
      goNext();
    } catch (err) {
      setError(toAppError(err, 'Sign in failed. Please try again.'));
    }
  };

  // A message that belongs to a field is shown under that field only.
  const formMessage = (error && !fieldError(error, 'password') && !fieldError(error, 'email') ? error.message : null) ?? google.error;

  return (
    <div>
      <AuthHeader icon={<UserRound size={24} />} title="Sign in to your account" subtitle="Enter your details to sign in." />

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
        />

        <PasswordField
          id={`${id}-password`}
          label="Password"
          autoComplete="current-password"
          placeholder="••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError(error, 'password')}
          labelAside={
            <Link className="auth-link" to="/forgot-password">Forgot password?</Link>
          }
          required
        />

        <AuthCheckbox id={`${id}-remember`} label="Keep me logged in" checked={remember} onChange={setRemember} />

        <FancyButton type="submit" size="lg" fullWidth isLoading={isLoading && !google.busy} disabled={!email || !password}>
          Sign in
        </FancyButton>
      </form>

      <AuthDivider />

      <SocialButton icon={<GoogleIcon />} onClick={() => void google.start()} disabled={google.busy} aria-busy={google.busy || undefined}>
        {google.busy ? 'Connecting to Google…' : 'Continue with Google'}
      </SocialButton>

      {SHOW_DEMO && (
        <div className="demo-account-box">
          <div className="demo-account-title">
            <Sparkles size={15} aria-hidden="true" /> {import.meta.env.DEV ? 'Development demo account' : 'Demo account'}
          </div>
          <div>
            Email: <strong>{DEMO.email}</strong> · Password: <strong>{DEMO.password}</strong>
          </div>
          <button
            type="button"
            className="demo-btn-link"
            onClick={() => {
              setEmail(DEMO.email);
              setPassword(DEMO.password);
            }}
          >
            Fill in demo credentials
          </button>
        </div>
      )}

      <p className="auth-switch">
        <span>Not a member yet?</span>
        <Link to="/register" className="auth-link">Join now</Link>
      </p>
    </div>
  );
};
