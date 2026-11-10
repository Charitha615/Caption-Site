import { memo, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  CloudOff,
  Download,
  Eye,
  EyeOff,
  Keyboard,
  Loader2,
  PanelRight,
  Redo2,
  Save,
  Undo2,
} from 'lucide-react';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useEditorProjectStore } from '../../../../stores/editor/editorProjectStore';
import { useUIStore } from '../../../../stores/editor/uiStore';
import { useToastStore } from '../../../../stores/toastStore';
import { flush } from '../../services/autosave';
import { useLeaveEditor } from '../../hooks/useLeaveEditor';
import { renameProject } from '../../services/session';
import { tip } from '../../shortcuts';
import { IconButton } from '../controls';

function relativeTime(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const SaveIndicator = memo(function SaveIndicator() {
  const status = useEditorProjectStore((s) => s.saveStatus);
  const lastSavedAt = useEditorProjectStore((s) => s.lastSavedAt);
  const error = useEditorProjectStore((s) => s.saveError);
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const map = {
    saved: { Icon: Check, text: 'Saved', tipText: lastSavedAt ? `All changes saved ${relativeTime(lastSavedAt)}` : 'All changes saved' },
    saving: { Icon: Loader2, text: 'Saving…', tipText: 'Saving your changes' },
    unsaved: { Icon: null, text: 'Unsaved changes', tipText: 'Saves automatically in a moment' },
    failed: { Icon: AlertCircle, text: 'Save failed', tipText: `${error ?? 'Could not reach the server'} — click to retry` },
    offline: { Icon: CloudOff, text: 'Demo · not saved', tipText: 'Demo mode: nothing is saved to the server' },
  } as const;
  const { Icon, text, tipText } = map[status];

  return (
    <button
      type="button"
      className={`ed-save-pill is-${status}`}
      onClick={() => status === 'failed' && void flush()}
      data-tip={tipText}
      aria-live="polite"
    >
      {Icon ? <Icon size={12} className={status === 'saving' ? 'ed-spin' : ''} /> : <span className="ed-dot" />}
      {text}
    </button>
  );
});

export function ProjectTitle() {
  const name = useEditorProjectStore((s) => s.projectName);
  const [draft, setDraft] = useState<string | null>(null);
  const { addToast } = useToastStore();
  const commit = async () => {
    if (draft === null) return;
    const value = draft;
    setDraft(null);
    const ok = await renameProject(value);
    if (!ok && value.trim() && value.trim() !== name) addToast({ type: 'error', message: 'Could not rename the project.' });
  };
  return (
    <input
      className="ed-title-input"
      value={draft ?? name}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(null);
          (e.target as HTMLInputElement).blur();
        }
      }}
      aria-label="Project name"
      data-native-undo
      maxLength={255}
    />
  );
}

export function UndoRedoButtons() {
  const past = useCaptionStore((s) => s.past);
  const future = useCaptionStore((s) => s.future);
  const undoLabel = past.length ? `Undo ${past[past.length - 1].label.toLowerCase()}` : 'Nothing to undo';
  const redoLabel = future.length ? `Redo ${future[future.length - 1].label.toLowerCase()}` : 'Nothing to redo';
  return (
    <>
      <IconButton tip={tip(undoLabel, 'undo')} disabled={!past.length} onClick={() => useCaptionStore.getState().undo()}>
        <Undo2 size={16} />
      </IconButton>
      <IconButton tip={tip(redoLabel, 'redo')} disabled={!future.length} onClick={() => useCaptionStore.getState().redo()}>
        <Redo2 size={16} />
      </IconButton>
    </>
  );
}

export const EditorToolbar = memo(function EditorToolbar({ showInspectorToggle }: { showInspectorToggle: boolean }) {
  const leave = useLeaveEditor();
  const isPreview = useUIStore((s) => s.isPreviewMode);
  const inspectorOpen = useUIStore((s) => s.isInspectorOpen);
  const saveStatus = useEditorProjectStore((s) => s.saveStatus);
  const isDemo = useEditorProjectStore((s) => s.isDemo);
  const ui = useUIStore.getState;

  return (
    <header className="ed-toolbar">
      <div className="ed-toolbar-group">
        <IconButton tip="Back to project" onClick={() => void leave()}>
          <ChevronLeft size={18} />
        </IconButton>
        <div className="ed-brand" aria-hidden>S</div>
        <div className="ed-title">
          <ProjectTitle />
          <SaveIndicator />
        </div>
      </div>

      <div className="ed-toolbar-group">
        <UndoRedoButtons />
        <span className="ed-toolbar-divider" />
        <button
          type="button"
          className="ed-btn is-ghost"
          disabled={isDemo || saveStatus === 'saving'}
          onClick={() => void flush()}
          data-tip={tip('Save now', 'save')}
        >
          <Save size={15} />
          <span className="ed-hide-sm">Save</span>
        </button>
        <IconButton tip={isPreview ? 'Exit preview  ·  Esc' : 'Preview (hide panels)'} active={isPreview} onClick={() => ui().setPreviewMode(!isPreview)}>
          {isPreview ? <EyeOff size={16} /> : <Eye size={16} />}
        </IconButton>
        <IconButton tip={tip('Keyboard shortcuts', 'help')} onClick={() => ui().setShortcutsOpen(true)}>
          <Keyboard size={16} />
        </IconButton>
        {showInspectorToggle && !isPreview && (
          <IconButton tip="Properties panel" active={inspectorOpen} onClick={() => ui().setInspectorOpen(!inspectorOpen)}>
            <PanelRight size={16} />
          </IconButton>
        )}
        <button type="button" className="ed-btn is-accent" onClick={() => ui().setExportOpen(true)}>
          <Download size={15} />
          Export
        </button>
      </div>
    </header>
  );
});
