import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const auth = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn(), logout: vi.fn(), getMe: vi.fn() }));
vi.mock('../services/authService', () => ({ authService: auth }));

import { LoginPage } from '../pages/Login/LoginPage';
import { RegisterPage } from '../pages/Register/RegisterPage';
import { useAuthStore } from '../stores/authStore';
import { STORAGE_KEYS } from '../config/constants';
import { safeNextPath } from '../utils/navigation';

const renderAt = (path: string, element: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={element} />
        <Route path="/register" element={element} />
        <Route path="/dashboard" element={<p>Dashboard page</p>} />
        <Route path="/projects/:id" element={<p>Project page</p>} />
      </Routes>
    </MemoryRouter>,
  );

const user = { id: 1, uuid: 'u', name: 'Kasun', email: 'k@example.com', role: 'user', created_at: '', updated_at: '' };

describe('authentication', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
  });

  it('signs in, stores the token and goes to the requested page', async () => {
    auth.login.mockResolvedValue({ user, token: 'tok-1' });
    renderAt('/login?next=/projects/abc', <LoginPage />);

    await userEvent.type(screen.getByLabelText(/email address/i), 'k@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Project page')).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)).toBe('tok-1');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('shows the server message when credentials are wrong', async () => {
    auth.login.mockRejectedValue(
      new AxiosError('bad', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 422, statusText: '', headers: {}, config: { headers: new AxiosHeaders() },
        data: { message: 'The provided credentials do not match our records.', errors: { email: ['The provided credentials do not match our records.'] } },
      }),
    );
    renderAt('/login', <LoginPage />);

    await userEvent.type(screen.getByLabelText(/email address/i), 'k@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'nope');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('rejects open redirects after login', () => {
    expect(safeNextPath('//evil.example')).toBe('/dashboard');
    expect(safeNextPath('https://evil.example')).toBe('/dashboard');
    expect(safeNextPath('/projects/1')).toBe('/projects/1');
  });

  it('validates registration before calling the API', async () => {
    renderAt('/register', <RegisterPage />);

    await userEvent.type(screen.getByLabelText(/full name/i), 'කසුන්');
    await userEvent.type(screen.getByLabelText(/email address/i), 'k@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'abcdefgh');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'abcdefgh');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByText('Use both letters and numbers.')).toBeInTheDocument();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('registers and lands on the dashboard', async () => {
    auth.register.mockResolvedValue({ user, token: 'tok-2' });
    renderAt('/register', <RegisterPage />);

    await userEvent.type(screen.getByLabelText(/full name/i), 'කසුන්');
    await userEvent.type(screen.getByLabelText(/email address/i), 'k@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'secret123');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(auth.register).toHaveBeenCalledWith({ name: 'කසුන්', email: 'k@example.com', password: 'secret123' });
  });
});
