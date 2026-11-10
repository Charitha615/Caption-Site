import { create } from 'zustand';

export const MIN_ZOOM = 8;
export const MAX_ZOOM = 480;

/** Timeline view state: zoom, snapping behaviour and transient drag feedback. */
interface TimelineState {
  /** Pixels per second. */
  zoom: number;
  snapping: boolean;
  preventOverlap: boolean;
  followPlayhead: boolean;
  /** Time (s) of the edge we're currently snapped to while dragging — drives the snap guide. */
  snapGuide: number | null;
  /** Caption being dragged (for styling); null when idle. */
  draggingId: string | null;

  setZoom: (zoom: number) => void;
  zoomBy: (factor: number) => void;
  setSnapping: (v: boolean) => void;
  setPreventOverlap: (v: boolean) => void;
  setFollowPlayhead: (v: boolean) => void;
  setSnapGuide: (t: number | null) => void;
  setDraggingId: (id: string | null) => void;
}

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const useTimelineStore = create<TimelineState>()((set) => ({
  zoom: 80,
  snapping: true,
  preventOverlap: true,
  followPlayhead: true,
  snapGuide: null,
  draggingId: null,

  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  zoomBy: (factor) => set((s) => ({ zoom: clampZoom(s.zoom * factor) })),
  setSnapping: (snapping) => set({ snapping }),
  setPreventOverlap: (preventOverlap) => set({ preventOverlap }),
  setFollowPlayhead: (followPlayhead) => set({ followPlayhead }),
  setSnapGuide: (snapGuide) => set({ snapGuide }),
  setDraggingId: (draggingId) => set({ draggingId }),
}));
