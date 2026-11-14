import { create } from 'zustand';
import { STORAGE_KEYS } from '../config/constants';
import { authService } from '../services/authService';
import { safeStorage } from '../utils/storage';
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
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: safeStorage.get(STORAGE_KEYS.AUTH_TOKEN),
  isAuthenticated: !!safeStorage.get(STORAGE_KEYS.AUTH_TOKEN),
  isLoading: false,
  isInitialized: false,

  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const data = await authService.login(credentials);
      safeStorage.set(STORAGE_KEYS.AUTH_TOKEN, data.token);
      safeStorage.set(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
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
      safeStorage.set(STORAGE_KEYS.AUTH_TOKEN, data.token);
      safeStorage.set(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
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
      safeStorage.remove(STORAGE_KEYS.AUTH_TOKEN);
      safeStorage.remove(STORAGE_KEYS.USER_DATA);
      set({
        user: null,
        token: null,
        isAuthenticated: false,
      });
    }
  },

  setUser: (user) => {
    safeStorage.set(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    set({ user });
  },

  fetchMe: async () => {
    try {
      const user = await authService.getMe();
      safeStorage.set(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
      set({ user, isAuthenticated: true });
    } catch (err) {
      // Only an explicit 401 ends the session; a network blip keeps the cached user.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        safeStorage.remove(STORAGE_KEYS.AUTH_TOKEN);
        safeStorage.remove(STORAGE_KEYS.USER_DATA);
        set({ user: null, token: null, isAuthenticated: false });
      }
    }
  },

  initializeAuth: async () => {
    const token = safeStorage.get(STORAGE_KEYS.AUTH_TOKEN);
    const cachedUser = safeStorage.get(STORAGE_KEYS.USER_DATA);

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
