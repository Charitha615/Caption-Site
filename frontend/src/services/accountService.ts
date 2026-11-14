import { apiClient } from './api';
import type { ApiResponse } from '../types/api';
import type { User, UserSettings } from '../types/auth';
import type { UsageSummary } from '../types/project';

export const accountService = {
  async updateProfile(payload: { name?: string; email?: string }): Promise<User> {
    const res = await apiClient.patch<ApiResponse<{ user: User }>>('/me', payload, { silent: true });
    return res.data.data.user;
  },

  async changePassword(payload: { current_password: string; password: string; password_confirmation: string }): Promise<void> {
    await apiClient.put('/me/password', payload, { silent: true });
  },

  async getSettings(): Promise<UserSettings> {
    const res = await apiClient.get<ApiResponse<{ settings: UserSettings }>>('/settings');
    return res.data.data.settings;
  },

  async updateSettings(payload: Partial<UserSettings>): Promise<UserSettings> {
    const res = await apiClient.put<ApiResponse<{ settings: UserSettings }>>('/settings', payload);
    return res.data.data.settings;
  },

  async getUsage(): Promise<UsageSummary> {
    const res = await apiClient.get<ApiResponse<{ usage: UsageSummary }>>('/usage');
    return res.data.data.usage;
  },
};
