export interface User {
  id: number;
  uuid: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  role: string;
  plan?: string;
  /** When a paid plan ends (null on Free). */
  plan_expires_at?: string | null;
  /** International digits, e.g. 94771234567. */
  whatsapp_number?: string | null;
  /** Agreed to updates on WhatsApp. */
  whatsapp_opt_in?: boolean;
  /** Wants update emails from the team (on by default). */
  email_updates?: boolean;
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
  /** Optional; only used for WhatsApp messages when `whatsapp_opt_in` is true. */
  whatsapp_number?: string;
  whatsapp_opt_in?: boolean;
}

export interface UserSettings {
  default_language: 'si' | 'en' | 'auto';
  default_export_resolution: 'source' | '720' | '1080' | '1440' | '2160';
  default_export_quality: 'high' | 'standard' | 'small';
  /** Set for new accounts: show the app tour on the next visit. */
  tour_pending?: boolean;
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

/** A device the user is signed in on (GET /me/sessions). */
export interface SignedInDevice {
  id: number;
  browser: string;
  os: string;
  device: 'desktop' | 'mobile' | 'tablet';
  /** False for sign-ins saved before devices were recorded. */
  known: boolean;
  ip_address: string | null;
  sign_in_method: 'password' | 'google' | 'register' | null;
  signed_in_at: string;
  last_active_at: string;
  /** The device this page is open on. */
  current: boolean;
}

/** What the current plan includes (GET /usage → features). */
export interface PlanFeatures {
  /** Tallest MP4 export (short side, px): 720 on Free, 2160 on Pro. */
  max_export_height: number;
  watermark: boolean;
  /** Word-by-word highlight caption styles (Spotlight, Hormozi, Word Box, TikTok). */
  premium_styles: boolean;
  /** AI tools in the video editor (voice-over, translation, script writer, titles, highlights). */
  editor_ai: boolean;
  priority_support: boolean;
}

export type BillingPeriod = 'monthly' | 'yearly';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface Payment {
  uuid: string;
  plan: string;
  period: BillingPeriod;
  amount: number;
  currency: string;
  reference: string;
  status: PaymentStatus;
  has_slip: boolean;
  note: string | null;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  period_start: string | null;
  period_end: string | null;
  /** Admin list only. */
  user?: { uuid: string; name: string; email: string; plan: string; plan_expires_at: string | null };
}

export interface BillingInfo {
  plan: { key: string; label: string; expires_at: string | null };
  billing: {
    currency: string;
    plan: string;
    prices: Record<BillingPeriod, number>;
    bank: { bank_name: string; account_name: string; account_number: string; branch: string };
    /** False until the bank account is filled in on the server. */
    bank_ready: boolean;
    whatsapp: string;
    whatsapp_link: string;
    /** The user's code for the transfer remarks, e.g. SS-7KQ2PX. */
    reference: string;
  };
  payments: Payment[];
}
