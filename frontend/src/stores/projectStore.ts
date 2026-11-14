import { create } from 'zustand';
import { projectService } from '../services/projectService';
import type {
  CreateProjectPayload,
  DashboardData,
  Project,
  ProjectCounts,
  ProjectStatusResponse,
  UpdateProjectPayload,
} from '../types/project';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  dashboardData: DashboardData | null;
  counts: ProjectCounts;
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
  setProject: (project: Project) => void;
  checkStatus: (uuid: string) => Promise<ProjectStatusResponse>;
}

const EMPTY_COUNTS: ProjectCounts = { all: 0, processing: 0, ready: 0, completed: 0, draft: 0, failed: 0 };

// Responses that arrive after a newer request started are discarded.
let listRequest = 0;

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  dashboardData: null,
  counts: EMPTY_COUNTS,
  pagination: null,
  selectedStatus: 'all',
  searchQuery: '',
  isLoading: false,
  isCreating: false,

  setStatusFilter: (status) => {
    set({ selectedStatus: status });
    void get().loadProjects(1).catch(() => undefined);
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  loadDashboard: async () => {
    set({ isLoading: true });
    try {
      const data = await projectService.getDashboard();
      set({ dashboardData: data });
    } finally {
      set({ isLoading: false });
    }
  },

  loadProjects: async (page = 1) => {
    const request = ++listRequest;
    set({ isLoading: true });
    try {
      const res = await projectService.getProjects({
        status: get().selectedStatus !== 'all' ? get().selectedStatus : undefined,
        search: get().searchQuery || undefined,
        page,
      });
      if (request !== listRequest) return;
      set({ projects: res.projects, counts: res.counts, pagination: res.pagination });
    } finally {
      if (request === listRequest) set({ isLoading: false });
    }
  },

  loadProject: async (uuid) => {
    set({ isLoading: true });
    try {
      const project = await projectService.getProject(uuid);
      set({ currentProject: project });
      return project;
    } finally {
      set({ isLoading: false });
    }
  },

  createProject: async (payload) => {
    set({ isCreating: true });
    try {
      const project = await projectService.createProject(payload);
      set((state) => ({ projects: [project, ...state.projects] }));
      return project;
    } finally {
      set({ isCreating: false });
    }
  },

  updateProject: async (uuid, payload) => {
    const updated = await projectService.updateProject(uuid, payload);
    get().setProject(updated);
    return updated;
  },

  deleteProject: async (uuid) => {
    await projectService.deleteProject(uuid);
    set((state) => ({
      projects: state.projects.filter((p) => p.uuid !== uuid),
      currentProject: state.currentProject?.uuid === uuid ? null : state.currentProject,
      dashboardData: state.dashboardData
        ? { ...state.dashboardData, recent_projects: state.dashboardData.recent_projects.filter((p) => p.uuid !== uuid) }
        : null,
    }));
    void get().loadDashboard().catch(() => undefined);
  },

  setProject: (project) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.uuid === project.uuid ? project : p)),
      currentProject: state.currentProject?.uuid === project.uuid ? project : state.currentProject,
    })),

  checkStatus: async (uuid) => {
    const status = await projectService.getProjectStatus(uuid);
    set((state) => ({
      currentProject:
        state.currentProject?.uuid === uuid
          ? {
              ...state.currentProject,
              status: status.status,
              processing_error: status.error ?? null,
              duration: status.duration ?? state.currentProject.duration,
              thumbnail: status.thumbnail ?? state.currentProject.thumbnail,
              captions_count: status.captions_count,
            }
          : state.currentProject,
    }));
    return status;
  },
}));
