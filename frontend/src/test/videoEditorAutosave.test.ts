import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosave, memoryBackend } from '../features/videoEditor/autosave';
import type { MediaItem } from '../features/videoEditor/model';
import { useVideoEditorStore } from '../features/videoEditor/store';

const store = () => useVideoEditorStore.getState();
const video: MediaItem = { id: 'm-vid', kind: 'video', name: 'trip.mp4', url: 'blob:trip', duration: 6, width: 1280, height: 720 };
const music: MediaItem = { id: 'm-song', kind: 'audio', name: 'song.mp3', url: 'blob:song', duration: 30 };

describe('Video editor autosave', () => {
  let urls = 0;
  const fetched: string[] = [];
  const blobOf = async (url: string) => {
    fetched.push(url);
    return new Blob([`bytes of ${url}`], { type: 'video/mp4' });
  };

  beforeEach(() => {
    store().reset();
    fetched.length = 0;
    // jsdom has no object URLs.
    URL.createObjectURL = vi.fn(() => `blob:restored-${++urls}`);
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.useRealTimers());

  it('saves the timeline and the media files, and reopens them after a reload', async () => {
    const backend = memoryBackend();
    const autosave = createAutosave(backend, { blobOf, delayMs: 0 });
    autosave.start();
    store().setName('Trip to Ella');
    store().addMedia(video);
    store().addMediaClip('m-vid');
    store().addTextClip('Hello', { fontSize: 80 });
    await autosave.stop();

    expect(backend.project?.name).toBe('Trip to Ella');
    expect(backend.project?.media[0]).not.toHaveProperty('url');
    expect([...backend.files.keys()]).toEqual(['media:m-vid']);

    // A later visit: a fresh editor, then the saved project comes back.
    store().reset();
    expect(await createAutosave(backend, { blobOf }).restore()).toBe(true);
    expect(store().name).toBe('Trip to Ella');
    expect(store().media).toEqual([{ ...video, url: expect.stringMatching(/^blob:restored-/), missing: false }]);
    expect(store().clips.map((c) => c.kind).sort()).toEqual(['text', 'video']);
    expect(store().past).toEqual([]);
  });

  it('writes each file once, and deletes the file of media taken out of the project', async () => {
    const backend = memoryBackend();
    const autosave = createAutosave(backend, { blobOf, delayMs: 0 });
    autosave.start();
    store().addMedia(video);
    store().addMedia(music);
    await autosave.flush();
    store().setName('Renamed');
    await autosave.flush();
    expect(fetched).toEqual(['blob:trip', 'blob:song']);

    store().removeMedia('m-song');
    await autosave.stop();
    expect([...backend.files.keys()]).toEqual(['media:m-vid']);
    expect(backend.project?.media.map((m) => m.id)).toEqual(['m-vid']);
  });

  it('waits for a pause in editing before saving', async () => {
    vi.useFakeTimers();
    const backend = memoryBackend();
    const statuses: string[] = [];
    const autosave = createAutosave(backend, { blobOf, delayMs: 800, onStatus: (s) => statuses.push(s) });
    autosave.start();
    store().setName('One');
    store().setName('Two');
    expect(backend.project).toBeNull();
    await vi.advanceTimersByTimeAsync(800);
    expect(backend.project?.name).toBe('Two');
    expect(statuses.at(-1)).toBe('saved');
  });

  it('keeps media whose file is gone as a placeholder to find again, with its clips', async () => {
    const backend = memoryBackend();
    const autosave = createAutosave(backend, { blobOf, delayMs: 0 });
    autosave.start();
    store().addMedia(video);
    store().addMediaClip('m-vid');
    store().addTextClip('Still here');
    await autosave.stop();
    backend.files.delete('media:m-vid');

    store().reset();
    await createAutosave(backend, { blobOf }).restore();
    expect(store().media).toEqual([{ ...video, url: '', missing: true }]);
    expect(store().clips.map((c) => c.kind).sort()).toEqual(['text', 'video']);
  });

  it('starts empty after "New video"', async () => {
    const backend = memoryBackend();
    const autosave = createAutosave(backend, { blobOf, delayMs: 0 });
    autosave.start();
    store().addMedia(video);
    await autosave.stop();
    await autosave.clear();
    expect(backend.project).toBeNull();
    expect(backend.files.size).toBe(0);
    expect(await createAutosave(backend, { blobOf }).restore()).toBe(false);
  });
});
