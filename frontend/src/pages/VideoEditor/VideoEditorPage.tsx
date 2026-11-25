import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, AlignHorizontalJustifyStart, ArrowLeft, Check, CloudOff, FilePlus2, Loader2, AudioLines, Bot, Captions, Camera, Copy, Download, FolderOpen, Magnet, Maximize2, Pause, Play, Redo2, Scissors,
  Shapes, SkipBack, Sparkles, Trash2, Type, Undo2, Unlink, UploadCloud, ZoomIn, ZoomOut,
} from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { useToastStore } from '../../stores/toastStore';
import { autosaveSupported, createAutosave, indexedDbBackend, type Autosave, type SaveStatus } from '../../features/videoEditor/autosave';
import { ASPECTS, formatTime, type AspectRatio } from '../../features/videoEditor/model';
import { totalDuration, useVideoEditorStore } from '../../features/videoEditor/store';
import { Preview } from '../../features/videoEditor/components/Preview';
import { Timeline } from '../../features/videoEditor/components/Timeline';
import { MediaPanel } from '../../features/videoEditor/components/MediaPanel';
import { ElementsPanel, FiltersPanel, TextPanel } from '../../features/videoEditor/components/LibraryPanels';
import { Inspector } from '../../features/videoEditor/components/Inspector';
import { AudioPanel } from '../../features/videoEditor/components/AudioPanel';
import { SubtitlesPanel } from '../../features/videoEditor/components/SubtitlesPanel';
import { AiToolsPanel } from '../../features/videoEditor/components/AiToolsPanel';
import { ExportDialog } from '../../features/videoEditor/components/ExportDialog';
import { drawFrame, frameSize } from '../../features/videoEditor/render';
import { downloadBlob, fileBase, previewLookup } from '../../features/videoEditor/sources';
import { useImportFiles } from '../../features/videoEditor/useImportFiles';
import '../../features/videoEditor/videoEditor.css';

type Tab = 'media' | 'subtitles' | 'text' | 'audio' | 'ai' | 'elements' | 'filters';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'media', label: 'Media', icon: <FolderOpen size={18} aria-hidden="true" /> },
  { id: 'subtitles', label: 'Subtitles', icon: <Captions size={18} aria-hidden="true" /> },
  { id: 'text', label: 'Text', icon: <Type size={18} aria-hidden="true" /> },
  { id: 'audio', label: 'Audio', icon: <AudioLines size={18} aria-hidden="true" /> },
  { id: 'ai', label: 'AI tools', icon: <Bot size={18} aria-hidden="true" /> },
  { id: 'elements', label: 'Elements', icon: <Shapes size={18} aria-hidden="true" /> },
  { id: 'filters', label: 'Filters', icon: <Sparkles size={18} aria-hidden="true" /> },
];

/** Saves the frame under the playhead as a full-size PNG (uses the preview's decoded sources). */
function saveFrame() {
  const s = useVideoEditorStore.getState();
  const { width, height } = frameSize(s.aspect, 1080);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawFrame(ctx, width, height, s.playhead, s, previewLookup(new Map(s.media.map((m) => [m.id, m.url]))));
  canvas.toBlob((blob) => blob && downloadBlob(blob, `${fileBase(s.name)}-${formatTime(s.playhead, false).replace(':', '-')}.png`), 'image/png');
}

/** Moves the playhead while playing, and stops at the end of the video. */
function usePlayback() {
  const playing = useVideoEditorStore((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const { playhead, clips, setPlayhead, setPlaying } = useVideoEditorStore.getState();
      const end = totalDuration(clips);
      const next = playhead + (now - last) / 1000;
      last = now;
      if (next >= end) {
        setPlayhead(end);
        setPlaying(false);
        return;
      }
      setPlayhead(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}

/** Input types that don't take typed text, so editor shortcuts still work while they have focus. */
const NON_TEXT_INPUTS = ['checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'file'];

/** Whether a key press is typing into a field (then shortcuts like Delete leave it alone). */
const isTyping = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLInputElement) return !target.disabled && !NON_TEXT_INPUTS.includes(target.type);
  return (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) && !target.disabled;
};

function useShortcuts() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const s = useVideoEditorStore.getState();
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) s.redo();
        else s.undo();
      } else if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        s.redo();
      } else if (mod && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        s.selectMany(s.clips.map((c) => c.id));
      } else if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        s.duplicateSelected();
      } else if (mod) {
        return;
      } else if (event.key === ' ' || event.key === 'k') {
        event.preventDefault();
        togglePlay();
      } else if (event.key === 's') {
        s.splitAtPlayhead();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        if (event.shiftKey) s.rippleDeleteSelected();
        else s.deleteSelected();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const stepBy = event.shiftKey ? 1 : 1 / 30;
        s.setPlayhead(s.playhead + (event.key === 'ArrowLeft' ? -stepBy : stepBy));
      } else if (event.key === 'Home') {
        s.setPlayhead(0);
      } else if (event.key === 'Escape') {
        s.select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Each editor visit gets a number, so a late clean-up from an earlier visit doesn't clear a newer one. */
let editorVisit = 0;

/**
 * Reopens the last video saved in this browser and keeps saving it. Resolves `ready` once the saved
 * project is loaded, so nothing is imported into the editor before that.
 */
function useEditorAutosave() {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [ready, setReady] = useState(false);
  const ref = useRef<Autosave | null>(null);

  useEffect(() => {
    const visit = ++editorVisit;
    const { reset } = useVideoEditorStore.getState();
    if (!autosaveSupported()) {
      setReady(true);
      return () => reset();
    }
    const autosave = createAutosave(indexedDbBackend, { onStatus: setStatus });
    ref.current = autosave;
    let cancelled = false;
    // Asks the browser not to clear the saved files when space runs low (it may say no).
    void navigator.storage?.persist?.().catch(() => undefined);
    autosave
      .restore()
      .then((found) => {
        if (found && !cancelled) {
          setStatus('saved');
          useToastStore.getState().addToast({ type: 'info', message: 'Opened your last video. It is saved in this browser.' });
        }
      })
      .catch((err) => console.warn('Could not open the saved video', err))
      .finally(() => {
        if (cancelled) return;
        autosave.start();
        setReady(true);
      });
    // Write straight away when the tab is hidden or closed.
    const onHide = () => document.visibilityState === 'hidden' && void autosave.flush();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onHide);
      // The last change is written before the project's files are let go.
      void autosave.stop().finally(() => {
        if (editorVisit === visit) reset();
      });
    };
  }, []);

  /** Starts an empty video and forgets the saved one. */
  const startNew = async () => {
    const autosave = ref.current;
    if (autosave) {
      await autosave.stop();
      await autosave.clear();
    }
    useVideoEditorStore.getState().reset();
    autosave?.start();
  };

  return { status, ready, startNew };
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  const info: Record<Exclude<SaveStatus, 'idle'>, { icon: React.ReactNode; text: string; title: string }> = {
    saving: { icon: <Loader2 size={13} className="ve-spin" />, text: 'Saving…', title: 'Saving in this browser' },
    saved: { icon: <Check size={13} />, text: 'Saved', title: 'Saved in this browser. It reopens here next time.' },
    error: { icon: <AlertTriangle size={13} />, text: 'Not saved', title: 'Could not save in this browser (storage may be full). Export to keep your video.' },
  };
  const { icon, text, title } = info[status];
  return <span className={`ve-save is-${status}`} title={title} role="status">{icon} {text}</span>;
}

function togglePlay() {
  const s = useVideoEditorStore.getState();
  const end = totalDuration(s.clips);
  if (end === 0) return;
  if (!s.playing && s.playhead >= end - 0.01) s.setPlayhead(0);
  s.setPlaying(!s.playing);
}

function Editor() {
  useDocumentTitle('Video editor');
  usePlayback();
  useShortcuts();
  const { status: saveStatus, ready, startNew } = useEditorAutosave();
  const [confirmNew, setConfirmNew] = useState(false);
  const [tab, setTab] = useState<Tab>('media');
  const [exporting, setExporting] = useState(false);
  const snap = useVideoEditorStore((s) => s.snap);
  const name = useVideoEditorStore((s) => s.name);
  const aspect = useVideoEditorStore((s) => s.aspect);
  const playing = useVideoEditorStore((s) => s.playing);
  const playhead = useVideoEditorStore((s) => s.playhead);
  const zoom = useVideoEditorStore((s) => s.zoom);
  const total = useVideoEditorStore((s) => totalDuration(s.clips));
  const canUndo = useVideoEditorStore((s) => s.past.length > 0);
  const canRedo = useVideoEditorStore((s) => s.future.length > 0);
  const hasSelection = useVideoEditorStore((s) => s.selectedId !== null);
  const {
    setName, setAspect, undo, redo, splitAtPlayhead, deleteSelected, rippleDeleteSelected, duplicateSelected, closeGaps, toggleSnap,
    setZoom, setPlayhead,
  } = useVideoEditorStore.getState();
  // Zoom so the whole video fits the visible timeline.
  const zoomToFit = () => setZoom(((window.innerWidth - 190) / Math.max(total, 5)) * 0.92);
  const { importFiles } = useImportFiles();
  // Files dragged from the computer can be dropped anywhere in the editor.
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');


  return (
    <div
      className="ve editor-theme"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        dragDepth.current++;
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault();
      }}
      onDrop={(e) => {
        dragDepth.current = 0;
        setDragging(false);
        // A drop on a timeline track has already been placed there.
        if (e.defaultPrevented || e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        void importFiles(e.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="ve-drop-overlay" aria-hidden="true">
          <div>
            <UploadCloud size={40} />
            <strong>Drop to import</strong>
            <span>Drop on a timeline track to place it there too</span>
          </div>
        </div>
      )}
      <header className="ve-topbar">
        <Link to="/dashboard" className="ve-back" aria-label="Back to dashboard"><ArrowLeft size={18} /></Link>
        <input className="ve-name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Video name" />
        {autosaveSupported() ? <SaveBadge status={saveStatus} /> : <span className="ve-save is-error" title="This browser can't save projects. Export to keep your video."><CloudOff size={13} /> Not saved</span>}
        <div className="ve-topbar-spacer" />
        <button type="button" className="ve-icon-btn" onClick={() => setConfirmNew(true)} aria-label="New video" title="New video"><FilePlus2 size={16} /></button>
        <button type="button" className="ve-icon-btn" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)"><Undo2 size={16} /></button>
        <button type="button" className="ve-icon-btn" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Redo2 size={16} /></button>
        <select className="ve-select" value={aspect} onChange={(e) => setAspect(e.target.value as AspectRatio)} aria-label="Aspect ratio">
          {ASPECTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <button type="button" className="ve-icon-btn" onClick={saveFrame} disabled={total === 0} aria-label="Save this frame as an image" title="Save frame as PNG"><Camera size={16} /></button>
        <button type="button" className="ve-export" onClick={() => setExporting(true)} disabled={total === 0}>
          <Download size={16} aria-hidden="true" /> Export
        </button>
      </header>

      <div className="ve-body">
        <nav className="ve-rail" aria-label="Editor tools">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? 'is-on' : ''} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
        <section className="ve-side">
          {tab === 'media' && <MediaPanel />}
          {tab === 'text' && <TextPanel />}
          {tab === 'audio' && <AudioPanel />}
          {tab === 'subtitles' && <SubtitlesPanel />}
          {tab === 'ai' && <AiToolsPanel />}
          {tab === 'elements' && <ElementsPanel />}
          {tab === 'filters' && <FiltersPanel />}
        </section>
        <main className="ve-center">
          <Preview />
        </main>
        <Inspector />
      </div>

      <div className="ve-controls">
        <div className="ve-controls-left">
          <button type="button" className="ve-icon-btn" onClick={splitAtPlayhead} aria-label="Split at playhead" title="Split (S)"><Scissors size={16} /></button>
          <button type="button" className="ve-icon-btn" onClick={duplicateSelected} disabled={!hasSelection} aria-label="Duplicate selected clip" title="Duplicate (Ctrl+D)"><Copy size={16} /></button>
          <button type="button" className="ve-icon-btn" onClick={deleteSelected} disabled={!hasSelection} aria-label="Delete selected clip" title="Delete (Del)"><Trash2 size={16} /></button>
          <button type="button" className="ve-icon-btn" onClick={rippleDeleteSelected} disabled={!hasSelection} aria-label="Delete and close the gap" title="Delete and close gap (Shift+Del)"><Unlink size={16} /></button>
          <span className="ve-divider" aria-hidden="true" />
          <button type="button" className="ve-icon-btn" onClick={closeGaps} disabled={total === 0} aria-label="Remove gaps on the track" title="Remove gaps (selected clip's track, or the main video track)"><AlignHorizontalJustifyStart size={16} /></button>
          <button type="button" className="ve-icon-btn" onClick={toggleSnap} aria-pressed={snap} aria-label="Snapping" title={snap ? 'Snapping on' : 'Snapping off'}><Magnet size={16} /></button>
        </div>
        <div className="ve-controls-center">
          <button type="button" className="ve-icon-btn" onClick={() => setPlayhead(0)} aria-label="Go to start" title="Go to start (Home)"><SkipBack size={16} /></button>
          <button type="button" className="ve-play" onClick={togglePlay} disabled={total === 0} aria-label={playing ? 'Pause' : 'Play'} title="Play / pause (Space)">
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <span className="ve-time"><strong>{formatTime(playhead)}</strong> / {formatTime(total)}</span>
        </div>
        <div className="ve-controls-right">
          <button type="button" className="ve-icon-btn" onClick={() => setZoom(zoom / 1.4)} aria-label="Zoom out"><ZoomOut size={16} /></button>
          <input type="range" className="ve-zoom" min={4} max={400} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Timeline zoom" />
          <button type="button" className="ve-icon-btn" onClick={() => setZoom(zoom * 1.4)} aria-label="Zoom in"><ZoomIn size={16} /></button>
          <button type="button" className="ve-icon-btn" onClick={zoomToFit} aria-label="Fit timeline to the window" title="Fit timeline"><Maximize2 size={16} /></button>
        </div>
      </div>

      <Timeline />
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
      {!ready && (
        <div className="ve-restoring" role="status">
          <Loader2 size={22} className="ve-spin" aria-hidden="true" /> Opening your last video…
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmNew}
        title="Start a new video?"
        message="The current video and its files will be removed from this browser. Export it first if you want to keep it."
        confirmLabel="Start new video"
        tone="danger"
        onCancel={() => setConfirmNew(false)}
        onConfirm={() => {
          setConfirmNew(false);
          void startNew();
        }}
      />
    </div>
  );
}

export const VideoEditorPage: React.FC = () => <Editor />;
