export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'samplecap_auth_token',
  USER_DATA: 'samplecap_user_data',
  THEME: 'samplecap_theme',
} as const;

export const DEFAULT_PAGINATION = {
  PAGE_SIZE: 12,
};

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'gray' },
  uploading: { label: 'Uploading', color: 'blue' },
  processing: { label: 'Processing', color: 'purple' },
  completed: { label: 'Completed', color: 'green' },
  failed: { label: 'Failed', color: 'red' },
};
