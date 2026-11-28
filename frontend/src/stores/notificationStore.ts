import { create } from 'zustand';
import { notificationService, type AppNotification } from '../services/notificationService';

interface NotificationState {
  unread: number;
  /** The latest few, for the bell's dropdown. */
  recent: AppNotification[];
  loaded: boolean;
  refreshUnread: () => Promise<void>;
  loadRecent: () => Promise<void>;
  markRead: (n: AppNotification) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/** The notification bell: unread count (checked every so often) and the latest notifications. */
export const useNotificationStore = create<NotificationState>((set, get) => ({
  unread: 0,
  recent: [],
  loaded: false,
  refreshUnread: async () => {
    const unread = await notificationService.unread();
    // Something new arrived: the dropdown list is out of date.
    if (unread !== get().unread) set({ loaded: false });
    set({ unread });
  },
  loadRecent: async () => {
    const page = await notificationService.list(1, 8);
    set({ recent: page.notifications, unread: page.unread, loaded: true });
  },
  markRead: async (n) => {
    if (n.read) return;
    set((s) => ({ recent: s.recent.map((r) => (r.id === n.id ? { ...r, read: true } : r)), unread: Math.max(0, s.unread - 1) }));
    await notificationService.markRead(n.id).catch(() => undefined);
  },
  markAllRead: async () => {
    set((s) => ({ recent: s.recent.map((r) => ({ ...r, read: true })), unread: 0 }));
    await notificationService.markAllRead();
  },
}));
