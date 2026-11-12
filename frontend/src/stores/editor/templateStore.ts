import { create } from 'zustand';
import { apiErrorMessage, templateService } from '../../services/exportService';
import type { CaptionTemplate } from '../../types/export';

/** Caption templates from the API: system presets + the user's own (account-wide). */
interface TemplateState {
  templates: CaptionTemplate[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  load: (force?: boolean) => Promise<void>;
  save: (name: string, style: Record<string, unknown>) => Promise<CaptionTemplate>;
  remove: (uuid: string) => Promise<void>;
}

export const useTemplateStore = create<TemplateState>()((set, get) => ({
  templates: [],
  status: 'idle',
  error: null,

  load: async (force = false) => {
    if (!force && (get().status === 'loading' || get().status === 'ready')) return;
    set({ status: 'loading', error: null });
    try {
      set({ templates: await templateService.list(), status: 'ready' });
    } catch (err) {
      set({ status: 'error', error: apiErrorMessage(err, 'Could not load templates.') });
    }
  },

  save: async (name, style) => {
    const template = await templateService.create({ name, style });
    set((s) => ({ templates: [...s.templates.filter((t) => t.is_system), template, ...s.templates.filter((t) => !t.is_system)] }));
    return template;
  },

  remove: async (uuid) => {
    await templateService.remove(uuid);
    set((s) => ({ templates: s.templates.filter((t) => t.uuid !== uuid) }));
  },
}));
