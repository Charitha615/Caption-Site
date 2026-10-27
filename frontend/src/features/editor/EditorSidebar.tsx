import React from 'react';
import {
  Film,
  FileText,
  Palette,
  Sparkles,
  Settings,
} from 'lucide-react';
import { useEditorStore, type EditorTool } from '../../stores/editorStore';
import './EditorSidebar.css';

interface ToolItem {
  id: EditorTool;
  label: string;
  icon: React.ReactNode;
}

export const EditorSidebar: React.FC = () => {
  const { activeTool, setActiveTool } = useEditorStore();

  const tools: ToolItem[] = [
    { id: 'media', label: 'Media', icon: <Film size={18} /> },
    { id: 'captions', label: 'Captions', icon: <FileText size={18} /> },
    { id: 'styles', label: 'Styles', icon: <Palette size={18} /> },
    { id: 'templates', label: 'Templates', icon: <Sparkles size={18} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
  ];

  return (
    <aside className="editor-tool-strip">
      {tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className={`editor-tool-item ${activeTool === tool.id ? 'editor-tool-item-active' : ''}`}
          onClick={() => setActiveTool(tool.id)}
          title={tool.label}
        >
          <div className="editor-tool-icon">{tool.icon}</div>
          <span className="editor-tool-label">{tool.label}</span>
        </button>
      ))}
    </aside>
  );
};
