export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

/** localStorage keys. Internal identifiers — not user-visible branding. */
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'samplecap_auth_token',
  USER_DATA: 'samplecap_user_data',
  THEME: 'samplecap_theme',
  UPLOAD_SESSIONS: 'samplecap_upload_sessions',
} as const;

export const DEFAULT_PAGINATION = {
  PAGE_SIZE: 12,
};

export const VIDEO_UPLOAD = {
  EXTENSIONS: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'],
  ACCEPT: 'video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo,.mp4,.mov,.webm,.mkv,.avi,.m4v',
  /** Fallback when the plan limit is not loaded yet; the server enforces the real one. */
  DEFAULT_MAX_MB: 500,
  PARALLEL_CHUNKS: 3,
} as const;

/** Project statuses during which the AI pipeline is running. */
export const PROCESSING_STATUSES = ['uploaded', 'processing', 'extracting_audio', 'transcribing', 'generating_captions'] as const;
