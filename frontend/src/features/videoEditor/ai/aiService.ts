import axios from 'axios';
import { apiClient } from '../../../services/api';
import { toAppError } from '../../../services/errors';
import type { ApiResponse } from '../../../types/api';

/** Calls to the editor's AI endpoints. Errors are shown by the panels, so requests are silent. */

export type SpeechLanguage = 'si' | 'en' | 'mixed' | 'auto';
export type TextLanguage = 'si' | 'en' | 'ta';

export interface TranscribedWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscribedLine {
  start: number;
  end: number;
  text: string;
  language: string;
  words: TranscribedWord[];
}

export interface Moment {
  start: number;
  end: number;
  title: string;
  reason: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  gender: string | null;
}

/** AI Studio's prebuilt voices, shown until (or if) the live list can't be loaded. */
export const BUILT_IN_VOICES: VoiceOption[] = (
  [
    ['Zephyr', 'Bright'], ['Puck', 'Upbeat'], ['Charon', 'Informative'], ['Kore', 'Firm'], ['Fenrir', 'Excitable'], ['Leda', 'Youthful'],
    ['Orus', 'Firm'], ['Aoede', 'Breezy'], ['Callirrhoe', 'Easy-going'], ['Autonoe', 'Bright'], ['Enceladus', 'Breathy'], ['Iapetus', 'Clear'],
    ['Umbriel', 'Easy-going'], ['Algieba', 'Smooth'], ['Despina', 'Smooth'], ['Erinome', 'Clear'], ['Algenib', 'Gravelly'],
    ['Rasalgethi', 'Informative'], ['Laomedeia', 'Upbeat'], ['Achernar', 'Soft'], ['Alnilam', 'Firm'], ['Schedar', 'Even'], ['Gacrux', 'Mature'],
    ['Pulcherrima', 'Forward'], ['Achird', 'Friendly'], ['Zubenelgenubi', 'Casual'], ['Vindemiatrix', 'Gentle'], ['Sadachbia', 'Lively'],
    ['Sadaltager', 'Knowledgeable'], ['Sulafat', 'Warm'],
  ] as const
).map(([name, description]) => ({ id: name, name, description, gender: null }));

/** Ready-made speaking styles (sent as the style instruction; any text works). */
export const VOICE_STYLES = [
  'cheerful and friendly', 'warm and enthusiastic', 'calm and relaxed', 'excited and energetic', 'serious news anchor',
  'storytelling, slow and dramatic', 'professional narrator', 'soft and gentle', 'whispered urgently', 'sad and quiet',
];

/** Sound tags the speech model performs instead of reading out. */
export const VOICE_TAGS = ['<short pause>', '<long pause>', '<laugh>', '<sigh>', '<gasp>', '<breath>'];

const AI_TIMEOUT = 180_000;

export const aiService = {
  async transcribePart(wav: Blob, language: SpeechLanguage, part: number, leadIn: number, signal?: AbortSignal): Promise<TranscribedLine[]> {
    const form = new FormData();
    form.append('audio', wav, `part-${part}.wav`);
    form.append('language', language);
    form.append('part', String(part));
    form.append('lead_in', String(leadIn));
    const res = await apiClient.post<ApiResponse<{ lines: TranscribedLine[] }>>('/video-editor/ai/transcribe', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: AI_TIMEOUT,
      silent: true,
      signal,
    });
    return res.data.data?.lines ?? [];
  },

  async text(payload: Record<string, unknown>, signal?: AbortSignal): Promise<string[]> {
    const res = await apiClient.post<ApiResponse<{ lines: string[] }>>('/video-editor/ai/text', payload, { timeout: AI_TIMEOUT, silent: true, signal });
    return res.data.data?.lines ?? [];
  },

  singlishToSinhala: (lines: string[], signal?: AbortSignal) => aiService.text({ task: 'singlish', lines }, signal),
  translate: (lines: string[], to: TextLanguage, signal?: AbortSignal) => aiService.text({ task: 'translate', lines, to }, signal),
  script: (topic: string, language: TextLanguage, seconds: number, tone: string) => aiService.text({ task: 'script', topic, language, seconds, tone }),
  titles: (context: string, language: TextLanguage) => aiService.text({ task: 'titles', context, language }),

  async highlights(transcript: { start: number; end: number; text: string }[], count: number): Promise<Moment[]> {
    const res = await apiClient.post<ApiResponse<{ moments: Moment[] }>>('/video-editor/ai/text', { task: 'highlights', transcript, count }, { timeout: AI_TIMEOUT, silent: true });
    return res.data.data?.moments ?? [];
  },

  /**
   * Media from a TikTok link (without TikTok's watermark) or a direct file link, downloaded by the
   * server and returned as a file named like the original.
   */
  async importLink(url: string, onProgress: (loaded: number, total: number | null) => void, signal: AbortSignal): Promise<File> {
    const res = await apiClient.post<Blob>('/video-editor/import-link', { url, confirm_rights: true }, {
      responseType: 'blob',
      timeout: 15 * 60_000,
      silent: true,
      signal,
      onDownloadProgress: (e) => onProgress(e.loaded, e.total ?? null),
    });
    const disposition = String(res.headers['content-disposition'] ?? '');
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
    const plain = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
    const name = encoded ? decodeURIComponent(encoded) : plain ?? 'download.mp4';
    return new File([res.data], name, { type: res.data.type || String(res.headers['content-type'] ?? '') });
  },

  async voices(): Promise<VoiceOption[]> {
    const res = await apiClient.get<ApiResponse<{ voices: VoiceOption[] }>>('/video-editor/ai/voices', { silent: true });
    return res.data.data?.voices?.length ? res.data.data.voices : BUILT_IN_VOICES;
  },

  async speech(text: string, voice: string, style: string): Promise<Blob> {
    const res = await apiClient.post<Blob>('/video-editor/ai/speech', { text, voice, style }, { timeout: AI_TIMEOUT, silent: true, responseType: 'blob' });
    return res.data;
  },
};

/**
 * A message for the user. AI provider errors (502) carry a safe message of their own, and blob
 * requests (speech) return their error as a blob, so both are read here.
 */
export async function aiErrorMessage(err: unknown): Promise<string> {
  if (axios.isAxiosError(err) && err.response) {
    let data: unknown = err.response.data;
    if (data instanceof Blob) {
      try {
        data = JSON.parse(await data.text());
      } catch {
        data = {};
      }
    }
    const body = (data ?? {}) as { code?: string; message?: string; errors?: Record<string, string[]> };
    if (body.code === 'ai_provider_error' && body.message) return body.message;
    if (err.response.status < 500) {
      const field = Object.values(body.errors ?? {})[0]?.[0];
      if (field || body.message) return (field || body.message)!;
    }
  }
  if (err instanceof DOMException && err.name === 'AbortError') return 'Cancelled.';
  return toAppError(err).message;
}
