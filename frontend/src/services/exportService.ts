import { apiClient } from './api';
import type { ApiResponse } from '../types/api';
import type { CaptionTemplate, CreateExportPayload, ExportItem } from '../types/export';

export const exportService = {
  async list(projectUuid: string): Promise<ExportItem[]> {
    const res = await apiClient.get<ApiResponse<{ exports: ExportItem[] }>>(`/projects/${projectUuid}/exports`);
    return res.data.data.exports;
  },

  async create(projectUuid: string, payload: CreateExportPayload): Promise<ExportItem> {
    const res = await apiClient.post<ApiResponse<{ export: ExportItem }>>(`/projects/${projectUuid}/exports`, payload);
    return res.data.data.export;
  },

  async get(exportUuid: string): Promise<ExportItem> {
    const res = await apiClient.get<ApiResponse<{ export: ExportItem }>>(`/exports/${exportUuid}`);
    return res.data.data.export;
  },

  async remove(exportUuid: string): Promise<void> {
    await apiClient.delete(`/exports/${exportUuid}`);
  },

  /** Fetch a fresh signed URL (they expire) and hand it to the browser's download manager. */
  async download(exportUuid: string): Promise<void> {
    const fresh = await exportService.get(exportUuid);
    if (!fresh.download_url) throw new Error('This export is not ready to download.');
    const a = document.createElement('a');
    a.href = fresh.download_url;
    a.download = fresh.download_name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
};

export const templateService = {
  async list(): Promise<CaptionTemplate[]> {
    const res = await apiClient.get<ApiResponse<{ templates: CaptionTemplate[] }>>('/caption-templates');
    return res.data.data.templates;
  },

  async create(payload: { name: string; style: Record<string, unknown>; description?: string; preview_text?: string }): Promise<CaptionTemplate> {
    const res = await apiClient.post<ApiResponse<{ template: CaptionTemplate }>>('/caption-templates', payload);
    return res.data.data.template;
  },

  async remove(uuid: string): Promise<void> {
    await apiClient.delete(`/caption-templates/${uuid}`);
  },
};

export { apiErrorMessage } from './errors';
