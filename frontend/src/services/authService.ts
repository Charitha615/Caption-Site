import { apiClient } from './api';
import type { ApiResponse } from '../types/api';
import type { AuthResponseData, LoginCredentials, RegisterCredentials, User } from '../types/auth';

export const authService = {
  async register(credentials: RegisterCredentials): Promise<AuthResponseData> {
    const res = await apiClient.post<ApiResponse<AuthResponseData>>('/auth/register', credentials);
    return res.data.data;
  },

  async login(credentials: LoginCredentials): Promise<AuthResponseData> {
    const res = await apiClient.post<ApiResponse<AuthResponseData>>('/auth/login', credentials);
    return res.data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post<ApiResponse<null>>('/auth/logout');
  },

  async getMe(): Promise<User> {
    const res = await apiClient.get<ApiResponse<{ user: User }>>('/me');
    return res.data.data.user;
  },
};
