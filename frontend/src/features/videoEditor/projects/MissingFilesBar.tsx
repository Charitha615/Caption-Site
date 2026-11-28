import { useRef, useState } from 'react';
import { FileSearch, Loader2 } from 'lucide-react';
import { useToastStore } from '../../../stores/toastStore';
import { ACCEPTED_MEDIA } from '../importMedia';
import { useVideoEditorStore } from '../store';
import { relinkFiles } from './relink';

/** "These files aren't on this device": pick them to bring the project back to life. */
export function MissingFilesBar() {
  const media = useVideoEditorStore((s) => s.media);
  const missing = media.filter((m) => m.missing);
  const addToast = useToastStore((s) => s.addToast);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (missing.length === 0) return null;

  const onFiles = async (files: FileList) => {
    setBusy(true);
    try {
      const { found, stillMissing } = await relinkFiles(Array.from(files));
      if (found === 0) addToast({ type: 'error', message: 'None of those files match. Pick the files with the same names.' });
      else if (stillMissing.length > 0) addToast({ type: 'info', message: `Found ${found}. Still missing: ${stillMissing.join(', ')}.` });
      else addToast({ type: 'success', message: 'All files found.' });
    } finally {
      setBusy(false);
    }
  };

  const names = missing.slice(0, 3).map((m) => m.name).join(', ') + (missing.length > 3 ? ` and ${missing.length - 3} more` : '');
  return (
    <div className="ve-missing-bar" role="status">
      <FileSearch size={16} aria-hidden="true" />
      <span>
        <strong>{missing.length === 1 ? '1 file is' : `${missing.length} files are`} not on this device:</strong> {names}. Pick them to continue editing.
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MEDIA}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <button type="button" className="ve-secondary-btn" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 size={14} className="ve-spin" aria-hidden="true" /> : null} Find files
      </button>
    </div>
  );
}
