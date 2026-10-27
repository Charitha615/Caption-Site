import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, UserPlus } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';

export const RegisterPage: React.FC = () => {
  useDocumentTitle('Create Account');
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name || !email || !password) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    try {
      await register({ name, email, password });
      navigate('/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setErrorMessage(
        error.response?.data?.message || 'Registration failed. Please check inputs.'
      );
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
          label="Full Name"
          type="text"
          placeholder="e.g. Kasun Silva"
          value={name}
          onChange={(e) => setName(e.target.value)}
          startIcon={<User size={18} />}
          required
        />

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
          placeholder="Minimum 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          startIcon={<Lock size={18} />}
          required
        />

        <Input
          label="Confirm Password"
          type="password"
          placeholder="Re-enter password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          startIcon={<Lock size={18} />}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isLoading}
          startIcon={<UserPlus size={18} />}
        >
          Create Account
        </Button>
      </form>

      <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ fontWeight: 600 }}>
          Sign in
        </Link>
      </div>
    </div>
  );
};
