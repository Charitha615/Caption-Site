import { memo, useEffect, useMemo, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useEditorStore } from '../../../../stores/editor/editorStore';
import { useSelectedCaption } from '../../../../stores/editor/selectors';
import { useEditorProjectStore } from '../../../../stores/editor/editorProjectStore';
import { useTemplateStore } from '../../../../stores/editor/templateStore';
import { apiErrorMessage } from '../../../../services/exportService';
import { sanitizeStyle } from '../../utils/captionStyle';
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
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isDemo = useEditorProjectStore((s) => s.isDemo);
  const templates = useTemplateStore((s) => s.templates);
  const templatesStatus = useTemplateStore((s) => s.status);
  const templatesError = useTemplateStore((s) => s.error);
  const saveTemplate = useTemplateStore((s) => s.save);
  const removeTemplate = useTemplateStore((s) => s.remove);
  const myTemplates = useMemo(() => templates.filter((t) => !t.is_system), [templates]);

  useEffect(() => {
    if (!isDemo) void useTemplateStore.getState().load();
  }, [isDemo]);

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
        <span className="ed-field-label">My templates</span>
        <p className="ed-help">Saved to your account — reuse them in any project and when exporting.</p>
        {isDemo ? (
          <p className="ed-help">Templates are not available in demo mode.</p>
        ) : templatesStatus === 'error' ? (
          <p className="ed-help is-error">{templatesError}</p>
        ) : (
          <div className="ed-preset-grid">
            {myTemplates.map((t) => (
              <PresetCard
                key={t.uuid}
                label={t.name}
                description={t.description ?? 'Custom template'}
                sample={t.preview_text || 'මගේ style · My style'}
                style={sanitizeStyle(t.style)}
                selected={currentPreset === `template:${t.uuid}`}
                onApply={() => useCaptionStore.getState().applyTemplateStyle(sanitizeStyle(t.style, true), `template:${t.uuid}`, t.name, target)}
                onDelete={() => {
                  if (window.confirm(`Delete template “${t.name}”?`)) void removeTemplate(t.uuid).catch((err) => setFormError(apiErrorMessage(err)));
                }}
              />
            ))}
            {customPresets.map((p) => (
              <PresetCard
                key={p.id}
                label={p.label}
                description="Saved in this project"
                sample="මගේ style · My style"
                style={p.style}
                selected={currentPreset === p.id}
                onApply={() => useCaptionStore.getState().applyPreset(p.id, target)}
                onDelete={() => useCaptionStore.getState().deleteCustomPreset(p.id)}
              />
            ))}
          </div>
        )}
        {!isDemo && (
          <form
            className="ed-inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              setFormError(null);
              try {
                const t = await saveTemplate(name.trim() || `My style ${myTemplates.length + 1}`, { ...style });
                useCaptionStore.getState().updateStyle({ preset: `template:${t.uuid}` }, null);
                setName('');
              } catch (err) {
                setFormError(apiErrorMessage(err, 'Could not save template.'));
              } finally {
                setSaving(false);
              }
            }}
          >
            <input
              className="ed-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Save project style as template…"
              aria-label="New template name"
              maxLength={120}
              data-native-undo
            />
            <button type="submit" className="ed-btn" disabled={saving}>
              <Plus size={14} /> Save
            </button>
          </form>
        )}
        {formError && <p className="ed-help is-error">{formError}</p>}
      </div>
    </div>
  );
});
