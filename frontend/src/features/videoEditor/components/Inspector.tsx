import { useState } from 'react';
import { ChevronDown, Copy, FlipHorizontal2, RotateCcw, Trash2 } from 'lucide-react';
import { FILTER_PRESETS } from '../filters';
import {
  DEFAULT_FILTER, DEFAULT_TRANSFORM, FONTS, SPEEDS, clipEnd, formatTime,
  type FilterPresetId, type FontId, type TextAnimation,
} from '../model';
import { useVideoEditorStore } from '../store';

function Section({ title, children, defaultOpen = true, onReset }: { title: string; children: React.ReactNode; defaultOpen?: boolean; onReset?: () => void }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="ve-section">
      <div className="ve-section-head">
        <button type="button" className="ve-section-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <ChevronDown size={14} aria-hidden="true" className={open ? '' : 'is-closed'} /> {title}
        </button>
        {onReset && (
          <button type="button" className="ve-icon-btn" onClick={onReset} aria-label={`Reset ${title.toLowerCase()}`} title="Reset"><RotateCcw size={13} /></button>
        )}
      </div>
      {open && <div className="ve-section-body">{children}</div>}
    </section>
  );
}

function Slider({ label, value, min, max, step = 1, format, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; format?: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <label className="ve-field">
      <span>{label} <b>{format ? format(value) : value}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const secs = (v: number) => `${v.toFixed(1)}s`;

const ANIMATIONS: { id: TextAnimation; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'fade', label: 'Fade' },
  { id: 'pop', label: 'Pop' },
  { id: 'slide', label: 'Slide up' },
  { id: 'typewriter', label: 'Typewriter' },
];

/** Properties of the selected clip. */
export function Inspector() {
  const clip = useVideoEditorStore((s) => s.clips.find((c) => c.id === s.selectedId));
  const media = useVideoEditorStore((s) => s.media);
  const { updateClip, deleteSelected, duplicateSelected } = useVideoEditorStore.getState();
  if (!clip) return null;
  const item = media.find((m) => m.id === clip.mediaId);
  const { style, filter, transform } = clip;
  const set = (patch: Parameters<typeof updateClip>[1]) => updateClip(clip.id, patch);
  const isPicture = clip.kind === 'video' || clip.kind === 'image';
  const title = clip.kind === 'text' ? 'Text' : clip.kind === 'color' ? clip.label ?? 'Background' : item?.name ?? 'Clip';

  return (
    <aside className="ve-inspector" aria-label="Clip properties">
      <div className="ve-inspector-head">
        <h2 className="ve-panel-title" title={title}>{title}</h2>
        <button type="button" className="ve-icon-btn" onClick={duplicateSelected} aria-label="Duplicate clip" title="Duplicate (Ctrl+D)"><Copy size={15} /></button>
        <button type="button" className="ve-icon-btn" onClick={deleteSelected} aria-label="Delete clip" title="Delete (Del)"><Trash2 size={15} /></button>
      </div>
      <dl className="ve-inspector-times">
        <div><dt>Start</dt><dd>{formatTime(clip.start)}</dd></div>
        <div><dt>End</dt><dd>{formatTime(clipEnd(clip))}</dd></div>
        <div><dt>Length</dt><dd>{formatTime(clip.duration)}</dd></div>
      </dl>

      {clip.kind === 'text' && style && (
        <Section title="Text">
          <label className="ve-field">
            <span>Words</span>
            {/* key resets the draft when another clip is selected */}
            <textarea key={clip.id} defaultValue={clip.text} rows={3} onBlur={(e) => e.target.value !== clip.text && set({ text: e.target.value })} />
          </label>
          <label className="ve-field">
            <span>Font</span>
            <select className="ve-select" value={style.font} onChange={(e) => set({ style: { font: e.target.value as FontId } })}>
              {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </label>
          <Slider label="Size" value={style.fontSize} min={20} max={220} onChange={(v) => set({ style: { fontSize: v } })} />
          <Slider label="Position" value={style.y} min={0.05} max={0.95} step={0.01} format={pct} onChange={(v) => set({ style: { y: v } })} />
          <div className="ve-field-row">
            <label className="ve-field is-inline">
              <span>Colour</span>
              <input type="color" value={style.color} onChange={(e) => set({ style: { color: e.target.value } })} />
            </label>
            <label className="ve-field is-inline">
              <input type="checkbox" checked={style.bold} onChange={(e) => set({ style: { bold: e.target.checked } })} /> <span>Bold</span>
            </label>
            <label className="ve-field is-inline">
              <input type="checkbox" checked={style.outline} onChange={(e) => set({ style: { outline: e.target.checked } })} /> <span>Outline</span>
            </label>
          </div>
          <div className="ve-field-row">
            <label className="ve-field is-inline">
              <input type="checkbox" checked={!!style.background} onChange={(e) => set({ style: { background: e.target.checked ? '#000000a6' : null } })} />
              <span>Background box</span>
            </label>
            {style.background && (
              <input
                type="color"
                aria-label="Box colour"
                value={style.background.slice(0, 7).startsWith('#') ? style.background.slice(0, 7) : '#000000'}
                onChange={(e) => set({ style: { background: `${e.target.value}d9` } })}
              />
            )}
          </div>
          <div className="ve-field">
            <span>Animation</span>
            <div className="ve-chips">
              {ANIMATIONS.map((a) => (
                <button key={a.id} type="button" className={style.animation === a.id ? 'is-on' : ''} aria-pressed={style.animation === a.id} onClick={() => set({ style: { animation: a.id } })}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </Section>
      )}

      {clip.kind === 'color' && clip.fill && (
        <Section title="Colour">
          <div className="ve-field-row">
            <label className="ve-field is-inline">
              <span>{clip.fill.to ? 'From' : 'Colour'}</span>
              <input type="color" value={clip.fill.from} onChange={(e) => set({ fill: { from: e.target.value } })} />
            </label>
            {clip.fill.to && (
              <label className="ve-field is-inline">
                <span>To</span>
                <input type="color" value={clip.fill.to} onChange={(e) => set({ fill: { to: e.target.value } })} />
              </label>
            )}
            <label className="ve-field is-inline">
              <input type="checkbox" checked={!!clip.fill.to} onChange={(e) => set({ fill: { to: e.target.checked ? '#f97316' : null } })} />
              <span>Gradient</span>
            </label>
          </div>
        </Section>
      )}

      {isPicture && (
        <Section title="Adjust" onReset={() => set({ filter: { ...DEFAULT_FILTER } })}>
          <label className="ve-field">
            <span>Filter</span>
            <select className="ve-select" value={filter.preset} onChange={(e) => set({ filter: { preset: e.target.value as FilterPresetId } })}>
              {FILTER_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <Slider label="Brightness" value={filter.brightness} min={0.2} max={2} step={0.05} format={pct} onChange={(v) => set({ filter: { brightness: v } })} />
          <Slider label="Contrast" value={filter.contrast} min={0.2} max={2} step={0.05} format={pct} onChange={(v) => set({ filter: { contrast: v } })} />
          <Slider label="Saturation" value={filter.saturation} min={0} max={2.5} step={0.05} format={pct} onChange={(v) => set({ filter: { saturation: v } })} />
          <Slider label="Blur" value={filter.blur} min={0} max={30} step={0.5} format={(v) => `${v}px`} onChange={(v) => set({ filter: { blur: v } })} />
        </Section>
      )}

      {isPicture && (
        <Section title="Position & size" onReset={() => set({ transform: { ...DEFAULT_TRANSFORM } })} defaultOpen={false}>
          <div className="ve-field">
            <span>Fit</span>
            <div className="ve-chips">
              <button type="button" className={transform.fit === 'contain' ? 'is-on' : ''} aria-pressed={transform.fit === 'contain'} onClick={() => set({ transform: { fit: 'contain' } })}>Fit</button>
              <button type="button" className={transform.fit === 'cover' ? 'is-on' : ''} aria-pressed={transform.fit === 'cover'} onClick={() => set({ transform: { fit: 'cover' } })}>Fill frame</button>
            </div>
          </div>
          <Slider label="Zoom" value={transform.scale} min={0.2} max={3} step={0.01} format={pct} onChange={(v) => set({ transform: { scale: v } })} />
          <Slider label="Left / right" value={transform.x} min={-1} max={1} step={0.01} format={pct} onChange={(v) => set({ transform: { x: v } })} />
          <Slider label="Up / down" value={transform.y} min={-1} max={1} step={0.01} format={pct} onChange={(v) => set({ transform: { y: v } })} />
          <Slider label="Rotate" value={transform.rotation} min={-180} max={180} format={(v) => `${v}°`} onChange={(v) => set({ transform: { rotation: v } })} />
          <button type="button" className={`ve-secondary-btn ${transform.flip ? 'is-on' : ''}`} aria-pressed={transform.flip} onClick={() => set({ transform: { flip: !transform.flip } })}>
            <FlipHorizontal2 size={14} aria-hidden="true" /> Flip horizontally
          </button>
        </Section>
      )}

      {clip.kind !== 'audio' && (
        <Section title="Opacity" defaultOpen={false}>
          <Slider label="Opacity" value={transform.opacity} min={0} max={1} step={0.01} format={pct} onChange={(v) => set({ transform: { opacity: v } })} />
        </Section>
      )}

      {(clip.kind === 'video' || clip.kind === 'audio') && (
        <Section title="Speed & audio">
          <div className="ve-field">
            <span>Speed</span>
            <div className="ve-chips">
              {SPEEDS.map((sp) => (
                <button key={sp} type="button" className={clip.speed === sp ? 'is-on' : ''} aria-pressed={clip.speed === sp} onClick={() => set({ speed: sp })}>
                  {sp}×
                </button>
              ))}
            </div>
          </div>
          <Slider label="Volume" value={clip.volume} min={0} max={1} step={0.01} format={pct} onChange={(v) => set({ volume: v })} />
        </Section>
      )}

      <Section title="Fade">
        <Slider label="Fade in" value={clip.fadeIn} min={0} max={Math.min(5, clip.duration)} step={0.1} format={secs} onChange={(v) => set({ fadeIn: v })} />
        <Slider label="Fade out" value={clip.fadeOut} min={0} max={Math.min(5, clip.duration)} step={0.1} format={secs} onChange={(v) => set({ fadeOut: v })} />
      </Section>
    </aside>
  );
}
