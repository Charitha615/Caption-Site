import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const account = vi.hoisted(() => ({ getSessions: vi.fn(), signOutDevice: vi.fn(), signOutOtherDevices: vi.fn() }));
vi.mock('../services/accountService', () => ({ accountService: account }));

import { SignedInDevices } from '../pages/Settings/SignedInDevices';
import { formatTimeAgo } from '../utils/formatters';
import type { SignedInDevice } from '../types/auth';

const device = (over: Partial<SignedInDevice>): SignedInDevice => ({
  id: 1, browser: 'Chrome', os: 'Windows', device: 'desktop', known: true, ip_address: '198.51.100.20',
  sign_in_method: 'password', signed_in_at: '2026-11-20T09:15:00Z', last_active_at: new Date().toISOString(), current: false, ...over,
});

describe('Signed-in devices', () => {
  beforeEach(() => Object.values(account).forEach((m) => m.mockReset()));

  it('lists each device with its IP, sign-in time and method, marking this one', async () => {
    account.getSessions.mockResolvedValue([
      device({ id: 1, current: true }),
      device({ id: 2, browser: 'Safari', os: 'iPhone', device: 'mobile', ip_address: '203.0.113.7', sign_in_method: 'google' }),
    ]);
    render(<SignedInDevices />);

    const items = await screen.findAllByRole('listitem');
    expect(within(items[0]!).getByText('This device')).toBeInTheDocument();
    expect(within(items[0]!).getByText(/Active now/)).toBeInTheDocument();
    expect(within(items[0]!).queryByRole('button', { name: /Sign out/ })).not.toBeInTheDocument();
    expect(within(items[1]!).getByText('Safari on iPhone')).toBeInTheDocument();
    expect(within(items[1]!).getByText(/IP 203\.0\.113\.7/)).toBeInTheDocument();
    expect(within(items[1]!).getByText(/Google/)).toBeInTheDocument();
    expect(within(items[1]!).getByText(/Signed in/).querySelector('time')).toHaveAttribute('datetime', '2026-11-20T09:15:00Z');
  });

  it('signs out one device, or all the others after confirming', async () => {
    account.getSessions.mockResolvedValue([
      device({ id: 1, current: true }),
      device({ id: 2, browser: 'Safari', os: 'iPhone' }),
      device({ id: 3, browser: 'Firefox', os: 'Linux' }),
    ]);
    account.signOutDevice.mockResolvedValue(undefined);
    account.signOutOtherDevices.mockResolvedValue(1);
    render(<SignedInDevices />);

    await userEvent.click(await screen.findByRole('button', { name: 'Sign out Safari on iPhone' }));
    expect(account.signOutDevice).toHaveBeenCalledWith(2);
    expect(screen.queryByText('Safari on iPhone')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out all other devices' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out others' }));
    expect(account.signOutOtherDevices).toHaveBeenCalled();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Sign out all other devices' })).not.toBeInTheDocument();
  });

  it('describes how long ago a device was used', () => {
    const now = Date.parse('2026-11-27T12:00:00Z');
    expect(formatTimeAgo('2026-11-27T11:59:30Z', now)).toBe('Just now');
    expect(formatTimeAgo('2026-11-27T11:55:00Z', now)).toBe('5 minutes ago');
    expect(formatTimeAgo('2026-11-27T11:00:00Z', now)).toBe('1 hour ago');
    expect(formatTimeAgo('2026-11-24T12:00:00Z', now)).toBe('3 days ago');
    expect(formatTimeAgo('2026-09-01T12:00:00Z', now)).toBe('Sep 1, 2026');
  });
});
