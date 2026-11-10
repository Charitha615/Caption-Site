import { useCallback } from 'react';
import { findCaptionIndexAt } from '../../features/editor/model/captionOps';
import type { CaptionSegment } from '../../features/editor/model/types';
import { resolveStyle } from '../../features/editor/utils/captionStyle';
import { useCaptionStore } from './captionStore';
import { useEditorStore } from './editorStore';
import { useVideoStore } from './videoStore';

/**
 * Id of the caption under the playhead. Although currentTime changes every
 * frame, this hook only re-renders its component when the *active caption*
 * changes — the selector returns a stable string.
 */
export function useActiveCaptionId(): string | null {
  const captions = useCaptionStore((s) => s.captions);
  const selector = useCallback(
    (s: { currentTime: number }) => {
      const idx = findCaptionIndexAt(captions, s.currentTime);
      return idx === -1 ? null : captions[idx].id;
    },
    [captions]
  );
  return useVideoStore(selector);
}

export function useCaption(id: string | null): CaptionSegment | null {
  return useCaptionStore(useCallback((s) => (id ? s.captions.find((c) => c.id === id) ?? null : null), [id]));
}

export function useSelectedCaption(): CaptionSegment | null {
  const id = useEditorStore((s) => s.selectedCaptionId);
  return useCaption(id);
}

/** Effective style of a caption (global style + its override). Memoised per caption/style reference. */
export function useResolvedStyle(caption: CaptionSegment | null) {
  const style = useCaptionStore((s) => s.style);
  return caption ? resolveStyle(style, caption.styleOverride) : style;
}

export const getActiveCaptionId = (): string | null => {
  const { captions } = useCaptionStore.getState();
  const idx = findCaptionIndexAt(captions, useVideoStore.getState().currentTime);
  return idx === -1 ? null : captions[idx].id;
};

/** Caption the editing commands act on: the selection, else whatever is under the playhead. */
export const getTargetCaptionId = (): string | null =>
  useEditorStore.getState().selectedCaptionId ?? getActiveCaptionId();
