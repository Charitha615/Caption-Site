import axios, { AxiosError } from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../config/constants';
import { useToastStore } from '../stores/toastStore';
import type { ApiResponse } from '../types/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor: Attach Sanctum Bearer token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401, 403, 422, 429, 500
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse>) => {
    const { addToast } = useToastStore.getState();
    const status = error.response?.status;
    const responseData = error.response?.data;
    const message = responseData?.message || error.message || 'An unexpected error occurred.';

    if (status === 401) {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);

      // Only redirect if not already on login or register page
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
        addToast({
          type: 'error',
          title: 'Session Expired',
          message: 'Your session has expired. Please sign in again.',
        });
        window.location.href = '/login';
      }
    } else if (status === 403) {
      addToast({
        type: 'error',
        title: 'Access Denied',
        message: message || 'You do not have permission to perform this action.',
      });
    } else if (status === 422) {
      // Form validation errors will usually be caught and rendered on the form inputs
      // but if not handled, show general error
      if (responseData?.errors) {
        const firstErrorKey = Object.keys(responseData.errors)[0];
        const firstErrorMessage = responseData.errors[firstErrorKey]?.[0];
        if (firstErrorMessage) {
          addToast({
            type: 'warning',
            title: 'Validation Error',
            message: firstErrorMessage,
          });
        }
      }
    } else if (status === 429) {
      addToast({
        type: 'warning',
        title: 'Rate Limit Exceeded',
        message: 'Too many requests. Please wait a moment before trying again.',
      });
    } else if (status && status >= 500) {
      addToast({
        type: 'error',
        title: 'Server Error',
        message: message || 'Server encounter an error. Please try again later.',
      });
    } else if (!error.response) {
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Unable to reach backend server. Please verify backend is running.',
      });
    }

    return Promise.reject(error);
  }
);
