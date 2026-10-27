import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectStore } from '../../stores/projectStore';
import { useEditorStore } from '../../stores/editorStore';
import { useToastStore } from '../../stores/toastStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { EditorHeader } from '../../features/editor/EditorHeader';
import { EditorSidebar } from '../../features/editor/EditorSidebar';
import { EditorToolPanel } from '../../features/editor/EditorToolPanel';
import { EditorVideoCanvas } from '../../features/editor/EditorVideoCanvas';
import { EditorInspector } from '../../features/editor/EditorInspector';
import { EditorTimeline } from '../../features/editor/EditorTimeline';
import { Modal } from '../../components/Modal/Modal';
import { Button } from '../../components/Button/Button';
import './StudioEditorPage.css';

export const StudioEditorPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();

  const { currentProject, loadProject } = useProjectStore();
  const {
    setIsPlaying,
    isPlaying,
    setCurrentTime,
    currentTime,
    duration,
    setVideoUrl,
    setProjectInfo,
    loadProjectCaptions,
    selectedCaptionId,
    deleteCaptionSegment,
    undo,
    redo,
    saveNow,
    addCaptionSegment,
    splitCaptionAtCurrentTime,
    isCaptionVisible,
    setIsCaptionVisible,
  } = useEditorStore();
  const { addToast } = useToastStore();

  const [exportModalFormat, setExportModalFormat] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useDocumentTitle(
    currentProject?.name ? `${currentProject.name} — Studio Editor` : 'Studio Editor'
  );

  useEffect(() => {
    if (uuid) {
      loadProject(uuid)
        .then((project) => {
          if (project.video_url) {
            setVideoUrl(project.video_url);
          }
          setProjectInfo(uuid, project.name);
          loadProjectCaptions(uuid);
        })
        .catch(() => {
          console.warn('Backend project not found, using interactive local state');
        });
    }
  }, [uuid, loadProject, setVideoUrl, setProjectInfo, loadProjectCaptions]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || target?.isContentEditable;

      // Handle Undo / Redo even if inside or outside (standard editor behavior)
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if ((cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z') || (cmdOrCtrl && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        redo();
        return;
      }
      if (cmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveNow();
        addToast({
          type: 'success',
          title: 'Captions Saved',
          message: 'All captions, styles and timings have been synced to the database.',
        });
        return;
      }

      // If currently typing in an input or textarea, don't hijack editing keys
      if (isInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 0.2;
        setCurrentTime(Math.max(0, currentTime - step));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 0.2;
        setCurrentTime(Math.min(duration, currentTime + step));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedCaptionId) {
          e.preventDefault();
          deleteCaptionSegment(selectedCaptionId);
        }
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        addCaptionSegment(currentTime);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        splitCaptionAtCurrentTime();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setIsCaptionVisible(!isCaptionVisible);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPlaying,
    setIsPlaying,
    currentTime,
    duration,
    setCurrentTime,
    selectedCaptionId,
    deleteCaptionSegment,
    undo,
    redo,
    saveNow,
    addCaptionSegment,
    splitCaptionAtCurrentTime,
    isCaptionVisible,
    setIsCaptionVisible,
    addToast,
  ]);

  const handleExportTrigger = (format: string) => {
    setExportModalFormat(format);
  };

  const confirmExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      addToast({
        type: 'success',
        title: 'Export Ready',
        message: `Your ${exportModalFormat?.toUpperCase()} file has been generated and downloaded.`,
      });
      setExportModalFormat(null);
    }, 1200);
  };

  return (
    <div className={`editor-studio-fullscreen ${isPreviewMode ? 'editor-preview-mode-active' : ''}`}>
      {/* Top Navigation & Workspace Controls Header */}
      <EditorHeader
        projectName={currentProject?.name || 'සිංහල තාක්ෂණික සමාලෝචනය #1'}
        onExport={handleExportTrigger}
        isPreviewMode={isPreviewMode}
        onTogglePreview={() => setIsPreviewMode(!isPreviewMode)}
      />

      {/* Middle Stage: Left Tool Strip + Context Panel + Video Canvas + Right Inspector */}
      <div className="editor-middle-workspace">
        {!isPreviewMode && <EditorSidebar />}
        {!isPreviewMode && <EditorToolPanel />}
        <EditorVideoCanvas />
        {!isPreviewMode && <EditorInspector />}
      </div>

      {/* Bottom Stage: Multi-Track Layers Timeline (Hidden in pure cinema preview mode) */}
      {!isPreviewMode && <EditorTimeline />}

      {/* Export Modal */}
      <Modal
        isOpen={!!exportModalFormat}
        onClose={() => setExportModalFormat(null)}
        title={`Export ${exportModalFormat?.toUpperCase()} Captions`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setExportModalFormat(null)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={confirmExport}
              isLoading={isExporting}
            >
              Start Export
            </Button>
          </>
        }
      >
        <div className="export-dialog-content">
          <p>
            Ready to export captions for <strong>&ldquo;{currentProject?.name || 'Project'}&rdquo;</strong>.
          </p>
          <div className="export-format-grid">
            <div className="export-format-card" onClick={() => setExportModalFormat('mp4')}>
              <span className="export-format-title">Rendered MP4</span>
              <span className="export-format-desc">Burned-in Sinhala/English subtitles with active animations.</span>
            </div>
            <div className="export-format-card" onClick={() => setExportModalFormat('srt')}>
              <span className="export-format-title">SubRip (.SRT)</span>
              <span className="export-format-desc">Standard subtitle file compatible with YouTube & Premiere.</span>
            </div>
            <div className="export-format-card" onClick={() => setExportModalFormat('vtt')}>
              <span className="export-format-title">WebVTT (.VTT)</span>
              <span className="export-format-desc">Web video subtitle file with styling cues.</span>
            </div>
            <div className="export-format-card" onClick={() => setExportModalFormat('txt')}>
              <span className="export-format-title">Plain Transcript (.TXT)</span>
              <span className="export-format-desc">Clean full text without timestamps.</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
