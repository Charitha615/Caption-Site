import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    // Collapse identical messages (e.g. several failed requests at once) into one toast.
    const duplicate = get().toasts.find((t) => t.message === toast.message && t.type === toast.type);
    if (duplicate) return duplicate.id;
    const newToast: ToastItem = {
      ...toast,
      id,
      duration: toast.duration ?? (toast.type === 'error' ? 7000 : 4500),
    };

    set((state) => ({ toasts: [...state.toasts, newToast].slice(-4) }));

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, newToast.duration);
    }

    return id;
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clearAll: () => set({ toasts: [] }),
}));
