export type ProjectStatus =
  | 'draft'
  | 'uploaded'
  | 'processing'
  | 'extracting_audio'
  | 'transcribing'
  | 'generating_captions'
  | 'ready'
  | 'rendering'
  | 'completed'
  | 'failed';

export interface CaptionWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface Caption {
  id: number;
  uuid: string;
  project_id: number;
  transcript_id?: number | null;
  sequence: number;
  start_time: number;
  end_time: number;
  text: string;
  language?: string;
  style_id?: number | null;
  style_override?: Record<string, unknown> | null;
  metadata?: {
    words?: CaptionWord[];
    [key: string]: unknown;
  } | null;
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: number;
  uuid: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  /** User-safe reason when status is 'failed'. */
  processing_error?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  language: string;
  thumbnail?: string | null;
  video_url?: string | null;
  settings?: Record<string, unknown> | null;
  captions_count?: number;
  media_files_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectStatusResponse {
  uuid: string;
  status: ProjectStatus;
  progress_percentage: number;
  phase: string;
  phase_label: string;
  is_processing: boolean;
  is_ready: boolean;
  is_failed: boolean;
  error?: string | null;
  /** While status is 'uploaded': seconds spent waiting for a queue worker. */
  queued_seconds?: number | null;
  /** While processing: seconds the current phase has been running. */
  phase_seconds?: number | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  thumbnail?: string | null;
  language?: string;
  captions_count: number;
  updated_at?: string;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  language?: string;
  duration?: number;
  settings?: Record<string, unknown>;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  language?: string;
  settings?: Record<string, unknown>;
}

export interface DashboardMetrics {
  total_projects: number;
  processing_projects: number;
  completed_projects: number;
  draft_projects: number;
  failed_projects: number;
  caption_minutes_used: number;
  caption_minutes_limit: number | null;
  rendered_videos_count: number;
}

export interface UsageMeter {
  used: number;
  /** null = unlimited */
  limit: number | null;
}

export interface UsageSummary {
  plan: { key: string; label: string };
  period: { start: string; end: string };
  caption_minutes: UsageMeter;
  ai_requests_today: UsageMeter;
  exports: UsageMeter;
  renders: UsageMeter;
  storage_mb: UsageMeter;
  max_upload_mb: number | null;
  max_video_minutes: number | null;
}

export interface DashboardData {
  summary: DashboardMetrics;
  usage: UsageSummary;
  recent_projects: Project[];
}

export interface UploadedMedia {
  uuid: string;
  original_name: string;
  file_size: number;
}

export interface ProjectsListResponse {
  projects: Project[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  counts: ProjectCounts;
}

export interface ProjectCounts {
  all: number;
  processing: number;
  ready: number;
  completed: number;
  draft: number;
  failed: number;
}
