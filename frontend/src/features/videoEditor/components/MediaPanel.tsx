import { useRef, useState } from 'react';
import { AudioLines, Film, Image as ImageIcon, Loader2, Music, Plus, Trash2, UploadCloud } from 'lucide-react';
import { useToastStore } from '../../../stores/toastStore';
import { extractAudioWav } from '../audio';
import { ACCEPTED_MEDIA } from '../importMedia';
import { downloadBlob } from '../sources';
import { useImportFiles } from '../useImportFiles';
import { formatTime } from '../model';
import { useVideoEditorStore } from '../store';
import { MEDIA_DRAG_TYPE } from './Timeline';

const KIND_ICON = { video: Film, audio: Music, image: ImageIcon } as const;

export function MediaPanel() {
  const media = useVideoEditorStore((s) => s.media);
  const { addMediaClip, removeMedia } = useVideoEditorStore.getState();
  const inputRef = useRef<HTMLInputElement>(null);
  const { importFiles, busy } = useImportFiles();
  const [extracting, setExtracting] = useState<string | null>(null);
  const addToast = useToastStore((s) => s.addToast);

  const saveAudio = async (id: string, url: string, name: string) => {
    setExtracting(id);
    try {
      downloadBlob(await extractAudioWav(url), `${name.replace(/\.[^.]+$/, '')}.wav`);
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not extract the sound.' });
    } finally {
      setExtracting(null);
    }
  };

  return (
    <div className="ve-panel">
      <h2 className="ve-panel-title">Your media</h2>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MEDIA}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void importFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {/* Drops anywhere in the editor are handled by the page, so this box only opens the file picker. */}
      <button type="button" className="ve-dropzone" onClick={() => inputRef.current?.click()} disabled={busy}>
        <UploadCloud size={22} aria-hidden="true" />
        <strong>{busy ? 'Importing…' : 'Import media'}</strong>
        <span>Drop files anywhere in the editor, or click to browse</span>
      </button>

      {media.length === 0 ? (
        <p className="ve-panel-hint">Files stay on this computer while you edit. Nothing is uploaded yet.</p>
      ) : (
        <ul className="ve-media-grid">
          {media.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <li
                key={item.id}
                className={`ve-media-item ${item.missing ? 'is-missing' : ''}`}
                title={item.missing ? 'This file is not on this device yet. Use “Find files”.' : undefined}
                draggable={!item.missing}
                onDragStart={(e) => {
                  e.dataTransfer.setData(MEDIA_DRAG_TYPE, item.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              >
                <span className="ve-media-thumb">
                  {item.thumb ? <img src={item.thumb} alt="" draggable={false} /> : <Icon size={22} aria-hidden="true" />}
                  {item.kind !== 'image' && <span className="ve-media-duration">{formatTime(item.duration, false)}</span>}
                </span>
                <span className="ve-media-name" title={item.name}>{item.name}{item.missing && <span className="ve-missing-tag">Not on this device</span>}</span>
                <span className="ve-media-actions">
                  <button type="button" className="ve-icon-btn is-solid" aria-label={`Add ${item.name} to the timeline`} title="Add to timeline" disabled={item.missing} onClick={() => addMediaClip(item.id)}>
                    <Plus size={14} />
                  </button>
                  {item.kind === 'video' && !item.missing && (
                    <button
                      type="button"
                      className="ve-icon-btn is-solid"
                      aria-label={`Save the sound of ${item.name} as WAV`}
                      title="Save audio as WAV"
                      disabled={extracting !== null}
                      onClick={() => void saveAudio(item.id, item.url, item.name)}
                    >
                      {extracting === item.id ? <Loader2 size={14} className="ve-spin" /> : <AudioLines size={14} />}
                    </button>
                  )}
                  <button type="button" className="ve-icon-btn is-solid" aria-label={`Remove ${item.name}`} title="Remove from project" onClick={() => removeMedia(item.id)}>
                    <Trash2 size={14} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
