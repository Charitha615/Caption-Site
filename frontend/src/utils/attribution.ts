import { STORAGE_KEYS } from '../config/constants';
import { safeStorage } from './storage';

/**
 * Sign-up attribution: where a visitor first came from, sent with registration so the admin
 * "Sign-ups" page can show which posts and platforms bring users.
 *
 * Reads `utm_source` / `utm_medium` / `utm_campaign` from the landing URL, or `?ref=name` for a
 * creator's link (source = name, medium = "creator"). Without either, an outside referring site
 * is kept. First touch wins for 90 days, so later visits don't overwrite where someone came from.
 */
export interface SignupAttribution {
  source?: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
}

interface StoredAttribution extends SignupAttribution {
  at: number;
}

const KEEP_FOR_MS = 90 * 24 * 60 * 60 * 1000;

const clip = (value: string | null, max = 100): string | undefined => {
  const v = value?.trim();
  return v ? v.slice(0, max) : undefined;
};

function read(): StoredAttribution | null {
  try {
    const stored = JSON.parse(safeStorage.get(STORAGE_KEYS.SIGNUP_ATTRIBUTION) ?? 'null') as StoredAttribution | null;
    return stored && typeof stored.at === 'number' && Date.now() - stored.at < KEEP_FOR_MS ? stored : null;
  } catch {
    return null;
  }
}

/** Call once on page load. */
export function captureAttribution(href = window.location.href, referrer = document.referrer): void {
  if (read()) return;

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return;
  }
  const params = url.searchParams;
  const ref = clip(params.get('ref'));

  let externalReferrer: string | undefined;
  try {
    const host = referrer ? new URL(referrer).hostname : '';
    if (host && host !== url.hostname) externalReferrer = host;
  } catch {
    /* not a URL */
  }

  const found: SignupAttribution = {
    source: clip(params.get('utm_source')) ?? ref,
    medium: clip(params.get('utm_medium')) ?? (ref ? 'creator' : undefined),
    campaign: clip(params.get('utm_campaign')),
    referrer: externalReferrer,
  };
  if (!found.source && !found.referrer) return;

  safeStorage.set(STORAGE_KEYS.SIGNUP_ATTRIBUTION, JSON.stringify({ ...found, at: Date.now() }));
}

/** What to send with registration, or undefined when the visitor came in directly. */
export function getAttribution(): SignupAttribution | undefined {
  const stored = read();
  if (!stored) return undefined;
  const { source, medium, campaign, referrer } = stored;
  return { source, medium, campaign, referrer };
}
