import { apiClient } from './api';
import type { ApiResponse } from '../types/api';
import type { BillingInfo, BillingPeriod, Payment, PaymentStatus } from '../types/auth';

export interface AdminPaymentList {
  payments: Payment[];
  counts: Partial<Record<PaymentStatus, number>>;
  meta: { current_page: number; last_page: number; total: number };
}

/** Pro by bank transfer: the user's plan and payments, and the admin review queue. */
export const billingService = {
  /** Starts the free Pro trial (once per email). */
  async startTrial(): Promise<{ ends_at: string; days: number }> {
    const res = await apiClient.post<ApiResponse<{ ends_at: string; days: number }>>('/billing/trial', null, { silent: true });
    return res.data.data;
  },

  async get(): Promise<BillingInfo> {
    const res = await apiClient.get<ApiResponse<BillingInfo>>('/billing');
    return res.data.data;
  },

  /** Sends a payment for checking, with the slip (or a note that it was sent on WhatsApp). */
  async submit(period: BillingPeriod, slip: File | null, note?: string): Promise<Payment> {
    const form = new FormData();
    form.append('period', period);
    if (slip) form.append('slip', slip);
    if (note) form.append('note', note);
    const res = await apiClient.post<ApiResponse<{ payment: Payment }>>('/billing/payments', form, { silent: true });
    return res.data.data.payment;
  },

  async attachSlip(uuid: string, slip: File): Promise<Payment> {
    const form = new FormData();
    form.append('slip', slip);
    const res = await apiClient.post<ApiResponse<{ payment: Payment }>>(`/billing/payments/${uuid}/slip`, form, { silent: true });
    return res.data.data.payment;
  },

  /** The slip as a blob (it needs the sign-in token, so it can't be a plain link). */
  async slip(uuid: string): Promise<Blob> {
    const res = await apiClient.get<Blob>(`/billing/payments/${uuid}/slip`, { responseType: 'blob' });
    return res.data;
  },

  async adminList(status: PaymentStatus, page = 1): Promise<AdminPaymentList> {
    const res = await apiClient.get<ApiResponse<AdminPaymentList>>('/admin/payments', { params: { status, page } });
    return res.data.data;
  },

  async approve(uuid: string, note?: string): Promise<Payment> {
    const res = await apiClient.post<ApiResponse<{ payment: Payment }>>(`/admin/payments/${uuid}/approve`, { note });
    return res.data.data.payment;
  },

  async reject(uuid: string, reason: string): Promise<Payment> {
    const res = await apiClient.post<ApiResponse<{ payment: Payment }>>(`/admin/payments/${uuid}/reject`, { reason }, { silent: true });
    return res.data.data.payment;
  },
};
