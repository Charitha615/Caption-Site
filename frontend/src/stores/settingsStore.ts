import { create } from 'zustand';
import { accountService } from '../services/accountService';
import type { UserSettings } from '../types/auth';

interface SettingsState {
  settings: UserSettings | null;
  load: () => Promise<void>;
  save: (patch: Partial<UserSettings>) => Promise<void>;
}

/** The signed-in user's preferences (defaults for new projects and exports). */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  load: async () => {
    if (get().settings) return;
    set({ settings: await accountService.getSettings() });
  },
  save: async (patch) => {
    set({ settings: await accountService.updateSettings(patch) });
  },
}));
