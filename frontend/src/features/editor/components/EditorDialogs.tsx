import { FileText, Film, Subtitles } from 'lucide-react';
import { Modal } from '../../../components/Modal/Modal';
import { useCaptionStore } from '../../../stores/editor/captionStore';
import { useUIStore } from '../../../stores/editor/uiStore';
import { SHORTCUT_GROUPS, SHORTCUTS } from '../shortcuts';
import { Kbd } from './controls';

export function ShortcutsDialog() {
  const open = useUIStore((s) => s.isShortcutsOpen);
  return (
    <Modal isOpen={open} onClose={() => useUIStore.getState().setShortcutsOpen(false)} title="Keyboard shortcuts" size="lg">
      <div className="ed-shortcuts">
        {SHORTCUT_GROUPS.map((g) => (
          <section key={g.title}>
            <h4>{g.title}</h4>
            {g.items.map((id) => (
              <div key={id} className="ed-shortcut-row">
                <span>{SHORTCUTS[id].label}</span>
                <Kbd keys={SHORTCUTS[id].keys} />
              </div>
            ))}
          </section>
        ))}
      </div>
      <p className="ed-help">Shortcuts are paused while you type in a text field — press Esc to leave the field. Undo, redo and save always work.</p>
    </Modal>
  );
}

const FORMATS = [
  { Icon: Film, title: 'MP4 with burned-in captions', desc: 'Renders your styles and animations into the video.' },
  { Icon: Subtitles, title: 'SRT / WebVTT', desc: 'Subtitle files for YouTube, Premiere and web players.' },
  { Icon: FileText, title: 'Plain transcript', desc: 'Clean text without timestamps.' },
];

/** Export is STEP 4. Until then this dialog is honest about it instead of faking a download. */
export function ExportDialog() {
  const open = useUIStore((s) => s.isExportOpen);
  const count = useCaptionStore((s) => s.captions.length);
  return (
    <Modal isOpen={open} onClose={() => useUIStore.getState().setExportOpen(false)} title="Export">
      <div className="ed-export">
        <p>
          Export is coming in the next update. Your {count} captions, styles and canvas settings are already saved with the
          project and will be used exactly as you see them in the preview.
        </p>
        <ul>
          {FORMATS.map(({ Icon, title, desc }) => (
            <li key={title}>
              <Icon size={18} />
              <span>
                <strong>{title}</strong>
                <span>{desc}</span>
              </span>
              <span className="ed-badge">Soon</span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
