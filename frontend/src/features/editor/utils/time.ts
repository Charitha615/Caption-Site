/** 75.25 -> "01:15.25" (adds hours when needed). */
export function formatTimecode(seconds: number, fractionDigits = 2): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const factor = 10 ** fractionDigits;
  const total = Math.round(seconds * factor) / factor;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const sec = fractionDigits > 0
    ? s.toFixed(fractionDigits).padStart(fractionDigits + 3, '0')
    : String(Math.floor(s)).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${sec}` : `${mm}:${sec}`;
}

/** Short label for the timeline ruler: "0s", "1:05", "12.5s". */
export function formatRulerLabel(seconds: number, interval: number): string {
  if (seconds < 60) {
    return interval < 1 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const sec = interval < 1 ? s.toFixed(1).padStart(4, '0') : String(Math.round(s)).padStart(2, '0');
  return `${m}:${sec}`;
}

/**
 * Accepts "75.5", "1:15.5", "01:15,500", "0:01:15.5". Returns null when invalid.
 */
export function parseTimecode(input: string): number | null {
  const value = input.trim().replace(',', '.');
  if (!value) return null;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  const parts = value.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p, i) => (i === parts.length - 1 ? /^\d+(\.\d+)?$/ : /^\d+$/).test(p))) return null;
  const nums = parts.map(Number);
  const [h, m, s] = nums.length === 3 ? nums : [0, nums[0], nums[1]];
  if (s >= 60 && nums.length > 1) return null;
  return h * 3600 + m * 60 + s;
}

export const roundTime = (t: number) => Math.round(t * 1000) / 1000;
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
