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

  async updateProject(uuid: string, payload: UpdateProjectPayload, options: { silent?: boolean } = {}): Promise<Project> {
    const res = await apiClient.patch<ApiResponse<{ project: Project }>>(`/projects/${uuid}`, payload, { silent: options.silent });
    return res.data.data.project;
  },

  async deleteProject(uuid: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(`/projects/${uuid}`);
  },

  /** Polled while processing; failures are retried by the caller, so no global toast. */
  async getProjectStatus(uuid: string): Promise<ProjectStatusResponse> {
    const res = await apiClient.get<ApiResponse<ProjectStatusResponse>>(`/projects/${uuid}/status`, { silent: true });
    return res.data.data;
  },
};
