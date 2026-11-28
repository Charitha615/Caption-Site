import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosave, memoryBackend } from '../features/videoEditor/autosave';
import type { MediaItem } from '../features/videoEditor/model';
import { useVideoEditorStore } from '../features/videoEditor/store';
import { packProjectFile, projectFileName, unpackProjectFile } from '../features/videoEditor/projects/projectFile';
import { matchFiles } from '../features/videoEditor/projects/relink';
import { currentLayout, toSavedProject } from '../features/videoEditor/projects/videoProjectService';

const store = () => useVideoEditorStore.getState();
const video: MediaItem = { id: 'm-vid', kind: 'video', name: 'trip.mp4', url: 'blob:trip', duration: 6, size: 11, thumb: 'data:image/jpeg;base64,AAAA', peaks: [0.1, 0.5], peaksPerSecond: 10 };
const music: MediaItem = { id: 'm-song', kind: 'audio', name: 'song.mp3', url: 'blob:song', duration: 30, size: 7 };
const blobOf = async (url: string) => new Blob([`bytes of ${url}`], { type: 'video/mp4' });

describe('Video editor projects', () => {
  let urls = 0;
  beforeEach(() => {
    store().reset();
    URL.createObjectURL = vi.fn(() => `blob:restored-${++urls}`);
    URL.revokeObjectURL = vi.fn();
  });

  it('packs a project file with its media and opens it again', async () => {
    store().setName('Ella: day 1');
    store().addMedia(video);
    store().addMediaClip('m-vid');
    store().addTextClip('Hello');
    store().setProjectUuid('online-1');

    const file = await packProjectFile(blobOf);
    const { project, files } = await unpackProjectFile(file);

    expect(project.name).toBe('Ella: day 1');
    expect(project.projectUuid).toBeNull(); // an opened file starts its own online copy
    expect(project.clips).toHaveLength(2);
    expect(await files.get('media:m-vid')!.text()).toBe('bytes of blob:trip');
    expect(projectFileName('Ella: day 1')).toBe('Ella- day 1.sinsub');
    await expect(unpackProjectFile(new Blob(['not a project']))).rejects.toThrow(/not a සිංSub video project file/);
  });

  it('opens a project whose files are not here as placeholders, and keeps files it shares with the open one', async () => {
    const backend = memoryBackend();
    const autosave = createAutosave(backend, { blobOf, delayMs: 0 });
    autosave.start();
    store().addMedia(video);
    store().addMedia(music);
    store().addMediaClip('m-vid');
    store().addMediaClip('m-song');
    await autosave.stop();

    // The online copy of a project using the same video but not the song.
    const online = toSavedProject({
      uuid: 'online-2', name: 'From the account', aspect: '9:16', duration: 6, clip_count: 1, thumb: null, created_at: null, updated_at: null,
      data: { version: 1, tracks: store().tracks, clips: store().clips.filter((c) => c.mediaId === 'm-vid'), media: [currentLayout().data.media[0]!], fonts: [], zoom: 60, snap: true },
    });
    online.media.push({ id: 'm-new', kind: 'video', name: 'beach.mp4', duration: 4 });
    online.clips.push({ ...online.clips[0]!, id: 'c-beach', mediaId: 'm-new', start: 6 });
    await autosave.load(online, new Map());

    expect(store().name).toBe('From the account');
    expect(store().projectUuid).toBe('online-2');
    expect(store().media.find((m) => m.id === 'm-vid')).toMatchObject({ missing: false });
    expect(store().media.find((m) => m.id === 'm-new')).toMatchObject({ missing: true, url: '' });
    expect(store().clips.map((c) => c.mediaId)).toEqual(['m-vid', 'm-new']); // its clip is kept
    expect([...backend.files.keys()]).toEqual(['media:m-vid']); // the song went, the shared video stayed

    store().addMediaClip('m-new');
    expect(store().clips).toHaveLength(2); // can't place a file that isn't here
  });

  it('saves only the layout to the account: no file contents, previews or waveforms', () => {
    store().addMedia(video);
    store().addMediaClip('m-vid');
    const { data, thumb } = currentLayout();

    expect(data.media[0]).toEqual({ id: 'm-vid', kind: 'video', name: 'trip.mp4', duration: 6, size: 11 });
    expect(thumb).toBe('data:image/jpeg;base64,AAAA');
  });

  it('matches picked files to missing media by name and size, then by kind', () => {
    const missing: MediaItem[] = [
      { ...video, url: '', missing: true },
      { ...music, url: '', missing: true },
      { id: 'm-logo', kind: 'image', name: 'logo.png', url: '', duration: 0, missing: true },
    ];
    const pick = (name: string, size: number, type: string) => new File(['x'.repeat(size)], name, { type });
    const pairs = matchFiles(missing, [pick('TRIP.mp4', 11, 'video/mp4'), pick('other-song.mp3', 7, 'audio/mpeg'), pick('logo.png', 3, 'image/png')]);

    expect(pairs.map((p) => [p.item.id, p.file.name])).toEqual([['m-vid', 'TRIP.mp4'], ['m-logo', 'logo.png'], ['m-song', 'other-song.mp3']]);
  });
});
