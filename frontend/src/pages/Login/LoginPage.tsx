import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, LogIn, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { BRAND } from '../../config/brand';
import { fieldError, toAppError, type AppError } from '../../services/errors';
import { safeNextPath } from '../../utils/navigation';
import './LoginPage.css';

const SHOW_DEMO = import.meta.env.DEV && import.meta.env.VITE_SHOW_DEMO_LOGIN !== 'false';
const DEMO = { email: 'demo@samplecap.com', password: 'password123' };

export const LoginPage: React.FC = () => {
  useDocumentTitle('Sign in');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<AppError | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login({ email: email.trim(), password });
      navigate(safeNextPath(params.get('next')), { replace: true });
    } catch (err) {
      setError(toAppError(err, 'Sign in failed. Please try again.'));
    }
  };

  const formMessage = error && !fieldError(error, 'password') ? error.message : null;

  return (
    <div>
      <h2 className="sr-only">Sign in to {BRAND.name}</h2>
      <form onSubmit={handleSubmit} className="login-form" noValidate>
        {formMessage && <div className="form-alert" role="alert">{formMessage}</div>}

        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          startIcon={<Mail size={18} aria-hidden="true" />}
          required
        />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          startIcon={<Lock size={18} aria-hidden="true" />}
          error={fieldError(error, 'password')}
          required
        />

        <div className="login-options-row">
          <a className="login-forgot-link" href={`mailto:${BRAND.supportEmail}?subject=${encodeURIComponent('Password reset')}`}>
            Forgot password?
          </a>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isLoading}
          disabled={!email || !password}
          startIcon={<LogIn size={18} aria-hidden="true" />}
        >
          Sign in
        </Button>
      </form>

      {SHOW_DEMO && (
        <div className="demo-account-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <Sparkles size={15} aria-hidden="true" /> Development demo account
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

      <p className="auth-switch-text">
        Don&apos;t have an account yet?{' '}
        <Link to="/register" style={{ fontWeight: 600 }}>
          Create one
        </Link>
      </p>
    </div>
  );
};
