import { create } from 'zustand';

export type MobileTab = 'captions' | 'edit' | 'style';

/** Pure presentation state: panels, dialogs, modes. Never persisted. */
interface UIState {
  isPreviewMode: boolean;
  isShortcutsOpen: boolean;
  isExportOpen: boolean;
  /** Tablet: left tool panel drawer. Desktop always shows it. */
  isToolPanelOpen: boolean;
  /** Tablet: right property drawer. Desktop always shows it. */
  isInspectorOpen: boolean;
  showSafeArea: boolean;
  mobileTab: MobileTab;

  setPreviewMode: (v: boolean) => void;
  setShortcutsOpen: (v: boolean) => void;
  setExportOpen: (v: boolean) => void;
  setToolPanelOpen: (v: boolean) => void;
  setInspectorOpen: (v: boolean) => void;
  setShowSafeArea: (v: boolean) => void;
  setMobileTab: (tab: MobileTab) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  isPreviewMode: false,
  isShortcutsOpen: false,
  isExportOpen: false,
  isToolPanelOpen: false,
  isInspectorOpen: false,
  showSafeArea: false,
  mobileTab: 'captions',

  setPreviewMode: (isPreviewMode) => set({ isPreviewMode }),
  setShortcutsOpen: (isShortcutsOpen) => set({ isShortcutsOpen }),
  setExportOpen: (isExportOpen) => set({ isExportOpen }),
  setToolPanelOpen: (isToolPanelOpen) => set({ isToolPanelOpen }),
  setInspectorOpen: (isInspectorOpen) => set({ isInspectorOpen }),
  setShowSafeArea: (showSafeArea) => set({ showSafeArea }),
  setMobileTab: (mobileTab) => set({ mobileTab }),
}));
