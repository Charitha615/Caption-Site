import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('samplecap_theme') as ThemeMode | null;
  if (saved === 'dark' || saved === 'light') {
    return saved;
  }
  // Default to sleek dark mode
  return 'dark';
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  setTheme: (theme: ThemeMode) => {
    localStorage.setItem('samplecap_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  toggleTheme: () => {
    const nextTheme: ThemeMode = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(nextTheme);
  },
}));
