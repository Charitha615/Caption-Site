import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ImportCaptionsDialog } from '../features/editor/components/dialogs/ImportCaptionsDialog';
import { useUIStore } from '../stores/editor/uiStore';
import { useEditorProjectStore } from '../stores/editor/editorProjectStore';
import { EMPTY_DOCUMENT, useCaptionStore } from '../stores/editor/captionStore';
import { useVideoStore } from '../stores/editor/videoStore';
import { captionsToSrt } from '../features/editor/utils/importCaptions';

const words = [{ text: 'හෙලෝ', start: 0.5, end: 1 }, { text: 'යාලුවනේ', start: 1, end: 2 }];

describe('Copy all captions → correct → paste back', () => {
  beforeEach(() => {
    useVideoStore.getState()._set({ duration: 30 });
    useCaptionStore.getState().load({
      ...EMPTY_DOCUMENT,
      captions: [
        { id: 'a', start: 0.5, end: 2, text: 'හෙලෝ යාලුවනේ', language: 'si', words },
        { id: 'b', start: 62.25, end: 3725.004, text: 'Toyota ඇක්වා', language: 'mixed' },
      ],
    });
    useEditorProjectStore.getState().setLoaded({ uuid: 'p1', name: 'P', duration: 30, settings: {}, isDemo: false, sourceWidth: 720, sourceHeight: 1280, hasServerVideo: true });
    useUIStore.getState().setImportOpen(true);
  });

  it('copies captions as SRT with their timings', () => {
    expect(captionsToSrt(useCaptionStore.getState().captions)).toBe(
      '1\n00:00:00,500 --> 00:00:02,000\nහෙලෝ යාලුවනේ\n\n2\n00:01:02,250 --> 01:02:05,004\nToyota ඇක්වා\n',
    );
  });

  it('pasting the corrected copy back updates only the text, keeping timing and word timings (undoable)', async () => {
    const corrected = captionsToSrt(useCaptionStore.getState().captions).replace('යාලුවනේ', 'යාළුවනේ').replace('ඇක්වා', 'Aqua');
    render(<ImportCaptionsDialog />);
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.paste(corrected);

    expect(screen.getByRole('checkbox', { name: /update text only/i })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Update 2 captions' }));

    const [a, b] = useCaptionStore.getState().captions;
    expect(a).toMatchObject({ id: 'a', start: 0.5, end: 2, text: 'හෙලෝ යාළුවනේ' });
    expect(a.words?.map((w) => [w.text, w.start])).toEqual([['හෙලෝ', 0.5], ['යාළුවනේ', 1]]);
    expect(b).toMatchObject({ id: 'b', start: 62.25, text: 'Toyota Aqua' });

    useCaptionStore.getState().undo();
    expect(useCaptionStore.getState().captions.map((c) => c.text)).toEqual(['හෙලෝ යාලුවනේ', 'Toyota ඇක්වා']);
  });
});
