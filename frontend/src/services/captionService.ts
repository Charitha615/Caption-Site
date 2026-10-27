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

export const captionService = {
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
    }>
  ): Promise<{ captions: Caption[]; count: number }> {
    const res = await apiClient.put<ApiResponse<{ captions: Caption[]; count: number }>>(
      `/projects/${projectUuid}/captions/sync`,
      { captions }
    );
    return res.data.data;
  },
};
