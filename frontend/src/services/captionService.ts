import { apiClient } from './api';
import type { ApiResponse } from '../types/api';
import type { Caption, Project } from '../types/project';

export interface CaptionCreatePayload {
  start_time: number;
  end_time: number;
  text: string;
  language?: string;
  sequence?: number;
  style_id?: number | null;
  style_override?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface CaptionUpdatePayload {
  start_time?: number;
  end_time?: number;
  text?: string;
  language?: string;
  sequence?: number;
  style_id?: number | null;
  style_override?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface AlignedCaption {
  start_time: number;
  end_time: number;
  text: string;
  language: string;
  words: Array<{ word: string; start: number; end: number }>;
}

export interface AlignResult {
  captions: AlignedCaption[];
  stats: { script_words: number; matched: number; placed: number };
  english_applied: boolean;
}

export const captionService = {
  /** Line up a pasted script with the video's speech timings (preview only — nothing is saved). */
  async alignScript(projectUuid: string, text: string, englishWords: boolean): Promise<AlignResult> {
    const res = await apiClient.post<ApiResponse<AlignResult>>(
      `/projects/${projectUuid}/captions/align`,
      { text, english_words: englishWords },
      { silent: true, timeout: 120_000 }
    );
    return res.data.data;
  },

  async getCaptions(projectUuid: string): Promise<{ captions: Caption[]; count: number }> {
    const res = await apiClient.get<ApiResponse<{ captions: Caption[]; count: number }>>(
      `/projects/${projectUuid}/captions`
    );
    return res.data.data;
  },

  async createCaption(projectUuid: string, payload: CaptionCreatePayload): Promise<Caption> {
    const res = await apiClient.post<ApiResponse<{ caption: Caption }>>(
      `/projects/${projectUuid}/captions`,
      payload
    );
    return res.data.data.caption;
  },

  async updateCaption(
    projectUuid: string,
    captionUuid: string,
    payload: CaptionUpdatePayload
  ): Promise<Caption> {
    const res = await apiClient.patch<ApiResponse<{ caption: Caption }>>(
      `/projects/${projectUuid}/captions/${captionUuid}`,
      payload
    );
    return res.data.data.caption;
  },

  async deleteCaption(projectUuid: string, captionUuid: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(`/projects/${projectUuid}/captions/${captionUuid}`);
  },

  async generateCaptions(
    projectUuid: string,
    language?: string
  ): Promise<{ project: Project; status: string }> {
    const res = await apiClient.post<ApiResponse<{ project: Project; status: string }>>(
      `/projects/${projectUuid}/generate-captions`,
      { language }
    );
    return res.data.data;
  },

  async syncCaptions(
    projectUuid: string,
    captions: Array<{
      uuid?: string;
      sequence?: number;
      start_time: number;
      end_time: number;
      text: string;
      language?: string;
      style_id?: number | null;
      style_override?: Record<string, unknown> | null;
      metadata?: Record<string, unknown> | null;
    }>,
    options: { silent?: boolean; confirmEmpty?: boolean } = {}
  ): Promise<{ captions: Caption[]; count: number }> {
    const res = await apiClient.put<ApiResponse<{ captions: Caption[]; count: number }>>(
      `/projects/${projectUuid}/captions/sync`,
      { captions, ...(options.confirmEmpty ? { confirm_empty: true } : {}) },
      { silent: options.silent }
    );
    return res.data.data;
  },
};
