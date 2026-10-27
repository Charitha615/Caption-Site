import { create } from 'zustand';
import { captionService } from '../services/captionService';
import type { Caption } from '../types/project';

export type EditorTool = 'media' | 'captions' | 'styles' | 'templates' | 'settings';
export type AspectRatio = '9:16' | '16:9' | '1:1';
export type AlignMatrix =
  | 'top-left' | 'top-center' | 'top-right'
  | 'mid-left' | 'center' | 'mid-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type CaptionAnimation = 'none' | 'karaoke' | 'pop' | 'bounce' | 'fade' | 'typewriter' | 'highlight';

export interface CaptionWord {
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface CaptionSegment {
  id: string;
  uuid?: string;
  start: number;
  end: number;
  text: string;
  sequence?: number;
  language?: string;
  words?: CaptionWord[];
  styleOverride?: Partial<CaptionStyleConfig> | null;
}

export interface CaptionStyleConfig {
  preset: string;
  fontFamily: string;
  englishFontFamily: string;
  fontSize: number;
  fontWeight: number;
  textColor: string;
  highlightColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  borderRadius: number;
  padding: number;
  outlineColor: string;
  outlineWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  positionX: number; // -50% to +50%
  positionY: number; // -50% to +50% (vertical placement)
  alignMatrix: AlignMatrix;
  textAlign: 'left' | 'center' | 'right';
  rotation: number;
  scale: number;
  transparency: number;
  animation: CaptionAnimation;
  applyTo: 'all' | 'single';
}

export const PRESET_TEMPLATES: Record<
  string,
  Partial<CaptionStyleConfig> & { label: string; sampleSinhala: string; category: string; description: string }
> = {
  modern: {
    label: 'Modern',
    sampleSinhala: 'ලංකාවේ අලුත් Story',
    category: 'popular',
    description: 'Clean rounded pill with crisp white text and bright cyan highlight.',
    fontFamily: '"Noto Sans Sinhala", sans-serif',
    englishFontFamily: '"Inter", sans-serif',
    fontSize: 28,
    fontWeight: 600,
    textColor: '#FFFFFF',
    highlightColor: '#38BDF8',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    backgroundOpacity: 85,
    borderRadius: 8,
    padding: 8,
    outlineColor: '#000000',
    outlineWidth: 0,
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowBlur: 6,
    animation: 'highlight',
  },
  bold: {
    label: 'Bold',
    sampleSinhala: 'ගැම්මටම කතා කරමු',
    category: 'popular',
    description: 'High-impact heavy typography with solid black outline.',
    fontFamily: '"Noto Sans Sinhala", sans-serif',
    englishFontFamily: '"Inter", sans-serif',
    fontSize: 32,
    fontWeight: 800,
    textColor: '#FACC15',
    highlightColor: '#FFFFFF',
    backgroundColor: 'transparent',
    backgroundOpacity: 0,
    borderRadius: 0,
    padding: 4,
    outlineColor: '#000000',
    outlineWidth: 5,
    shadowColor: 'rgba(0,0,0,0.8)',
    shadowBlur: 8,
    animation: 'bounce',
  },
  minimal: {
    label: 'Minimal',
    sampleSinhala: 'සරල සහ අලංකාර',
    category: 'minimal',
    description: 'Understated pure white captions with subtle drop shadow.',
    fontFamily: '"Noto Sans Sinhala", sans-serif',
    englishFontFamily: '"Inter", sans-serif',
    fontSize: 25,
    fontWeight: 500,
    textColor: '#FFFFFF',
    highlightColor: '#E2E8F0',
    backgroundColor: 'transparent',
    backgroundOpacity: 0,
    borderRadius: 0,
    padding: 4,
    outlineColor: '#000000',
    outlineWidth: 0,
    shadowColor: 'rgba(0, 0, 0, 0.75)',
    shadowBlur: 4,
    animation: 'fade',
  },
  cinema: {
    label: 'Cinema',
    sampleSinhala: 'සිනමා පන්නයේ උපසිරැසි',
    category: 'classic',
    description: 'Classic serif letterbox subtitling with subtle background block.',
    fontFamily: '"Noto Serif Sinhala", serif',
    englishFontFamily: '"Merriweather", serif',
    fontSize: 26,
    fontWeight: 600,
    textColor: '#FEF08A',
    highlightColor: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    backgroundOpacity: 70,
    borderRadius: 4,
    padding: 6,
    outlineColor: '#000000',
    outlineWidth: 2,
    shadowColor: '#000000',
    shadowBlur: 8,
    animation: 'none',
  },
  youtube: {
    label: 'YouTube',
    sampleSinhala: 'Subscribe කරන්න අමතක කරන්න එපා',
    category: 'social',
    description: 'High-contrast sans-serif with red highlight accent for video creators.',
    fontFamily: '"Noto Sans Sinhala", sans-serif',
    englishFontFamily: '"Roboto", sans-serif',
    fontSize: 29,
    fontWeight: 700,
    textColor: '#FFFFFF',
    highlightColor: '#EF4444',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    backgroundOpacity: 90,
    borderRadius: 6,
    padding: 8,
    outlineColor: '#1F2937',
    outlineWidth: 2,
    shadowColor: 'rgba(0,0,0,0.6)',
    shadowBlur: 4,
    animation: 'pop',
  },
  tiktok: {
    label: 'TikTok',
    sampleSinhala: 'Trending වීඩියෝවක් මෙන්න',
    category: 'social',
    description: 'Energetic karaoke highlight word-by-word with rounded badge.',
    fontFamily: '"Noto Sans Sinhala", sans-serif',
    englishFontFamily: '"Poppins", sans-serif',
    fontSize: 32,
    fontWeight: 800,
    textColor: '#FFFFFF',
    highlightColor: '#06B6D4',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    backgroundOpacity: 90,
    borderRadius: 12,
    padding: 10,
    outlineColor: '#000000',
    outlineWidth: 3,
    shadowColor: '#06B6D4',
    shadowBlur: 10,
    animation: 'karaoke',
  },
  classic: {
    label: 'Classic',
    sampleSinhala: 'ටෙලිටෙක්ස්ට් මාදිලිය',
    category: 'classic',
    description: 'Traditional solid black box with high-visibility yellow text.',
    fontFamily: '"Noto Sans Sinhala", monospace',
    englishFontFamily: '"Courier New", monospace',
    fontSize: 26,
    fontWeight: 700,
    textColor: '#FDE047',
    highlightColor: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundOpacity: 100,
    borderRadius: 2,
    padding: 6,
    outlineColor: '#000000',
    outlineWidth: 0,
    shadowColor: 'transparent',
    shadowBlur: 0,
    animation: 'none',
  },
};

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'failed';

interface HistorySnapshot {
  captions: CaptionSegment[];
  style: CaptionStyleConfig;
}

interface EditorState {
  // Project Info
  projectUuid: string | null;
  projectName: string;
  setProjectInfo: (uuid: string, name: string) => void;

  // Navigation & Tool Strip
  activeTool: EditorTool;
  setActiveTool: (tool: EditorTool) => void;

  // Viewport & Canvas Layout
  aspectRatio: AspectRatio;
  setAspectRatio: (ratio: AspectRatio) => void;
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
  zoomLevel: number; // 25 to 200 (pixels per second)
  setZoomLevel: (zoom: number) => void;
  isSnappingEnabled: boolean;
  setIsSnappingEnabled: (enabled: boolean) => void;

  // Video Playback
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isCaptionVisible: boolean;
  videoUrl: string | null;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setIsCaptionVisible: (visible: boolean) => void;
  setVideoUrl: (url: string | null) => void;

  // Captions Data & Selection
  captions: CaptionSegment[];
  selectedCaptionId: string | null;
  activeCaptionIndex: number;
  setCaptions: (captions: CaptionSegment[]) => void;
  loadProjectCaptions: (projectUuid: string) => Promise<void>;
  setSelectedCaptionId: (id: string | null) => void;
  setActiveCaptionIndex: (index: number) => void;

  // Caption Operations
  updateCaptionText: (id: string, text: string) => void;
  updateCaptionTiming: (id: string, start: number, end: number) => void;
  updateCaptionStyleOverride: (id: string, partial: Partial<CaptionStyleConfig>) => void;
  addCaptionSegment: (atTime?: number) => void;
  deleteCaptionSegment: (id: string) => void;
  duplicateCaptionSegment: (id: string) => void;
  splitCaptionAtCurrentTime: (id?: string) => void;
  mergeCaptionWithNext: (id: string) => void;
  moveCaptionSegment: (id: string, deltaSeconds: number) => void;
  selectNextCaption: () => void;
  selectPrevCaption: () => void;

  // Caption Global Styling
  style: CaptionStyleConfig;
  updateStyle: (partial: Partial<CaptionStyleConfig>) => void;
  applyPreset: (presetKey: string) => void;
  resetTransform: () => void;

  // History Undo / Redo
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];
  undo: () => void;
  redo: () => void;

  // Autosave
  saveStatus: SaveStatus;
  setSaveStatus: (status: SaveStatus) => void;
  saveNow: () => Promise<void>;
}

const DEFAULT_STYLE: CaptionStyleConfig = {
  preset: 'modern',
  fontFamily: '"Noto Sans Sinhala", sans-serif',
  englishFontFamily: '"Inter", sans-serif',
  fontSize: 28,
  fontWeight: 600,
  textColor: '#FFFFFF',
  highlightColor: '#38BDF8',
  backgroundColor: 'rgba(15, 23, 42, 0.85)',
  backgroundOpacity: 85,
  borderRadius: 8,
  padding: 8,
  outlineColor: '#000000',
  outlineWidth: 0,
  shadowColor: 'rgba(0, 0, 0, 0.6)',
  shadowBlur: 6,
  shadowOffsetX: 0,
  shadowOffsetY: 2,
  positionX: 0,
  positionY: 24, // +24% bottom placement
  alignMatrix: 'bottom-center',
  textAlign: 'center',
  rotation: 0,
  scale: 28,
  transparency: 0,
  animation: 'highlight',
  applyTo: 'all',
};

const INITIAL_CAPTIONS: CaptionSegment[] = [
  {
    id: 'seg-1',
    start: 0.5,
    end: 3.2,
    text: 'ආයුබෝවන්, අපගේ වීඩියෝවට සාදරයෙන් පිළිගනිමු.',
    language: 'si',
    words: [
      { text: 'ආයුබෝවන්,', start: 0.5, end: 1.2 },
      { text: 'අපගේ', start: 1.3, end: 1.7 },
      { text: 'වීඩියෝවට', start: 1.8, end: 2.4 },
      { text: 'සාදරයෙන්', start: 2.5, end: 2.9 },
      { text: 'පිළිගනිමු.', start: 2.9, end: 3.2 },
    ],
  },
  {
    id: 'seg-2',
    start: 3.45,
    end: 6.8,
    text: 'මෙම වීඩියෝවෙන් අපි AI තාක්ෂණය මඟින් සිංහල උපසිරැසි නිර්මාණය කරමු.',
    language: 'si',
    words: [
      { text: 'මෙම', start: 3.45, end: 3.8 },
      { text: 'වීඩියෝවෙන්', start: 3.9, end: 4.5 },
      { text: 'අපි', start: 4.6, end: 4.9 },
      { text: 'AI', start: 5.0, end: 5.4 },
      { text: 'තාක්ෂණය', start: 5.5, end: 6.0 },
      { text: 'මඟින්', start: 6.1, end: 6.4 },
      { text: 'නිර්මාණය', start: 6.4, end: 6.8 },
    ],
  },
  {
    id: 'seg-3',
    start: 7.0,
    end: 10.5,
    text: 'නියම වේලාවට ගැළපෙන අලංකාර animation සහිත caption පේළි මෙහිදී ලැබෙනවා.',
    language: 'si',
    words: [
      { text: 'නියම', start: 7.0, end: 7.4 },
      { text: 'වේලාවට', start: 7.5, end: 8.0 },
      { text: 'ගැළපෙන', start: 8.1, end: 8.6 },
      { text: 'caption', start: 8.7, end: 9.3 },
      { text: 'පේළි', start: 9.4, end: 9.8 },
      { text: 'ලැබෙනවා.', start: 9.9, end: 10.5 },
    ],
  },
  {
    id: 'seg-4',
    start: 10.8,
    end: 14.2,
    text: 'වීඩියෝව පහසුවෙන් සංස්කරණය කර Studio Editor හරහා export කරගන්න.',
    language: 'si',
    words: [
      { text: 'වීඩියෝව', start: 10.8, end: 11.4 },
      { text: 'පහසුවෙන්', start: 11.5, end: 12.1 },
      { text: 'සංස්කරණය', start: 12.2, end: 12.8 },
      { text: 'Studio', start: 12.9, end: 13.4 },
      { text: 'Editor', start: 13.5, end: 14.2 },
    ],
  },
];

// Helper to push history snapshot
let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;

export const useEditorStore = create<EditorState>((set, get) => ({
  projectUuid: null,
  projectName: 'SampleCap Project',
  setProjectInfo: (uuid, name) => set({ projectUuid: uuid, projectName: name }),

  activeTool: 'captions',
  setActiveTool: (tool) => set({ activeTool: tool }),

  aspectRatio: '16:9',
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  isLocked: false,
  setIsLocked: (isLocked) => set({ isLocked }),
  zoomLevel: 60, // 60px per second default
  setZoomLevel: (zoomLevel) => set({ zoomLevel: Math.max(20, Math.min(200, zoomLevel)) }),
  isSnappingEnabled: true,
  setIsSnappingEnabled: (isSnappingEnabled) => set({ isSnappingEnabled }),

  currentTime: 0.0,
  duration: 15.0,
  isPlaying: false,
  volume: 1.0,
  isMuted: false,
  playbackRate: 1.0,
  isCaptionVisible: true,
  videoUrl: null,

  setCurrentTime: (currentTime) => {
    set({ currentTime });
    const { captions, activeCaptionIndex } = get();
    const idx = captions.findIndex((c) => currentTime >= c.start && currentTime <= c.end);
    if (idx !== -1 && idx !== activeCaptionIndex) {
      set({ activeCaptionIndex: idx });
    }
  },
  setDuration: (duration) => set({ duration: Math.max(1, duration) }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)), isMuted: volume === 0 }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setIsCaptionVisible: (isCaptionVisible) => set({ isCaptionVisible }),
  setVideoUrl: (videoUrl) => set({ videoUrl }),

  captions: INITIAL_CAPTIONS,
  selectedCaptionId: INITIAL_CAPTIONS[0].id,
  activeCaptionIndex: 0,
  setCaptions: (captions) => set({ captions }),

  loadProjectCaptions: async (projectUuid) => {
    try {
      const res = await captionService.getCaptions(projectUuid);
      if (res && res.captions && res.captions.length > 0) {
        const mapped: CaptionSegment[] = res.captions.map((c: Caption, idx: number) => ({
          id: c.uuid || `cap-${c.id || idx}`,
          uuid: c.uuid,
          sequence: c.sequence || idx + 1,
          start: c.start_time,
          end: c.end_time,
          text: c.text,
          language: c.language || 'si',
          words: c.metadata?.words
            ? (c.metadata.words as any[]).map((w: any) => ({
                text: w.word || w.text || '',
                start: Number(w.start),
                end: Number(w.end),
                confidence: w.confidence,
              }))
            : undefined,
          styleOverride: (c.style_override as Partial<CaptionStyleConfig>) || null,
        }));
        set({
          captions: mapped,
          selectedCaptionId: mapped[0]?.id || null,
          activeCaptionIndex: 0,
        });
      }
    } catch (err) {
      console.warn('Could not fetch backend captions, using fallback', err);
    }
  },

  setSelectedCaptionId: (id) => {
    set({ selectedCaptionId: id });
    if (id) {
      const idx = get().captions.findIndex((c) => c.id === id);
      if (idx !== -1) {
        set({ activeCaptionIndex: idx });
      }
    }
  },

  setActiveCaptionIndex: (activeCaptionIndex) => {
    set({ activeCaptionIndex });
    const target = get().captions[activeCaptionIndex];
    if (target) {
      set({ currentTime: target.start, selectedCaptionId: target.id });
    }
  },

  updateCaptionText: (id, text) => {
    const { captions, undoStack, style } = get();
    set({
      undoStack: [...undoStack, { captions, style }],
      redoStack: [],
      captions: captions.map((c) => (c.id === id ? { ...c, text } : c)),
      saveStatus: 'unsaved',
    });
    triggerAutosave();
  },

  updateCaptionTiming: (id, start, end) => {
    const { captions, undoStack, style } = get();
    const safeStart = Math.max(0, start);
    const safeEnd = Math.max(safeStart + 0.2, end);
    set({
      undoStack: [...undoStack, { captions, style }],
      redoStack: [],
      captions: captions
        .map((c) => (c.id === id ? { ...c, start: safeStart, end: safeEnd } : c))
        .sort((a, b) => a.start - b.start),
      saveStatus: 'unsaved',
    });
    triggerAutosave();
  },

  updateCaptionStyleOverride: (id, partial) => {
    const { captions, undoStack, style } = get();
    set({
      undoStack: [...undoStack, { captions, style }],
      redoStack: [],
      captions: captions.map((c) =>
        c.id === id ? { ...c, styleOverride: { ...c.styleOverride, ...partial } } : c
      ),
      saveStatus: 'unsaved',
    });
    triggerAutosave();
  },

  addCaptionSegment: (atTime) => {
    const { captions, currentTime, undoStack, style } = get();
    const start = atTime !== undefined ? atTime : currentTime;
    const end = start + 2.5;
    const newSeg: CaptionSegment = {
      id: `seg-${Date.now()}`,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      text: 'නව උපසිරැසි පේළියක්...',
      language: 'si',
    };
    const updated = [...captions, newSeg].sort((a, b) => a.start - b.start);
    set({
      undoStack: [...undoStack, { captions, style }],
      redoStack: [],
      captions: updated,
      selectedCaptionId: newSeg.id,
      activeCaptionIndex: updated.findIndex((c) => c.id === newSeg.id),
      saveStatus: 'unsaved',
    });
    triggerAutosave();
  },

  deleteCaptionSegment: (id) => {
    const { captions, undoStack, style, selectedCaptionId } = get();
    const updated = captions.filter((c) => c.id !== id);
    set({
      undoStack: [...undoStack, { captions, style }],
      redoStack: [],
      captions: updated,
      selectedCaptionId: selectedCaptionId === id ? (updated[0]?.id || null) : selectedCaptionId,
      activeCaptionIndex: Math.max(0, Math.min(get().activeCaptionIndex, updated.length - 1)),
      saveStatus: 'unsaved',
    });
    triggerAutosave();
  },

  duplicateCaptionSegment: (id) => {
    const { captions, undoStack, style } = get();
    const target = captions.find((c) => c.id === id);
    if (!target) return;

    const newStart = target.end + 0.1;
    const duration = target.end - target.start;
    const duplicated: CaptionSegment = {
      ...target,
      id: `seg-${Date.now()}`,
      uuid: undefined,
      start: Number(newStart.toFixed(2)),
      end: Number((newStart + duration).toFixed(2)),
    };

    const updated = [...captions, duplicated].sort((a, b) => a.start - b.start);
    set({
      undoStack: [...undoStack, { captions, style }],
      redoStack: [],
      captions: updated,
      selectedCaptionId: duplicated.id,
      activeCaptionIndex: updated.findIndex((c) => c.id === duplicated.id),
      saveStatus: 'unsaved',
    });
    triggerAutosave();
  },

  splitCaptionAtCurrentTime: (id) => {
    const { captions, selectedCaptionId, activeCaptionIndex, currentTime, undoStack, style } = get();
    const targetId = id || selectedCaptionId || captions[activeCaptionIndex]?.id;
    const current = captions.find((c) => c.id === targetId);

    if (!current || currentTime <= current.start + 0.2 || currentTime >= current.end - 0.2) {
      return;
    }

    const words = current.text.split(' ');
    const midPoint = Math.max(1, Math.floor(words.length / 2));
    const text1 = words.slice(0, midPoint).join(' ');
    const text2 = words.slice(midPoint).join(' ') || current.text;

    const seg1: CaptionSegment = { ...current, end: Number(currentTime.toFixed(2)), text: text1 };
    const seg2: CaptionSegment = {
      id: `seg-${Date.now()}`,
      start: Number((currentTime + 0.05).toFixed(2)),
      end: current.end,
      text: text2,
      language: current.language,
    };

    const updated = captions
      .map((c) => (c.id === current.id ? seg1 : c))
      .concat(seg2)
      .sort((a, b) => a.start - b.start);

    set({
      undoStack: [...undoStack, { captions, style }],
      redoStack: [],
      captions: updated,
      selectedCaptionId: seg2.id,
      saveStatus: 'unsaved',
    });
    triggerAutosave();
  },

  mergeCaptionWithNext: (id) => {
    const { captions, undoStack, style } = get();
    const index = captions.findIndex((c) => c.id === id);
    if (index === -1 || index >= captions.length - 1) return;

    const current = captions[index];
    const next = captions[index + 1];

    const merged: CaptionSegment = {
      ...current,
      end: next.end,
      text: `${current.text} ${next.text}`,
      words: [...(current.words || []), ...(next.words || [])],
    };

    const updated = captions
      .filter((_, idx) => idx !== index + 1)
      .map((c) => (c.id === current.id ? merged : c));

    set({
      undoStack: [...undoStack, { captions, style }],
      redoStack: [],
      captions: updated,
      selectedCaptionId: merged.id,
      saveStatus: 'unsaved',
    });
    triggerAutosave();
  },

  moveCaptionSegment: (id, deltaSeconds) => {
    const { captions, undoStack, style, duration } = get();
    const updated = captions.map((c) => {
      if (c.id !== id) return c;
      const segDuration = c.end - c.start;
      const newStart = Math.max(0, Math.min(duration - segDuration, c.start + deltaSeconds));
      return {
        ...c,
        start: Number(newStart.toFixed(2)),
        end: Number((newStart + segDuration).toFixed(2)),
      };
    }).sort((a, b) => a.start - b.start);

    set({
      undoStack: [...undoStack, { captions, style }],
      redoStack: [],
      captions: updated,
      saveStatus: 'unsaved',
    });
    triggerAutosave();
  },

  selectNextCaption: () => {
    const { captions, selectedCaptionId, setSelectedCaptionId, setCurrentTime } = get();
    const currIdx = captions.findIndex((c) => c.id === selectedCaptionId);
    if (currIdx < captions.length - 1) {
      const next = captions[currIdx + 1];
      setSelectedCaptionId(next.id);
      setCurrentTime(next.start);
    }
  },

  selectPrevCaption: () => {
    const { captions, selectedCaptionId, setSelectedCaptionId, setCurrentTime } = get();
    const currIdx = captions.findIndex((c) => c.id === selectedCaptionId);
    if (currIdx > 0) {
      const prev = captions[currIdx - 1];
      setSelectedCaptionId(prev.id);
      setCurrentTime(prev.start);
    }
  },

  style: DEFAULT_STYLE,
  updateStyle: (partial) => {
    set((state) => ({
      style: { ...state.style, ...partial },
      saveStatus: 'unsaved',
    }));
    triggerAutosave();
  },

  applyPreset: (presetKey) => {
    const template = PRESET_TEMPLATES[presetKey];
    if (template) {
      set((state) => ({
        style: {
          ...state.style,
          ...template,
          preset: presetKey,
        },
        saveStatus: 'unsaved',
      }));
      triggerAutosave();
    }
  },

  resetTransform: () => {
    set((state) => ({
      style: {
        ...state.style,
        positionX: 0,
        positionY: 24,
        alignMatrix: 'bottom-center',
        textAlign: 'center',
        rotation: 0,
        scale: 28,
        transparency: 0,
      },
    }));
  },

  undoStack: [],
  redoStack: [],
  undo: () => {
    const { undoStack, captions, redoStack, style } = get();
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, { captions, style }],
      captions: last.captions,
      style: last.style,
      saveStatus: 'unsaved',
    });
    triggerAutosave();
  },

  redo: () => {
    const { redoStack, captions, undoStack, style } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, { captions, style }],
      captions: next.captions,
      style: next.style,
      saveStatus: 'unsaved',
    });
    triggerAutosave();
  },

  saveStatus: 'saved',
  setSaveStatus: (saveStatus) => set({ saveStatus }),

  saveNow: async () => {
    const { projectUuid, captions, setSaveStatus } = get();
    if (!projectUuid) return;

    setSaveStatus('saving');
    try {
      const payload = captions.map((c, idx) => ({
        uuid: c.uuid,
        sequence: idx + 1,
        start_time: c.start,
        end_time: c.end,
        text: c.text,
        language: c.language || 'si',
        style_override: c.styleOverride || null,
        metadata: c.words ? { words: c.words } : null,
      }));

      await captionService.syncCaptions(projectUuid, payload);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save captions:', err);
      setSaveStatus('failed');
    }
  },
}));

// Debounced autosave mechanism (800ms)
function triggerAutosave() {
  const store = useEditorStore.getState();
  if (!store.projectUuid) return;

  store.setSaveStatus('unsaved');

  if (autosaveTimeout) {
    clearTimeout(autosaveTimeout);
  }

  autosaveTimeout = setTimeout(() => {
    store.saveNow().catch(() => {});
  }, 800);
}
