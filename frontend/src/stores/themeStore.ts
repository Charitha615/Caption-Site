import { create } from 'zustand';
import { STORAGE_KEYS } from '../config/constants';
import { safeStorage } from '../utils/storage';

export type ThemeMode = 'dark' | 'light';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

export const getInitialTheme = (): ThemeMode => {
  const saved = safeStorage.get(STORAGE_KEYS.THEME);
  return saved === 'light' || saved === 'dark' ? saved : 'dark';
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    safeStorage.set(STORAGE_KEYS.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}));
