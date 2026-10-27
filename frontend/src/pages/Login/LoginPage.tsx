import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  useDocumentTitle('Sign In');
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email || !password) {
      setErrorMessage('Please provide both email and password.');
      return;
    }

    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setErrorMessage(
        error.response?.data?.message || 'Invalid credentials. Please try again.'
      );
    }
  };

  const handleFillDemo = () => {
    setEmail('demo@samplecap.com');
    setPassword('password123');
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="login-form">
        {errorMessage && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--status-error-bg)',
              color: 'var(--status-error-text)',
              border: '1px solid var(--status-error-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        <Input
          label="Email Address"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          startIcon={<Mail size={18} />}
          required
        />

        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          startIcon={<Lock size={18} />}
          required
        />

        <div className="login-options-row">
          <label className="login-remember">
            <input type="checkbox" defaultChecked />
            <span>Remember me</span>
          </label>
          <span className="login-forgot-link">Forgot password?</span>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isLoading}
          startIcon={<LogIn size={18} />}
        >
          Sign In
        </Button>
      </form>

      {/* One-click demo credentials helper */}
      <div className="demo-account-box">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
          <Sparkles size={15} /> Demo Credentials Available
        </div>
        <div>Email: <strong>demo@samplecap.com</strong> | Pass: <strong>password123</strong></div>
        <button type="button" className="demo-btn-link" onClick={handleFillDemo}>
          Click here to auto-fill demo credentials
        </button>
      </div>

      <div className="auth-switch-text">
        Don&apos;t have an account yet?{' '}
        <Link to="/register" style={{ fontWeight: 600 }}>
          Sign up
        </Link>
      </div>
    </div>
  );
};
