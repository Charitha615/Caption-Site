import { useState } from 'react';
import { useToastStore } from '../../stores/toastStore';
import { readMediaFile } from './importMedia';
import { useVideoEditorStore } from './store';

/** Imports dropped or picked files one by one, reporting files that can't be read. */
export function useImportFiles() {
  const addMedia = useVideoEditorStore((s) => s.addMedia);
  const addToast = useToastStore((s) => s.addToast);
  const [busy, setBusy] = useState(false);
  const importFiles = async (files: FileList | File[]) => {
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        try {
          addMedia(await readMediaFile(file));
        } catch (err) {
          addToast({ type: 'error', message: err instanceof Error ? err.message : `Could not import “${file.name}”.` });
        }
      }
    } finally {
      setBusy(false);
    }
  };
  return { importFiles, busy };
}
