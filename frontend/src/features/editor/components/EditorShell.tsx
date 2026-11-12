import { memo, useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useUIStore, type MobileTab } from '../../../stores/editor/uiStore';
import { useBreakpoint } from '../hooks/layout';
import { ShortcutsDialog } from './EditorDialogs';
import { ExportDialog } from './export/ExportDialog';
import { IconButton } from './controls';
import { PropertyPanel } from './inspector/PropertyPanel';
import { CaptionsPanel } from './panels/CaptionsPanel';
import { StylesPanel } from './panels/StylesPanel';
import { ToolPanel, ToolStrip } from './panels/ToolPanel';
import { PlayerControls } from './player/PlayerControls';
import { VideoStage } from './player/VideoStage';
import { Timeline } from './timeline/Timeline';
import { EditorToolbar, ProjectTitle, SaveIndicator, UndoRedoButtons } from './toolbar/EditorToolbar';
import { useLeaveEditor } from '../hooks/useLeaveEditor';

const Player = memo(function Player({ compact = false }: { compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="ed-player" ref={ref}>
      <VideoStage />
      <PlayerControls fullscreenTarget={ref} compact={compact} />
    </div>
  );
});

/** Desktop (≥1280px): every panel docked. Tablet (768–1279px): side panels become drawers. */
function DesktopEditor({ tablet }: { tablet: boolean }) {
  const isPreview = useUIStore((s) => s.isPreviewMode);
  const toolOpen = useUIStore((s) => s.isToolPanelOpen);
  const inspectorOpen = useUIStore((s) => s.isInspectorOpen);
  const ui = useUIStore.getState;

  return (
    <div className={`cap-editor ${tablet ? 'bp-tablet' : 'bp-desktop'} ${isPreview ? 'is-preview' : ''}`}>
      <EditorToolbar showInspectorToggle={tablet} />
      <div className="ed-main">
        {!isPreview && <ToolStrip drawer={tablet} />}
        {!isPreview && (!tablet || toolOpen) && (
          <div className={tablet ? 'ed-drawer ed-drawer-left' : 'ed-dock-left'}>
            <ToolPanel onClose={tablet ? () => ui().setToolPanelOpen(false) : undefined} />
          </div>
        )}
        <Player />
        {!isPreview && (!tablet || inspectorOpen) && (
          <div className={tablet ? 'ed-drawer ed-drawer-right' : 'ed-dock-right'}>
            <PropertyPanel onClose={tablet ? () => ui().setInspectorOpen(false) : undefined} />
          </div>
        )}
        {tablet && !isPreview && (toolOpen || inspectorOpen) && (
          <div className="ed-drawer-scrim" onClick={() => { ui().setToolPanelOpen(false); ui().setInspectorOpen(false); }} />
        )}
      </div>
      {!isPreview && <Timeline />}
      <ShortcutsDialog />
      <ExportDialog />
    </div>
  );
}

const MOBILE_TABS: Array<{ id: MobileTab; label: string }> = [
  { id: 'captions', label: 'Captions' },
  { id: 'edit', label: 'Edit' },
  { id: 'style', label: 'Style' },
];

/** Phones: a focused flow — preview, a compact timeline, and one task tab at a time. */
function MobileEditor() {
  const tab = useUIStore((s) => s.mobileTab);
  const leave = useLeaveEditor();
  return (
    <div className="cap-editor bp-mobile">
      <header className="ed-toolbar">
        <div className="ed-toolbar-group ed-grow">
          <IconButton tip="Back to project" onClick={() => void leave()}>
            <ChevronLeft size={18} />
          </IconButton>
          <div className="ed-title">
            <ProjectTitle />
            <SaveIndicator />
          </div>
        </div>
        <div className="ed-toolbar-group">
          <UndoRedoButtons />
        </div>
      </header>
      <Player compact />
      <Timeline compact />
      <nav className="ed-mobile-tabs" role="tablist">
        {MOBILE_TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-active' : ''} onClick={() => useUIStore.getState().setMobileTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="ed-mobile-body">
        {tab === 'captions' && <CaptionsPanel />}
        {tab === 'edit' && <PropertyPanel compact />}
        {tab === 'style' && <StylesPanel />}
      </div>
    </div>
  );
}

export function EditorShell() {
  const bp = useBreakpoint();
  // Closing drawers when switching layouts avoids a stale overlay after rotating a tablet.
  useEffect(() => {
    useUIStore.getState().setToolPanelOpen(false);
    useUIStore.getState().setInspectorOpen(false);
  }, [bp]);
  return bp === 'mobile' ? <MobileEditor /> : <DesktopEditor tablet={bp === 'tablet'} />;
}
