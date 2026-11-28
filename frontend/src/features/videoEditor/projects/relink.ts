import { PEAKS_PER_SECOND, computePeaks } from '../audio';
import { mediaKindOf, readMediaFile } from '../importMedia';
import type { MediaItem } from '../model';
import { useVideoEditorStore } from '../store';

/**
 * Which picked file is which missing media item: the same name (and size, when known) first; then,
 * when one file and one missing item of the same kind are left, those two.
 */
export function matchFiles(missing: MediaItem[], files: File[]): Array<{ item: MediaItem; file: File }> {
  const pairs: Array<{ item: MediaItem; file: File }> = [];
  const items = [...missing];
  const left = [...files];
  const take = (pred: (item: MediaItem, file: File) => boolean) => {
    for (const item of [...items]) {
      const i = left.findIndex((f) => pred(item, f));
      if (i >= 0) {
        pairs.push({ item, file: left[i]! });
        items.splice(items.indexOf(item), 1);
        left.splice(i, 1);
      }
    }
  };
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  take((item, f) => same(item.name, f.name) && (item.size === undefined || item.size === f.size));
  take((item, f) => same(item.name, f.name));
  for (const kind of ['video', 'audio', 'image'] as const) {
    const items1 = items.filter((m) => m.kind === kind);
    const files1 = left.filter((f) => mediaKindOf(f) === kind);
    if (items1.length === 1 && files1.length === 1) {
      pairs.push({ item: items1[0]!, file: files1[0]! });
      left.splice(left.indexOf(files1[0]!), 1);
    }
  }
  return pairs;
}

/** Gives missing media their files again. Resolves with how many were found, and the names still missing. */
export async function relinkFiles(files: File[]): Promise<{ found: number; stillMissing: string[] }> {
  const store = useVideoEditorStore.getState();
  const missing = store.media.filter((m) => m.missing);
  let found = 0;
  for (const { item, file } of matchFiles(missing, files)) {
    try {
      const fresh = await readMediaFile(file);
      // Keep the saved length so the clips on the timeline stay as they were.
      store.relinkMedia(item.id, { url: fresh.url, thumb: fresh.thumb, size: file.size, width: fresh.width ?? item.width, height: fresh.height ?? item.height });
      found++;
      if (item.kind !== 'image' && !item.peaks) {
        void computePeaks(file).then((peaks) => peaks && useVideoEditorStore.getState().setMediaPeaks(item.id, peaks, PEAKS_PER_SECOND));
      }
    } catch {
      /* not readable: stays missing */
    }
  }
  return { found, stillMissing: useVideoEditorStore.getState().media.filter((m) => m.missing).map((m) => m.name) };
}
