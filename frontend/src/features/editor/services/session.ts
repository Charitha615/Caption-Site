import axios from 'axios';
import { captionService } from '../../../services/captionService';
import { projectService } from '../../../services/projectService';
import { EMPTY_DOCUMENT, useCaptionStore } from '../../../stores/editor/captionStore';
import { useEditorProjectStore } from '../../../stores/editor/editorProjectStore';
import { useEditorStore } from '../../../stores/editor/editorStore';
import { useTimelineStore } from '../../../stores/editor/timelineStore';
import { useVideoStore } from '../../../stores/editor/videoStore';
import { createId } from '../model/captionOps';
import type { CaptionSegment } from '../model/types';
import { detectLanguage } from '../utils/unicode';
import { flush, startAutosave, stopAutosave } from './autosave';
import { playback } from './playback';
import { deserializeCaptions, deserializeEditorSettings } from './serialization';

/** Editor session lifecycle: open a project into the stores, and tear it down cleanly. */

let loadToken = 0;

function fallbackDuration(captions: CaptionSegment[], projectDuration?: number | null) {
  const lastEnd = captions.reduce((m, c) => Math.max(m, c.end), 0);
  return Math.max(projectDuration ?? 0, lastEnd + 2, 10);
}

function fitZoom(duration: number) {
  // Show roughly the first 20 s (or the whole clip if shorter) on a typical timeline width.
  const visible = Math.min(duration, 20);
  useTimelineStore.getState().setZoom(Math.round(1100 / Math.max(5, visible)));
}

function resetStores() {
  stopAutosave();
  playback.setSource(null, null);
  useVideoStore.getState().reset();
  useEditorStore.getState().reset();
  useCaptionStore.getState().load(EMPTY_DOCUMENT);
}

export async function openProject(uuid: string): Promise<void> {
  const token = ++loadToken;
  resetStores();
  useEditorProjectStore.getState().setLoading(uuid);

  try {
    const [project, captionRes] = await Promise.all([
      projectService.getProject(uuid),
      captionService.getCaptions(uuid),
    ]);
    if (token !== loadToken) return;

    const settings = (project.settings ?? {}) as Record<string, unknown>;
    const captions = deserializeCaptions(captionRes.captions ?? []);
    useCaptionStore.getState().load({ ...deserializeEditorSettings(settings), captions });

    const duration = fallbackDuration(captions, project.duration);
    useVideoStore.getState()._set({ duration });
    playback.setSource(project.video_url ?? null, project.name, false);
    fitZoom(duration);

    useEditorProjectStore.getState().setLoaded({
      uuid,
      name: project.name,
      duration: project.duration ?? null,
      settings,
      isDemo: false,
      sourceWidth: project.width ?? null,
      sourceHeight: project.height ?? null,
      hasServerVideo: !!project.video_url,
    });
    useEditorStore.getState().select(captions[0]?.id ?? null);
    startAutosave();
  } catch (err) {
    if (token !== loadToken) return;
    let message = 'We could not load this project.';
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 404) message = 'This project does not exist or was deleted.';
      else if (status === 403) message = 'You do not have access to this project.';
      else if (!err.response) message = 'Cannot reach the server. Check that the API is running and try again.';
    }
    useEditorProjectStore.getState().setLoadError(message);
  }
}

const DEMO_LINES: Array<[number, number, string]> = [
  [0.5, 3.2, 'ආයුබෝවන්, අපගේ වීඩියෝවට සාදරයෙන් පිළිගනිමු.'],
  [3.45, 6.8, 'මෙම වීඩියෝවෙන් අපි AI තාක්ෂණය මඟින් සිංහල උපසිරැසි නිර්මාණය කරමු.'],
  [7.0, 10.5, 'නියම වේලාවට ගැළපෙන අලංකාර animation සහිත caption පේළි මෙහිදී ලැබෙනවා.'],
  [10.8, 14.2, 'Edit, style and export your captions in one place.'],
];

/** Local-only sandbox used when the backend is unreachable. Nothing is persisted. */
export function openDemo(): void {
  loadToken++;
  resetStores();
  const captions: CaptionSegment[] = DEMO_LINES.map(([start, end, text]) => ({
    id: createId(),
    start,
    end,
    text,
    language: detectLanguage(text),
  }));
  useCaptionStore.getState().load({ ...EMPTY_DOCUMENT, captions });
  useVideoStore.getState()._set({ duration: 16 });
  fitZoom(16);
  useEditorProjectStore.getState().setLoaded({ uuid: null, name: 'Demo project', duration: 16, settings: {}, isDemo: true, sourceWidth: null, sourceHeight: null, hasServerVideo: false });
  useEditorStore.getState().select(captions[0].id);
}

export async function closeProject(): Promise<void> {
  const token = ++loadToken;
  playback.pause();
  await flush().catch(() => undefined);
  // A new session may have opened while we were flushing (route change, StrictMode remount) — leave it alone.
  if (token === loadToken) stopAutosave();
}

export async function renameProject(name: string): Promise<boolean> {
  const store = useEditorProjectStore.getState();
  const trimmed = name.trim();
  if (!trimmed || trimmed === store.projectName) return false;
  const previous = store.projectName;
  store.setProjectName(trimmed);
  if (store.isDemo || !store.projectUuid) return true;
  try {
    await projectService.updateProject(store.projectUuid, { name: trimmed });
    return true;
  } catch {
    useEditorProjectStore.getState().setProjectName(previous);
    return false;
  }
}
