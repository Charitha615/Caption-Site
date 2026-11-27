import { useEffect, useRef, useState } from 'react';
import { useToastStore } from '../../../stores/toastStore';
import { analyzeShake } from '../ai/stabilize';
import {
  AlignCenter, AlignLeft, AlignRight, ChevronDown, Copy, Diamond, FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw, Trash2,
  Loader2, Unlink2, Vibrate, Volume2, VolumeX, ZoomIn, ZoomOut, X,
} from 'lucide-react';
import { FILTER_PRESETS } from '../filters';
import {
  DEFAULT_CHROMA, DEFAULT_FILTER, DEFAULT_TRANSFORM, FONTS, KEY_EPSILON, MAX_SPEED, MIN_SPEED, NO_CROP, SPEEDS, TRANSITIONS,
  clipEnd, formatTime, transformAt,
  type AnimProp, type Clip, type Crop, type FilterPresetId, type TextAlign, type TextAnimation, type Transition, type TransitionType,
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
  { id: 'zoom', label: 'Zoom' },
  { id: 'blur', label: 'Blur in' },
  { id: 'bounce', label: 'Bounce' },
];

const ALIGNS: { id: TextAlign; label: string; Icon: typeof AlignLeft }[] = [
  { id: 'left', label: 'Align left', Icon: AlignLeft },
  { id: 'center', label: 'Centre', Icon: AlignCenter },
  { id: 'right', label: 'Align right', Icon: AlignRight },
];

/** Keeps a rotation in -180 … 180. */
const normaliseAngle = (deg: number) => {
  const a = ((((deg + 180) % 360) + 360) % 360) - 180;
  return a === -180 ? 180 : a;
};

/**
 * A slider for a transform value that can be animated. With no keyframes it sets the value; once the
 * property has keyframes, moving it sets a keyframe at the playhead. The diamond adds or removes the
 * keyframe at the playhead.
 */
function KeyedSlider({ clip, prop, label, min, max, step = 1, format }: {
  clip: Clip; prop: AnimProp; label: string; min: number; max: number; step?: number; format?: (v: number) => string;
}) {
  const playhead = useVideoEditorStore((s) => s.playhead);
  const { updateClip, setKeyframe, removeKeyframe } = useVideoEditorStore.getState();
  const inClip = playhead >= clip.start - KEY_EPSILON && playhead <= clipEnd(clip) + KEY_EPSILON;
  const at = Math.min(clipEnd(clip), Math.max(clip.start, playhead));
  const value = transformAt(clip, at)[prop];
  const keys = clip.keyframes[prop] ?? [];
  const animated = keys.length > 0;
  const onKey = inClip && keys.some((k) => Math.abs(k.t - (playhead - clip.start)) <= KEY_EPSILON);
  const change = (v: number) => (animated ? setKeyframe(clip.id, prop, v) : updateClip(clip.id, { transform: { [prop]: v } }));
  const keyLabel = onKey ? `Remove the ${label.toLowerCase()} keyframe here` : `Add a ${label.toLowerCase()} keyframe at the playhead`;
  return (
    <div className="ve-keyed">
      <label className="ve-field">
        <span>
          {label} <b>{format ? format(value) : Math.round(value * 100) / 100}</b>
          {animated && <em className="ve-keyed-count">{keys.length} key{keys.length === 1 ? '' : 's'}</em>}
        </span>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => change(Number(e.target.value))} />
      </label>
      <button
        type="button"
        className={`ve-key-btn ${onKey ? 'is-on' : ''} ${animated ? 'is-animated' : ''}`}
        aria-pressed={onKey}
        aria-label={keyLabel}
        title={inClip ? keyLabel : 'Move the playhead over this clip to add keyframes'}
        disabled={!inClip}
        onClick={() => (onKey ? removeKeyframe(clip.id, prop) : setKeyframe(clip.id, prop, value))}
      >
        <Diamond size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Works out and applies shake correction for a video clip. */
function StabilizeControl({ clip }: { clip: Clip }) {
  const media = useVideoEditorStore((s) => s.media.find((m) => m.id === clip.mediaId));
  const addToast = useToastStore((s) => s.addToast);
  const [progress, setProgress] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async () => {
    if (!media) return;
    useVideoEditorStore.getState().setPlaying(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);
    try {
      const from = clip.offset;
      const to = Math.min(media.duration, clip.offset + clip.duration * clip.speed);
      const stabilize = await analyzeShake(media.url, from, to, setProgress, controller.signal);
      useVideoEditorStore.getState().updateClip(clip.id, { stabilize });
    } catch (err) {
      if (!controller.signal.aborted) addToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not stabilize this clip.' });
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };

  if (progress !== null) {
    return (
      <div className="ve-field-row">
        <span className="ve-panel-hint"><Loader2 size={13} className="ve-spin" aria-hidden="true" /> Analysing motion… {Math.round(progress * 100)}%</span>
        <button type="button" className="ve-chip-btn" onClick={() => abortRef.current?.abort()}>Cancel</button>
      </div>
    );
  }
  return clip.stabilize ? (
    <button type="button" className="ve-secondary-btn is-on" onClick={() => useVideoEditorStore.getState().updateClip(clip.id, { stabilize: null })}>
      <Vibrate size={14} aria-hidden="true" /> Stabilized · turn off
    </button>
  ) : (
    <>
      <button type="button" className="ve-secondary-btn" onClick={() => void run()} disabled={!media}>
        <Vibrate size={14} aria-hidden="true" /> Stabilize shaky video
      </button>
      <p className="ve-panel-hint">Smooths handheld shake. The picture is enlarged slightly to hide the edges.</p>
    </>
  );
}

function TransitionPicker({ label, value, onChange, maxDuration }: {
  label: string; value: Transition; maxDuration: number; onChange: (patch: Partial<Transition>) => void;
}) {
  return (
    <div className="ve-transition">
      <label className="ve-field">
        <span>{label}</span>
        <select className="ve-select" value={value.type} onChange={(e) => onChange({ type: e.target.value as TransitionType })}>
          {TRANSITIONS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
      {value.type !== 'none' && (
        <Slider label="Length" value={Math.min(value.duration, maxDuration)} min={0.1} max={Math.max(0.1, maxDuration)} step={0.1} format={secs} onChange={(v) => onChange({ duration: v })} />
      )}
    </div>
  );
}

/** Properties of the selected clip. */
export function Inspector() {
  const clip = useVideoEditorStore((s) => s.clips.find((c) => c.id === s.selectedId));
  const media = useVideoEditorStore((s) => s.media);
  const fonts = useVideoEditorStore((s) => s.fonts);
  const selectedCount = useVideoEditorStore((s) => s.selectedIds.filter((id) => s.clips.some((c) => c.id === id)).length);
  const { updateClip, deleteSelected, duplicateSelected, addZoomMotion, clearKeyframes, detachAudio, toggleClipMute, rippleDeleteSelected, select } = useVideoEditorStore.getState();
  if (selectedCount > 1) {
    return (
      <aside className="ve-inspector" aria-label="Clip properties">
        <div className="ve-inspector-head">
          <h2 className="ve-panel-title">{selectedCount} clips selected</h2>
        </div>
        <div className="ve-multi">
          <button type="button" className="ve-secondary-btn" onClick={deleteSelected}><Trash2 size={14} aria-hidden="true" /> Delete all (Del)</button>
          <button type="button" className="ve-secondary-btn" onClick={rippleDeleteSelected}>Delete and close the gaps (Shift+Del)</button>
          <button type="button" className="ve-secondary-btn" onClick={() => select(null)}>Clear selection (Esc)</button>
          <p className="ve-panel-hint">Drag any selected clip to move them all together. Shift, Ctrl or ⌘-click a clip to add or remove it; drag across empty track space to select with a box; Ctrl/⌘+A selects everything.</p>
        </div>
      </aside>
    );
  }
  if (!clip) return null;
  const item = media.find((m) => m.id === clip.mediaId);
  const { style, filter, transform } = clip;
  const set = (patch: Parameters<typeof updateClip>[1]) => updateClip(clip.id, patch);
  const isPicture = clip.kind === 'video' || clip.kind === 'image';
  const isVisual = clip.kind !== 'audio';
  const hasKeys = Object.keys(clip.keyframes).length > 0;
  const crop = transform.crop;
  const setCrop = (side: keyof Crop, v: number) => {
    // Opposite sides together can't remove more than 90% of the picture.
    const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;
    set({ transform: { crop: { ...crop, [side]: Math.min(v, 0.9 - crop[opposite[side]]) } } });
  };
  const title = clip.kind === 'text' ? 'Text' : clip.kind === 'color' ? clip.label ?? 'Background' : item?.name ?? 'Clip';

  return (
    <aside className="ve-inspector" aria-label="Clip properties">
      <div className="ve-inspector-head">
        <h2 className="ve-panel-title" title={title}>{title}</h2>
        <button type="button" className="ve-icon-btn" onClick={duplicateSelected} aria-label="Duplicate clip" title="Duplicate (Ctrl+D)"><Copy size={15} /></button>
        <button type="button" className="ve-icon-btn" onClick={deleteSelected} aria-label="Delete clip" title="Delete (Del)"><Trash2 size={15} /></button>
        <button type="button" className="ve-icon-btn ve-inspector-close" onClick={() => select(null)} aria-label="Close clip properties" title="Close (Esc)"><X size={15} /></button>
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
            <select className="ve-select" value={style.font} onChange={(e) => set({ style: { font: e.target.value } })}>
              {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              {fonts.length > 0 && (
                <optgroup label="Your fonts">
                  {fonts.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </optgroup>
              )}
            </select>
          </label>
          <Slider label="Size" value={style.fontSize} min={20} max={220} onChange={(v) => set({ style: { fontSize: v } })} />
          <div className="ve-field">
            <span>Alignment</span>
            <div className="ve-chips">
              {ALIGNS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={(style.align ?? 'center') === id ? 'is-on' : ''}
                  aria-pressed={(style.align ?? 'center') === id}
                  aria-label={label}
                  title={label}
                  // Aligning also moves the text to that side, which is what people expect from the buttons.
                  onClick={() => set({ style: { align: id, x: id === 'left' ? 0.06 : id === 'right' ? 0.94 : 0.5 } })}
                >
                  <Icon size={14} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
          <Slider label="Left / right" value={style.x ?? 0.5} min={0} max={1} step={0.01} format={pct} onChange={(v) => set({ style: { x: v } })} />
          <Slider label="Top / bottom" value={style.y} min={0.05} max={0.95} step={0.01} format={pct} onChange={(v) => set({ style: { y: v } })} />
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

      {clip.kind === 'video' && (
        <Section title="Stabilize" defaultOpen={!!clip.stabilize}>
          <StabilizeControl clip={clip} />
        </Section>
      )}

      {isPicture && (
        <Section title="Crop & rotate" onReset={() => set({ transform: { crop: NO_CROP, rotation: 0, flip: false, flipV: false } })} defaultOpen={false}>
          <div className="ve-field-row">
            <button type="button" className="ve-secondary-btn" onClick={() => set({ transform: { rotation: normaliseAngle(transform.rotation - 90) } })}>
              <RotateCcw size={14} aria-hidden="true" /> 90°
            </button>
            <button type="button" className="ve-secondary-btn" onClick={() => set({ transform: { rotation: normaliseAngle(transform.rotation + 90) } })}>
              <RotateCw size={14} aria-hidden="true" /> 90°
            </button>
            <button type="button" className={`ve-icon-btn ${transform.flip ? 'is-on' : ''}`} aria-pressed={transform.flip} aria-label="Flip left to right" title="Flip left to right" onClick={() => set({ transform: { flip: !transform.flip } })}>
              <FlipHorizontal2 size={15} />
            </button>
            <button type="button" className={`ve-icon-btn ${transform.flipV ? 'is-on' : ''}`} aria-pressed={transform.flipV} aria-label="Flip upside down" title="Flip upside down" onClick={() => set({ transform: { flipV: !transform.flipV } })}>
              <FlipVertical2 size={15} />
            </button>
          </div>
          <Slider label="Crop top" value={crop.top} min={0} max={0.9} step={0.01} format={pct} onChange={(v) => setCrop('top', v)} />
          <Slider label="Crop bottom" value={crop.bottom} min={0} max={0.9} step={0.01} format={pct} onChange={(v) => setCrop('bottom', v)} />
          <Slider label="Crop left" value={crop.left} min={0} max={0.9} step={0.01} format={pct} onChange={(v) => setCrop('left', v)} />
          <Slider label="Crop right" value={crop.right} min={0} max={0.9} step={0.01} format={pct} onChange={(v) => setCrop('right', v)} />
        </Section>
      )}

      {isVisual && clip.kind !== 'color' && (
        <Section
          title="Position & motion"
          onReset={() => set({
            keyframes: { scale: [], x: [], y: [], rotation: [] },
            transform: { scale: 1, x: 0, y: 0, rotation: 0, fit: isPicture ? transform.fit : DEFAULT_TRANSFORM.fit },
          })}
          defaultOpen={hasKeys}
        >
          {isPicture && (
            <div className="ve-field">
              <span>Fit</span>
              <div className="ve-chips">
                <button type="button" className={transform.fit === 'contain' ? 'is-on' : ''} aria-pressed={transform.fit === 'contain'} onClick={() => set({ transform: { fit: 'contain' } })}>Fit</button>
                <button type="button" className={transform.fit === 'cover' ? 'is-on' : ''} aria-pressed={transform.fit === 'cover'} onClick={() => set({ transform: { fit: 'cover' } })}>Fill frame</button>
              </div>
            </div>
          )}
          <p className="ve-panel-hint">Press ◆ to animate a value: keyframes at two playhead positions make it move between them.</p>
          <KeyedSlider clip={clip} prop="scale" label="Size" min={0.1} max={4} step={0.01} format={pct} />
          <KeyedSlider clip={clip} prop="x" label="Left / right" min={-1.5} max={1.5} step={0.01} format={pct} />
          <KeyedSlider clip={clip} prop="y" label="Up / down" min={-1.5} max={1.5} step={0.01} format={pct} />
          <KeyedSlider clip={clip} prop="rotation" label="Rotate" min={-180} max={180} format={(v) => `${Math.round(v)}°`} />
          {isPicture && (
            <div className="ve-field-row">
              <button type="button" className="ve-secondary-btn" onClick={() => addZoomMotion(clip.id, 'in')} title="Slowly zoom in across the whole clip">
                <ZoomIn size={14} aria-hidden="true" /> Zoom in
              </button>
              <button type="button" className="ve-secondary-btn" onClick={() => addZoomMotion(clip.id, 'out')} title="Slowly zoom out across the whole clip">
                <ZoomOut size={14} aria-hidden="true" /> Zoom out
              </button>
            </div>
          )}
          {hasKeys && (
            <button type="button" className="ve-secondary-btn" onClick={() => clearKeyframes(clip.id)}>Remove all keyframes</button>
          )}
        </Section>
      )}

      {isVisual && (
        <Section title="Opacity" defaultOpen={false}>
          <KeyedSlider clip={clip} prop="opacity" label="Opacity" min={0} max={1} step={0.01} format={pct} />
        </Section>
      )}

      {isPicture && (
        <Section title="Green screen" onReset={() => set({ chroma: { ...DEFAULT_CHROMA } })} defaultOpen={clip.chroma.enabled}>
          <label className="ve-field is-inline">
            <input type="checkbox" checked={clip.chroma.enabled} onChange={(e) => set({ chroma: { enabled: e.target.checked } })} />
            <span>Remove a background colour</span>
          </label>
          {clip.chroma.enabled && (
            <>
              <div className="ve-field-row">
                <label className="ve-field is-inline">
                  <span>Colour</span>
                  <input type="color" value={clip.chroma.color} onChange={(e) => set({ chroma: { color: e.target.value } })} />
                </label>
                <button type="button" className="ve-chip-btn" onClick={() => set({ chroma: { color: '#00ff00' } })}>Green</button>
                <button type="button" className="ve-chip-btn" onClick={() => set({ chroma: { color: '#0047bb' } })}>Blue</button>
              </div>
              <Slider label="Strength" value={clip.chroma.similarity} min={0} max={1} step={0.01} format={pct} onChange={(v) => set({ chroma: { similarity: v } })} />
              <Slider label="Soft edge" value={clip.chroma.smoothness} min={0} max={1} step={0.01} format={pct} onChange={(v) => set({ chroma: { smoothness: v } })} />
              <label className="ve-field is-inline">
                <input type="checkbox" checked={clip.chroma.spill} onChange={(e) => set({ chroma: { spill: e.target.checked } })} />
                <span>Remove colour tint on edges</span>
              </label>
              <p className="ve-panel-hint">Put this clip on a track above the new background.</p>
            </>
          )}
        </Section>
      )}

      {isVisual && (
        <Section title="Transitions" defaultOpen={clip.transitionIn.type !== 'none' || clip.transitionOut.type !== 'none'}>
          <TransitionPicker label="In" value={clip.transitionIn} maxDuration={Math.min(3, clip.duration)} onChange={(patch) => set({ transitionIn: patch })} />
          <TransitionPicker label="Out" value={clip.transitionOut} maxDuration={Math.min(3, clip.duration)} onChange={(patch) => set({ transitionOut: patch })} />
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
          <Slider label="Custom speed" value={clip.speed} min={MIN_SPEED} max={MAX_SPEED} step={0.05} format={(v) => `${Math.round(v * 100) / 100}×`} onChange={(v) => set({ speed: v })} />
          {clip.speed > 4 && <p className="ve-panel-hint">Above 4× most browsers play the picture without sound.</p>}
          <button type="button" className={`ve-secondary-btn ${clip.muted ? 'is-on' : ''}`} aria-pressed={!!clip.muted} onClick={() => toggleClipMute(clip.id)}>
            {clip.muted ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />} {clip.muted ? 'Muted · click to unmute' : 'Mute this clip'}
          </button>
          <Slider label="Volume" value={clip.volume} min={0} max={1} step={0.01} format={pct} onChange={(v) => set({ volume: v })} />
          <label className="ve-field is-inline" title="Cuts rumble, hum and hiss and evens out loudness">
            <input type="checkbox" checked={clip.denoise} onChange={(e) => set({ denoise: e.target.checked })} />
            <span>Clean up voice (reduce hum and hiss)</span>
          </label>
          {clip.kind === 'video' && (
            <button type="button" className="ve-secondary-btn" onClick={() => detachAudio(clip.id)} title="Put the sound on its own audio track to trim or move it separately">
              <Unlink2 size={14} aria-hidden="true" /> Detach audio
            </button>
          )}
        </Section>
      )}

      <Section title="Fade">
        <Slider label="Fade in" value={clip.fadeIn} min={0} max={Math.min(5, clip.duration)} step={0.1} format={secs} onChange={(v) => set({ fadeIn: v })} />
        <Slider label="Fade out" value={clip.fadeOut} min={0} max={Math.min(5, clip.duration)} step={0.1} format={secs} onChange={(v) => set({ fadeOut: v })} />
      </Section>
    </aside>
  );
}
