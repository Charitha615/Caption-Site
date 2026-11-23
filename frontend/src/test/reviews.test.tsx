import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const api = vi.hoisted(() => ({ listPublic: vi.fn(), mine: vi.fn(), save: vi.fn(), remove: vi.fn(), adminList: vi.fn(), moderate: vi.fn() }));
vi.mock('../services/reviewService', () => ({ reviewService: api }));

import { AuthLayout } from '../layouts/AuthLayout/AuthLayout';
import { ReviewCard } from '../features/account/ReviewCard';
import { AdminReviewsPage } from '../pages/Admin/AdminReviewsPage';
import { useAuthStore } from '../stores/authStore';

const own = (over = {}) => ({ uuid: 'r1', rating: 5, body: 'Best Sinhala caption tool ever.', role: 'Vlogger', name: 'Kasun', avatar_url: null, created_at: null, status: 'pending', approved_at: null, ...over });

describe('Reviews', () => {
  beforeEach(() => Object.values(api).forEach((m) => m.mockReset()));

  it('the sign-in panel shows real approved reviews instead of the samples', async () => {
    api.listPublic.mockResolvedValue([{ uuid: 'a', rating: 5, body: 'සිංහල captions ගොඩක් ලේසියි now.', role: 'Car reviewer', name: 'Nimal Perera', avatar_url: null, created_at: null }]);
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes><Route element={<AuthLayout />}><Route path="/login" element={<p>form</p>} /></Route></Routes>
      </MemoryRouter>,
    );
    const panel = screen.getByRole('complementary', { name: 'What creators say' });
    expect(await within(panel).findByText('Nimal Perera')).toBeInTheDocument();
    expect(within(panel).getByText(/ගොඩක් ලේසියි/)).toBeInTheDocument();
  });

  it('keeps the samples when there are no approved reviews yet', async () => {
    api.listPublic.mockResolvedValue([]);
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes><Route element={<AuthLayout />}><Route path="/login" element={<p>form</p>} /></Route></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Kasun Perera')).toBeInTheDocument();
  });

  it('a user rates the product and sees it is waiting for approval', async () => {
    api.mine.mockResolvedValue(null);
    api.save.mockResolvedValue(own());
    render(<ReviewCard />);

    const submit = await screen.findByRole('button', { name: 'Submit review' });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: /5 stars/ }));
    await userEvent.type(screen.getByLabelText('Your review'), 'Best Sinhala caption tool ever.');
    await userEvent.type(screen.getByLabelText(/What you do/), 'Vlogger');
    await userEvent.click(submit);

    expect(api.save).toHaveBeenCalledWith({ rating: 5, body: 'Best Sinhala caption tool ever.', role: 'Vlogger' });
    expect(await screen.findByText(/Waiting for approval/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update review' })).toBeInTheDocument();
  });

  it('an admin publishes a waiting review', async () => {
    useAuthStore.setState({ user: { id: 1, uuid: 'u', name: 'Admin', email: 'a@x.lk', role: 'admin', created_at: '', updated_at: '' } as never });
    api.adminList.mockResolvedValue({ reviews: [own()], counts: { pending: 1 }, meta: { current_page: 1, last_page: 1, total: 1 } });
    api.moderate.mockResolvedValue(own({ status: 'approved' }));
    render(<MemoryRouter><AdminReviewsPage /></MemoryRouter>);

    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));

    expect(api.moderate).toHaveBeenCalledWith('r1', 'approved');
    expect(api.adminList).toHaveBeenCalledTimes(2);
  });

  it('non-admins cannot manage reviews', () => {
    useAuthStore.setState({ user: { id: 2, uuid: 'v', name: 'User', email: 'u@x.lk', role: 'user', created_at: '', updated_at: '' } as never });
    render(<MemoryRouter><AdminReviewsPage /></MemoryRouter>);
    expect(screen.getByText(/Only admins/)).toBeInTheDocument();
    expect(api.adminList).not.toHaveBeenCalled();
  });
});
