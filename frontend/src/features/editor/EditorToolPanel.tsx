import React, { useState } from 'react';
import {
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Copy,
  Scissors,
  Search,
  Film,
  UploadCloud,
  Clock,
  Sliders,
  Type,
  Palette,
  Check,
  Zap,
} from 'lucide-react';
import {
  useEditorStore,
  PRESET_TEMPLATES,
  type CaptionAnimation,
} from '../../stores/editorStore';
import { useToastStore } from '../../stores/toastStore';
import { formatDuration } from '../../utils/formatters';
import './EditorToolPanel.css';

export const EditorToolPanel: React.FC = () => {
  const {
    activeTool,
    captions,
    selectedCaptionId,
    activeCaptionIndex,
    setSelectedCaptionId,
    setActiveCaptionIndex,
    updateCaptionText,
    addCaptionSegment,
    deleteCaptionSegment,
    duplicateCaptionSegment,
    splitCaptionAtCurrentTime,
    currentTime,
    duration,
    videoUrl,
    setVideoUrl,
    style,
    updateStyle,
    applyPreset,
    resetTransform,
    isSnappingEnabled,
    setIsSnappingEnabled,
  } = useEditorStore();

  const { addToast } = useToastStore();

  // Captions Search Filter
  const [captionSearch, setCaptionSearch] = useState('');

  // Accordion open/close states
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    font: true,
    colors: false,
    background: false,
  });

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const blobUrl = URL.createObjectURL(file);
      setVideoUrl(blobUrl);
      addToast({
        type: 'success',
        title: 'Video Loaded',
        message: `Loaded ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
      });
    }
  };

  // TAB 1: MEDIA
  const renderMediaPanel = () => (
    <div className="tool-panel-scrollable">
      <div className="media-info-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Film size={20} color="var(--brand-primary)" />
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#FFFFFF' }}>Video Asset</span>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#9CA3AF', margin: '6px 0 12px 0' }}>
          {videoUrl ? 'Source video attached and synchronized with caption tracks.' : 'No active video stream loaded.'}
        </p>

        <label
          htmlFor="editor-video-replace-input"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            border: '1.5px dashed #383838',
            background: '#1F1F1F',
            color: '#E5E7EB',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <UploadCloud size={16} />
          <span>Replace Video File</span>
          <input
            id="editor-video-replace-input"
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={handleVideoUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div className="media-stats-group">
        <div className="media-stat-item">
          <span className="media-stat-label">TIMELINE DURATION</span>
          <span className="media-stat-val">{formatDuration(duration)}</span>
        </div>
        <div className="media-stat-item">
          <span className="media-stat-label">TOTAL CAPTION SEGMENTS</span>
          <span className="media-stat-val">{captions.length}</span>
        </div>
        <div className="media-stat-item">
          <span className="media-stat-label">SPEECH AUDIO TRACK</span>
          <span className="media-stat-val" style={{ color: '#10B981' }}>Active Waveform</span>
        </div>
      </div>
    </div>
  );

  // TAB 2: CAPTIONS LIST
  const filteredCaptions = captionSearch.trim()
    ? captions.filter((c) => c.text.toLowerCase().includes(captionSearch.toLowerCase()))
    : captions;

  const renderCaptionsPanel = () => (
    <div className="tool-panel-scrollable" style={{ padding: '12px' }}>
      {/* Search and Add Header */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#9CA3AF' }} />
          <input
            type="text"
            className="tool-search-input"
            placeholder="Search captions..."
            value={captionSearch}
            onChange={(e) => setCaptionSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 30px',
              background: '#1F1F1F',
              border: '1px solid #333333',
              borderRadius: '6px',
              color: '#FFFFFF',
              fontSize: '0.825rem',
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => addCaptionSegment(currentTime)}
          style={{
            background: 'var(--brand-primary)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 600,
            fontSize: '0.8rem',
            flexShrink: 0,
          }}
          title="Add caption at current time (A)"
        >
          <Plus size={14} />
          <span>Add</span>
        </button>
      </div>

      {/* Captions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
        {filteredCaptions.map((cap, idx) => {
          const isSelected = cap.id === selectedCaptionId;
          const isActive = idx === activeCaptionIndex;

          return (
            <div
              key={cap.id}
              className={`caption-item-card ${isSelected ? 'caption-item-card-selected' : ''} ${isActive ? 'caption-item-card-active' : ''}`}
              onClick={() => {
                setSelectedCaptionId(cap.id);
                setActiveCaptionIndex(idx);
              }}
              style={{
                background: isSelected ? '#252033' : '#1A1A1A',
                border: isSelected ? '1px solid var(--brand-primary)' : isActive ? '1px solid #4B5563' : '1px solid #2B2B2B',
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Timing row & actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: isSelected ? 'var(--brand-primary-light)' : '#9CA3AF',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Clock size={11} />
                  <span>{formatDuration(cap.start)} ➔ {formatDuration(cap.end)}</span>
                </span>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      splitCaptionAtCurrentTime(cap.id);
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '2px' }}
                    title="Split caption at playhead (S)"
                  >
                    <Scissors size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateCaptionSegment(cap.id);
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '2px' }}
                    title="Duplicate caption"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCaptionSegment(cap.id);
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                    title="Delete caption"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Editable Textarea with Unicode Sinhala support */}
              <textarea
                value={cap.text}
                onChange={(e) => updateCaptionText(cap.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                rows={2}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '0.88rem',
                  lineHeight: '1.4',
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  // TAB 3: STYLES
  const renderStylesPanel = () => (
    <div className="tool-panel-scrollable">
      {/* Apply To Scope */}
      <div className="apply-to-section">
        <span className="apply-to-label">Apply Scope</span>
        <div className="apply-to-tabs">
          <button
            type="button"
            className={`apply-to-btn ${style.applyTo === 'all' ? 'apply-to-btn-active' : ''}`}
            onClick={() => updateStyle({ applyTo: 'all' })}
          >
            All Captions
          </button>
          <button
            type="button"
            className={`apply-to-btn ${style.applyTo === 'single' ? 'apply-to-btn-active' : ''}`}
            onClick={() => updateStyle({ applyTo: 'single' })}
          >
            Selected Only
          </button>
        </div>
      </div>

      {/* Preset Cards Grid (7 Presets) */}
      <div>
        <span className="apply-to-label" style={{ display: 'block', marginBottom: '8px' }}>
          Style Presets
        </span>
        <div className="preset-cards-grid">
          {Object.entries(PRESET_TEMPLATES).map(([key, p]) => {
            const isCurrent = style.preset === key;
            return (
              <div
                key={key}
                className={`preset-card ${isCurrent ? 'preset-card-selected' : ''}`}
                onClick={() => applyPreset(key)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span className="preset-card-title">{p.label}</span>
                  {isCurrent && <Check size={14} style={{ color: 'var(--brand-accent)' }} />}
                </div>
                <div className="preset-card-preview" style={{ fontFamily: p.fontFamily }}>
                  {p.sampleSinhala}
                </div>
                <span style={{ fontSize: '0.68rem', color: '#9CA3AF', marginTop: '4px', display: 'block' }}>
                  {p.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Accordion 1: Typography */}
      <div className="tool-accordion">
        <div className="tool-accordion-header" onClick={() => toggleAccordion('font')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Type size={16} />
            <span>Typography</span>
          </div>
          {openAccordions.font ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>

        {openAccordions.font && (
          <div className="tool-accordion-content">
            {/* Sinhala Font Family */}
            <div className="tool-control-group">
              <label className="tool-control-label">Sinhala Font</label>
              <select
                className="tool-select-input"
                value={style.fontFamily}
                onChange={(e) => updateStyle({ fontFamily: e.target.value })}
              >
                <option value='"Noto Sans Sinhala", sans-serif'>Noto Sans Sinhala</option>
                <option value='"Noto Serif Sinhala", serif'>Noto Serif Sinhala</option>
                <option value='"Gemunu Libre", sans-serif'>Gemunu Libre</option>
                <option value='"Abhaya Libre", serif'>Abhaya Libre</option>
                <option value='"Yaldevi", sans-serif'>Yaldevi</option>
              </select>
            </div>

            {/* Font Size */}
            <div className="tool-control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label className="tool-control-label">Font Size</label>
                <span style={{ fontSize: '0.8rem', color: '#FFFFFF', fontWeight: 600 }}>{style.fontSize}px</span>
              </div>
              <input
                type="range"
                min="16"
                max="60"
                value={style.fontSize}
                className="tool-slider-input"
                onChange={(e) => updateStyle({ fontSize: Number(e.target.value) })}
              />
            </div>

            {/* Font Weight */}
            <div className="tool-control-group">
              <label className="tool-control-label">Font Weight</label>
              <select
                className="tool-select-input"
                value={style.fontWeight}
                onChange={(e) => updateStyle({ fontWeight: Number(e.target.value) })}
              >
                <option value={400}>400 (Regular)</option>
                <option value={600}>600 (Semi-Bold)</option>
                <option value={700}>700 (Bold)</option>
                <option value={800}>800 (Extra-Bold)</option>
                <option value={900}>900 (Black)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Accordion 2: Colors & Stroke */}
      <div className="tool-accordion">
        <div className="tool-accordion-header" onClick={() => toggleAccordion('colors')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Palette size={16} />
            <span>Colors & Stroke</span>
          </div>
          {openAccordions.colors ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>

        {openAccordions.colors && (
          <div className="tool-accordion-content">
            <div className="tool-control-group">
              <label className="tool-control-label">Text Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={style.textColor}
                  onChange={(e) => updateStyle({ textColor: e.target.value })}
                  style={{ width: '32px', height: '32px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={style.textColor}
                  onChange={(e) => updateStyle({ textColor: e.target.value })}
                  className="tool-text-input"
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div className="tool-control-group">
              <label className="tool-control-label">Karaoke Highlight Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={style.highlightColor}
                  onChange={(e) => updateStyle({ highlightColor: e.target.value })}
                  style={{ width: '32px', height: '32px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={style.highlightColor}
                  onChange={(e) => updateStyle({ highlightColor: e.target.value })}
                  className="tool-text-input"
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div className="tool-control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label className="tool-control-label">Stroke Width</label>
                <span style={{ fontSize: '0.8rem', color: '#FFFFFF' }}>{style.outlineWidth}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                value={style.outlineWidth}
                className="tool-slider-input"
                onChange={(e) => updateStyle({ outlineWidth: Number(e.target.value) })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Accordion 3: Background & Box */}
      <div className="tool-accordion">
        <div className="tool-accordion-header" onClick={() => toggleAccordion('background')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={16} />
            <span>Background & Box</span>
          </div>
          {openAccordions.background ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>

        {openAccordions.background && (
          <div className="tool-accordion-content">
            <div className="tool-control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label className="tool-control-label">Background Opacity</label>
                <span style={{ fontSize: '0.8rem', color: '#FFFFFF' }}>{style.backgroundOpacity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={style.backgroundOpacity}
                className="tool-slider-input"
                onChange={(e) => updateStyle({ backgroundOpacity: Number(e.target.value) })}
              />
            </div>

            <div className="tool-control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label className="tool-control-label">Border Radius</label>
                <span style={{ fontSize: '0.8rem', color: '#FFFFFF' }}>{style.borderRadius}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="32"
                value={style.borderRadius}
                className="tool-slider-input"
                onChange={(e) => updateStyle({ borderRadius: Number(e.target.value) })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // TAB 4: TEMPLATES
  const templatesList: Array<{ id: CaptionAnimation; label: string; desc: string }> = [
    { id: 'karaoke', label: 'Karaoke Highlight', desc: 'Highlights current active word dynamically in real-time.' },
    { id: 'pop', label: 'Word Pop In', desc: 'Energetic scale transition for reels & shorts.' },
    { id: 'bounce', label: 'Bounce Jump', desc: 'Punchy bounce emphasis on newly spoken phrases.' },
    { id: 'fade', label: 'Smooth Fade', desc: 'Gentle opacity crossfade for long-form narrative videos.' },
    { id: 'typewriter', label: 'Typewriter Flow', desc: 'Character by character reveal animation.' },
    { id: 'none', label: 'Static Classic', desc: 'Standard solid subtitles without motion.' },
  ];

  const renderTemplatesPanel = () => (
    <div className="tool-panel-scrollable">
      <span className="apply-to-label" style={{ display: 'block', marginBottom: '8px' }}>
        Motion & Animations
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {templatesList.map((tpl) => {
          const isSelected = style.animation === tpl.id;
          return (
            <div
              key={tpl.id}
              className={`template-item-row ${isSelected ? 'template-item-row-active' : ''}`}
              onClick={() => updateStyle({ animation: tpl.id })}
              style={{
                background: isSelected ? '#252033' : '#1A1A1A',
                border: isSelected ? '1.5px solid var(--brand-primary)' : '1px solid #2B2B2B',
                borderRadius: '8px',
                padding: '12px',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#FFFFFF' }}>
                  <Zap size={14} color="var(--brand-accent)" />
                  <span>{tpl.label}</span>
                </div>
                {isSelected && <Check size={14} color="var(--brand-primary)" />}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: '4px 0 0 0' }}>{tpl.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );

  // TAB 5: SETTINGS
  const renderSettingsPanel = () => (
    <div className="tool-panel-scrollable">
      <div className="settings-group">
        <label className="tool-control-label">Timeline Snapping</label>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#1F1F1F', borderRadius: '6px' }}>
          <span style={{ fontSize: '0.85rem', color: '#FFFFFF' }}>Snap to Caption Boundaries</span>
          <input
            type="checkbox"
            checked={isSnappingEnabled}
            onChange={(e) => setIsSnappingEnabled(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
        </div>
      </div>

      <div className="settings-group" style={{ marginTop: '16px' }}>
        <button
          type="button"
          onClick={resetTransform}
          style={{
            width: '100%',
            padding: '10px',
            background: '#262626',
            color: '#E5E7EB',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <RotateCcw size={14} />
          <span>Reset All Styles to Defaults</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="editor-tool-panel">
      {/* Header */}
      <div className="tool-panel-header">
        <div className="tool-panel-title">
          <span>{activeTool.toUpperCase()}</span>
        </div>
        {activeTool === 'styles' && (
          <button type="button" className="tool-panel-reset-btn" onClick={resetTransform}>
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Body by Tab */}
      {activeTool === 'media' && renderMediaPanel()}
      {activeTool === 'captions' && renderCaptionsPanel()}
      {activeTool === 'styles' && renderStylesPanel()}
      {activeTool === 'templates' && renderTemplatesPanel()}
      {activeTool === 'settings' && renderSettingsPanel()}
    </div>
  );
};
