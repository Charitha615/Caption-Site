import { create } from 'zustand';
import { projectService } from '../services/projectService';
import type {
  CreateProjectPayload,
  DashboardData,
  Project,
  UpdateProjectPayload,
} from '../types/project';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  dashboardData: DashboardData | null;
  counts: {
    all: number;
    processing: number;
    completed: number;
    draft: number;
  };
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  } | null;
  selectedStatus: string;
  searchQuery: string;
  isLoading: boolean;
  isCreating: boolean;

  setStatusFilter: (status: string) => void;
  setSearchQuery: (query: string) => void;
  loadDashboard: () => Promise<void>;
  loadProjects: (page?: number) => Promise<void>;
  loadProject: (uuid: string) => Promise<Project>;
  createProject: (payload: CreateProjectPayload) => Promise<Project>;
  updateProject: (uuid: string, payload: UpdateProjectPayload) => Promise<Project>;
  deleteProject: (uuid: string) => Promise<void>;
  uploadVideo: (
    uuid: string,
    file: File,
    language?: string,
    onProgress?: (pct: number) => void
  ) => Promise<{ project: Project; media_file: any }>;
  checkStatus: (uuid: string) => Promise<import('../types/project').ProjectStatusResponse>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  dashboardData: null,
  counts: { all: 0, processing: 0, completed: 0, draft: 0 },
  pagination: null,
  selectedStatus: 'all',
  searchQuery: '',
  isLoading: false,
  isCreating: false,

  setStatusFilter: (status) => {
    set({ selectedStatus: status });
    get().loadProjects(1);
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  loadDashboard: async () => {
    set({ isLoading: true });
    try {
      const data = await projectService.getDashboard();
      set({ dashboardData: data, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  loadProjects: async (page = 1) => {
    set({ isLoading: true });
    try {
      const res = await projectService.getProjects({
        status: get().selectedStatus !== 'all' ? get().selectedStatus : undefined,
        search: get().searchQuery || undefined,
        page,
      });

      set({
        projects: res.projects,
        counts: res.counts,
        pagination: res.pagination,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  loadProject: async (uuid) => {
    set({ isLoading: true });
    try {
      const project = await projectService.getProject(uuid);
      set({ currentProject: project, isLoading: false });
      return project;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  createProject: async (payload) => {
    set({ isCreating: true });
    try {
      const project = await projectService.createProject(payload);
      set((state) => ({
        projects: [project, ...state.projects],
        isCreating: false,
      }));
      // Refresh dashboard if already loaded
      get().loadDashboard().catch(() => {});
      return project;
    } catch (err) {
      set({ isCreating: false });
      throw err;
    }
  },

  updateProject: async (uuid, payload) => {
    try {
      const updated = await projectService.updateProject(uuid, payload);
      set((state) => ({
        projects: state.projects.map((p) => (p.uuid === uuid ? updated : p)),
        currentProject: state.currentProject?.uuid === uuid ? updated : state.currentProject,
      }));
      return updated;
    } catch (err) {
      throw err;
    }
  },

  deleteProject: async (uuid) => {
    try {
      await projectService.deleteProject(uuid);
      set((state) => ({
        projects: state.projects.filter((p) => p.uuid !== uuid),
        currentProject: state.currentProject?.uuid === uuid ? null : state.currentProject,
      }));
      // Refresh metrics
      get().loadDashboard().catch(() => {});
    } catch (err) {
      throw err;
    }
  },

  uploadVideo: async (uuid, file, language, onProgress) => {
    try {
      const res = await projectService.uploadVideo(uuid, file, language, onProgress);
      set((state) => ({
        projects: state.projects.map((p) => (p.uuid === uuid ? res.project : p)),
        currentProject: state.currentProject?.uuid === uuid ? res.project : state.currentProject,
      }));
      return res;
    } catch (err) {
      throw err;
    }
  },

  checkStatus: async (uuid) => {
    try {
      const statusRes = await projectService.getProjectStatus(uuid);
      // update project status in memory if project is loaded
      if (get().currentProject?.uuid === uuid) {
        set((state) => ({
          currentProject: state.currentProject ? {
            ...state.currentProject,
            status: statusRes.status,
            duration: statusRes.duration ?? state.currentProject.duration,
            thumbnail: statusRes.thumbnail ?? state.currentProject.thumbnail,
            captions_count: statusRes.captions_count,
          } : null,
        }));
      }
      return statusRes;
    } catch (err) {
      throw err;
    }
  },
}));
