import { useCaptionStore } from '../../../stores/editor/captionStore';
import { useEditorStore } from '../../../stores/editor/editorStore';
import { getActiveCaptionId } from '../../../stores/editor/selectors';
import { useVideoStore } from '../../../stores/editor/videoStore';
import { playback } from './playback';

/** Small cross-store commands shared by toolbar buttons, shortcuts and lists. */

/** Select a caption and move the playhead to its start (the "click a caption" behaviour). */
export function selectAndSeek(id: string) {
  const c = useCaptionStore.getState().captions.find((x) => x.id === id);
  useEditorStore.getState().select(id);
  if (c) playback.seek(c.start + 0.001);
}

export function selectRelative(dir: -1 | 1) {
  const { captions } = useCaptionStore.getState();
  if (captions.length === 0) return;
  const current = useEditorStore.getState().selectedCaptionId ?? getActiveCaptionId();
  const idx = captions.findIndex((c) => c.id === current);
  if (idx === -1) {
    // Nothing selected and nothing under the playhead: pick the nearest caption in that direction.
    const t = useVideoStore.getState().currentTime;
    const next = dir === 1 ? captions.find((c) => c.start > t) : captions.findLast((c) => c.end <= t);
    if (next) selectAndSeek(next.id);
    return;
  }
  const next = captions[Math.min(captions.length - 1, Math.max(0, idx + dir))];
  if (next) selectAndSeek(next.id);
}
