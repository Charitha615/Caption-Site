import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const billing = vi.hoisted(() => ({ get: vi.fn(), submit: vi.fn(), attachSlip: vi.fn(), slip: vi.fn(), adminList: vi.fn(), approve: vi.fn(), reject: vi.fn() }));
vi.mock('../services/billingService', () => ({ billingService: billing }));
vi.mock('../services/accountService', () => ({ accountService: { getUsage: vi.fn().mockResolvedValue(null) } }));

import { BillingPage } from '../pages/Billing/BillingPage';
import { AdminPaymentsPage } from '../pages/Admin/AdminPaymentsPage';
import { useAuthStore } from '../stores/authStore';
import type { BillingInfo, Payment } from '../types/auth';

const info = (over: Partial<BillingInfo> = {}): BillingInfo => ({
  plan: { key: 'free', label: 'Free', expires_at: null },
  billing: {
    currency: 'LKR', plan: 'pro', prices: { monthly: 490, yearly: 3990 },
    bank: { bank_name: 'Commercial Bank', account_name: 'Sinsub', account_number: '8001234567', branch: 'Kandy' },
    bank_ready: true, whatsapp: '075 517 3298', whatsapp_link: 'https://wa.me/94755173298', reference: 'SS-7KQ2PX',
  },
  payments: [],
  ...over,
});

const payment = (over: Partial<Payment> = {}): Payment => ({
  uuid: 'p1', plan: 'pro', period: 'yearly', amount: 3990, currency: 'LKR', reference: 'SS-7KQ2PX', status: 'pending',
  has_slip: true, note: null, admin_note: null, created_at: '2026-11-27T08:00:00Z', reviewed_at: null, period_start: null, period_end: null, ...over,
});

describe('Upgrade page', () => {
  beforeEach(() => Object.values(billing).forEach((m) => m.mockReset()));

  it('shows the price for the chosen period, the bank details and the reference', async () => {
    billing.get.mockResolvedValue(info());
    render(<MemoryRouter><BillingPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Upgrade to Pro' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Transfer LKR 3,990/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Monthly/ }));
    expect(screen.getByRole('heading', { name: /Transfer LKR 490/ })).toBeInTheDocument();
    expect(screen.getByText('8001234567')).toBeInTheDocument();
    expect(screen.getAllByText('SS-7KQ2PX').length).toBeGreaterThan(0);
  });

  it('sends the slip for checking', async () => {
    billing.get.mockResolvedValueOnce(info()).mockResolvedValueOnce(info({ payments: [payment()] }));
    billing.submit.mockResolvedValue(payment());
    const { container } = render(<MemoryRouter><BillingPage /></MemoryRouter>);

    const send = await screen.findByRole('button', { name: 'Send for checking' });
    expect(send).toBeDisabled();
    const slip = new File(['x'], 'slip.jpg', { type: 'image/jpeg' });
    await userEvent.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, slip);
    await userEvent.click(send);

    expect(billing.submit).toHaveBeenCalledWith('yearly', slip, undefined);
    expect(await screen.findByRole('heading', { name: /We are checking your payment/ })).toBeInTheDocument();
  });

  it('shows when Pro ends and why a payment was not confirmed', async () => {
    billing.get.mockResolvedValue(info({
      plan: { key: 'pro', label: 'Pro', expires_at: '2027-11-27T00:00:00Z' },
      payments: [payment({ uuid: 'p2', status: 'rejected', admin_note: 'No transfer found' }), payment({ status: 'approved', period_end: '2027-11-27T00:00:00Z' })],
    }));
    render(<MemoryRouter><BillingPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Your Pro plan' })).toBeInTheDocument();
    expect(screen.getByText(/Pro is active until/)).toHaveTextContent('Nov 27, 2027');
    expect(screen.getByText('No transfer found')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });
});

describe('Admin payments', () => {
  beforeEach(() => {
    Object.values(billing).forEach((m) => m.mockReset());
    useAuthStore.setState({ user: { id: 1, uuid: 'a', name: 'Admin', email: 'a@x.lk', role: 'admin', created_at: '', updated_at: '' } });
  });

  it('approves a payment, and needs a reason to reject one', async () => {
    const p = payment({ user: { uuid: 'u', name: 'Kasun', email: 'kasun@example.com', plan: 'free', plan_expires_at: null } });
    billing.adminList.mockResolvedValue({ payments: [p], counts: { pending: 1 }, meta: { current_page: 1, last_page: 1, total: 1 } });
    billing.approve.mockResolvedValue({ ...p, status: 'approved', period_end: '2027-11-27T00:00:00Z' });
    render(<MemoryRouter><AdminPaymentsPage /></MemoryRouter>);

    const item = (await screen.findByText('Kasun')).closest('li')!;
    expect(within(item).getByText('LKR 3,990')).toBeInTheDocument();
    await userEvent.click(within(item).getByRole('button', { name: 'Reject' }));
    expect(screen.getByRole('button', { name: 'Reject payment' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await userEvent.click(within(item).getByRole('button', { name: 'Approve' }));
    expect(billing.approve).toHaveBeenCalledWith('p1');
  });
});
