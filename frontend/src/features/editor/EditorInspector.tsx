import React from 'react';
import {
  RotateCcw,
  Layers,
  Copy,
  Scissors,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import {
  useEditorStore,
  type AlignMatrix,
  type CaptionAnimation,
  type CaptionStyleConfig,
} from '../../stores/editorStore';
import './EditorInspector.css';

export const EditorInspector: React.FC = () => {
  const {
    captions,
    selectedCaptionId,
    activeCaptionIndex,
    updateCaptionText,
    updateCaptionTiming,
    updateCaptionStyleOverride,
    duplicateCaptionSegment,
    splitCaptionAtCurrentTime,
    mergeCaptionWithNext,
    deleteCaptionSegment,
    style,
    updateStyle,
    resetTransform,
  } = useEditorStore();

  const currentSegment =
    captions.find((c) => c.id === selectedCaptionId) || captions[activeCaptionIndex];

  if (!currentSegment) {
    return (
      <aside className="editor-inspector-panel">
        <div className="inspector-header">
          <h3 className="inspector-title">Properties</h3>
        </div>
        <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>
          Select a caption from the list or timeline to inspect and edit properties.
        </div>
      </aside>
    );
  }

  // Active styles for current segment (custom override or global)
  const activeStyle: CaptionStyleConfig = currentSegment.styleOverride
    ? { ...style, ...currentSegment.styleOverride }
    : style;

  const durationSec = Number((currentSegment.end - currentSegment.start).toFixed(2));

  const handleStyleChange = (partial: Partial<CaptionStyleConfig>) => {
    if (style.applyTo === 'single') {
      updateCaptionStyleOverride(currentSegment.id, partial);
    } else {
      updateStyle(partial);
    }
  };

  const matrixNodes: Array<{ id: AlignMatrix; label: string; x: number; y: number }> = [
    { id: 'top-left', label: 'Top Left', x: -30, y: -35 },
    { id: 'top-center', label: 'Top Center', x: 0, y: -35 },
    { id: 'top-right', label: 'Top Right', x: 30, y: -35 },
    { id: 'mid-left', label: 'Middle Left', x: -30, y: 0 },
    { id: 'center', label: 'Center', x: 0, y: 0 },
    { id: 'mid-right', label: 'Middle Right', x: 30, y: 0 },
    { id: 'bottom-left', label: 'Bottom Left', x: -30, y: 24 },
    { id: 'bottom-center', label: 'Bottom Center', x: 0, y: 24 },
    { id: 'bottom-right', label: 'Bottom Right', x: 30, y: 24 },
  ];

  return (
    <aside className="editor-inspector-panel">
      {/* Header */}
      <div className="inspector-header">
        <div className="inspector-title-group">
          <h3 className="inspector-title">Caption Properties</h3>
          <span className="inspector-subtitle">
            #{captions.findIndex((c) => c.id === currentSegment.id) + 1} • {currentSegment.language === 'si' ? 'සිංහල' : 'English'}
          </span>
        </div>
        <button
          type="button"
          className="inspector-reset-btn"
          onClick={resetTransform}
          title="Reset position and styling"
        >
          <RotateCcw size={12} />
          <span>Reset</span>
        </button>
      </div>

      <div className="inspector-body">
        {/* TEXT CONTENT */}
        <div className="inspector-section">
          <label className="inspector-section-label">Caption Text</label>
          <textarea
            className="inspector-textarea"
            rows={3}
            value={currentSegment.text}
            onChange={(e) => updateCaptionText(currentSegment.id, e.target.value)}
            placeholder="Type caption text in Sinhala or English..."
          />
        </div>

        {/* TIMING CONTROLS */}
        <div className="inspector-section">
          <label className="inspector-section-label">Timing & Duration</label>
          <div className="timing-inputs-grid">
            <div className="timing-input-box">
              <span className="timing-label">START</span>
              <div className="timing-control-row">
                <button
                  type="button"
                  className="timing-step-btn"
                  onClick={() =>
                    updateCaptionTiming(
                      currentSegment.id,
                      Math.max(0, Number((currentSegment.start - 0.1).toFixed(2))),
                      currentSegment.end
                    )
                  }
                >
                  -
                </button>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={Number(currentSegment.start.toFixed(2))}
                  onChange={(e) => updateCaptionTiming(currentSegment.id, Number(e.target.value), currentSegment.end)}
                  className="timing-num-input"
                />
                <button
                  type="button"
                  className="timing-step-btn"
                  onClick={() =>
                    updateCaptionTiming(
                      currentSegment.id,
                      Number((currentSegment.start + 0.1).toFixed(2)),
                      currentSegment.end
                    )
                  }
                >
                  +
                </button>
              </div>
            </div>

            <div className="timing-input-box">
              <span className="timing-label">END</span>
              <div className="timing-control-row">
                <button
                  type="button"
                  className="timing-step-btn"
                  onClick={() =>
                    updateCaptionTiming(
                      currentSegment.id,
                      currentSegment.start,
                      Math.max(currentSegment.start + 0.1, Number((currentSegment.end - 0.1).toFixed(2)))
                    )
                  }
                >
                  -
                </button>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={Number(currentSegment.end.toFixed(2))}
                  onChange={(e) => updateCaptionTiming(currentSegment.id, currentSegment.start, Number(e.target.value))}
                  className="timing-num-input"
                />
                <button
                  type="button"
                  className="timing-step-btn"
                  onClick={() =>
                    updateCaptionTiming(
                      currentSegment.id,
                      currentSegment.start,
                      Number((currentSegment.end + 0.1).toFixed(2))
                    )
                  }
                >
                  +
                </button>
              </div>
            </div>

            <div className="timing-input-box" style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#9CA3AF' }}>
                <span>DURATION</span>
                <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{durationSec}s</span>
              </div>
            </div>
          </div>
        </div>

        {/* TYPOGRAPHY */}
        <div className="inspector-section">
          <label className="inspector-section-label">Font & Typography</label>
          <div className="inspector-control-group">
            <select
              className="inspector-select"
              value={activeStyle.fontFamily}
              onChange={(e) => handleStyleChange({ fontFamily: e.target.value })}
            >
              <option value='"Noto Sans Sinhala", sans-serif'>Noto Sans Sinhala</option>
              <option value='"Noto Serif Sinhala", serif'>Noto Serif Sinhala</option>
              <option value='"Gemunu Libre", sans-serif'>Gemunu Libre</option>
              <option value='"Inter", sans-serif'>Inter (English)</option>
              <option value='"Poppins", sans-serif'>Poppins (Modern)</option>
              <option value='"Courier New", monospace'>Courier New (Monospace)</option>
            </select>
          </div>

          <div className="inspector-control-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Size</span>
              <span style={{ fontSize: '0.78rem', color: '#FFFFFF', fontWeight: 600 }}>{activeStyle.fontSize}px</span>
            </div>
            <input
              type="range"
              min="14"
              max="64"
              value={activeStyle.fontSize}
              onChange={(e) => handleStyleChange({ fontSize: Number(e.target.value) })}
              className="inspector-slider"
            />
          </div>

          <div className="inspector-control-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Weight</span>
              <span style={{ fontSize: '0.78rem', color: '#FFFFFF', fontWeight: 600 }}>{activeStyle.fontWeight}</span>
            </div>
            <select
              className="inspector-select"
              value={activeStyle.fontWeight}
              onChange={(e) => handleStyleChange({ fontWeight: Number(e.target.value) })}
            >
              <option value={400}>400 (Regular)</option>
              <option value={600}>600 (Semi-Bold)</option>
              <option value={700}>700 (Bold)</option>
              <option value={800}>800 (Extra-Bold)</option>
              <option value={900}>900 (Black)</option>
            </select>
          </div>
        </div>

        {/* COLORS & STROKE */}
        <div className="inspector-section">
          <label className="inspector-section-label">Text & Stroke</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.72rem', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>TEXT COLOR</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="color"
                  value={activeStyle.textColor}
                  onChange={(e) => handleStyleChange({ textColor: e.target.value })}
                  className="inspector-color-picker"
                />
                <input
                  type="text"
                  value={activeStyle.textColor}
                  onChange={(e) => handleStyleChange({ textColor: e.target.value })}
                  className="inspector-color-input"
                />
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.72rem', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>STROKE COLOR</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="color"
                  value={activeStyle.outlineColor}
                  onChange={(e) => handleStyleChange({ outlineColor: e.target.value })}
                  className="inspector-color-picker"
                />
                <input
                  type="text"
                  value={activeStyle.outlineColor}
                  onChange={(e) => handleStyleChange({ outlineColor: e.target.value })}
                  className="inspector-color-input"
                />
              </div>
            </div>
          </div>

          <div className="inspector-control-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Stroke Width</span>
              <span style={{ fontSize: '0.78rem', color: '#FFFFFF' }}>{activeStyle.outlineWidth}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="8"
              value={activeStyle.outlineWidth}
              onChange={(e) => handleStyleChange({ outlineWidth: Number(e.target.value) })}
              className="inspector-slider"
            />
          </div>

          <div className="inspector-control-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Shadow Blur</span>
              <span style={{ fontSize: '0.78rem', color: '#FFFFFF' }}>{activeStyle.shadowBlur}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              value={activeStyle.shadowBlur}
              onChange={(e) => handleStyleChange({ shadowBlur: Number(e.target.value) })}
              className="inspector-slider"
            />
          </div>
        </div>

        {/* BACKGROUND & BOX */}
        <div className="inspector-section">
          <label className="inspector-section-label">Background Box</label>
          <div className="inspector-control-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Opacity</span>
              <span style={{ fontSize: '0.78rem', color: '#FFFFFF' }}>{activeStyle.backgroundOpacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={activeStyle.backgroundOpacity}
              onChange={(e) => handleStyleChange({ backgroundOpacity: Number(e.target.value) })}
              className="inspector-slider"
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>RADIUS ({activeStyle.borderRadius}px)</span>
              <input
                type="range"
                min="0"
                max="32"
                value={activeStyle.borderRadius}
                onChange={(e) => handleStyleChange({ borderRadius: Number(e.target.value) })}
                className="inspector-slider"
              />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>PADDING ({activeStyle.padding}px)</span>
              <input
                type="range"
                min="2"
                max="24"
                value={activeStyle.padding}
                onChange={(e) => handleStyleChange({ padding: Number(e.target.value) })}
                className="inspector-slider"
              />
            </div>
          </div>
        </div>

        {/* ALIGNMENT & POSITION */}
        <div className="inspector-section">
          <label className="inspector-section-label">Alignment & Position</label>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            <button
              type="button"
              className={`inspector-align-btn ${activeStyle.textAlign === 'left' ? 'inspector-align-btn-active' : ''}`}
              onClick={() => handleStyleChange({ textAlign: 'left' })}
              title="Align Left"
            >
              <AlignLeft size={15} />
            </button>
            <button
              type="button"
              className={`inspector-align-btn ${activeStyle.textAlign === 'center' ? 'inspector-align-btn-active' : ''}`}
              onClick={() => handleStyleChange({ textAlign: 'center' })}
              title="Align Center"
            >
              <AlignCenter size={15} />
            </button>
            <button
              type="button"
              className={`inspector-align-btn ${activeStyle.textAlign === 'right' ? 'inspector-align-btn-active' : ''}`}
              onClick={() => handleStyleChange({ textAlign: 'right' })}
              title="Align Right"
            >
              <AlignRight size={15} />
            </button>
          </div>

          {/* 3x3 Position Matrix */}
          <div className="position-matrix-grid">
            {matrixNodes.map((node) => {
              const isActive = activeStyle.alignMatrix === node.id;
              return (
                <div
                  key={node.id}
                  className={`matrix-node-cell ${isActive ? 'matrix-node-active' : ''}`}
                  onClick={() =>
                    handleStyleChange({
                      alignMatrix: node.id,
                      positionX: node.x,
                      positionY: node.y,
                    })
                  }
                  title={node.label}
                >
                  <div className="matrix-dot" />
                </div>
              );
            })}
          </div>
        </div>

        {/* ANIMATION & LANGUAGE */}
        <div className="inspector-section">
          <label className="inspector-section-label">Animation & Motion</label>
          <select
            className="inspector-select"
            value={activeStyle.animation}
            onChange={(e) => handleStyleChange({ animation: e.target.value as CaptionAnimation })}
          >
            <option value="none">None (Static)</option>
            <option value="karaoke">Karaoke Highlight (Active Word)</option>
            <option value="pop">Pop In (Bounce scale)</option>
            <option value="bounce">Bounce Jump</option>
            <option value="fade">Smooth Fade In</option>
            <option value="typewriter">Typewriter Flow</option>
          </select>
        </div>

        {/* ACTION BUTTONS */}
        <div className="inspector-actions-group">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              className="inspector-btn inspector-btn-secondary"
              onClick={() => duplicateCaptionSegment(currentSegment.id)}
            >
              <Copy size={13} />
              <span>Duplicate</span>
            </button>
            <button
              type="button"
              className="inspector-btn inspector-btn-secondary"
              onClick={() => splitCaptionAtCurrentTime(currentSegment.id)}
            >
              <Scissors size={13} />
              <span>Split Here</span>
            </button>
          </div>

          <button
            type="button"
            className="inspector-btn inspector-btn-secondary"
            onClick={() => mergeCaptionWithNext(currentSegment.id)}
          >
            <Layers size={13} />
            <span>Merge with Next Caption</span>
          </button>

          <button
            type="button"
            className="inspector-btn inspector-btn-danger"
            onClick={() => deleteCaptionSegment(currentSegment.id)}
          >
            <Trash2 size={13} />
            <span>Delete Caption</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
