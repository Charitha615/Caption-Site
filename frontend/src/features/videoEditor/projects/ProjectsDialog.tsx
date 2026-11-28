import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Cloud, CloudOff, Download, FileUp, Film, FolderOpen, HardDrive, Loader2, Trash2, X } from 'lucide-react';
import { formatTime } from '../model';
import { useVideoEditorStore } from '../store';
import { formatTimeAgo } from '../../../utils/formatters';
import { PROJECT_FILE_EXTENSION } from './projectFile';
import type { CloudStatus } from './useCloudSync';
import { videoProjectService, type OnlineProject } from './videoProjectService';

interface Props {
  onClose: () => void;
  cloud: CloudStatus;
  /** Opens a project saved to the account. */
  onOpenOnline: (uuid: string) => Promise<void>;
  /** Opens a downloaded project file. */
  onOpenFile: (file: File) => Promise<void>;
  /** Downloads the open video as a project file. */
  onDownload: () => Promise<void>;
  /** After deleting a project (room for the open video, if the plan was full). */
  onDeleted: () => void;
}

const CLOUD_TEXT: Record<CloudStatus, string> = {
  off: 'Saved to your account once you add something to the timeline.',
  saving: 'Saving to your account…',
  saved: 'Saved to your account: open it on any computer and pick the same files there.',
  error: 'Could not save to your account just now. It will try again after your next change.',
  full: 'Not saved to your account: your plan’s online projects are used up. Delete an old one below, or download a project file.',
};

/** Your videos: saved to the account (layout) and as downloadable project files (everything). */
export function ProjectsDialog({ onClose, cloud, onOpenOnline, onOpenFile, onDownload, onDeleted }: Props) {
  const currentUuid = useVideoEditorStore((s) => s.projectUuid);
  const hasClips = useVideoEditorStore((s) => s.clips.length > 0);
  const [projects, setProjects] = useState<OnlineProject[] | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'open' | 'delete'; uuid: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const load = () =>
    videoProjectService.list()
      .then((d) => { setProjects(d.projects); setLimit(d.limit); })
      .catch(() => setError('Could not load your saved videos.'));

  useEffect(() => {
    void load();
    dialogRef.current?.focus();
  }, []);

  /** Opening another video replaces the one in this browser; warn when it isn't kept anywhere else. */
  const unsafe = hasClips && cloud !== 'saved';

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  return (
    <div className="ve-modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div
        ref={dialogRef}
        className="ve-modal ve-projects"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ve-projects-title"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !busy) onClose();
          e.stopPropagation();
        }}
      >
        <div className="ve-modal-head">
          <h2 id="ve-projects-title">Projects</h2>
          <button type="button" className="ve-icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <section className="ve-projects-current" aria-label="This video">
          <p className="ve-projects-line"><HardDrive size={14} aria-hidden="true" /> Saved in this browser, with its files.</p>
          <p className={`ve-projects-line is-${cloud}`}>
            {cloud === 'saved' || cloud === 'saving' ? <Cloud size={14} aria-hidden="true" /> : <CloudOff size={14} aria-hidden="true" />} {CLOUD_TEXT[cloud]}
          </p>
          <div className="ve-modal-actions is-left">
            <button type="button" className="ve-secondary-btn" disabled={busy !== null || !hasClips} onClick={() => void run('download', onDownload)}>
              {busy === 'download' ? <Loader2 size={14} className="ve-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />} Download project file
            </button>
            <button type="button" className="ve-secondary-btn" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
              {busy === 'file' ? <Loader2 size={14} className="ve-spin" aria-hidden="true" /> : <FileUp size={14} aria-hidden="true" />} Open project file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={`${PROJECT_FILE_EXTENSION},application/octet-stream`}
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file && (!unsafe || window.confirm('Open this file? The video you have open now is not saved to your account and will be replaced.'))) {
                  void run('file', () => onOpenFile(file));
                }
              }}
            />
          </div>
          <p className="ve-panel-hint">A project file has everything, videos included: keep it as a backup or open it on another computer.</p>
        </section>

        <section aria-labelledby="ve-projects-list-title">
          <h3 id="ve-projects-list-title" className="ve-projects-h">
            Your videos {projects && limit !== null && <span className="ve-projects-count">{projects.length} of {limit}</span>}
          </h3>
          {error && <p className="ve-modal-error" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}
          {!projects && !error && <p className="ve-panel-hint"><Loader2 size={14} className="ve-spin" aria-hidden="true" /> Loading…</p>}
          {projects?.length === 0 && <p className="ve-panel-hint">No videos saved yet. Your video is saved here automatically once you start editing.</p>}
          <ul className="ve-projects-list">
            {projects?.map((p) => {
              const open = p.uuid === currentUuid;
              const confirming = confirm?.uuid === p.uuid ? confirm.kind : null;
              return (
                <li key={p.uuid} className={open ? 'is-open' : ''}>
                  <span className="ve-projects-thumb">{p.thumb ? <img src={p.thumb} alt="" /> : <Film size={18} aria-hidden="true" />}</span>
                  <span className="ve-projects-info">
                    <strong title={p.name}>{p.name}</strong>
                    <small>
                      {formatTime(p.duration, false)} · {p.clip_count} {p.clip_count === 1 ? 'clip' : 'clips'} · {p.aspect}
                      {p.updated_at && <> · edited {formatTimeAgo(p.updated_at)}</>}
                    </small>
                  </span>
                  {confirming === 'delete' ? (
                    <span className="ve-projects-confirm">
                      Delete?
                      <button type="button" className="ve-secondary-btn is-danger" disabled={busy !== null} onClick={() => void run(`del-${p.uuid}`, async () => {
                        await videoProjectService.remove(p.uuid);
                        if (open) useVideoEditorStore.getState().setProjectUuid(null);
                        await load();
                        onDeleted();
                      })}>Delete</button>
                      <button type="button" className="ve-secondary-btn" onClick={() => setConfirm(null)}>Keep</button>
                    </span>
                  ) : confirming === 'open' ? (
                    <span className="ve-projects-confirm">
                      Replace the open video?
                      <button type="button" className="ve-secondary-btn is-on" disabled={busy !== null} onClick={() => void run(`open-${p.uuid}`, () => onOpenOnline(p.uuid))}>Open</button>
                      <button type="button" className="ve-secondary-btn" onClick={() => setConfirm(null)}>Cancel</button>
                    </span>
                  ) : (
                    <span className="ve-projects-actions">
                      {open ? (
                        <span className="ve-projects-open-tag">Open now</span>
                      ) : (
                        <button
                          type="button"
                          className="ve-secondary-btn"
                          disabled={busy !== null}
                          onClick={() => (unsafe ? setConfirm({ kind: 'open', uuid: p.uuid }) : void run(`open-${p.uuid}`, () => onOpenOnline(p.uuid)))}
                        >
                          {busy === `open-${p.uuid}` ? <Loader2 size={14} className="ve-spin" aria-hidden="true" /> : <FolderOpen size={14} aria-hidden="true" />} Open
                        </button>
                      )}
                      <button type="button" className="ve-icon-btn" aria-label={`Delete ${p.name}`} title="Delete" disabled={busy !== null} onClick={() => setConfirm({ kind: 'delete', uuid: p.uuid })}>
                        <Trash2 size={14} />
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {cloud === 'full' && <p className="ve-panel-hint"><Link to="/billing">Pro</Link> keeps up to 200 videos online.</p>}
          <p className="ve-panel-hint">Only the edit (clips, text, effects) is saved to your account; your video files stay on your device. On another computer, pick the same files when asked.</p>
        </section>
      </div>
    </div>
  );
}
