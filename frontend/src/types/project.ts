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
  user_id: number;
  name: string;
  description?: string | null;
  status: ProjectStatus;
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
  status?: ProjectStatus;
  language?: string;
  settings?: Record<string, unknown>;
}

export interface DashboardMetrics {
  total_projects: number;
  processing_projects: number;
  completed_projects: number;
  draft_projects: number;
  caption_minutes_used: number;
  caption_minutes_limit: number;
  rendered_videos_count: number;
}

export interface DashboardData {
  summary: DashboardMetrics;
  recent_projects: Project[];
}

export interface ProjectsListResponse {
  projects: Project[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  counts: {
    all: number;
    processing: number;
    completed: number;
    draft: number;
  };
}
