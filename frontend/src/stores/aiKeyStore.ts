import { create } from 'zustand';
import { accountService } from '../services/accountService';
import type { AiKeyStatus } from '../types/auth';

interface AiKeyState {
  aiKey: AiKeyStatus | null;
  load: (force?: boolean) => Promise<AiKeyStatus>;
  set: (aiKey: AiKeyStatus) => void;
}

/** The user's own Google AI key status (never the key itself). */
export const useAiKeyStore = create<AiKeyState>((set, get) => ({
  aiKey: null,
  load: async (force = false) => {
    const current = get().aiKey;
    if (current && !force) return current;
    const aiKey = await accountService.getAiKey();
    set({ aiKey });
    return aiKey;
  },
  set: (aiKey) => set({ aiKey }),
}));

/** True when uploads/generation should be blocked for lack of a usable key. */
export function useAiKeyMissing(): boolean {
  const aiKey = useAiKeyStore((s) => s.aiKey);
  return !!aiKey && !aiKey.can_caption;
}
