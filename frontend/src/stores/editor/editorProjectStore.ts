import { create } from 'zustand';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'failed' | 'offline';
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Project-level state: identity, load lifecycle and persistence status. */
interface EditorProjectState {
  projectUuid: string | null;
  projectName: string;
  projectDuration: number | null;
  /** The project's `settings` JSON as loaded — merged (never replaced) when we save editor settings. */
  baseSettings: Record<string, unknown>;
  loadStatus: LoadStatus;
  loadError: string | null;
  /** True when running the offline demo (no backend project) — nothing is persisted. */
  isDemo: boolean;

  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  saveError: string | null;

  setLoading: (uuid: string) => void;
  setLoaded: (p: { uuid: string | null; name: string; duration: number | null; settings: Record<string, unknown>; isDemo: boolean }) => void;
  setLoadError: (message: string) => void;
  setProjectName: (name: string) => void;
  setBaseSettings: (settings: Record<string, unknown>) => void;
  setSaveStatus: (status: SaveStatus, error?: string | null) => void;
  markSaved: () => void;
  reset: () => void;
}

const initial = {
  projectUuid: null,
  projectName: 'Untitled project',
  projectDuration: null,
  baseSettings: {},
  loadStatus: 'idle' as LoadStatus,
  loadError: null,
  isDemo: false,
  saveStatus: 'saved' as SaveStatus,
  lastSavedAt: null,
  saveError: null,
};

export const useEditorProjectStore = create<EditorProjectState>()((set) => ({
  ...initial,
  setLoading: (projectUuid) => set({ ...initial, projectUuid, loadStatus: 'loading' }),
  setLoaded: ({ uuid, name, duration, settings, isDemo }) =>
    set({
      projectUuid: uuid,
      projectName: name,
      projectDuration: duration,
      baseSettings: settings,
      isDemo,
      loadStatus: 'ready',
      loadError: null,
      saveStatus: isDemo ? 'offline' : 'saved',
    }),
  setLoadError: (loadError) => set({ loadStatus: 'error', loadError }),
  setProjectName: (projectName) => set({ projectName }),
  setBaseSettings: (baseSettings) => set({ baseSettings }),
  setSaveStatus: (saveStatus, saveError = null) => set({ saveStatus, saveError }),
  markSaved: () => set({ saveStatus: 'saved', saveError: null, lastSavedAt: Date.now() }),
  reset: () => set(initial),
}));
