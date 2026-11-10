import { memo, useCallback } from 'react';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { useCaptionStore, type StyleTarget } from '../../../../stores/editor/captionStore';
import { FONT_WEIGHTS, LATIN_FONTS, SINHALA_FONTS } from '../../model/fonts';
import { ALIGN_POSITIONS, ANIMATIONS } from '../../model/presets';
import type { AlignMatrix, CaptionStyle } from '../../model/types';
import { ColorField, Field, Section, Segmented, SliderField } from '../controls';

const MATRIX: AlignMatrix[] = ['top-left', 'top-center', 'top-right', 'mid-left', 'center', 'mid-right', 'bottom-left', 'bottom-center', 'bottom-right'];

/**
 * Every style property, editing either the global style (target = null) or one
 * caption's override. Rapid changes to one field (slider scrubbing, colour
 * dragging) coalesce into a single undo step.
 */
export const StyleControls = memo(function StyleControls({ value, target }: { value: CaptionStyle; target: StyleTarget }) {
  const set = useCallback(
    <K extends keyof CaptionStyle>(key: K, v: CaptionStyle[K]) => {
      useCaptionStore.getState().updateStyle({ [key]: v } as Partial<CaptionStyle>, target, key);
    },
    [target]
  );

  return (
    <>
      <Section title="Typography">
        <Field label="Font (English)">
          <select className="ed-input" value={value.englishFontFamily} onChange={(e) => set('englishFontFamily', e.target.value)}>
            {LATIN_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </Field>
        <Field label="Font (සිංහල)">
          <select className="ed-input" value={value.fontFamily} onChange={(e) => set('fontFamily', e.target.value)}>
            {SINHALA_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </Field>
        <SliderField label="Font size" value={value.fontSize} min={16} max={160} unit="px" onChange={(v) => set('fontSize', v)} />
        <Field label="Font weight">
          <select className="ed-input" value={value.fontWeight} onChange={(e) => set('fontWeight', Number(e.target.value))}>
            {FONT_WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.value} · {w.label}</option>)}
          </select>
        </Field>
        <div className="ed-grid-2">
          <SliderField label="Line height" value={value.lineHeight} min={0.9} max={2.2} step={0.05} onChange={(v) => set('lineHeight', v)} />
          <SliderField label="Letter spacing" value={value.letterSpacing} min={-4} max={12} step={0.5} unit="px" onChange={(v) => set('letterSpacing', v)} />
        </div>
      </Section>

      <Section title="Colour & stroke">
        <div className="ed-grid-2">
          <ColorField label="Text" value={value.textColor} onChange={(v) => set('textColor', v)} />
          <ColorField label="Highlight" value={value.highlightColor} onChange={(v) => set('highlightColor', v)} />
        </div>
        <div className="ed-grid-2">
          <ColorField label="Stroke" value={value.outlineColor} onChange={(v) => set('outlineColor', v)} />
          <SliderField label="Stroke width" value={value.outlineWidth} min={0} max={20} step={0.5} unit="px" onChange={(v) => set('outlineWidth', v)} />
        </div>
      </Section>

      <Section title="Shadow" defaultOpen={false}>
        <div className="ed-grid-2">
          <ColorField label="Colour" value={value.shadowColor} onChange={(v) => set('shadowColor', v)} />
          <SliderField label="Opacity" value={value.shadowOpacity} min={0} max={100} unit="%" onChange={(v) => set('shadowOpacity', v)} />
        </div>
        <SliderField label="Blur" value={value.shadowBlur} min={0} max={40} unit="px" onChange={(v) => set('shadowBlur', v)} />
        <div className="ed-grid-2">
          <SliderField label="Offset X" value={value.shadowOffsetX} min={-20} max={20} unit="px" onChange={(v) => set('shadowOffsetX', v)} />
          <SliderField label="Offset Y" value={value.shadowOffsetY} min={-20} max={20} unit="px" onChange={(v) => set('shadowOffsetY', v)} />
        </div>
      </Section>

      <Section title="Background">
        <div className="ed-grid-2">
          <ColorField label="Colour" value={value.backgroundColor} onChange={(v) => set('backgroundColor', v)} />
          <SliderField label="Opacity" value={value.backgroundOpacity} min={0} max={100} unit="%" onChange={(v) => set('backgroundOpacity', v)} />
        </div>
        <div className="ed-grid-2">
          <SliderField label="Radius" value={value.borderRadius} min={0} max={60} unit="px" onChange={(v) => set('borderRadius', v)} />
          <SliderField label="Padding" value={value.padding} min={0} max={60} unit="px" onChange={(v) => set('padding', v)} />
        </div>
      </Section>

      <Section title="Alignment & position">
        <div className="ed-position-row">
          <div className="ed-matrix" role="radiogroup" aria-label="Anchor position">
            {MATRIX.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={value.alignMatrix === m}
                aria-label={ALIGN_POSITIONS[m].label}
                data-tip={ALIGN_POSITIONS[m].label}
                className={value.alignMatrix === m ? 'is-active' : ''}
                onClick={() =>
                  useCaptionStore.getState().updateStyle(
                    {
                      alignMatrix: m,
                      positionX: ALIGN_POSITIONS[m].x,
                      positionY: ALIGN_POSITIONS[m].y,
                      textAlign: m.endsWith('left') ? 'left' : m.endsWith('right') ? 'right' : 'center',
                    },
                    target
                  )
                }
              >
                <span />
              </button>
            ))}
          </div>
          <div className="ed-position-fields">
            <Segmented
              ariaLabel="Text alignment"
              size="sm"
              value={value.textAlign}
              onChange={(v) => set('textAlign', v)}
              options={[
                { value: 'left', label: <AlignLeft size={14} />, tip: 'Align left' },
                { value: 'center', label: <AlignCenter size={14} />, tip: 'Align center' },
                { value: 'right', label: <AlignRight size={14} />, tip: 'Align right' },
              ]}
            />
            <p className="ed-help">Tip: drag the caption on the video to place it.</p>
          </div>
        </div>
        <div className="ed-grid-2">
          <SliderField label="Position X" value={value.positionX} min={0} max={100} step={0.5} unit="%" onChange={(v) => set('positionX', v)} />
          <SliderField label="Position Y" value={value.positionY} min={0} max={100} step={0.5} unit="%" onChange={(v) => set('positionY', v)} />
        </div>
        <SliderField label="Max width" value={value.maxWidth} min={20} max={100} unit="%" onChange={(v) => set('maxWidth', v)} />
      </Section>

      <Section title="Animation">
        <Field label="Entrance & emphasis">
          <select className="ed-input" value={value.animation} onChange={(e) => set('animation', e.target.value as CaptionStyle['animation'])}>
            {ANIMATIONS.map((a) => <option key={a.id} value={a.id}>{a.label} — {a.description}</option>)}
          </select>
        </Field>
      </Section>
    </>
  );
});
