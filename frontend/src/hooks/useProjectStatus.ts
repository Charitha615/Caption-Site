import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../stores/projectStore';
import type { ProjectStatusResponse } from '../types/project';

/**
 * Polls GET /projects/{uuid}/status while `enabled` and the project is processing.
 * Backs off on errors, pauses while the tab is hidden, and stops once ready/failed.
 */
export function useProjectStatus(
  uuid: string | undefined,
  enabled: boolean,
  onSettled?: (status: ProjectStatusResponse) => void,
) {
  const checkStatus = useProjectStore((s) => s.checkStatus);
  const [status, setStatus] = useState<ProjectStatusResponse | null>(null);
  const [pollError, setPollError] = useState(false);
  const [generation, setGeneration] = useState(0);
  const timer = useRef<number | null>(null);
  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    if (!uuid || !enabled) return;
    let cancelled = false;
    let failures = 0;

    const tick = async () => {
      if (document.hidden) {
        timer.current = window.setTimeout(tick, 3000);
        return;
      }
      try {
        const res = await checkStatus(uuid);
        if (cancelled) return;
        failures = 0;
        setPollError(false);
        setStatus(res);
        if (res.is_processing) timer.current = window.setTimeout(tick, 2000);
        else settledRef.current?.(res);
      } catch {
        if (cancelled) return;
        failures += 1;
        setPollError(failures >= 3);
        timer.current = window.setTimeout(tick, Math.min(2000 * 2 ** failures, 30000));
      }
    };
    void tick();

    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [uuid, enabled, checkStatus, generation]);

  /** Restart polling, e.g. after triggering regeneration. */
  const restart = () => setGeneration((g) => g + 1);

  return { status, pollError, restart };
}
