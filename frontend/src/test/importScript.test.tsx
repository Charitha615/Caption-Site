import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const captionApi = vi.hoisted(() => ({ alignScript: vi.fn() }));
vi.mock('../services/captionService', async (orig) => ({
  ...(await orig<typeof import('../services/captionService')>()),
  captionService: captionApi,
}));

import { ImportCaptionsDialog } from '../features/editor/components/dialogs/ImportCaptionsDialog';
import { useUIStore } from '../stores/editor/uiStore';
import { useEditorProjectStore } from '../stores/editor/editorProjectStore';
import { EMPTY_DOCUMENT, useCaptionStore } from '../stores/editor/captionStore';
import { useVideoStore } from '../stores/editor/videoStore';
import { enhanceTextForCaptions } from '../features/editor/utils/importCaptions';

describe('Import script → match speech', () => {
  beforeEach(() => {
    captionApi.alignScript.mockReset();
    useVideoStore.getState()._set({ duration: 30 });
    useCaptionStore.getState().load({ ...EMPTY_DOCUMENT, captions: [{ id: 'old', start: 0, end: 1, text: 'old caption', language: 'en' }] });
    useEditorProjectStore.getState().setLoaded({ uuid: 'p1', name: 'P', duration: 30, settings: {}, isDemo: false, sourceWidth: 720, sourceHeight: 1280, hasServerVideo: true });
    useUIStore.getState().setImportOpen(true);
  });

  it('matches the script to speech, previews it and imports with word timings (undoable)', async () => {
    captionApi.alignScript.mockResolvedValue({
      captions: [{ start_time: 2, end_time: 3.8, text: 'මේ තමයි Toyota Aqua.', language: 'si', words: [
        { word: 'මේ', start: 2, end: 2.4 }, { word: 'තමයි', start: 2.4, end: 2.9 }, { word: 'Toyota', start: 2.9, end: 3.4 }, { word: 'Aqua.', start: 3.4, end: 3.8 },
      ] }],
      stats: { script_words: 4, matched: 3, placed: 1 },
      english_applied: true,
    });
    render(<ImportCaptionsDialog />);

    await userEvent.type(screen.getByRole('textbox'), 'මේ තමයි ටොයොටා ඇක්වා.');
    expect(screen.getByRole('button', { name: /^Import\b/ })).toBeDisabled(); // must match speech first

    await userEvent.click(screen.getByRole('button', { name: /match script to speech/i }));

    await waitFor(() => expect(captionApi.alignScript).toHaveBeenCalledWith('p1', expect.stringContaining('Toyota Aqua'), true));
    expect(await screen.findByText(/3 of 4 words matched the speech/)).toBeInTheDocument();
    expect(screen.getByText('මේ තමයි Toyota Aqua.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^Import\b/ }));

    const captions = useCaptionStore.getState().captions;
    expect(captions).toHaveLength(1);
    expect(captions[0]).toMatchObject({ start: 2, end: 3.8, text: 'මේ තමයි Toyota Aqua.' });
    expect(captions[0].words?.map((w) => w.start)).toEqual([2, 2.4, 2.9, 3.4]);

    useCaptionStore.getState().undo();
    expect(useCaptionStore.getState().captions[0].text).toBe('old caption');
  });

  it('never turns part of a longer Sinhala word into English', () => {
    expect(enhanceTextForCaptions('කාර්යය සහ කාර් එක')).toBe('කාර්\u200Dයය සහ Car එක');
  });
});
