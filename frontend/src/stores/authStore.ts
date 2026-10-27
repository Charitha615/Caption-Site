import { create } from 'zustand';
import { STORAGE_KEYS } from '../config/constants';
import { authService } from '../services/authService';
import type { LoginCredentials, RegisterCredentials, User } from '../types/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
  isAuthenticated: !!localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
  isLoading: false,
  isInitialized: false,

  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const data = await authService.login(credentials);
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.token);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (credentials) => {
    set({ isLoading: true });
    try {
      const data = await authService.register(credentials);
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.token);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      if (get().token) {
        await authService.logout();
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      set({
        user: null,
        token: null,
        isAuthenticated: false,
      });
    }
  },

  fetchMe: async () => {
    try {
      const user = await authService.getMe();
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
      set({ user, isAuthenticated: true });
    } catch {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  initializeAuth: async () => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const cachedUser = localStorage.getItem(STORAGE_KEYS.USER_DATA);

    if (token) {
      if (cachedUser) {
        try {
          set({ user: JSON.parse(cachedUser), token, isAuthenticated: true });
        } catch {
          // Ignore json parse error
        }
      }
      try {
        await get().fetchMe();
      } catch {
        // Handled in fetchMe
      }
    }

    set({ isInitialized: true });
  },
}));
