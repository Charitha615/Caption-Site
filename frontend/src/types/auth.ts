export interface User {
  id: number;
  uuid: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  role: string;
  plan?: string;
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
