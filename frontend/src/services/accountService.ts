import { apiClient } from './api';
import type { ApiResponse } from '../types/api';
import type { AiKeyStatus, AiKeyVerification, User, UserSettings } from '../types/auth';
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

  async getAiKey(): Promise<AiKeyStatus> {
    const res = await apiClient.get<ApiResponse<{ ai_key: AiKeyStatus }>>('/me/ai-key');
    return res.data.data.ai_key;
  },

  /** Verifies with Google and saves. Rejected keys come back as a 422 field error on `api_key`. */
  async saveAiKey(apiKey: string): Promise<{ aiKey: AiKeyStatus; verification: AiKeyVerification }> {
    const res = await apiClient.put<ApiResponse<{ ai_key: AiKeyStatus; verification: AiKeyVerification }>>('/me/ai-key', { api_key: apiKey }, { silent: true });
    return { aiKey: res.data.data.ai_key, verification: res.data.data.verification };
  },

  async verifyAiKey(): Promise<{ aiKey: AiKeyStatus; verification: AiKeyVerification }> {
    const res = await apiClient.post<ApiResponse<{ ai_key: AiKeyStatus; verification: AiKeyVerification }>>('/me/ai-key/verify', {}, { silent: true });
    return { aiKey: res.data.data.ai_key, verification: res.data.data.verification };
  },

  async removeAiKey(): Promise<AiKeyStatus> {
    const res = await apiClient.delete<ApiResponse<{ ai_key: AiKeyStatus }>>('/me/ai-key');
    return res.data.data.ai_key;
  },

  async getUsage(): Promise<UsageSummary> {
    const res = await apiClient.get<ApiResponse<{ usage: UsageSummary }>>('/usage');
    return res.data.data.usage;
  },
};
