import { apiClient } from './api';
import type { ApiResponse } from '../types/api';
import type {
  CreateProjectPayload,
  DashboardData,
  Project,
  ProjectStatusResponse,
  ProjectsListResponse,
  UpdateProjectPayload,
} from '../types/project';

export const projectService = {
  async getDashboard(): Promise<DashboardData> {
    const res = await apiClient.get<ApiResponse<DashboardData>>('/dashboard');
    return res.data.data;
  },

  async getProjects(params?: {
    status?: string;
    search?: string;
    page?: number;
    per_page?: number;
  }): Promise<ProjectsListResponse> {
    const res = await apiClient.get<ApiResponse<ProjectsListResponse>>('/projects', { params });
    return res.data.data;
  },

  async getProject(uuid: string): Promise<Project> {
    const res = await apiClient.get<ApiResponse<{ project: Project }>>(`/projects/${uuid}`);
    return res.data.data.project;
  },

  async createProject(payload: CreateProjectPayload): Promise<Project> {
    const res = await apiClient.post<ApiResponse<{ project: Project }>>('/projects', payload);
    return res.data.data.project;
  },

  async updateProject(uuid: string, payload: UpdateProjectPayload): Promise<Project> {
    const res = await apiClient.patch<ApiResponse<{ project: Project }>>(`/projects/${uuid}`, payload);
    return res.data.data.project;
  },

  async deleteProject(uuid: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(`/projects/${uuid}`);
  },

  async uploadVideo(
    uuid: string,
    file: File,
    language?: string,
    onProgress?: (percent: number) => void
  ): Promise<{ project: Project; media_file: any }> {
    const formData = new FormData();
    formData.append('video', file);
    if (language) {
      formData.append('language', language);
    }

    const res = await apiClient.post<ApiResponse<{ project: Project; media_file: any }>>(
      `/projects/${uuid}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress?.(percent);
          }
        },
      }
    );
    return res.data.data;
  },

  async getProjectStatus(uuid: string): Promise<ProjectStatusResponse> {
    const res = await apiClient.get<ApiResponse<ProjectStatusResponse>>(`/projects/${uuid}/status`);
    return res.data.data;
  },
};
