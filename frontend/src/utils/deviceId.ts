import { STORAGE_KEYS } from '../config/constants';
import { safeStorage } from './storage';

/**
 * A random id this browser keeps (it survives signing out), sent when signing in so the server can
 * replace this browser's previous session instead of listing it twice under "Signed-in devices".
 * It says nothing about the person or the device; clearing site data makes a new one.
 */
export function deviceId(): string {
  const stored = safeStorage.get(STORAGE_KEYS.DEVICE_ID);
  if (stored && /^[A-Za-z0-9_-]{16,64}$/.test(stored)) return stored;
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  safeStorage.set(STORAGE_KEYS.DEVICE_ID, id);
  return id;
}
