import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useToastStore } from '../../../stores/toastStore';
import { ACCEPTED_FONTS, loadFontFile } from '../customFonts';
import { filterCss, FILTER_PRESETS } from '../filters';
import { fontCss, type Fill, type TextStyle } from '../model';
import { useVideoEditorStore } from '../store';

/* ---------- Text ---------- */

const TEXT_PRESETS: { label: string; text: string; sample: string; style: Partial<TextStyle> }[] = [
  { label: 'Title', text: 'Your title', sample: 'Title', style: { fontSize: 120, y: 0.45, animation: 'pop' } },
  { label: 'Subtitle', text: 'Add a subtitle', sample: 'Subtitle', style: { fontSize: 60, y: 0.6, bold: false, animation: 'fade' } },
  { label: 'Caption box', text: 'Caption text', sample: 'Caption', style: { fontSize: 52, y: 0.86, background: 'rgba(0, 0, 0, 0.65)', animation: 'none' } },
  { label: 'Sinhala caption', text: 'සිංහල කැප්ෂන්', sample: 'සිංහල', style: { fontSize: 58, y: 0.86, color: '#ffd400', outline: true, animation: 'none' } },
  { label: 'Bold outline', text: 'WAIT FOR IT', sample: 'BOLD', style: { fontSize: 96, y: 0.5, font: 'impact', outline: true, animation: 'pop' } },
  { label: 'Lower third', text: 'Name · Role', sample: 'Lower third', style: { fontSize: 44, y: 0.8, background: 'rgba(139, 92, 246, 0.9)', animation: 'slide' } },
  { label: 'Typewriter', text: 'Typing this out…', sample: 'Type_', style: { fontSize: 64, y: 0.5, font: 'mono', bold: false, animation: 'typewriter' } },
  { label: 'Quote', text: '“A line worth sharing.”', sample: '“Quote”', style: { fontSize: 72, y: 0.5, font: 'serif', bold: false, animation: 'fade' } },
  { label: 'Social handle', text: '@yourchannel', sample: '@handle', style: { fontSize: 48, y: 0.92, font: 'rounded', background: 'rgba(255, 255, 255, 0.92)', color: '#111111', animation: 'slide' } },
  { label: 'Subscribe', text: 'Subscribe for more!', sample: 'Subscribe', style: { fontSize: 56, y: 0.85, font: 'rounded', background: '#dc2626', animation: 'pop' } },
  { label: 'Lower third left', text: 'Your name\nWhat you do', sample: 'Name', style: { fontSize: 46, y: 0.8, x: 0.06, align: 'left', background: 'rgba(17, 17, 17, 0.85)', animation: 'slide' } },
  { label: 'Breaking', text: 'BREAKING NEWS', sample: 'BREAKING', style: { fontSize: 54, y: 0.88, x: 0.06, align: 'left', font: 'impact', background: '#dc2626', animation: 'zoom' } },
  { label: 'Bounce', text: 'Wow!', sample: 'Wow!', style: { fontSize: 140, y: 0.45, font: 'rounded', color: '#fde047', outline: true, animation: 'bounce' } },
  { label: 'Dreamy', text: 'Somewhere in Ella', sample: 'Dreamy', style: { fontSize: 76, y: 0.5, font: 'serif', bold: false, animation: 'blur' } },
];

function FontUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const fonts = useVideoEditorStore((s) => s.fonts);
  const addFont = useVideoEditorStore((s) => s.addFont);
  const addToast = useToastStore((s) => s.addToast);
  const [busy, setBusy] = useState(false);
  const onFiles = async (files: FileList) => {
    setBusy(true);
    for (const file of Array.from(files)) {
      try {
        const font = await loadFontFile(file);
        addFont(font);
        // Apply it straight away when a text clip is selected.
        const s = useVideoEditorStore.getState();
        const clip = s.clips.find((c) => c.id === s.selectedId);
        if (clip?.kind === 'text') s.updateClip(clip.id, { style: { font: font.id } });
      } catch (err) {
        addToast({ type: 'error', message: err instanceof Error ? err.message : `Could not load “${file.name}”.` });
      }
    }
    setBusy(false);
  };
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FONTS}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <button type="button" className="ve-secondary-btn" onClick={() => inputRef.current?.click()} disabled={busy}>
        <Upload size={14} aria-hidden="true" /> {busy ? 'Loading font…' : 'Upload a font (TTF, OTF, WOFF)'}
      </button>
      {fonts.length > 0 && (
        <p className="ve-panel-hint">
          Your fonts: {fonts.map((f) => <span key={f.id} style={{ fontFamily: fontCss(f.id), color: 'var(--editor-text)' }}>{f.label} </span>)}
        </p>
      )}
    </>
  );
}

export function TextPanel() {
  const addTextClip = useVideoEditorStore((s) => s.addTextClip);
  return (
    <div className="ve-panel">
      <h2 className="ve-panel-title">Text</h2>
      <p className="ve-panel-hint">Added at the playhead. Change the words and look in the panel on the right.</p>
      <FontUpload />
      <div className="ve-tile-grid">
        {TEXT_PRESETS.map((preset) => (
          <button key={preset.label} type="button" className="ve-tile" onClick={() => addTextClip(preset.text, preset.style)}>
            <span className="ve-tile-art is-text" aria-hidden="true">
              <span
                style={{
                  color: preset.style.color ?? '#fff',
                  background: preset.style.background ?? undefined,
                  fontWeight: preset.style.bold === false ? 500 : 800,
                  fontFamily: fontCss(preset.style.font ?? 'sans'),
                  WebkitTextStroke: preset.style.outline ? '0.5px #000' : undefined,
                }}
              >
                {preset.sample}
              </span>
            </span>
            <span className="ve-tile-label">{preset.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Elements: backgrounds and title cards ---------- */

const COLORS: { label: string; fill: Fill }[] = [
  { label: 'Black', fill: { from: '#000000', to: null } },
  { label: 'White', fill: { from: '#ffffff', to: null } },
  { label: 'Purple', fill: { from: '#6d28d9', to: null } },
  { label: 'Amber', fill: { from: '#f59e0b', to: null } },
  { label: 'Sunset', fill: { from: '#7c3aed', to: '#f97316' } },
  { label: 'Ocean', fill: { from: '#0ea5e9', to: '#0f766e' } },
  { label: 'Berry', fill: { from: '#db2777', to: '#6d28d9' } },
  { label: 'Night', fill: { from: '#1d1140', to: '#0b0716' } },
  { label: 'Mint', fill: { from: '#34d399', to: '#0ea5e9' } },
  { label: 'Ember', fill: { from: '#f43f5e', to: '#f59e0b' } },
];

const fillCss = (fill: Fill) => (fill.to ? `linear-gradient(135deg, ${fill.from}, ${fill.to})` : fill.from);

const TITLE_CARDS: { label: string; fill: Fill; text: string; style: Partial<TextStyle> }[] = [
  { label: 'Intro', fill: { from: '#1d1140', to: '#0b0716' }, text: 'Episode 1', style: { fontSize: 120, y: 0.5, animation: 'pop' } },
  { label: 'Chapter', fill: { from: '#7c3aed', to: '#f97316' }, text: 'Part 2', style: { fontSize: 110, y: 0.5, font: 'impact', animation: 'slide' } },
  { label: 'Outro', fill: { from: '#000000', to: null }, text: 'Thanks for watching!', style: { fontSize: 80, y: 0.5, font: 'rounded', animation: 'fade' } },
  { label: 'Sinhala intro', fill: { from: '#db2777', to: '#6d28d9' }, text: 'ආයුබෝවන්!', style: { fontSize: 120, y: 0.5, animation: 'pop' } },
];

export function ElementsPanel() {
  const { addColorClip, addTitleCard } = useVideoEditorStore.getState();
  const addCard = (card: (typeof TITLE_CARDS)[number]) => addTitleCard(card.fill, card.label, card.text, card.style, 3);
  return (
    <div className="ve-panel">
      <h2 className="ve-panel-title">Title cards</h2>
      <p className="ve-panel-hint">A background with a title, 3 seconds at the playhead.</p>
      <div className="ve-tile-grid">
        {TITLE_CARDS.map((card) => (
          <button key={card.label} type="button" className="ve-tile" onClick={() => addCard(card)}>
            <span className="ve-tile-art" style={{ background: fillCss(card.fill) }} aria-hidden="true">
              <span style={{ fontFamily: fontCss(card.style.font ?? 'sans'), fontWeight: 800 }}>{card.text}</span>
            </span>
            <span className="ve-tile-label">{card.label}</span>
          </button>
        ))}
      </div>

      <h2 className="ve-panel-title">Backgrounds</h2>
      <div className="ve-swatch-grid">
        {COLORS.map((c) => (
          <button key={c.label} type="button" className="ve-swatch" onClick={() => addColorClip(c.fill, c.label)} aria-label={`Add ${c.label} background`} title={c.label}>
            <span style={{ background: fillCss(c.fill) }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Filters ---------- */

export function FiltersPanel() {
  const clip = useVideoEditorStore((s) => s.clips.find((c) => c.id === s.selectedId));
  const media = useVideoEditorStore((s) => s.media);
  const { updateClip, updateAll } = useVideoEditorStore.getState();
  const picture = clip && (clip.kind === 'video' || clip.kind === 'image') ? clip : undefined;
  const thumb = picture ? media.find((m) => m.id === picture.mediaId)?.thumb : undefined;

  return (
    <div className="ve-panel">
      <h2 className="ve-panel-title">Filters</h2>
      {!picture ? (
        <p className="ve-panel-hint">Select a video or image clip on the timeline to give it a look.</p>
      ) : (
        <>
          <div className="ve-tile-grid">
            {FILTER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`ve-tile ${picture.filter.preset === preset.id ? 'is-on' : ''}`}
                aria-pressed={picture.filter.preset === preset.id}
                onClick={() => updateClip(picture.id, { filter: { preset: preset.id } })}
              >
                <span className="ve-tile-art">
                  {thumb
                    ? <img src={thumb} alt="" style={{ filter: filterCss({ ...picture.filter, preset: preset.id }, 0.15) }} />
                    : <span className="ve-tile-gradient" style={{ filter: preset.css || undefined }} />}
                </span>
                <span className="ve-tile-label">{preset.label}</span>
              </button>
            ))}
          </div>
          <button type="button" className="ve-secondary-btn" onClick={() => updateAll(['video', 'image'], { filter: { preset: picture.filter.preset } })}>
            Use “{FILTER_PRESETS.find((p) => p.id === picture.filter.preset)?.label}” on every clip
          </button>
        </>
      )}
    </div>
  );
}
