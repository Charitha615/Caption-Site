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

  /** "Continue with Google": exchanges a Google access token for our API token. */
  async google(accessToken: string): Promise<AuthResponseData> {
    const res = await apiClient.post<ApiResponse<AuthResponseData>>('/auth/google', { access_token: accessToken });
    return res.data.data;
  },

  /** Emails a reset link. Answers the same whether or not the email has an account. Returns the server's message. */
  async forgotPassword(email: string): Promise<string> {
    const res = await apiClient.post<ApiResponse<null>>('/auth/forgot-password', { email });
    return res.data.message;
  },

  /** Sets a new password from the emailed link's token. Returns the server's message. */
  async resetPassword(data: { token: string; email: string; password: string; password_confirmation: string }): Promise<string> {
    const res = await apiClient.post<ApiResponse<null>>('/auth/reset-password', data);
    return res.data.message;
  },

  async logout(): Promise<void> {
    await apiClient.post<ApiResponse<null>>('/auth/logout');
  },

  async getMe(): Promise<User> {
    const res = await apiClient.get<ApiResponse<{ user: User }>>('/me');
    return res.data.data.user;
  },
};
