import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Sparkles,
  Save,
  Undo2,
  Redo2,
  Download,
  Smartphone,
  Tv,
  Square,
  Eye,
  EyeOff,
  HelpCircle,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useToastStore } from '../../stores/toastStore';
import { useBrand } from '../../hooks/useBrand';
import { Dropdown } from '../../components/Dropdown/Dropdown';
import { Modal } from '../../components/Modal/Modal';
import './EditorHeader.css';

interface EditorHeaderProps {
  projectName?: string;
  onExport: (format: string) => void;
  isPreviewMode?: boolean;
  onTogglePreview?: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  projectName = 'SampleCap Project',
  onExport,
  isPreviewMode = false,
  onTogglePreview,
}) => {
  const brand = useBrand();
  const navigate = useNavigate();
  const { addToast } = useToastStore();

  const {
    projectUuid,
    aspectRatio,
    setAspectRatio,
    undo,
    redo,
    undoStack,
    redoStack,
    captions,
    saveStatus,
    saveNow,
  } = useEditorStore();

  const [title, setTitle] = useState(projectName);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const handleManualSave = async () => {
    await saveNow();
    addToast({
      type: 'success',
      title: 'Captions Saved',
      message: 'All captions, styles and timings have been synced to the database.',
    });
  };

  const exportMenuItems = [
    {
      key: 'mp4',
      label: 'Render Burned MP4 Video',
      onClick: () => onExport('mp4'),
    },
    {
      key: 'srt',
      label: 'Export Subtitles (.SRT)',
      onClick: () => onExport('srt'),
    },
    {
      key: 'vtt',
      label: 'Export WebVTT (.VTT)',
      onClick: () => onExport('vtt'),
    },
    {
      key: 'txt',
      label: 'Export Transcript (.TXT)',
      onClick: () => onExport('txt'),
    },
    {
      key: 'json',
      label: 'Export Timestamps (.JSON)',
      onClick: () => onExport('json'),
    },
  ];

  return (
    <>
      <header className="editor-header">
        {/* Left section: Back, Logo, Project Title, Save status */}
        <div className="editor-header-left">
          <button
            type="button"
            className="editor-back-btn"
            onClick={() => navigate(projectUuid ? `/projects/${projectUuid}` : '/projects')}
            title="Back to Project Details"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="editor-logo-badge" title={brand.name}>
            <Sparkles size={16} />
          </div>

          <div className="editor-project-info">
            <input
              type="text"
              className="editor-project-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              title="Click to rename project"
            />
            <div className="editor-project-meta-row">
              <span>{aspectRatio}</span>
              <span>•</span>
              <span>{captions.length} captions</span>
              <span>•</span>
              {/* Autosave status indicator */}
              <div className="autosave-status-pill">
                {saveStatus === 'saving' && (
                  <>
                    <RefreshCw size={11} className="spin-animation" style={{ color: '#F59E0B' }} />
                    <span style={{ color: '#F59E0B' }}>Saving...</span>
                  </>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <span className="status-dot status-dot-saved" />
                    <span>Saved</span>
                  </>
                )}
                {saveStatus === 'unsaved' && (
                  <>
                    <span className="status-dot status-dot-unsaved" />
                    <span>Unsaved</span>
                  </>
                )}
                {saveStatus === 'failed' && (
                  <>
                    <AlertCircle size={11} style={{ color: '#EF4444' }} />
                    <span style={{ color: '#EF4444' }}>Save failed</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="editor-save-btn"
            onClick={handleManualSave}
            disabled={saveStatus === 'saving'}
            title="Save changes immediately (Ctrl+S)"
          >
            <Save size={14} />
            <span>Save</span>
          </button>
        </div>

        {/* Center section: Aspect ratio switcher */}
        <div className="editor-header-center">
          <div className="workspace-ratio-group">
            <span className="workspace-ratio-label">CANVAS</span>
            <button
              type="button"
              className={`workspace-ratio-btn ${aspectRatio === '16:9' ? 'workspace-ratio-btn-active' : ''}`}
              onClick={() => setAspectRatio('16:9')}
              title="Landscape Video (16:9) — YouTube / Desktop"
            >
              <Tv size={13} />
              <span>16:9</span>
            </button>
            <button
              type="button"
              className={`workspace-ratio-btn ${aspectRatio === '9:16' ? 'workspace-ratio-btn-active' : ''}`}
              onClick={() => setAspectRatio('9:16')}
              title="Vertical Video (9:16) — Reels / TikTok / Shorts"
            >
              <Smartphone size={13} />
              <span>9:16</span>
            </button>
            <button
              type="button"
              className={`workspace-ratio-btn ${aspectRatio === '1:1' ? 'workspace-ratio-btn-active' : ''}`}
              onClick={() => setAspectRatio('1:1')}
              title="Square Video (1:1) — Instagram Feed"
            >
              <Square size={13} />
              <span>1:1</span>
            </button>
          </div>
        </div>

        {/* Right section: Undo/Redo, Preview, Shortcuts, Export */}
        <div className="editor-header-right">
          <button
            type="button"
            className="editor-icon-action-btn"
            disabled={undoStack.length === 0}
            onClick={undo}
            title="Undo (Ctrl+Z / Cmd+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="editor-icon-action-btn"
            disabled={redoStack.length === 0}
            onClick={redo}
            title="Redo (Ctrl+Shift+Z / Cmd+Shift+Z)"
          >
            <Redo2 size={16} />
          </button>

          {/* Preview Mode Toggle */}
          <button
            type="button"
            className={`editor-icon-action-btn ${isPreviewMode ? 'editor-icon-action-btn-active' : ''}`}
            onClick={onTogglePreview}
            title={isPreviewMode ? 'Exit Full Preview' : 'Preview Video (Hide Panels)'}
          >
            {isPreviewMode ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>

          {/* Shortcuts Help */}
          <button
            type="button"
            className="editor-icon-action-btn"
            onClick={() => setShowShortcutsModal(true)}
            title="Keyboard Shortcuts"
          >
            <HelpCircle size={16} />
          </button>

          {/* Export Dropdown */}
          <Dropdown
            items={exportMenuItems}
            align="right"
            trigger={
              <button type="button" className="export-main-btn">
                <Download size={15} />
                <span>Export</span>
              </button>
            }
          />
        </div>
      </header>

      {/* Keyboard Shortcuts Dialog */}
      <Modal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
        title="Keyboard Shortcuts"
      >
        <div className="shortcuts-modal-table">
          <div className="shortcut-row">
            <span className="shortcut-label">Play / Pause Video</span>
            <kbd className="shortcut-key">Space</kbd>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Scrub Backward 0.2s</span>
            <kbd className="shortcut-key">←</kbd>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Scrub Forward 0.2s</span>
            <kbd className="shortcut-key">→</kbd>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Scrub Backward 1.0s</span>
            <kbd className="shortcut-key">Shift + ←</kbd>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Scrub Forward 1.0s</span>
            <kbd className="shortcut-key">Shift + →</kbd>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Undo Changes</span>
            <kbd className="shortcut-key">Ctrl / ⌘ + Z</kbd>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Redo Changes</span>
            <kbd className="shortcut-key">Ctrl / ⌘ + Shift + Z</kbd>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Delete Selected Caption</span>
            <kbd className="shortcut-key">Delete / Backspace</kbd>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Add Caption at Playhead</span>
            <kbd className="shortcut-key">A</kbd>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Split Caption at Playhead</span>
            <kbd className="shortcut-key">S</kbd>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Toggle Captions Visibility</span>
            <kbd className="shortcut-key">C</kbd>
          </div>
        </div>
      </Modal>
    </>
  );
};
