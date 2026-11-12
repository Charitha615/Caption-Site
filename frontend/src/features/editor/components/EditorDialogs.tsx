import { Modal } from '../../../components/Modal/Modal';
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
