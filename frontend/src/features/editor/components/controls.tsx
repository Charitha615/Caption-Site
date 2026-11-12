import React, { memo, useId, useState } from 'react';
import { isValidColor, toHex } from '../utils/captionStyle';
import { formatTimecode, parseTimecode } from '../utils/time';

/* Small, memoised form primitives used across the editor panels. */

export const IconButton = memo(function IconButton({
  tip,
  tipSide = 'bottom',
  active,
  className = '',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tip: string; tipSide?: 'top' | 'bottom' | 'left' | 'right'; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={tip.split('  ·  ')[0]}
      aria-pressed={active}
      data-tip={tip}
      data-tip-side={tipSide}
      className={`ed-icon-btn ${active ? 'is-active' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

export function Section({
  title,
  children,
  actions,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`ed-section ${open ? 'is-open' : ''}`}>
      <header className="ed-section-head">
        <button type="button" className="ed-section-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="ed-section-caret" aria-hidden>▸</span>
          {title}
        </button>
        {actions}
      </header>
      {open && <div className="ed-section-body">{children}</div>}
    </section>
  );
}

export function Field({ label, hint, children, inline }: { label: string; hint?: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <label className={`ed-field ${inline ? 'is-inline' : ''}`}>
      <span className="ed-field-label">
        {label}
        {hint && <span className="ed-field-hint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const SliderField = memo(function SliderField({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  disabled,
}: {
  label: string;
  /** Short qualifier; "preview" marks properties the MP4 renderer cannot reproduce. */
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const decimals = step < 1 ? String(step).split('.')[1]?.length ?? 1 : 0;
  return (
    <div className="ed-slider">
      <div className="ed-slider-head">
        <label htmlFor={id} className="ed-field-label">
          <span>
            {label}
            {hint === 'preview' ? (
              <span className="ed-field-hint" data-tip={'Shown in the editor preview.\nNot reproduced in rendered MP4 (libass limitation).'}> · preview only</span>
            ) : hint ? <span className="ed-field-hint"> · {hint}</span> : null}
          </span>
        </label>
        <NumberInput value={value} min={min} max={max} step={step} decimals={decimals} unit={unit} onChange={onChange} disabled={disabled} />
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--pct' as string]: `${((value - min) / (max - min)) * 100}%` }}
      />
    </div>
  );
});

function NumberInput({
  value,
  min,
  max,
  step,
  decimals,
  unit,
  onChange,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  decimals: number;
  unit: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
    setDraft(null);
  };
  return (
    <span className="ed-num">
      <input
        inputMode="decimal"
        value={draft ?? value.toFixed(decimals)}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setDraft(null);
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            onChange(Math.min(max, Math.max(min, Number((value + delta).toFixed(decimals)))));
          }
        }}
        aria-label="Value"
      />
      {unit && <span className="ed-num-unit">{unit}</span>}
    </span>
  );
}

export const ColorField = memo(function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const hex = toHex(value);
  return (
    <div className="ed-color">
      <span className="ed-field-label">{label}</span>
      <div className="ed-color-row">
        <span className="ed-color-swatch" style={{ background: hex }}>
          <input type="color" value={hex} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label={`${label} colour`} />
        </span>
        <input
          className="ed-input ed-mono"
          value={draft ?? hex.toUpperCase()}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null && isValidColor(draft)) onChange(toHex(draft).toUpperCase());
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setDraft(null);
          }}
          aria-label={`${label} hex`}
        />
      </div>
    </div>
  );
});

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: React.ReactNode; tip?: string }>;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  ariaLabel: string;
}) {
  return (
    <div className={`ed-seg ed-seg-${size}`} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'is-active' : ''}
          onClick={() => onChange(o.value)}
          data-tip={o.tip}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="ed-toggle">
      <span>
        <span className="ed-toggle-label">{label}</span>
        {description && <span className="ed-toggle-desc">{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="ed-toggle-track" aria-hidden />
    </label>
  );
}

/**
 * Timecode input ("00:01.25"). Keeps a local draft while typing and commits on
 * Enter/blur — so the timeline doesn't jump around mid-keystroke.
 */
export const TimeInput = memo(function TimeInput({
  value,
  onCommit,
  step = 0.1,
  label,
}: {
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  const commit = () => {
    if (draft === null) return;
    const parsed = parseTimecode(draft);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setDraft(null);
    if (Math.abs(parsed - value) > 0.0005) onCommit(parsed);
  };

  return (
    <input
      className={`ed-input ed-mono ed-time ${invalid ? 'is-invalid' : ''}`}
      value={draft ?? formatTimecode(value, 2)}
      aria-label={label}
      aria-invalid={invalid}
      spellCheck={false}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setDraft(e.target.value);
        setInvalid(false);
      }}
      onBlur={() => {
        commit();
        setDraft(null);
        setInvalid(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setDraft(null);
          setInvalid(false);
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          setDraft(null);
          onCommit(Math.max(0, value + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)));
        }
      }}
    />
  );
});

export function Kbd({ keys }: { keys: readonly string[] }) {
  return (
    <span className="ed-kbd-group">
      {keys.map((k) => (
        <kbd key={k} className="ed-kbd">{k}</kbd>
      ))}
    </span>
  );
}
