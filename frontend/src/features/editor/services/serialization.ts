import type { Caption } from '../../../types/project';
import { createId, sortCaptions } from '../model/captionOps';
import { DEFAULT_STYLE } from '../model/presets';
import type {
  CanvasAspect,
  CaptionDocument,
  CaptionLanguage,
  CaptionSegment,
  CaptionWord,
  CustomPreset,
} from '../model/types';
import { sanitizeStyle } from '../utils/captionStyle';
import { detectLanguage, normalizeCaptionText } from '../utils/unicode';

/**
 * Translation between the API shapes and the editor document. The exporter in
 * STEP 4 should read `project.settings.editor` + captions through these same
 * functions so preview and export agree.
 */

export const EDITOR_SETTINGS_VERSION = 2;

const LANGS: CaptionLanguage[] = ['si', 'en', 'mixed'];
const ASPECTS: CanvasAspect[] = ['source', '16:9', '9:16', '1:1', '4:5'];

function toWords(raw: unknown): CaptionWord[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const words = raw
    .map((w) => {
      const o = (w ?? {}) as Record<string, unknown>;
      const text = String(o.text ?? o.word ?? '');
      const start = Number(o.start);
      const end = Number(o.end);
      if (!text || !Number.isFinite(start) || !Number.isFinite(end)) return null;
      return { text, start, end, ...(typeof o.confidence === 'number' ? { confidence: o.confidence } : {}) };
    })
    .filter((w): w is CaptionWord => w !== null);
  return words.length ? words : undefined;
}

export function deserializeCaptions(apiCaptions: Caption[]): CaptionSegment[] {
  return sortCaptions(
    apiCaptions.map((c) => {
      const { words, editor_version, ...meta } = (c.metadata ?? {}) as Record<string, unknown>;
      const legacy = !(Number(editor_version) >= EDITOR_SETTINGS_VERSION);
      const override = c.style_override ? sanitizeStyle(c.style_override, true, legacy) : null;
      const text = normalizeCaptionText(c.text ?? '');
      const start = Number(c.start_time) || 0;
      const end = Math.max(start + 0.1, Number(c.end_time) || start + 2);
      return {
        id: c.uuid || createId(),
        start,
        end,
        text,
        language: LANGS.includes(c.language as CaptionLanguage) ? (c.language as CaptionLanguage) : detectLanguage(text),
        words: toWords(words),
        styleOverride: override && Object.keys(override).length ? override : null,
        meta: Object.keys(meta).length ? meta : undefined,
      };
    })
  );
}

export function serializeCaptions(captions: CaptionSegment[]) {
  return captions.map((c, i) => ({
    uuid: c.id,
    sequence: i + 1,
    start_time: c.start,
    end_time: c.end,
    text: c.text.normalize('NFC'),
    language: c.language,
    style_override: c.styleOverride && Object.keys(c.styleOverride).length ? (c.styleOverride as Record<string, unknown>) : null,
    metadata: {
      ...(c.meta ?? {}),
      ...(c.words?.length ? { words: c.words } : {}),
      editor_version: EDITOR_SETTINGS_VERSION,
    },
  }));
}

export function serializeEditorSettings(doc: CaptionDocument) {
  return {
    version: EDITOR_SETTINGS_VERSION,
    style: doc.style,
    customPresets: doc.customPresets,
    canvas: doc.canvas,
  };
}

export function deserializeEditorSettings(settings: Record<string, unknown> | null | undefined): Omit<CaptionDocument, 'captions'> {
  const editor = (settings?.editor ?? null) as Record<string, unknown> | null;
  if (!editor || typeof editor !== 'object') {
    return { style: DEFAULT_STYLE, customPresets: [], canvas: { aspect: 'source' } };
  }
  const customPresets: CustomPreset[] = Array.isArray(editor.customPresets)
    ? (editor.customPresets as Array<Record<string, unknown>>)
        .filter((p) => p && typeof p.id === 'string')
        .map((p) => ({
          id: String(p.id),
          label: String(p.label ?? 'My style'),
          basePreset: String(p.basePreset ?? 'modern'),
          style: sanitizeStyle(p.style),
        }))
    : [];
  const canvas = (editor.canvas ?? {}) as Record<string, unknown>;
  return {
    style: sanitizeStyle(editor.style),
    customPresets,
    canvas: { aspect: ASPECTS.includes(canvas.aspect as CanvasAspect) ? (canvas.aspect as CanvasAspect) : 'source' },
  };
}
