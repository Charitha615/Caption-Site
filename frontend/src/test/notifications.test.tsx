import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const svc = vi.hoisted(() => ({ list: vi.fn(), unread: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn(), remove: vi.fn(), sentMessages: vi.fn(), send: vi.fn() }));
vi.mock('../services/notificationService', () => ({ notificationService: svc }));
const account = vi.hoisted(() => ({ updateSettings: vi.fn(), getSettings: vi.fn() }));
vi.mock('../services/accountService', () => ({ accountService: account }));

import { NotificationBell } from '../components/Notifications/NotificationBell';
import { AppTour, TOUR_STEPS } from '../components/Tour/AppTour';
import { useNotificationStore } from '../stores/notificationStore';
import { useTourStore } from '../stores/tourStore';

const note = (over = {}) => ({ id: 'n1', kind: 'render', title: 'Your video is ready 🎬', body: 'Open the project to download it.', link: '/projects/p1', read: false, created_at: new Date().toISOString(), ...over });

describe('Notification bell', () => {
  beforeEach(() => {
    Object.values(svc).forEach((m) => m.mockReset());
    useNotificationStore.setState({ unread: 0, recent: [], loaded: false });
  });

  it('shows the unread count, lists notifications and opens one', async () => {
    svc.unread.mockResolvedValue(2);
    svc.list.mockResolvedValue({ notifications: [note(), note({ id: 'n2', kind: 'admin', title: 'Hello from us', link: null, read: true })], unread: 2, meta: { current_page: 1, last_page: 1, total: 2 } });
    svc.markRead.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<NotificationBell />} />
          <Route path="/projects/p1" element={<p>Project page</p>} />
        </Routes>
      </MemoryRouter>,
    );

    const bell = await screen.findByRole('button', { name: 'Notifications, 2 unread' });
    await userEvent.click(bell);
    expect(await screen.findByText('Hello from us')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Your video is ready 🎬'));

    expect(svc.markRead).toHaveBeenCalledWith('n1');
    expect(await screen.findByText('Project page')).toBeInTheDocument();
    expect(useNotificationStore.getState().unread).toBe(1);
  });
});

describe('App tour', () => {
  beforeEach(() => {
    account.updateSettings.mockReset().mockResolvedValue({ default_language: 'si', default_export_resolution: '1080', default_export_quality: 'standard', tour_pending: false });
    act(() => useTourStore.setState({ open: false }));
  });

  it('walks through the steps and remembers when it is finished', async () => {
    render(<><div data-tour="new-project">New project</div><AppTour /></>);
    act(() => useTourStore.getState().start());

    expect(screen.getByRole('dialog', { name: TOUR_STEPS[0]!.title })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: "Let's go" }));
    expect(screen.getByRole('heading', { name: 'Start a new project' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText(/Step 1 of/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(account.updateSettings).toHaveBeenCalledWith({ tour_pending: false }));
  });
});
