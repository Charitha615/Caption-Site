import { memo, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useEditorStore } from '../../../../stores/editor/editorStore';
import { useSelectedCaption } from '../../../../stores/editor/selectors';
import { applyPresetLook, BUILT_IN_PRESETS } from '../../model/presets';
import type { CaptionStyle } from '../../model/types';
import { Segmented } from '../controls';
import { CaptionBox } from '../player/CaptionBox';

/** Thumbnails normalise text to ~15px so long samples fit, while keeping each preset's look. */
const previewScale = (fontSize: number) => Math.min(0.3, 15 / Math.max(1, fontSize));

const PresetCard = memo(function PresetCard({
  label,
  description,
  sample,
  style,
  selected,
  onApply,
  onDelete,
}: {
  label: string;
  description: string;
  sample: string;
  style: CaptionStyle;
  selected: boolean;
  onApply: () => void;
  onDelete?: () => void;
}) {
  const previewStyle = { ...style, maxWidth: 100, animation: 'none' as const };
  return (
    <div className={`ed-preset ${selected ? 'is-selected' : ''}`}>
      <button type="button" className="ed-preset-main" onClick={onApply} aria-pressed={selected}>
        <div className="ed-preset-preview">
          <CaptionBox
            caption={{ text: sample, start: 0, end: 1, language: 'mixed' }}
            style={previewStyle}
            scale={previewScale(style.fontSize)}
            animate={false}
          />
        </div>
        <div className="ed-preset-meta">
          <span className="ed-preset-name">
            {label}
            {selected && <Check size={13} />}
          </span>
          <span className="ed-preset-desc">{description}</span>
        </div>
      </button>
      {onDelete && (
        <button type="button" className="ed-preset-delete" onClick={onDelete} aria-label={`Delete ${label}`} data-tip="Delete preset">
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
});

export const StylesPanel = memo(function StylesPanel() {
  const style = useCaptionStore((s) => s.style);
  const customPresets = useCaptionStore((s) => s.customPresets);
  const scope = useEditorStore((s) => s.styleScope);
  const selected = useSelectedCaption();
  const [name, setName] = useState('');

  const target = scope === 'caption' && selected ? selected.id : null;
  const currentPreset = target ? selected?.styleOverride?.preset ?? style.preset : style.preset;

  return (
    <div className="ed-panel-scroll">
      <div className="ed-inspector-block">
        <span className="ed-field-label">Apply presets to</span>
        <Segmented
          ariaLabel="Preset scope"
          value={scope}
          onChange={(v) => useEditorStore.getState().setStyleScope(v)}
          options={[
            { value: 'all', label: 'All captions' },
            { value: 'caption', label: 'Selected caption' },
          ]}
        />
        {scope === 'caption' && !selected && <p className="ed-help">Select a caption first — until then presets apply to all.</p>}
      </div>

      <div className="ed-preset-grid">
        {BUILT_IN_PRESETS.map((p) => (
          <PresetCard
            key={p.key}
            label={p.label}
            description={p.description}
            sample={p.sample}
            style={applyPresetLook(style, p.key, p.look)}
            selected={currentPreset === p.key}
            onApply={() => useCaptionStore.getState().applyPreset(p.key, target)}
          />
        ))}
      </div>

      <div className="ed-inspector-block">
        <span className="ed-field-label">Your presets</span>
        {customPresets.length === 0 && (
          <p className="ed-help">Customise a preset in the Properties panel, then save it here to reuse it.</p>
        )}
        <div className="ed-preset-grid">
          {customPresets.map((p) => (
            <PresetCard
              key={p.id}
              label={p.label}
              description={`Based on ${BUILT_IN_PRESETS.find((b) => b.key === p.basePreset)?.label ?? 'custom'}`}
              sample="මගේ style · My style"
              style={p.style}
              selected={currentPreset === p.id}
              onApply={() => useCaptionStore.getState().applyPreset(p.id, target)}
              onDelete={() => useCaptionStore.getState().deleteCustomPreset(p.id)}
            />
          ))}
        </div>
        <form
          className="ed-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            useCaptionStore.getState().saveCustomPreset(name || `My style ${customPresets.length + 1}`);
            setName('');
          }}
        >
          <input
            className="ed-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name current project style…"
            aria-label="New preset name"
            data-native-undo
          />
          <button type="submit" className="ed-btn">
            <Plus size={14} /> Save
          </button>
        </form>
      </div>
    </div>
  );
});
