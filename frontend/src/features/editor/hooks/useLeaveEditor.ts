import { useNavigate } from 'react-router-dom';
import { useEditorProjectStore } from '../../../stores/editor/editorProjectStore';
import { flush, hasUnsavedChanges } from '../services/autosave';

/** Leave the editor without losing work: flush pending saves first, confirm if saving failed. */
export function useLeaveEditor() {
  const navigate = useNavigate();
  const uuid = useEditorProjectStore((s) => s.projectUuid);
  return async () => {
    if (hasUnsavedChanges()) {
      await flush();
      if (hasUnsavedChanges() && !window.confirm('Some changes could not be saved. Leave the editor anyway?')) return;
    }
    navigate(uuid ? `/projects/${uuid}` : '/projects');
  };
}
