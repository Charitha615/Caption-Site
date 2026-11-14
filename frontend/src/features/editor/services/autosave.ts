import { captionService } from '../../../services/captionService';
import { apiErrorMessage } from '../../../services/errors';
import { projectService } from '../../../services/projectService';
import { useCaptionStore } from '../../../stores/editor/captionStore';
import { useEditorProjectStore } from '../../../stores/editor/editorProjectStore';
import type { CaptionDocument } from '../model/types';
import { serializeCaptions, serializeEditorSettings } from './serialization';

/**
 * Debounced autosave.
 *
 * - Watches the caption document; any change marks the project "Unsaved" and
 *   schedules a save after DEBOUNCE_MS of quiet. Typing never saves per keystroke.
 * - Changes during an active drag transaction are ignored until the drag ends.
 * - Only dirty parts are sent: captions → PUT captions/sync, style/presets/canvas
 *   → PATCH project settings (merged with existing settings).
 * - Never runs two saves at once; edits made mid-save trigger a follow-up save.
 * - Failures surface as "Save failed" and retry with backoff.
 */

const DEBOUNCE_MS = 800;
const RETRY_DELAYS_MS = [3000, 10000, 30000];

let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
let queued = false;
let retryCount = 0;
let lastSaved: CaptionDocument | null = null;
let unsubscribe: (() => void) | null = null;

const project = () => useEditorProjectStore.getState();

function currentDoc(): CaptionDocument {
  const { captions, style, customPresets, canvas } = useCaptionStore.getState();
  return { captions, style, customPresets, canvas };
}

function isDirty(doc = currentDoc()): boolean {
  if (!lastSaved) return false;
  return (
    doc.captions !== lastSaved.captions ||
    doc.style !== lastSaved.style ||
    doc.customPresets !== lastSaved.customPresets ||
    doc.canvas !== lastSaved.canvas
  );
}

function schedule(delay = DEBOUNCE_MS) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, delay);
}

async function save(): Promise<void> {
  const { projectUuid, baseSettings, isDemo } = project();
  if (!projectUuid || isDemo || !lastSaved) return;

  const doc = currentDoc();
  if (!isDirty(doc)) {
    project().markSaved();
    return;
  }

  project().setSaveStatus('saving');
  const captionsDirty = doc.captions !== lastSaved.captions;
  const settingsDirty =
    doc.style !== lastSaved.style || doc.customPresets !== lastSaved.customPresets || doc.canvas !== lastSaved.canvas;

  try {
    if (captionsDirty) {
      await captionService.syncCaptions(projectUuid, serializeCaptions(doc.captions), { silent: true });
    }
    if (settingsDirty) {
      const settings = { ...baseSettings, editor: serializeEditorSettings(doc) };
      await projectService.updateProject(projectUuid, { settings }, { silent: true });
      project().setBaseSettings(settings);
    }
    lastSaved = doc;
    retryCount = 0;
    if (isDirty()) {
      project().setSaveStatus('unsaved');
      schedule();
    } else {
      project().markSaved();
    }
  } catch (err) {
    const message = apiErrorMessage(err, 'Could not save. Retrying…');
    project().setSaveStatus('failed', message);
    const delay = RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];
    retryCount += 1;
    schedule(delay);
  }
}

/** Save now (Ctrl/Cmd+S, leaving the editor). Resolves when everything pending is persisted or failed. */
export async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (inFlight) {
    queued = true;
    return inFlight;
  }
  inFlight = save().finally(() => {
    inFlight = null;
  });
  await inFlight;
  if (queued) {
    queued = false;
    await flush();
  }
}

export function hasUnsavedChanges(): boolean {
  const status = project().saveStatus;
  return status === 'unsaved' || status === 'saving' || status === 'failed' || (status !== 'offline' && isDirty());
}

/** Begin watching the freshly loaded document. Call after captionStore.load(). */
export function startAutosave(): () => void {
  stopAutosave();
  lastSaved = currentDoc();
  retryCount = 0;

  unsubscribe = useCaptionStore.subscribe((state, prev) => {
    if (project().isDemo) return;
    const changed =
      state.captions !== prev.captions ||
      state.style !== prev.style ||
      state.customPresets !== prev.customPresets ||
      state.canvas !== prev.canvas;
    const transactionEnded = prev.transaction && !state.transaction;
    if (!changed && !transactionEnded) return;

    if (!isDirty()) {
      // e.g. undo back to the saved state.
      if (project().saveStatus === 'unsaved' && !inFlight) {
        if (timer) clearTimeout(timer);
        timer = null;
        project().markSaved();
      }
      return;
    }
    if (project().saveStatus !== 'saving') project().setSaveStatus('unsaved');
    if (state.transaction) return; // wait for the drag to finish
    retryCount = 0;
    schedule();
  });

  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!hasUnsavedChanges()) return;
    void flush();
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  const prevUnsub = unsubscribe;
  unsubscribe = () => {
    prevUnsub?.();
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
  return stopAutosave;
}

export function stopAutosave() {
  if (timer) clearTimeout(timer);
  timer = null;
  unsubscribe?.();
  unsubscribe = null;
}

