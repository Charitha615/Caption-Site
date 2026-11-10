import { memo } from 'react';
import { Check } from 'lucide-react';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useEditorStore } from '../../../../stores/editor/editorStore';
import { useSelectedCaption } from '../../../../stores/editor/selectors';
import { ANIMATIONS, LAYOUT_TEMPLATES } from '../../model/presets';
import { resolveStyle } from '../../utils/captionStyle';

export const TemplatesPanel = memo(function TemplatesPanel() {
  const globalStyle = useCaptionStore((s) => s.style);
  const scope = useEditorStore((s) => s.styleScope);
  const selected = useSelectedCaption();
  const target = scope === 'caption' && selected ? selected.id : null;
  const style = target && selected ? resolveStyle(globalStyle, selected.styleOverride) : globalStyle;
  const apply = (patch: Parameters<ReturnType<typeof useCaptionStore.getState>['updateStyle']>[0]) =>
    useCaptionStore.getState().updateStyle(patch, target);

  return (
    <div className="ed-panel-scroll">
      <p className="ed-help ed-help-top">
        Applies to <strong>{target ? 'the selected caption' : 'all captions'}</strong>. Change this in the Styles tab.
      </p>

      <h3 className="ed-subhead">Motion</h3>
      <div className="ed-template-list">
        {ANIMATIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`ed-template ${style.animation === a.id ? 'is-selected' : ''}`}
            onClick={() => apply({ animation: a.id })}
            aria-pressed={style.animation === a.id}
          >
            <span className="ed-template-demo" data-anim={a.id} aria-hidden>
              <span>Aa</span>
              <span>අ</span>
            </span>
            <span className="ed-template-text">
              <span className="ed-template-name">
                {a.label}
                {a.timed && <span className="ed-badge">word-timed</span>}
              </span>
              <span className="ed-template-desc">{a.description}</span>
            </span>
            {style.animation === a.id && <Check size={14} className="ed-template-check" />}
          </button>
        ))}
      </div>

      <h3 className="ed-subhead">Layout</h3>
      <div className="ed-template-list">
        {LAYOUT_TEMPLATES.map((t) => {
          const isActive = style.alignMatrix === t.patch.alignMatrix && style.positionY === t.patch.positionY && style.positionX === t.patch.positionX;
          return (
            <button key={t.key} type="button" className={`ed-template ${isActive ? 'is-selected' : ''}`} onClick={() => apply(t.patch)}>
              <span className="ed-layout-demo" aria-hidden>
                <span
                  style={{
                    left: `${t.patch.positionX}%`,
                    top: `${t.patch.positionY}%`,
                    width: `${(t.patch.maxWidth ?? 80) * 0.7}%`,
                    transform: `translate(${t.patch.textAlign === 'left' ? '0' : '-50%'}, ${t.patch.alignMatrix?.startsWith('top') ? '0' : t.patch.alignMatrix?.startsWith('bottom') ? '-100%' : '-50%'})`,
                  }}
                />
              </span>
              <span className="ed-template-text">
                <span className="ed-template-name">{t.label}</span>
                <span className="ed-template-desc">{t.description}</span>
              </span>
              {isActive && <Check size={14} className="ed-template-check" />}
            </button>
          );
        })}
      </div>
    </div>
  );
});
