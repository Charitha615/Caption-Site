import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const svc = vi.hoisted(() => ({ list: vi.fn(), unread: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn(), remove: vi.fn(), sentMessages: vi.fn(), send: vi.fn(), whatsAppList: vi.fn() }));
vi.mock('../services/notificationService', () => ({ notificationService: svc }));

import { AdminNotificationsPage } from '../pages/Admin/AdminNotificationsPage';
import { useAuthStore } from '../stores/authStore';

const reach = { in_app: 0, email: 0, whatsapp: 0 };

describe('Admin: send notifications', () => {
  beforeEach(() => {
    Object.values(svc).forEach((m) => m.mockReset());
    useAuthStore.setState({ user: { id: 1, uuid: 'a', name: 'Admin', email: 'a@x.lk', role: 'admin', created_at: '', updated_at: '' } });
    localStorage.clear();
  });

  it('sends to Pro yearly users by email and WhatsApp, then shows the click-to-send list', async () => {
    svc.sentMessages.mockResolvedValue({ messages: [], reach: { everyone: { in_app: 10, email: 8, whatsapp: 3 }, pro_yearly: { in_app: 4, email: 4, whatsapp: 2 }, free: reach, pro: reach, pro_monthly: reach, unlimited: reach } });
    const sent = { id: 7, title: 'Thanks!', body: 'A gift.', category: 'offer', link: '/billing', button_label: 'Claim', audience: 'pro_yearly', channels: ['email', 'whatsapp'], target: null, recipients: 0, email_recipients: 4, whatsapp_recipients: 2, created_at: null };
    svc.send.mockResolvedValue(sent);
    svc.whatsAppList.mockResolvedValue([{ id: 3, name: 'Nimal', email: 'n@x.lk', phone: '+94771234567', link: 'https://wa.me/94771234567?text=hi' }]);
    render(<MemoryRouter><AdminNotificationsPage /></MemoryRouter>);

    await userEvent.selectOptions(await screen.findByLabelText('Send to'), 'pro_yearly');
    await userEvent.click(screen.getByRole('checkbox', { name: /In the app/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Email/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /WhatsApp/ }));
    expect(screen.getByText(/WhatsApp/, { selector: 'strong' }).parentElement).toHaveTextContent('2 people');
    await userEvent.click(screen.getByRole('radio', { name: '🎁 Offer' }));
    await userEvent.type(screen.getByLabelText('Title'), 'Thanks!');
    await userEvent.type(screen.getByLabelText('Message'), 'A gift.');
    await userEvent.type(screen.getByLabelText('Button link (optional)'), '/billing');
    await userEvent.type(screen.getByLabelText('Button text'), 'Claim');
    await userEvent.click(screen.getByRole('tab', { name: /WhatsApp/ }));
    expect(screen.getByText(/🎁 \*Thanks!\*/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Send this message?' })).getByRole('button', { name: 'Send' }));

    expect(svc.send).toHaveBeenCalledWith({ title: 'Thanks!', body: 'A gift.', category: 'offer', link: '/billing', button_label: 'Claim', audience: 'pro_yearly', channels: ['email', 'whatsapp'], email: undefined });
    const list = await screen.findByRole('dialog', { name: 'WhatsApp: Thanks!' });
    const send = within(list).getByRole('link', { name: /Send on WhatsApp/ });
    expect(send).toHaveAttribute('href', 'https://wa.me/94771234567?text=hi');
    await userEvent.click(send);
    expect(within(list).getByText('1 of 1 sent')).toBeInTheDocument();
  });
});
