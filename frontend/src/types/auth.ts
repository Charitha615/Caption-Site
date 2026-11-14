export interface User {
  id: number;
  uuid: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  role: string;
  plan?: string;
  ai_key?: Pick<AiKeyStatus, 'configured' | 'hint' | 'status' | 'checked_at'>;
  created_at: string;
  updated_at: string;
}

export interface AuthResponseData {
  user: User;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  device_name?: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export interface UserSettings {
  default_language: 'si' | 'en' | 'auto';
  default_export_resolution: 'source' | '720' | '1080' | '2160';
  default_export_quality: 'high' | 'standard' | 'small';
}

export interface AiKeyStatus {
  configured: boolean;
  /** Last 4 characters of the saved key. */
  hint: string | null;
  status: 'valid' | 'unverified' | 'invalid' | null;
  checked_at: string | null;
  /** Users must add their own key (no server fallback). */
  required: boolean;
  /** Whether AI captioning can run for this user right now. */
  can_caption: boolean;
  help_url: string;
}

export interface AiKeyVerification {
  result: 'valid' | 'invalid' | 'unreachable';
  message: string;
}
