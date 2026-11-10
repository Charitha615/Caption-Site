import { create } from 'zustand';

export type EditorTool = 'media' | 'captions' | 'styles' | 'templates' | 'settings';
/** Whether style edits in the property panel target the selected caption or the whole project. */
export type StyleScope = 'caption' | 'all';

/** Editing context: what's selected and how edits are applied. */
interface EditorState {
  activeTool: EditorTool;
  selectedCaptionId: string | null;
  styleScope: StyleScope;
  /** Seconds moved per ←/→ press (Shift multiplies by 10). */
  nudgeStep: number;

  setActiveTool: (tool: EditorTool) => void;
  select: (id: string | null) => void;
  setStyleScope: (scope: StyleScope) => void;
  setNudgeStep: (step: number) => void;
  reset: () => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  activeTool: 'captions',
  selectedCaptionId: null,
  styleScope: 'all',
  nudgeStep: 0.1,

  setActiveTool: (activeTool) => set({ activeTool }),
  select: (selectedCaptionId) => set({ selectedCaptionId }),
  setStyleScope: (styleScope) => set({ styleScope }),
  setNudgeStep: (nudgeStep) => set({ nudgeStep }),
  reset: () => set({ selectedCaptionId: null, activeTool: 'captions', styleScope: 'all' }),
}));
