import { apiClient } from '../../../services/api';
import type { ApiResponse } from '../../../types/api';
import type { AspectRatio } from '../model';
import type { SavedProject } from '../autosave';
import { useVideoEditorStore } from '../store';

/** A video project saved to the account (its layout; media stays on the device). */
export interface OnlineProject {
  uuid: string;
  name: string;
  aspect: AspectRatio;
  duration: number;
  clip_count: number;
  thumb: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** What is sent: the layout without file contents, previews or waveforms. */
export type OnlineLayout = Pick<SavedProject, 'version' | 'tracks' | 'clips' | 'media' | 'fonts' | 'zoom' | 'snap'>;

const MAX_THUMB = 60_000;

/** The open project's layout, ready to save to the account. */
export function currentLayout(): { name: string; aspect: AspectRatio; data: OnlineLayout; thumb: string | null } {
  const s = useVideoEditorStore.getState();
  const thumb = s.media.find((m) => m.kind === 'video' && m.thumb?.startsWith('data:image/'))?.thumb ?? null;
  return {
    name: s.name.trim() || 'Untitled video',
    aspect: s.aspect,
    data: {
      version: 1,
      tracks: s.tracks,
      clips: s.clips,
      media: s.media.map(({ url: _url, thumb: _thumb, peaks: _peaks, peaksPerSecond: _pps, missing: _missing, ...rest }) => rest),
      fonts: s.fonts,
      zoom: s.zoom,
      snap: s.snap,
    },
    thumb: thumb && thumb.length <= MAX_THUMB ? thumb : null,
  };
}

/** Turns a project from the account into one the editor can open (every file still to be found). */
export function toSavedProject(project: OnlineProject & { data: OnlineLayout }): SavedProject {
  return {
    ...project.data,
    version: 1,
    savedAt: Date.now(),
    name: project.name,
    aspect: project.aspect,
    projectUuid: project.uuid,
  };
}

export const videoProjectService = {
  async list(): Promise<{ projects: OnlineProject[]; limit: number | null }> {
    const res = await apiClient.get<ApiResponse<{ projects: OnlineProject[]; limit: number | null }>>('/video-projects', { silent: true });
    return res.data.data;
  },

  async get(uuid: string): Promise<OnlineProject & { data: OnlineLayout }> {
    const res = await apiClient.get<ApiResponse<{ project: OnlineProject & { data: OnlineLayout } }>>(`/video-projects/${uuid}`, { silent: true });
    return res.data.data.project;
  },

  async create(layout: ReturnType<typeof currentLayout>): Promise<OnlineProject> {
    const res = await apiClient.post<ApiResponse<{ project: OnlineProject }>>('/video-projects', layout, { silent: true });
    return res.data.data.project;
  },

  async update(uuid: string, layout: ReturnType<typeof currentLayout>): Promise<OnlineProject> {
    const res = await apiClient.put<ApiResponse<{ project: OnlineProject }>>(`/video-projects/${uuid}`, layout, { silent: true });
    return res.data.data.project;
  },

  async remove(uuid: string): Promise<void> {
    await apiClient.delete(`/video-projects/${uuid}`);
  },
};
