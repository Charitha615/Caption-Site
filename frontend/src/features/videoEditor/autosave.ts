/**
 * Autosave for the video editor, kept in this browser (IndexedDB): the timeline, the project
 * settings, and the media and font files themselves, so the last video reopens after a reload or
 * a later visit. Nothing is uploaded.
 *
 * Files are written once, when they first appear in the project, and deleted when they leave it;
 * the timeline is rewritten (debounced) after every change.
 */
import { customFontFile, restoreFont, type CustomFont } from './customFonts';
import type { AspectRatio, Clip, MediaItem, Track } from './model';
import { useVideoEditorStore } from './store';

export interface SavedProject {
  version: 1;
  savedAt: number;
  name: string;
  aspect: AspectRatio;
  tracks: Track[];
  clips: Clip[];
  /** Media without its object URL (rebuilt from the saved file). */
  media: Omit<MediaItem, 'url'>[];
  fonts: CustomFont[];
  zoom: number;
  snap: boolean;
}

/** Where the project and its files are kept. IndexedDB in the browser; an in-memory copy in tests. */
export interface AutosaveBackend {
  loadProject(): Promise<SavedProject | null>;
  saveProject(project: SavedProject): Promise<void>;
  loadFile(key: string): Promise<Blob | null>;
  saveFile(key: string, data: Blob): Promise<void>;
  deleteFile(key: string): Promise<void>;
  fileKeys(): Promise<string[]>;
  clear(): Promise<void>;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const mediaKey = (id: string) => `media:${id}`;
const fontKey = (id: string) => `font:${id}`;

/* ------------------------------------------------------------ IndexedDB */

const DB_NAME = 've-autosave';
const PROJECT_STORE = 'project';
const FILE_STORE = 'files';
const PROJECT_KEY = 'current';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PROJECT_STORE);
      req.result.createObjectStore(FILE_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

async function store(name: string, mode: IDBTransactionMode) {
  return (await openDb()).transaction(name, mode).objectStore(name);
}

export const indexedDbBackend: AutosaveBackend = {
  loadProject: async () => ((await request((await store(PROJECT_STORE, 'readonly')).get(PROJECT_KEY))) as SavedProject | undefined) ?? null,
  saveProject: async (project) => void (await request((await store(PROJECT_STORE, 'readwrite')).put(project, PROJECT_KEY))),
  loadFile: async (key) => ((await request((await store(FILE_STORE, 'readonly')).get(key))) as Blob | undefined) ?? null,
  saveFile: async (key, data) => void (await request((await store(FILE_STORE, 'readwrite')).put(data, key))),
  deleteFile: async (key) => void (await request((await store(FILE_STORE, 'readwrite')).delete(key))),
  fileKeys: async () => (await request((await store(FILE_STORE, 'readonly')).getAllKeys())).map(String),
  clear: async () => {
    await request((await store(PROJECT_STORE, 'readwrite')).clear());
    await request((await store(FILE_STORE, 'readwrite')).clear());
  },
};

export const autosaveSupported = () => typeof indexedDB !== 'undefined';

/* ------------------------------------------------------------ controller */

interface AutosaveOptions {
  /** Reads a media item's file from its object URL. */
  blobOf?: (url: string) => Promise<Blob>;
  delayMs?: number;
  onStatus?: (status: SaveStatus) => void;
}

/** The parts of the editor state that are saved: a change to any of them schedules a save. */
const savedSlice = (s: ReturnType<typeof useVideoEditorStore.getState>) => [s.name, s.aspect, s.tracks, s.clips, s.media, s.fonts, s.snap] as const;

export function createAutosave(backend: AutosaveBackend, options: AutosaveOptions = {}) {
  const blobOf = options.blobOf ?? (async (url: string) => (await fetch(url)).blob());
  const delay = options.delayMs ?? 800;
  const status = (s: SaveStatus) => options.onStatus?.(s);
  /** File keys known to be in storage. */
  let stored: Set<string> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;
  let running: Promise<void> = Promise.resolve();
  let dirty = false;

  const writeNow = async () => {
    dirty = false;
    const s = useVideoEditorStore.getState();
    stored ??= new Set(await backend.fileKeys());
    const wanted = new Set<string>();
    for (const item of s.media) {
      const key = mediaKey(item.id);
      wanted.add(key);
      if (!stored.has(key)) {
        await backend.saveFile(key, await blobOf(item.url));
        stored.add(key);
      }
    }
    for (const font of s.fonts) {
      const key = fontKey(font.id);
      const file = customFontFile(font.id);
      if (!file) continue;
      wanted.add(key);
      if (!stored.has(key)) {
        await backend.saveFile(key, file);
        stored.add(key);
      }
    }
    await backend.saveProject({
      version: 1,
      savedAt: Date.now(),
      name: s.name,
      aspect: s.aspect,
      tracks: s.tracks,
      clips: s.clips,
      media: s.media.map(({ url: _url, ...rest }) => rest),
      fonts: s.fonts,
      zoom: s.zoom,
      snap: s.snap,
    });
    // Files of media taken out of the project go after the project stops pointing at them.
    for (const key of [...stored]) {
      if (!wanted.has(key)) {
        await backend.deleteFile(key);
        stored.delete(key);
      }
    }
  };

  /** Saves now (after any save already running). */
  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    running = running.then(async () => {
      status('saving');
      try {
        await writeNow();
        status(dirty ? 'saving' : 'saved');
      } catch (err) {
        console.warn('Video editor autosave failed', err);
        status('error');
      }
    });
    return running;
  };

  const schedule = () => {
    dirty = true;
    status('saving');
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), delay);
  };

  return {
    /**
     * Loads the saved project into the editor. Media whose file is missing is left out, with its clips.
     * Resolves with whether there was a project to restore.
     */
    async restore(): Promise<boolean> {
      const saved = await backend.loadProject();
      if (!saved || saved.version !== 1) return false;
      const media: MediaItem[] = [];
      for (const item of saved.media) {
        const file = await backend.loadFile(mediaKey(item.id));
        if (file) media.push({ ...item, url: URL.createObjectURL(file) });
      }
      const fonts: CustomFont[] = [];
      for (const font of saved.fonts) {
        const file = await backend.loadFile(fontKey(font.id));
        if (file && (await restoreFont(font, file))) fonts.push(font);
      }
      const have = new Set(media.map((m) => m.id));
      useVideoEditorStore.setState({
        name: saved.name,
        aspect: saved.aspect,
        tracks: saved.tracks,
        clips: saved.clips.filter((c) => !c.mediaId || have.has(c.mediaId)),
        media,
        fonts,
        zoom: saved.zoom,
        snap: saved.snap,
        playhead: 0,
        playing: false,
        selectedId: null,
        selectedIds: [],
        past: [],
        future: [],
      });
      return true;
    },
    /** Starts saving after every change. */
    start() {
      unsubscribe?.();
      let last = savedSlice(useVideoEditorStore.getState());
      unsubscribe = useVideoEditorStore.subscribe((s) => {
        const next = savedSlice(s);
        if (next.some((v, i) => v !== last[i])) {
          last = next;
          schedule();
        }
      });
    },
    /** Stops watching; a pending save is written first. */
    async stop() {
      unsubscribe?.();
      unsubscribe = null;
      if (timer || dirty) await flush();
      else await running;
    },
    flush,
    /** Forgets the saved project (for "New video"). Call `stop` first. */
    async clear() {
      await running;
      if (timer) clearTimeout(timer);
      timer = null;
      dirty = false;
      await backend.clear();
      stored = new Set();
      status('idle');
    },
  };
}

export type Autosave = ReturnType<typeof createAutosave>;

/** An in-memory backend, for tests. */
export function memoryBackend(): AutosaveBackend & { files: Map<string, Blob>; project: SavedProject | null } {
  const self = {
    files: new Map<string, Blob>(),
    project: null as SavedProject | null,
    loadProject: async () => (self.project ? structuredClone(self.project) : null),
    saveProject: async (p: SavedProject) => {
      self.project = structuredClone(p);
    },
    loadFile: async (key: string) => self.files.get(key) ?? null,
    saveFile: async (key: string, data: Blob) => void self.files.set(key, data),
    deleteFile: async (key: string) => void self.files.delete(key),
    fileKeys: async () => [...self.files.keys()],
    clear: async () => {
      self.files.clear();
      self.project = null;
    },
  };
  return self;
}
