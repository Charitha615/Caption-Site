import axios, { type AxiosError } from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../config/constants';
import { useToastStore } from '../stores/toastStore';
import { toAppError } from './errors';
import { safeStorage } from '../utils/storage';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Suppress the global error toast (the caller shows its own UI, e.g. autosave status). */
    silent?: boolean;
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const token = safeStorage.get(STORAGE_KEYS.AUTH_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let redirectingToLogin = false;

/**
 * Global error policy:
 * - 401 → clear the session and go to /login (once).
 * - 422 → left to forms (inline field errors).
 * - Everything else → one friendly toast, unless the request opted out with `silent`.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (axios.isCancel(error)) return Promise.reject(error);

    const appError = toAppError(error);
    const { addToast } = useToastStore.getState();

    if (appError.status === 401) {
      safeStorage.remove(STORAGE_KEYS.AUTH_TOKEN);
      safeStorage.remove(STORAGE_KEYS.USER_DATA);
      const path = window.location.pathname;
      const onAuthPage = path.startsWith('/login') || path.startsWith('/register') || path === '/';
      if (!onAuthPage && !redirectingToLogin) {
        redirectingToLogin = true;
        addToast({ type: 'error', title: 'Session expired', message: appError.message });
        window.location.assign(`/login?next=${encodeURIComponent(path)}`);
      }
      return Promise.reject(error);
    }

    if (error.config?.silent || appError.status === 422) {
      return Promise.reject(error);
    }

    const titles: Record<string, string> = {
      usage_limit_exceeded: 'Plan limit reached',
      rate_limited: 'Slow down',
      network: 'Connection problem',
      timeout: 'Connection problem',
      forbidden: 'Access denied',
      not_found: 'Not found',
    };
    addToast({
      type: appError.status === 402 || appError.status === 429 ? 'warning' : 'error',
      title: titles[appError.code] ?? (appError.status && appError.status >= 500 ? 'Server error' : 'Request failed'),
      message: appError.requestId && appError.status && appError.status >= 500
        ? `${appError.message} (Ref: ${appError.requestId.slice(0, 8)})`
        : appError.message,
    });

    return Promise.reject(error);
  }
);
