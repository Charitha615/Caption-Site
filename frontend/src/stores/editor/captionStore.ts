import { create } from 'zustand';
import {
  createCaption,
  createId,
  duplicateCaption,
  mergeCaptions,
  neighbourBounds,
  replaceCaption,
  sortCaptions,
  splitCaption,
  withText,
  withTiming,
} from '../../features/editor/model/captionOps';
import { DEFAULT_STYLE, PRESETS_BY_KEY, applyPresetLook, type PresetLook } from '../../features/editor/model/presets';
import type {
  CanvasSettings,
  CaptionDocument,
  CaptionLanguage,
  CaptionSegment,
  CaptionStyle,
  CaptionStyleOverride,
  CustomPreset,
} from '../../features/editor/model/types';
import { useEditorStore } from './editorStore';
import { useTimelineStore } from './timelineStore';
import { useVideoStore } from './videoStore';

/**
 * Caption document state + undo/redo history.
 *
 * History stores whole-document snapshots. Because every update is immutable
 * and structurally shared, a snapshot costs one object + changed captions, not
 * a deep copy. Three mechanisms keep history meaningful:
 *  - commit(): one user action → one entry.
 *  - coalesceKey: rapid repeats of the same action (typing in one caption,
 *    scrubbing one slider, repeated nudges) merge into a single entry.
 *  - transactions: drags apply many intermediate updates and record one entry.
 */

const MAX_HISTORY = 300;
const COALESCE_WINDOW_MS = 1000;

export interface HistoryEntry {
  doc: CaptionDocument;
  label: string;
  selection: string | null;
  coalesceKey?: string;
  at: number;
}

interface Transaction {
  base: CaptionDocument;
  label: string;
  selection: string | null;
}

interface CommitOptions {
  coalesceKey?: string;
  /** Selection to apply after the change. `undefined` leaves selection untouched. */
  select?: string | null;
}

type Recipe = (doc: CaptionDocument) => Partial<CaptionDocument> | null;

/** `null` target = the global (project) style; a caption id = that caption's override. */
export type StyleTarget = string | null;

interface CaptionState extends CaptionDocument {
  past: HistoryEntry[];
  future: HistoryEntry[];
  transaction: Transaction | null;

  load: (doc: CaptionDocument) => void;
  commit: (label: string, recipe: Recipe, opts?: CommitOptions) => boolean;
  beginTransaction: (label: string) => void;
  endTransaction: () => void;
  cancelTransaction: () => void;
  undo: () => void;
  redo: () => void;

  addCaption: (at: number, text?: string) => string;
  deleteCaption: (id: string) => void;
  updateText: (id: string, text: string) => void;
  setTiming: (id: string, start: number, end: number, label?: string) => void;
  nudge: (id: string, delta: number) => void;
  splitAt: (id: string, time: number) => boolean;
  mergeWithNext: (id: string) => boolean;
  duplicate: (id: string) => void;
  setLanguage: (id: string, language: CaptionLanguage) => void;

  updateStyle: (patch: Partial<CaptionStyle>, target: StyleTarget, coalesceField?: string) => void;
  clearOverride: (id: string) => void;
  clearAllOverrides: () => void;
  applyPreset: (key: string, target: StyleTarget) => void;
  /** Apply a saved template (full style, incl. layout) to the project or one caption. */
  applyTemplateStyle: (style: Partial<CaptionStyle>, presetId: string, label: string, target: StyleTarget) => void;
  saveCustomPreset: (label: string) => string;
  deleteCustomPreset: (id: string) => void;
  setCanvas: (patch: Partial<CanvasSettings>) => void;
}

const docOf = (s: CaptionDocument): CaptionDocument => ({
  captions: s.captions,
  style: s.style,
  customPresets: s.customPresets,
  canvas: s.canvas,
});

const getSelection = () => useEditorStore.getState().selectedCaptionId;
const getDuration = () => useVideoStore.getState().duration;

function lookOf(style: CaptionStyle): PresetLook {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { preset, alignMatrix, positionX, positionY, maxWidth, textAlign, ...rest } = style;
  return rest;
}

export const EMPTY_DOCUMENT: CaptionDocument = {
  captions: [],
  style: DEFAULT_STYLE,
  customPresets: [],
  canvas: { aspect: 'source' },
};

export const useCaptionStore = create<CaptionState>()((set, get) => ({
  ...EMPTY_DOCUMENT,
  past: [],
  future: [],
  transaction: null,

  load: (doc) => set({ ...doc, captions: sortCaptions(doc.captions), past: [], future: [], transaction: null }),

  commit: (label, recipe, opts = {}) => {
    const state = get();
    const before = docOf(state);
    const patch = recipe(before);
    if (!patch) return false;

    if (state.transaction) {
      set(patch);
    } else {
      const now = performance.now();
      const last = state.past[state.past.length - 1];
      const coalesce =
        !!opts.coalesceKey && !!last && last.coalesceKey === opts.coalesceKey && now - last.at < COALESCE_WINDOW_MS;
      const past = coalesce
        ? [...state.past.slice(0, -1), { ...last, at: now }]
        : [...state.past, { doc: before, label, selection: getSelection(), coalesceKey: opts.coalesceKey, at: now }].slice(-MAX_HISTORY);
      set({ ...patch, past, future: [] });
    }
    if (opts.select !== undefined) useEditorStore.getState().select(opts.select);
    return true;
  },

  beginTransaction: (label) => {
    if (get().transaction) return;
    set({ transaction: { base: docOf(get()), label, selection: getSelection() } });
  },

  endTransaction: () => {
    const { transaction, past } = get();
    if (!transaction) return;
    const current = docOf(get());
    const changed = (Object.keys(current) as Array<keyof CaptionDocument>).some((k) => current[k] !== transaction.base[k]);
    set({
      transaction: null,
      ...(changed
        ? {
            past: [...past, { doc: transaction.base, label: transaction.label, selection: transaction.selection, at: performance.now() }].slice(-MAX_HISTORY),
            future: [],
          }
        : {}),
    });
  },

  cancelTransaction: () => {
    const { transaction } = get();
    if (!transaction) return;
    set({ ...transaction.base, transaction: null });
  },

  undo: () => {
    const { past, future, transaction } = get();
    if (transaction || past.length === 0) return;
    const entry = past[past.length - 1];
    set({
      ...entry.doc,
      past: past.slice(0, -1),
      future: [...future, { doc: docOf(get()), label: entry.label, selection: getSelection(), at: performance.now() }],
    });
    restoreSelection(entry.selection);
  },

  redo: () => {
    const { past, future, transaction } = get();
    if (transaction || future.length === 0) return;
    const entry = future[future.length - 1];
    set({
      ...entry.doc,
      future: future.slice(0, -1),
      past: [...past, { doc: docOf(get()), label: entry.label, selection: getSelection(), at: performance.now() }],
    });
    restoreSelection(entry.selection);
  },

  // ---------------------------------------------------------------- captions

  addCaption: (at, text = '') => {
    const caption = createCaption(get().captions, at, getDuration(), text);
    get().commit('Add caption', (d) => ({ captions: sortCaptions([...d.captions, caption]) }), { select: caption.id });
    return caption.id;
  },

  deleteCaption: (id) => {
    const { captions } = get();
    const idx = captions.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const neighbour = captions[idx + 1] ?? captions[idx - 1] ?? null;
    get().commit('Delete caption', (d) => ({ captions: d.captions.filter((c) => c.id !== id) }), {
      select: getSelection() === id ? neighbour?.id ?? null : undefined,
    });
  },

  updateText: (id, text) => {
    get().commit(
      'Edit text',
      (d) => {
        const c = d.captions.find((x) => x.id === id);
        if (!c || c.text === text) return null;
        return { captions: replaceCaption(d.captions, id, withText(c, text)) };
      },
      { coalesceKey: `text:${id}` }
    );
  },

  setTiming: (id, start, end, label = 'Change timing') => {
    get().commit(
      label,
      (d) => {
        const c = d.captions.find((x) => x.id === id);
        if (!c) return null;
        const next = withTiming(c, start, end, getDuration());
        if (next.start === c.start && next.end === c.end) return null;
        const captions = replaceCaption(d.captions, id, next);
        const needsSort = captions.some((x, i) => i > 0 && x.start < captions[i - 1].start);
        return { captions: needsSort ? sortCaptions(captions) : captions };
      },
      { coalesceKey: `timing:${id}:${label}` }
    );
  },

  nudge: (id, delta) => {
    const { captions } = get();
    const c = captions.find((x) => x.id === id);
    if (!c) return;
    const length = c.end - c.start;
    let start = c.start + delta;
    if (useTimelineStore.getState().preventOverlap) {
      const { min, max } = neighbourBounds(captions, id, getDuration());
      start = Math.min(Math.max(start, min), max - length);
      if (max - min < length) return;
    }
    get().setTiming(id, start, start + length, 'Move caption');
  },

  splitAt: (id, time) => {
    const c = get().captions.find((x) => x.id === id);
    const parts = c ? splitCaption(c, time) : null;
    if (!parts) return false;
    get().commit(
      'Split caption',
      (d) => ({ captions: sortCaptions([...d.captions.filter((x) => x.id !== id), ...parts]) }),
      { select: parts[1].id }
    );
    return true;
  },

  mergeWithNext: (id) => {
    const { captions } = get();
    const idx = captions.findIndex((c) => c.id === id);
    if (idx === -1 || idx >= captions.length - 1) return false;
    const merged = mergeCaptions(captions[idx], captions[idx + 1]);
    const nextId = captions[idx + 1].id;
    get().commit(
      'Merge captions',
      (d) => ({ captions: d.captions.filter((c) => c.id !== nextId).map((c) => (c.id === id ? merged : c)) }),
      { select: id }
    );
    return true;
  },

  duplicate: (id) => {
    const c = get().captions.find((x) => x.id === id);
    if (!c) return;
    const copy = duplicateCaption(c, getDuration());
    get().commit('Duplicate caption', (d) => ({ captions: sortCaptions([...d.captions, copy]) }), { select: copy.id });
  },

  setLanguage: (id, language) => {
    get().commit('Change language', (d) => {
      const c = d.captions.find((x) => x.id === id);
      if (!c || c.language === language) return null;
      return { captions: replaceCaption(d.captions, id, { ...c, language }) };
    });
  },

  // ------------------------------------------------------------------ styles

  updateStyle: (patch, target, coalesceField) => {
    const label = target ? 'Style caption' : 'Change style';
    const coalesceKey = coalesceField ? `style:${target ?? 'global'}:${coalesceField}` : undefined;
    get().commit(
      label,
      (d) => {
        if (target === null) return { style: { ...d.style, ...patch } };
        const c = d.captions.find((x) => x.id === target);
        if (!c) return null;
        const override: CaptionStyleOverride = { ...(c.styleOverride ?? {}), ...patch };
        return { captions: replaceCaption(d.captions, target, { ...c, styleOverride: override }) };
      },
      { coalesceKey }
    );
  },

  clearOverride: (id) => {
    get().commit('Reset caption style', (d) => {
      const c = d.captions.find((x) => x.id === id);
      if (!c?.styleOverride) return null;
      return { captions: replaceCaption(d.captions, id, { ...c, styleOverride: null }) };
    });
  },

  clearAllOverrides: () => {
    get().commit('Reset all caption styles', (d) => {
      if (!d.captions.some((c) => c.styleOverride)) return null;
      return { captions: d.captions.map((c) => (c.styleOverride ? { ...c, styleOverride: null } : c)) };
    });
  },

  applyPreset: (key, target) => {
    const builtIn = PRESETS_BY_KEY[key];
    const custom = get().customPresets.find((p) => p.id === key);
    const presetLook = builtIn ? builtIn.look : custom ? lookOf(custom.style) : null;
    if (!presetLook) return;
    get().commit(`Apply ${builtIn?.label ?? custom?.label} style`, (d) => {
      if (target === null) return { style: applyPresetLook(d.style, key, presetLook, builtIn?.layout) };
      const c = d.captions.find((x) => x.id === target);
      if (!c) return null;
      return { captions: replaceCaption(d.captions, target, { ...c, styleOverride: { ...(c.styleOverride ?? {}), ...presetLook, preset: key } }) };
    });
  },

  applyTemplateStyle: (style, presetId, label, target) => {
    get().commit(`Apply ${label}`, (d) => {
      const patch = { ...style, preset: presetId };
      if (target === null) return { style: { ...d.style, ...patch } };
      const c = d.captions.find((x) => x.id === target);
      if (!c) return null;
      return { captions: replaceCaption(d.captions, target, { ...c, styleOverride: { ...(c.styleOverride ?? {}), ...patch } }) };
    });
  },

  saveCustomPreset: (label) => {
    const id = `custom-${createId()}`;
    get().commit('Save style preset', (d) => ({
      customPresets: [...d.customPresets, { id, label: label.trim() || 'My style', basePreset: d.style.preset, style: { ...d.style, preset: id } } satisfies CustomPreset],
      style: { ...d.style, preset: id },
    }));
    return id;
  },

  deleteCustomPreset: (id) => {
    get().commit('Delete style preset', (d) => ({ customPresets: d.customPresets.filter((p) => p.id !== id) }));
  },

  setCanvas: (patch) => {
    get().commit('Change canvas', (d) => ({ canvas: { ...d.canvas, ...patch } }));
  },
}));

function restoreSelection(id: string | null) {
  const exists = id && useCaptionStore.getState().captions.some((c) => c.id === id);
  useEditorStore.getState().select(exists ? id : null);
}

export type { CaptionSegment };
