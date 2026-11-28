import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const billing = vi.hoisted(() => ({ startTrial: vi.fn(), get: vi.fn() }));
vi.mock('../services/billingService', () => ({ billingService: billing }));

import { TrialNotice } from '../features/billing/TrialNotice';
import { useUsageStore } from '../stores/usageStore';
import type { UsageSummary } from '../types/project';

const meter = { used: 0, limit: null };
const usage = (over: Partial<UsageSummary>): UsageSummary => ({
  plan: { key: 'free', label: 'Free', expires_at: null },
  period: { start: '', end: '' }, caption_minutes: meter, ai_requests_today: meter, exports: meter, renders: meter, storage_mb: meter,
  max_upload_mb: 200, max_video_minutes: 3,
  ...over,
} as UsageSummary);

describe('Free Pro trial notice', () => {
  beforeEach(() => {
    localStorage.clear();
    billing.startTrial.mockReset();
  });

  it('offers the trial to an eligible account and starts it', async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    useUsageStore.setState({ usage: usage({ trial: { days: 7, eligible: true, active: false, used: false, ends_at: null } }), load });
    billing.startTrial.mockResolvedValue({ ends_at: '2026-12-08T10:00:00Z', days: 7 });
    render(<MemoryRouter><TrialNotice /></MemoryRouter>);

    expect(screen.getByText('Try Pro free for 7 days')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start free trial' }));
    expect(billing.startTrial).toHaveBeenCalled();
    expect(load).toHaveBeenCalledWith(true);
  });

  it('shows the days left during the trial, and nothing for accounts that cannot have one', () => {
    const ends = new Date(Date.now() + 4.5 * 86_400_000).toISOString();
    useUsageStore.setState({ usage: usage({ plan: { key: 'pro', label: 'Pro', expires_at: ends }, trial: { days: 7, eligible: false, active: true, used: true, ends_at: ends } }) });
    const { unmount } = render(<MemoryRouter><TrialNotice /></MemoryRouter>);
    expect(screen.getByText('Pro trial: 5 days left')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Keep Pro' })).toHaveAttribute('href', '/billing');
    unmount();

    useUsageStore.setState({ usage: usage({ plan: { key: 'pro', label: 'Pro', expires_at: null }, trial: { days: 7, eligible: false, active: false, used: false, ends_at: null } }) });
    const { container } = render(<MemoryRouter><TrialNotice /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
