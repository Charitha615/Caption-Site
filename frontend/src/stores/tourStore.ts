import { create } from 'zustand';

interface TourState {
  open: boolean;
  start: () => void;
  close: () => void;
}

/** The app tour (shown to new accounts, and from "Take the tour" in the account menu). */
export const useTourStore = create<TourState>((set) => ({
  open: false,
  start: () => set({ open: true }),
  close: () => set({ open: false }),
}));
