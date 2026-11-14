import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter } from 'react-router-dom';

const account = vi.hoisted(() => ({ getAiKey: vi.fn(), saveAiKey: vi.fn(), verifyAiKey: vi.fn(), removeAiKey: vi.fn() }));
vi.mock('../services/accountService', () => ({ accountService: account }));

import { AiKeyCard } from '../features/account/AiKeyCard';
import { AiKeyNotice } from '../features/account/AiKeyNotice';
import { useAiKeyStore } from '../stores/aiKeyStore';
import type { AiKeyStatus } from '../types/auth';

const status = (over: Partial<AiKeyStatus> = {}): AiKeyStatus => ({
  configured: false, hint: null, status: null, checked_at: null,
  required: true, can_caption: false, help_url: 'https://aistudio.google.com/app/api-keys', ...over,
});
const KEY = 'AIzaSyTEST_user_key_1234567890abcd';

describe('Google AI key card', () => {
  beforeEach(() => {
    Object.values(account).forEach((m) => m.mockReset());
    useAiKeyStore.setState({ aiKey: null });
  });

  it('links to Google AI Studio and saves + verifies a pasted key', async () => {
    account.getAiKey.mockResolvedValue(status());
    account.saveAiKey.mockResolvedValue({
      aiKey: status({ configured: true, hint: 'abcd', status: 'valid', can_caption: true }),
      verification: { result: 'valid', message: 'Key verified. Captions will be generated with your Google AI key.' },
    });
    render(<MemoryRouter><AiKeyCard /></MemoryRouter>);

    const link = await screen.findByRole('link', { name: /google ai studio/i });
    expect(link).toHaveAttribute('href', 'https://aistudio.google.com/app/api-keys');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));

    const save = screen.getByRole('button', { name: /save & verify/i });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/^API key/), KEY);
    await userEvent.click(save);

    expect(account.saveAiKey).toHaveBeenCalledWith(KEY);
    expect(await screen.findByText('Verified')).toBeInTheDocument();
    expect(screen.getByText(/Key verified/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue(KEY)).not.toBeInTheDocument();
    expect(screen.getByText('Saved key ending in')).toBeInTheDocument();
  });

  it('shows Google’s rejection next to the field and does not keep the key', async () => {
    account.getAiKey.mockResolvedValue(status());
    account.saveAiKey.mockRejectedValue(new AxiosError('bad', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 422, statusText: '', headers: {}, config: { headers: new AxiosHeaders() },
      data: { message: 'Google rejected this key.', errors: { api_key: ['Google rejected this key. Copy it again from Google AI Studio and make sure the Gemini API is enabled.'] } },
    }));
    render(<MemoryRouter><AiKeyCard /></MemoryRouter>);

    await userEvent.type(await screen.findByLabelText(/^API key/), KEY);
    await userEvent.click(screen.getByRole('button', { name: /save & verify/i }));

    expect(await screen.findByText(/Google rejected this key/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^API key/)).toHaveAttribute('aria-invalid', 'true');
    expect(useAiKeyStore.getState().aiKey?.configured).toBe(false);
  });

  it('re-verifies a saved key and reports when Google rejects it', async () => {
    account.getAiKey.mockResolvedValue(status({ configured: true, hint: 'abcd', status: 'valid', can_caption: true }));
    account.verifyAiKey.mockResolvedValue({
      aiKey: status({ configured: true, hint: 'abcd', status: 'invalid', can_caption: true }),
      verification: { result: 'invalid', message: 'Google rejected this key.' },
    });
    render(<MemoryRouter><AiKeyCard /></MemoryRouter>);

    await userEvent.click(await screen.findByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Rejected by Google')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Google rejected this key.');
  });

  it('removes the key after confirmation', async () => {
    account.getAiKey.mockResolvedValue(status({ configured: true, hint: 'abcd', status: 'valid', can_caption: true }));
    account.removeAiKey.mockResolvedValue(status());
    render(<MemoryRouter><AiKeyCard /></MemoryRouter>);

    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove key' }));

    expect(account.removeAiKey).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /save & verify/i })).toBeInTheDocument();
  });

  it('prompts users without a key to add one, and hides once they have', async () => {
    account.getAiKey.mockResolvedValue(status());
    const { unmount } = render(<MemoryRouter><AiKeyNotice /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Add API key' })).toHaveAttribute('href', '/profile#ai-key');
    unmount();

    useAiKeyStore.setState({ aiKey: status({ configured: true, status: 'valid', can_caption: true }) });
    render(<MemoryRouter><AiKeyNotice /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: 'Add API key' })).not.toBeInTheDocument();
  });
});
