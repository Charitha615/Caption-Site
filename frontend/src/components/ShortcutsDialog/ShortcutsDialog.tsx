import React from 'react';
import { Modal } from '../Modal/Modal';
import { MOD, SHORTCUTS, SHORTCUT_GROUPS } from '../../features/editor/shortcuts';
import './ShortcutsDialog.css';

const APP_SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: [MOD, 'K'], label: 'Search projects' },
  { keys: ['?'], label: 'Show keyboard shortcuts' },
  { keys: ['Esc'], label: 'Close dialog or menu' },
];

const Row: React.FC<{ keys: readonly string[]; label: string }> = ({ keys, label }) => (
  <div className="shortcuts-row">
    <dt>
      {keys.map((k) => (
        <kbd key={k}>{k}</kbd>
      ))}
    </dt>
    <dd>{label}</dd>
  </div>
);

/** App-wide keyboard help ("?"). Editor shortcuts come from the editor's single registry. */
export const ShortcutsDialog: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Keyboard shortcuts" size="lg">
    <div className="shortcuts-grid">
      <section>
        <h3 className="shortcuts-heading">Everywhere</h3>
        <dl className="shortcuts-list">
          {APP_SHORTCUTS.map((s) => <Row key={s.label} {...s} />)}
        </dl>
      </section>
      {SHORTCUT_GROUPS.map((group) => (
        <section key={group.title}>
          <h3 className="shortcuts-heading">Editor · {group.title}</h3>
          <dl className="shortcuts-list">
            {group.items.map((id) => <Row key={id} keys={SHORTCUTS[id].keys} label={SHORTCUTS[id].label} />)}
          </dl>
        </section>
      ))}
    </div>
  </Modal>
);
