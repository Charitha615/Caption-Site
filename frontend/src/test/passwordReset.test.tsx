import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const auth = vi.hoisted(() => ({ forgotPassword: vi.fn(), resetPassword: vi.fn() }));
vi.mock('../services/authService', () => ({ authService: auth }));

import { ForgotPasswordPage } from '../pages/PasswordReset/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/PasswordReset/ResetPasswordPage';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<p>Sign in page</p>} />
      </Routes>
    </MemoryRouter>,
  );

/** A 422 like Laravel's validation errors. */
const validationError = (field: string, message: string) => {
  const res = { status: 422, data: { success: false, message, errors: { [field]: [message] } }, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } };
  return new AxiosError(message, 'ERR_BAD_REQUEST', undefined, undefined, res);
};

describe('forgot password', () => {
  beforeEach(() => Object.values(auth).forEach((m) => m.mockReset()));

  it('sends the reset link and shows the server message', async () => {
    auth.forgotPassword.mockResolvedValue('If an account exists for that email, we have sent a link.');
    renderAt('/forgot-password');

    await userEvent.type(screen.getByLabelText(/^email$/i), '  k@example.com ');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(auth.forgotPassword).toHaveBeenCalledWith('k@example.com');
    expect(await screen.findByRole('status')).toHaveTextContent(/we have sent a link/i);
  });

  it('shows a field error from the server', async () => {
    auth.forgotPassword.mockRejectedValue(validationError('email', 'The email field must be a valid email address.'));
    renderAt('/forgot-password');

    await userEvent.type(screen.getByLabelText(/^email$/i), 'bad@');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/must be a valid email/i)).toBeInTheDocument();
  });
});

describe('reset password', () => {
  beforeEach(() => Object.values(auth).forEach((m) => m.mockReset()));

  it('sets the new password from the emailed link, then offers sign in', async () => {
    auth.resetPassword.mockResolvedValue('Your password has been reset. You can now sign in.');
    renderAt('/reset-password?token=tok123&email=k%40example.com');

    expect(screen.getByText('For k@example.com')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^new password/i), 'NewPass123');
    await userEvent.type(screen.getByLabelText(/^confirm new password/i), 'NewPass123');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(auth.resetPassword).toHaveBeenCalledWith({
      token: 'tok123', email: 'k@example.com', password: 'NewPass123', password_confirmation: 'NewPass123',
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/has been reset/i);
    await userEvent.click(screen.getByRole('button', { name: /go to sign in/i }));
    expect(await screen.findByText('Sign in page')).toBeInTheDocument();
  });

  it('blocks mismatched passwords before calling the server', async () => {
    renderAt('/reset-password?token=tok123&email=k%40example.com');

    await userEvent.type(screen.getByLabelText(/^new password/i), 'NewPass123');
    await userEvent.type(screen.getByLabelText(/^confirm new password/i), 'NewPass124');

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeDisabled();
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });

  it('offers a new link when the token has expired', async () => {
    auth.resetPassword.mockRejectedValue(validationError('token', 'This reset link is invalid or has expired. Please request a new one.'));
    renderAt('/reset-password?token=old&email=k%40example.com');

    await userEvent.type(screen.getByLabelText(/^new password/i), 'NewPass123');
    await userEvent.type(screen.getByLabelText(/^confirm new password/i), 'NewPass123');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/expired/i);
    expect(screen.getByRole('link', { name: /request a new link/i })).toHaveAttribute('href', '/forgot-password');
  });

  it('explains when the link is missing its token', () => {
    renderAt('/reset-password');
    expect(screen.getByText(/reset link is incomplete/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new link/i })).toHaveAttribute('href', '/forgot-password');
  });
});
