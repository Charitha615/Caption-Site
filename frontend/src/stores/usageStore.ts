import { create } from 'zustand';
import { accountService } from '../services/accountService';
import type { UsageSummary } from '../types/project';

interface UsageState {
  usage: UsageSummary | null;
  loadedAt: number;
  load: (force?: boolean) => Promise<void>;
  set: (usage: UsageSummary) => void;
}

const STALE_MS = 60_000;

/** Plan limits + consumption (GET /usage). Cached for a minute; refreshed after costly actions. */
export const useUsageStore = create<UsageState>((set, get) => ({
  usage: null,
  loadedAt: 0,
  load: async (force = false) => {
    if (!force && get().usage && Date.now() - get().loadedAt < STALE_MS) return;
    const usage = await accountService.getUsage();
    set({ usage, loadedAt: Date.now() });
  },
  set: (usage) => set({ usage, loadedAt: Date.now() }),
}));

/** 0–100, or null for unlimited meters. */
export function meterPercent(used: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}
