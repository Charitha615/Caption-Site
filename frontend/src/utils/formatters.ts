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
