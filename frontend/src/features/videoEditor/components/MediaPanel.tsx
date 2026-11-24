import { useRef, useState } from 'react';
import { Film, Image as ImageIcon, Music, Plus, Trash2, UploadCloud } from 'lucide-react';
import { ACCEPTED_MEDIA } from '../importMedia';
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
  const [over, setOver] = useState(false);

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
      <button
        type="button"
        className={`ve-dropzone ${over ? 'is-over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void importFiles(e.dataTransfer.files);
        }}
        disabled={busy}
      >
        <UploadCloud size={22} aria-hidden="true" />
        <strong>{busy ? 'Importing…' : 'Import media'}</strong>
        <span>Drop video, audio or images here, or click to browse</span>
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
                className="ve-media-item"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(MEDIA_DRAG_TYPE, item.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              >
                <span className="ve-media-thumb">
                  {item.thumb ? <img src={item.thumb} alt="" draggable={false} /> : <Icon size={22} aria-hidden="true" />}
                  {item.kind !== 'image' && <span className="ve-media-duration">{formatTime(item.duration, false)}</span>}
                </span>
                <span className="ve-media-name" title={item.name}>{item.name}</span>
                <span className="ve-media-actions">
                  <button type="button" className="ve-icon-btn is-solid" aria-label={`Add ${item.name} to the timeline`} title="Add to timeline" onClick={() => addMediaClip(item.id)}>
                    <Plus size={14} />
                  </button>
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
