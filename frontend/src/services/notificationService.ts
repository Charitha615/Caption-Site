import { apiClient } from './api';
import type { ApiResponse } from '../types/api';

export interface AppNotification {
  id: string;
  /** welcome | payment | payment_rejected | plan | render | render_failed | admin | system */
  kind: string;
  title: string;
  body: string;
  /** A page of the app ("/billing") or a full https:// address. */
  link: string | null;
  /** Admin messages: announcement | update | offer | tip | important. */
  category?: string | null;
  /** Admin messages: text of the button for the link. */
  button_label?: string | null;
  read: boolean;
  created_at: string | null;
}

export interface NotificationPage {
  notifications: AppNotification[];
  unread: number;
  meta: { current_page: number; last_page: number; total: number };
}

export type MessageAudience = 'everyone' | 'free' | 'pro' | 'pro_monthly' | 'pro_yearly' | 'unlimited' | 'user';
export type MessageChannel = 'in_app' | 'email' | 'whatsapp';
export type MessageCategory = 'announcement' | 'update' | 'offer' | 'tip' | 'important';

export interface WhatsAppRecipient {
  id: number;
  name: string;
  email: string;
  phone: string;
  /** wa.me link with the message already typed. */
  link: string;
}

export interface SentMessage {
  id: number;
  title: string;
  body: string;
  category: MessageCategory;
  link: string | null;
  button_label: string | null;
  audience: MessageAudience;
  channels: MessageChannel[];
  target: { name: string; email: string } | null;
  /** People reached in the app, by email, and on the WhatsApp list. */
  recipients: number;
  email_recipients: number;
  whatsapp_recipients: number;
  created_at: string | null;
}

/** How many people each audience reaches on each channel. */
export type AudienceReach = Record<string, Record<MessageChannel, number>>;

export const notificationService = {
  async list(page = 1, perPage = 20): Promise<NotificationPage> {
    const res = await apiClient.get<ApiResponse<NotificationPage>>('/notifications', { params: { page, per_page: perPage }, silent: true });
    return res.data.data;
  },

  async unread(): Promise<number> {
    const res = await apiClient.get<ApiResponse<{ unread: number }>>('/notifications/unread', { silent: true });
    return res.data.data.unread;
  },

  async markRead(id: string): Promise<void> {
    await apiClient.post(`/notifications/${id}/read`, null, { silent: true });
  },

  async markAllRead(): Promise<void> {
    await apiClient.post('/notifications/read-all');
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/notifications/${id}`);
  },

  /* Admin */
  async sentMessages(): Promise<{ messages: SentMessage[]; reach: AudienceReach }> {
    const res = await apiClient.get<ApiResponse<{ messages: SentMessage[]; reach: AudienceReach }>>('/admin/messages');
    return res.data.data;
  },

  async whatsAppList(messageId: number): Promise<WhatsAppRecipient[]> {
    const res = await apiClient.get<ApiResponse<{ recipients: WhatsAppRecipient[] }>>(`/admin/messages/${messageId}/whatsapp`);
    return res.data.data.recipients;
  },

  async send(input: {
    title: string; body: string; category: MessageCategory; link: string | null; button_label: string | null;
    audience: MessageAudience; channels: MessageChannel[]; email?: string;
  }): Promise<SentMessage> {
    const res = await apiClient.post<ApiResponse<{ message: SentMessage }>>('/admin/messages', input, { silent: true });
    return res.data.data.message;
  },
};
