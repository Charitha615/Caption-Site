import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, UserPlus } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { fieldError, toAppError, type AppError } from '../../services/errors';
import { passwordProblem } from '../../utils/validation';

export const RegisterPage: React.FC = () => {
  useDocumentTitle('Create account');
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const pwProblem = password ? passwordProblem(password) : null;
  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!name.trim() || !email.trim() || pwProblem || mismatch || !password) return;

    try {
      await register({ name: name.trim(), email: email.trim(), password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(toAppError(err, 'Registration failed. Please check your details.'));
    }
  };

  const hasFieldErrors = error && Object.keys(error.fieldErrors).length > 0;

  return (
    <div>
      <h2 className="sr-only">Create your account</h2>
      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && !hasFieldErrors && <div className="form-alert" role="alert">{error.message}</div>}

        <Input
          label="Full name"
          type="text"
          autoComplete="name"
          placeholder="e.g. Kasun Silva / කසුන් සිල්වා"
          value={name}
          onChange={(e) => setName(e.target.value)}
          startIcon={<User size={18} aria-hidden="true" />}
          error={fieldError(error, 'name') ?? (touched && !name.trim() ? 'Please enter your name.' : undefined)}
          required
        />

        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          startIcon={<Mail size={18} aria-hidden="true" />}
          error={fieldError(error, 'email') ?? (touched && !email.trim() ? 'Please enter your email.' : undefined)}
          required
        />

        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters, letters and numbers"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          startIcon={<Lock size={18} aria-hidden="true" />}
          error={fieldError(error, 'password') ?? (touched || password ? pwProblem ?? undefined : undefined)}
          helperText="At least 8 characters with letters and numbers."
          required
        />

        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          startIcon={<Lock size={18} aria-hidden="true" />}
          error={mismatch ? 'Passwords do not match.' : undefined}
          required
        />

        <Button type="submit" variant="primary" size="lg" fullWidth isLoading={isLoading} startIcon={<UserPlus size={18} aria-hidden="true" />}>
          Create account
        </Button>
      </form>

      <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ fontWeight: 600 }}>
          Sign in
        </Link>
      </p>
    </div>
  );
};
