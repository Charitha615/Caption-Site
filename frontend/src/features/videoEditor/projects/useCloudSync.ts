import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { useVideoEditorStore } from '../store';
import { currentLayout, videoProjectService } from './videoProjectService';

/** off: nothing to save yet · full: the plan's online projects are used up */
export type CloudStatus = 'off' | 'saving' | 'saved' | 'error' | 'full';

const DELAY_MS = 2500;

/** The parts of the editor that are part of the online layout. */
const layoutSlice = (s: ReturnType<typeof useVideoEditorStore.getState>) => [s.name, s.aspect, s.tracks, s.clips, s.media, s.fonts, s.snap] as const;

/**
 * Saves the open video's layout to the account a moment after each change (media files stay on
 * the device). The first save of a new video creates its online copy.
 */
export function useCloudSync(ready: boolean) {
  const [status, setStatus] = useState<CloudStatus>('off');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let busy = false;
    let again = false;
    let stopped = false;

    const save = async () => {
      timer = null;
      const s = useVideoEditorStore.getState();
      // A brand-new, empty video isn't worth a project yet.
      if (!s.projectUuid && s.clips.length === 0) {
        setStatus('off');
        return;
      }
      if (busy) {
        again = true;
        return;
      }
      busy = true;
      setStatus('saving');
      try {
        const layout = currentLayout();
        const uuid = s.projectUuid;
        if (uuid) {
          try {
            await videoProjectService.update(uuid, layout);
          } catch (err) {
            // Deleted from another device: save it as a new one.
            if (!(isAxiosError(err) && err.response?.status === 404)) throw err;
            const created = await videoProjectService.create(layout);
            if (useVideoEditorStore.getState().projectUuid === uuid) useVideoEditorStore.getState().setProjectUuid(created.uuid);
          }
        } else {
          const created = await videoProjectService.create(layout);
          // Still the same video (not switched while saving)?
          if (!useVideoEditorStore.getState().projectUuid) useVideoEditorStore.getState().setProjectUuid(created.uuid);
        }
        if (!stopped) setStatus('saved');
      } catch (err) {
        if (!stopped) setStatus(isAxiosError(err) && err.response?.status === 402 ? 'full' : 'error');
      } finally {
        busy = false;
        if (again && !stopped) {
          again = false;
          schedule();
        }
      }
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void save(), DELAY_MS);
    };

    let last = layoutSlice(useVideoEditorStore.getState());
    const unsubscribe = useVideoEditorStore.subscribe((s) => {
      const next = layoutSlice(s);
      if (next.some((v, i) => v !== last[i])) {
        last = next;
        schedule();
      }
    });
    if (useVideoEditorStore.getState().projectUuid) setStatus('saved');
    else schedule();

    const onHide = () => {
      if (document.visibilityState === 'hidden' && timer) {
        clearTimeout(timer);
        void save();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      stopped = true;
      unsubscribe();
      document.removeEventListener('visibilitychange', onHide);
      if (timer) {
        clearTimeout(timer);
        void save();
      }
    };
  }, [ready, attempt]);

  /** Try again (e.g. after deleting an old project to make room). */
  const retry = () => setAttempt((n) => n + 1);
  return { status, retry };
}
