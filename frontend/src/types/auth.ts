export interface User {
  id: number;
  uuid: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  role: string;
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
