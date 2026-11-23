/**
 * localStorage / sessionStorage that never throw (private mode, blocked storage, quota).
 *
 * `get` reads either store, so a value saved "for this browser session only" (e.g. the auth
 * token when "Keep me logged in" is off) is found the same way as a remembered one.
 */
function store(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export const safeStorage = {
  get(key: string): string | null {
    try {
      return store('local')?.getItem(key) ?? store('session')?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  /** `session: true` keeps the value only until the browser is closed. */
  set(key: string, value: string, options: { session?: boolean } = {}): void {
    try {
      const keep = options.session ? 'session' : 'local';
      store(keep)?.setItem(key, value);
      store(keep === 'local' ? 'session' : 'local')?.removeItem(key);
    } catch {
      /* storage unavailable — keep working in memory */
    }
  },
  remove(key: string): void {
    for (const kind of ['local', 'session'] as const) {
      try {
        store(kind)?.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  },
};
