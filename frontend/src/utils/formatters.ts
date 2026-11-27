export function formatDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) {
    return '00:00';
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function getLanguageLabel(code: string): { label: string; flag: string } {
  switch (code.toLowerCase()) {
    case 'si':
      return { label: 'සිංහල', flag: '🇱🇰' };
    case 'en':
      return { label: 'English', flag: '🇺🇸' };
    default:
      return { label: code.toUpperCase(), flag: '🌐' };
  }
}

/** "27 Nov 2026, 3:15 PM" in the viewer's time zone. */
export function formatDateTime(dateString: string): string {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

/** "Just now", "5 minutes ago", "3 hours ago", "2 days ago"; older than a month gives the date. */
export function formatTimeAgo(dateString: string, now: number = Date.now()): string {
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return dateString;
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'Just now';
  const steps: [number, string][] = [[60, 'minute'], [24, 'hour'], [30, 'day']];
  let value = Math.floor(seconds / 60);
  for (const [size, unit] of steps) {
    if (value < size) return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
    value = Math.floor(value / size);
  }
  return formatDate(dateString);
}
