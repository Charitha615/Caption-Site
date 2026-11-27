import React, { useId, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { safeNextPath } from '../../utils/navigation';
import { UserRoundPlus } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { fieldError, toAppError, type AppError } from '../../services/errors';
import { passwordProblem } from '../../utils/validation';
import { FancyButton } from '../../components/ui/FancyButton/FancyButton';
import { AuthDivider, AuthField, AuthHeader, GoogleIcon, PasswordField, SocialButton } from '../../components/ui/AuthForm/AuthForm';
import { useGoogleSignIn } from '../../features/auth/useGoogleSignIn';

export const RegisterPage: React.FC = () => {
  useDocumentTitle('Create account');
  const id = useId();
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const [params] = useSearchParams();
  // "Get Pro" sends people here with ?next=/billing.
  const goToDashboard = () => navigate(safeNextPath(params.get('next')), { replace: true });
  const google = useGoogleSignIn(goToDashboard);

  const pwProblem = password ? passwordProblem(password) : null;
  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!name.trim() || !email.trim() || pwProblem || mismatch || !password) return;
    try {
      await register({ name: name.trim(), email: email.trim(), password });
      goToDashboard();
    } catch (err) {
      setError(toAppError(err, 'Registration failed. Please check your details.'));
    }
  };

  const hasFieldErrors = error && Object.keys(error.fieldErrors).length > 0;
  const formMessage = (error && !hasFieldErrors ? error.message : null) ?? google.error;

  return (
    <div>
      <AuthHeader icon={<UserRoundPlus size={24} />} title="Create your account" subtitle="Start captioning your videos for free." />

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        {formMessage && <div className="auth-alert" role="alert">{formMessage}</div>}

        <AuthField
          id={`${id}-name`}
          label="Full name"
          autoComplete="name"
          placeholder="e.g. Kasun Silva / කසුන් සිල්වා"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldError(error, 'name') ?? (touched && !name.trim() ? 'Please enter your name.' : undefined)}
          required
        />
        <AuthField
          id={`${id}-email`}
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError(error, 'email') ?? (touched && !email.trim() ? 'Please enter your email.' : undefined)}
          required
        />
        <PasswordField
          id={`${id}-password`}
          label="Password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError(error, 'password') ?? (touched || password ? pwProblem ?? undefined : undefined)}
          hint="At least 8 characters with letters and numbers."
          required
        />
        <PasswordField
          id={`${id}-confirm`}
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Re-enter password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          error={mismatch ? 'Passwords do not match.' : undefined}
          required
        />

        <FancyButton type="submit" size="lg" fullWidth isLoading={isLoading && !google.busy}>
          Create account
        </FancyButton>
      </form>

      <AuthDivider />

      <SocialButton icon={<GoogleIcon />} onClick={() => void google.start()} disabled={google.busy} aria-busy={google.busy || undefined}>
        {google.busy ? 'Connecting to Google…' : 'Sign up with Google'}
      </SocialButton>

      <p className="auth-switch">
        <span>Already a member?</span>
        <Link to={params.get('next') ? `/login?next=${encodeURIComponent(params.get('next')!)}` : '/login'} className="auth-link">Sign in</Link>
      </p>
    </div>
  );
};
