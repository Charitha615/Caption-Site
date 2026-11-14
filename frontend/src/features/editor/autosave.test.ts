import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sync = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
vi.mock('../../services/captionService', () => ({ captionService: { syncCaptions: sync } }));
vi.mock('../../services/projectService', () => ({ projectService: { updateProject: update } }));

import { EMPTY_DOCUMENT, useCaptionStore } from '../../stores/editor/captionStore';
import { useEditorProjectStore } from '../../stores/editor/editorProjectStore';
import { useVideoStore } from '../../stores/editor/videoStore';
import { flush, startAutosave, stopAutosave } from './services/autosave';

describe('autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sync.mockReset().mockResolvedValue({ captions: [], count: 1 });
    update.mockReset().mockResolvedValue({});
    useVideoStore.getState()._set({ duration: 30 });
    useCaptionStore.getState().load({ ...EMPTY_DOCUMENT, captions: [{ id: 'c1', start: 0, end: 2, text: 'hello', language: 'en' }] });
    useEditorProjectStore.getState().setLoaded({ uuid: 'p1', name: 'P', duration: 30, settings: {}, isDemo: false, sourceWidth: 1920, sourceHeight: 1080, hasServerVideo: true });
    startAutosave();
  });

  afterEach(() => {
    stopAutosave();
    vi.useRealTimers();
  });

  it('debounces typing into a single silent save', async () => {
    const store = useCaptionStore.getState();
    store.updateText('c1', 'h');
    store.updateText('c1', 'he');
    store.updateText('c1', 'hey');
    expect(useEditorProjectStore.getState().saveStatus).toBe('unsaved');
    expect(sync).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync.mock.calls[0][1][0].text).toBe('hey');
    expect(sync.mock.calls[0][2]).toMatchObject({ silent: true, confirmEmpty: false });
    expect(update).not.toHaveBeenCalled(); // style untouched → no settings PATCH
    expect(useEditorProjectStore.getState().saveStatus).toBe('saved');
  });

  it('reports a failed save and retries later', async () => {
    sync.mockRejectedValueOnce(new Error('offline'));
    useCaptionStore.getState().updateText('c1', 'retry me');

    await flush();
    expect(useEditorProjectStore.getState().saveStatus).toBe('failed');

    await vi.advanceTimersByTimeAsync(3500);
    expect(sync).toHaveBeenCalledTimes(2);
    expect(useEditorProjectStore.getState().saveStatus).toBe('saved');
  });
});

describe('autosave never wipes captions while a project is loading', () => {
  beforeEach(() => {
    sync.mockReset().mockResolvedValue({ captions: [], count: 0 });
    update.mockReset().mockResolvedValue({});
  });

  it('does not sync the empty placeholder document of a project that is still loading', async () => {
    // Session 1: a project with captions was open and saved.
    useCaptionStore.getState().load({ ...EMPTY_DOCUMENT, captions: [{ id: 'c1', start: 0, end: 2, text: 'hello', language: 'en' }] });
    useEditorProjectStore.getState().setLoaded({ uuid: 'p1', name: 'P', duration: 30, settings: {}, isDemo: false, sourceWidth: 1920, sourceHeight: 1080, hasServerVideo: true });
    startAutosave();

    // Opening (another or the same) project: stores reset to an empty doc while captions load…
    stopAutosave();
    useCaptionStore.getState().load(EMPTY_DOCUMENT);
    useEditorProjectStore.getState().setLoading('p2');

    // …and something flushes in that window (leaving the editor, StrictMode remount).
    await flush();

    expect(sync).not.toHaveBeenCalled();
  });
});
