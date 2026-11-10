import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useEditorProjectStore } from '../../stores/editor/editorProjectStore';
import { EditorShell } from '../../features/editor/components/EditorShell';
import { useEditorShortcuts } from '../../features/editor/hooks/useEditorShortcuts';
import { ensureEditorFonts } from '../../features/editor/model/fonts';
import { closeProject, openDemo, openProject } from '../../features/editor/services/session';
import '../../features/editor/editor.css';

export const StudioEditorPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const loadStatus = useEditorProjectStore((s) => s.loadStatus);
  const loadError = useEditorProjectStore((s) => s.loadError);
  const projectName = useEditorProjectStore((s) => s.projectName);

  useDocumentTitle(loadStatus === 'ready' ? `${projectName} — Editor` : 'Editor');
  useEditorShortcuts(loadStatus === 'ready');

  useEffect(() => {
    ensureEditorFonts();
    if (uuid) void openProject(uuid);
    return () => {
      void closeProject();
    };
  }, [uuid]);

  if (loadStatus === 'ready') return <EditorShell />;

  return (
    <div className="cap-editor ed-boot">
      {loadStatus === 'error' ? (
        <div className="ed-boot-card" role="alert">
          <AlertTriangle size={26} className="ed-boot-icon is-error" />
          <h1>Couldn’t open the editor</h1>
          <p>{loadError}</p>
          <div className="ed-boot-actions">
            <button type="button" className="ed-btn is-primary" onClick={() => uuid && void openProject(uuid)}>
              Try again
            </button>
            <button type="button" className="ed-btn" onClick={() => navigate('/projects')}>
              Back to projects
            </button>
            <button type="button" className="ed-btn is-ghost" onClick={openDemo}>
              Open demo (not saved)
            </button>
          </div>
        </div>
      ) : (
        <div className="ed-boot-card" aria-busy>
          <Loader2 size={26} className="ed-spin ed-boot-icon" />
          <p>Loading editor…</p>
        </div>
      )}
    </div>
  );
};
