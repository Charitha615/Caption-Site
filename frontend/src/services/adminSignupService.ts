import { apiClient } from './api';
import type { ApiResponse } from '../types/api';

export type SignupPeriod = 7 | 30 | 90 | 0;

export interface SignupSourceRow {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  signups: number;
  /** Of those sign-ups, how many have an approved Pro payment. */
  paid: number;
}

export interface SignupReport {
  days: SignupPeriod;
  totals: { signups: number; paid: number; tracked: number };
  sources: SignupSourceRow[];
}

/** Admin: where sign-ups come from (UTM tags captured on the first visit). */
export const adminSignupService = {
  /** `days: 0` is all time. */
  async report(days: SignupPeriod): Promise<SignupReport> {
    const res = await apiClient.get<ApiResponse<SignupReport>>('/admin/signups', { params: { days } });
    return res.data.data;
  },
};
