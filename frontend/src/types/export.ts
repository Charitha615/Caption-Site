export type ExportType = 'srt' | 'vtt' | 'txt' | 'json' | 'mp4';
export type ExportStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type ExportResolution = 'source' | '720' | '1080' | '1440' | '2160';
export type ExportQuality = 'high' | 'standard' | 'small';

export interface ExportItem {
  uuid: string;
  type: ExportType;
  status: ExportStatus;
  progress: number;
  file_size: number | null;
  error_message: string | null;
  options: {
    resolution?: ExportResolution;
    quality?: ExportQuality;
    width?: number;
    height?: number;
    aspect?: string;
    template?: string;
  };
  /** Short-lived signed URL; null until completed. */
  download_url: string | null;
  download_name: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreateExportPayload {
  type: ExportType;
  resolution?: ExportResolution;
  quality?: ExportQuality;
  template?: string | null;
}

export interface CaptionTemplate {
  uuid: string;
  slug: string | null;
  name: string;
  description: string | null;
  category: string;
  is_system: boolean;
  is_owner: boolean;
  style: Record<string, unknown>;
  preview_text: string | null;
  created_at: string | null;
}
