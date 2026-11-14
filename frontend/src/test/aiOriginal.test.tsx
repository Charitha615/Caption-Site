import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiOriginal } from '../features/editor/components/inspector/AiOriginal';
import { EMPTY_DOCUMENT, useCaptionStore } from '../stores/editor/captionStore';
import { useVideoStore } from '../stores/editor/videoStore';
import { mergeCaptions, splitCaption } from '../features/editor/model/captionOps';
import { serializeCaptions } from '../features/editor/services/serialization';
import type { CaptionSegment } from '../features/editor/model/types';

const aiCaption = (text: string): CaptionSegment => ({
  id: 'c1', start: 0, end: 3, text, language: 'si',
  meta: { original_text: 'ආයුබෝවන් මිතුරනි', cleaned: true, source: { transcriber: 'gemini-transcribe', cleanup: 'gemini-3.8-flash' } },
});

describe('AI original transcription', () => {
  beforeEach(() => {
    useVideoStore.getState()._set({ duration: 30 });
    useCaptionStore.getState().load({ ...EMPTY_DOCUMENT, captions: [aiCaption('ආයුබෝවන්, මිතුරනි!')] });
  });

  it('labels AI captions for review and restores the original text', async () => {
    render(<AiOriginal caption={useCaptionStore.getState().captions[0]} />);

    expect(screen.getByRole('note')).toHaveTextContent(/please check/i);
    expect(screen.getByText('ආයුබෝවන් මිතුරනි')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /restore original/i }));

    expect(useCaptionStore.getState().captions[0].text).toBe('ආයුබෝවන් මිතුරනි');
  });

  it('keeps the original through autosave serialisation', () => {
    const [payload] = serializeCaptions(useCaptionStore.getState().captions);
    expect(payload.metadata).toMatchObject({ original_text: 'ආයුබෝවන් මිතුරනි', cleaned: true });
  });

  it('drops the per-caption original after split or merge (no longer 1:1)', () => {
    const [a, b] = splitCaption(aiCaption('ආයුබෝවන් මිතුරනි'), 1.5)!;
    expect(a.meta?.original_text).toBeUndefined();
    expect(b.meta?.source).toBeDefined();
    expect(mergeCaptions(aiCaption('a'), aiCaption('b')).meta?.original_text).toBeUndefined();
  });

  it('accepts mixed Sinhala-English captions in autosave', () => {
    const [payload] = serializeCaptions([{ ...aiCaption('මේක really හොඳයි'), language: 'mixed' }]);
    expect(payload.language).toBe('mixed');
  });
});
