import { apiClient } from './api';
import type { ApiResponse } from '../types/api';
import type { UsageSummary } from '../types/project';

export interface AdminUser {
  uuid: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  /** The plan in force now (a lapsed paid plan shows as `free`). */
  plan: string;
  plan_label: string;
  /** The plan saved on the account, even if it has ended. */
  stored_plan: string | null;
  plan_expires_at: string | null;
  projects_count: number;
  last_active_at: string | null;
  usage_reset_at: string | null;
  created_at: string | null;
  /** Where they came from when they signed up (UTM tags or referring site). */
  signup?: { source: string | null; medium: string | null; campaign: string | null };
  usage?: UsageSummary;
}

export interface AdminUserList {
  users: AdminUser[];
  plans: Array<{ key: string; label: string }>;
  meta: { current_page: number; last_page: number; total: number };
}

/** Admin: registered users, their plans, and account resets. */
export const adminUserService = {
  async list(params: { search?: string; plan?: string; page?: number }): Promise<AdminUserList> {
    const res = await apiClient.get<ApiResponse<AdminUserList>>('/admin/users', { params });
    return res.data.data;
  },

  async get(uuid: string): Promise<AdminUser> {
    const res = await apiClient.get<ApiResponse<{ user: AdminUser }>>(`/admin/users/${uuid}`);
    return res.data.data.user;
  },

  /** No `expiresAt` = the plan never ends. */
  async setPlan(uuid: string, plan: string, expiresAt: string | null): Promise<AdminUser> {
    const res = await apiClient.put<ApiResponse<{ user: AdminUser }>>(`/admin/users/${uuid}/plan`, { plan, expires_at: expiresAt }, { silent: true });
    return res.data.data.user;
  },

  async resetPassword(uuid: string, password: string): Promise<void> {
    await apiClient.put(`/admin/users/${uuid}/password`, { password }, { silent: true });
  },

  async resetUsage(uuid: string): Promise<AdminUser> {
    const res = await apiClient.post<ApiResponse<{ user: AdminUser }>>(`/admin/users/${uuid}/usage-reset`);
    return res.data.data.user;
  },

  async signOut(uuid: string): Promise<number> {
    const res = await apiClient.post<ApiResponse<{ sessions: number }>>(`/admin/users/${uuid}/sign-out`);
    return res.data.data.sessions;
  },

  async deleteProjects(uuid: string): Promise<number> {
    const res = await apiClient.delete<ApiResponse<{ projects: number }>>(`/admin/users/${uuid}/projects`);
    return res.data.data.projects;
  },
};
