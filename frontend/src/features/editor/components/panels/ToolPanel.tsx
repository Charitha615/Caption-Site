import { memo } from 'react';
import { Film, LayoutTemplate, Palette, Settings2, Subtitles, X } from 'lucide-react';
import { useEditorStore, type EditorTool } from '../../../../stores/editor/editorStore';
import { useUIStore } from '../../../../stores/editor/uiStore';
import { IconButton } from '../controls';
import { CaptionsPanel } from './CaptionsPanel';
import { MediaPanel } from './MediaPanel';
import { SettingsPanel } from './SettingsPanel';
import { StylesPanel } from './StylesPanel';
import { TemplatesPanel } from './TemplatesPanel';

const TOOLS: Array<{ id: EditorTool; label: string; Icon: typeof Film }> = [
  { id: 'media', label: 'Media', Icon: Film },
  { id: 'captions', label: 'Captions', Icon: Subtitles },
  { id: 'styles', label: 'Styles', Icon: Palette },
  { id: 'templates', label: 'Templates', Icon: LayoutTemplate },
  { id: 'settings', label: 'Settings', Icon: Settings2 },
];

/** Vertical icon rail. On tablet, clicking the active tool toggles the drawer. */
export const ToolStrip = memo(function ToolStrip({ drawer }: { drawer: boolean }) {
  const active = useEditorStore((s) => s.activeTool);
  const open = useUIStore((s) => s.isToolPanelOpen);
  return (
    <nav className="ed-rail" aria-label="Editor tools">
      {TOOLS.map(({ id, label, Icon }) => {
        const isActive = active === id && (!drawer || open);
        return (
          <button
            key={id}
            type="button"
            className={`ed-rail-btn ${isActive ? 'is-active' : ''}`}
            aria-pressed={isActive}
            onClick={() => {
              const ui = useUIStore.getState();
              if (drawer) ui.setToolPanelOpen(!(open && active === id));
              useEditorStore.getState().setActiveTool(id);
            }}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
});

export const ToolPanel = memo(function ToolPanel({ onClose }: { onClose?: () => void }) {
  const active = useEditorStore((s) => s.activeTool);
  const title = TOOLS.find((t) => t.id === active)?.label;
  return (
    <aside className="ed-toolpanel" aria-label={`${title} panel`}>
      <header className="ed-panel-head">
        <div className="ed-panel-title">
          <h2>{title}</h2>
        </div>
        {onClose && (
          <IconButton tip="Close panel" onClick={onClose}>
            <X size={15} />
          </IconButton>
        )}
      </header>
      {active === 'media' && <MediaPanel />}
      {active === 'captions' && <CaptionsPanel />}
      {active === 'styles' && <StylesPanel />}
      {active === 'templates' && <TemplatesPanel />}
      {active === 'settings' && <SettingsPanel />}
    </aside>
  );
});
