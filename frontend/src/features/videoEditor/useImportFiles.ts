import { useState } from 'react';
import { useToastStore } from '../../stores/toastStore';
import { PEAKS_PER_SECOND, computePeaks } from './audio';
import { readMediaFile } from './importMedia';
import { useVideoEditorStore } from './store';

/** Imports dropped or picked files one by one, reporting files that can't be read. */
export function useImportFiles() {
  const addMedia = useVideoEditorStore((s) => s.addMedia);
  const setMediaPeaks = useVideoEditorStore((s) => s.setMediaPeaks);
  const addToast = useToastStore((s) => s.addToast);
  const [busy, setBusy] = useState(false);
  /** Imports the files; resolves with the ids of the ones that worked, in order. */
  const importFiles = async (files: FileList | File[]): Promise<string[]> => {
    setBusy(true);
    const ids: string[] = [];
    try {
      for (const file of Array.from(files)) {
        try {
          const item = await readMediaFile(file);
          addMedia(item);
          ids.push(item.id);
          // The waveform is drawn once it's ready; editing doesn't wait for it.
          if (item.kind !== 'image') {
            void computePeaks(file).then((peaks) => peaks && setMediaPeaks(item.id, peaks, PEAKS_PER_SECOND));
          }
        } catch (err) {
          addToast({ type: 'error', message: err instanceof Error ? err.message : `Could not import “${file.name}”.` });
        }
      }
    } finally {
      setBusy(false);
    }
    return ids;
  };
  return { importFiles, busy };
}
