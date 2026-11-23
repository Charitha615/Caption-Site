import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const confetti = vi.hoisted(() => vi.fn());
vi.mock('canvas-confetti', () => ({ default: confetti }));
// NumberFlow is a browser web component jsdom cannot animate: render the value as text.
vi.mock('@number-flow/react', () => ({
  default: ({ value, prefix = '' }: { value: number; prefix?: string }) => <span>{prefix}{value.toLocaleString('en-US')}</span>,
}));

import { Pricing } from '../components/ui/Pricing/Pricing';
import { PRICING_PLANS } from '../config/pricing';
import { LandingPage } from '../pages/Landing/LandingPage';

describe('Pricing', () => {
  it('switches between monthly and yearly billing', async () => {
    render(<MemoryRouter><Pricing plans={PRICING_PLANS} /></MemoryRouter>);
    const toggle = screen.getByRole('switch', { name: /yearly billing/i });

    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getAllByText('billed monthly')).toHaveLength(2);
    expect(screen.getByLabelText('PRO plan')).toHaveTextContent('LKR 990');

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/billed yearly · LKR 9,480 \/ year/)).toBeInTheDocument();
    expect(screen.getByLabelText('PRO plan')).toHaveTextContent('LKR 790');
    expect(confetti).toHaveBeenCalledTimes(1);
  });

  it('marks the popular plan and links every plan to sign-up', () => {
    render(<MemoryRouter><Pricing plans={PRICING_PLANS} /></MemoryRouter>);
    expect(screen.getByLabelText('PRO plan')).toHaveTextContent('Popular');
    expect(screen.getByRole('link', { name: 'Start free' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Get Pro' })).toHaveAttribute('href', '/register?plan=pro');
  });
});

describe('Landing page', () => {
  it('shows the Sinhala hero, the sections and pricing', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('සිංහල Captions');
    expect(screen.getByRole('heading', { name: /We write it properly/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Simple pricing' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Questions, answered' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /start free|caption a video free/i }).length).toBeGreaterThan(0);
  });

  it('lets visitors try caption styles in the playground', async () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    const hormozi = screen.getByRole('radio', { name: /Hormozi/ });
    expect(screen.getByRole('radio', { name: /Spotlight/ })).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(hormozi);

    expect(hormozi).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('img', { name: /hormozi style/i })).toBeInTheDocument();
  });
});
