import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Heart, Loader2, Pause, Play, Search, X } from 'lucide-react';
import { useToastStore } from '../../../stores/toastStore';
import { VOICE_STYLES, VOICE_TAGS, aiErrorMessage, aiService, type VoiceOption } from '../ai/aiService';
import { OTHER_CATEGORY, VOICE_CATEGORIES, loadFavorites, saveFavorites, voiceCategory, voiceGender } from '../ai/voiceCatalog';

/* ------------------------------------------------------------------ previews */

/** Sample clips already made this session, so a voice is only generated once. */
const previewUrls = new Map<string, string>();

/** Plays a short sample of a voice (made by the speech API on first play). */
function useVoicePreview() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const addToast = useToastStore((s) => s.addToast);
  useEffect(() => () => audioRef.current?.pause(), []);

  const stop = () => {
    audioRef.current?.pause();
    setPlaying(null);
  };

  const toggle = async (voice: VoiceOption) => {
    if (playing === voice.id) return stop();
    stop();
    let url = previewUrls.get(voice.id);
    if (!url) {
      setLoading(voice.id);
      try {
        const blob = await aiService.speech(`Hi, I'm ${voice.name}. This is how I sound.`, voice.id, '');
        url = URL.createObjectURL(blob);
        previewUrls.set(voice.id, url);
      } catch (err) {
        addToast({ type: 'error', message: await aiErrorMessage(err) });
        return;
      } finally {
        setLoading(null);
      }
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setPlaying(null);
    setPlaying(voice.id);
    void audio.play().catch(() => setPlaying(null));
  };

  return { playing, loading, toggle };
}

type Preview = ReturnType<typeof useVoicePreview>;

function PlayButton({ voice, preview }: { voice: VoiceOption; preview: Preview }) {
  const isLoading = preview.loading === voice.id;
  const isPlaying = preview.playing === voice.id;
  return (
    <button
      type="button"
      className="ve-voice-play"
      aria-label={isPlaying ? `Stop ${voice.name} sample` : `Play ${voice.name} sample`}
      disabled={preview.loading !== null && !isLoading}
      onClick={() => void preview.toggle(voice)}
    >
      {isLoading ? <Loader2 size={13} className="ve-spin" /> : isPlaying ? <Pause size={13} /> : <Play size={13} />}
    </button>
  );
}

const genderLabel = (g: string | null) => (g ? g[0]!.toUpperCase() + g.slice(1) : null);
const voiceMeta = (v: VoiceOption) => [v.description, genderLabel(voiceGender(v))].filter(Boolean).join(' · ');

/* -------------------------------------------------------------- voice dialog */

const PREVIEW_COUNT = 3;

function VoiceDialog({ voices, value, onPick, onClose }: {
  voices: VoiceOption[];
  value: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState('');
  const [category, setCategory] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const preview = useVoicePreview();
  const dialogRef = useRef<HTMLDivElement>(null);
  const current = voices.find((v) => v.id === value);
  useEffect(() => dialogRef.current?.focus(), []);

  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
    setFavorites(next);
    saveFavorites(next);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return voices.filter((v) =>
      (!q || `${v.name} ${v.description}`.toLowerCase().includes(q))
      && (!gender || voiceGender(v) === gender)
      && (!category || voiceCategory(v) === category));
  }, [voices, query, gender, category]);

  // Searching or filtering shows one flat list; otherwise voices are grouped by use.
  const filtering = query.trim() !== '' || gender !== '' || category !== '';
  const groups = [...VOICE_CATEGORIES, OTHER_CATEGORY]
    .map((c) => ({ ...c, voices: voices.filter((v) => voiceCategory(v) === c.id) }))
    .filter((g) => g.voices.length > 0);
  const favoriteVoices = voices.filter((v) => favorites.includes(v.id));

  const row = (v: VoiceOption) => (
    <li key={v.id} className={v.id === value ? 'is-on' : ''}>
      <button type="button" className="ve-voice-pick" onClick={() => { onPick(v.id); onClose(); }} aria-current={v.id === value}>
        <strong>{v.name}</strong>
        <span>{voiceMeta(v)}</span>
      </button>
      <button
        type="button"
        className={`ve-voice-fav ${favorites.includes(v.id) ? 'is-on' : ''}`}
        aria-pressed={favorites.includes(v.id)}
        aria-label={`Favourite ${v.name}`}
        onClick={() => toggleFavorite(v.id)}
      >
        <Heart size={14} />
      </button>
      <PlayButton voice={v} preview={preview} />
    </li>
  );

  return (
    <div className="ve-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="ve-modal ve-voice-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ve-voice-title"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          e.stopPropagation();
        }}
      >
        <div className="ve-modal-head">
          <h2 id="ve-voice-title">Speaker settings</h2>
          <button type="button" className="ve-icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <p className="ve-voice-label">Voice</p>
        {current && (
          <div className="ve-voice-current">
            <div>
              <span>Current voice</span>
              <strong>{current.name}</strong>
            </div>
            <PlayButton voice={current} preview={preview} />
          </div>
        )}

        <label className="ve-voice-search">
          <Search size={15} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${voices.length} voices`} aria-label="Search voices" />
        </label>
        <div className="ve-voice-filters">
          <select className="ve-select" value={gender} onChange={(e) => setGender(e.target.value)} aria-label="Gender">
            <option value="">Gender</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
          <select className="ve-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Use case">
            <option value="">Use case</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
          {filtering && (
            <button type="button" className="ve-voice-clear" onClick={() => { setQuery(''); setGender(''); setCategory(''); }}>Clear</button>
          )}
        </div>

        <div className="ve-voice-scroll">
          {filtering ? (
            filtered.length ? <ul className="ve-voice-list">{filtered.map(row)}</ul> : <p className="ve-panel-hint">No voices match.</p>
          ) : (
            <>
              {favoriteVoices.length > 0 && (
                <section className="ve-voice-group">
                  <h3>Favourites</h3>
                  <ul className="ve-voice-list">{favoriteVoices.map(row)}</ul>
                </section>
              )}
              {groups.map((g) => {
                const open = expanded === g.id;
                return (
                  <section key={g.id} className="ve-voice-group">
                    <div className="ve-voice-group-head">
                      <h3>{g.label}</h3>
                      {g.voices.length > PREVIEW_COUNT && (
                        <button type="button" onClick={() => setExpanded(open ? null : g.id)}>
                          {open ? 'Show less' : `View all ${g.voices.length}`}
                        </button>
                      )}
                    </div>
                    <ul className="ve-voice-list">{(open ? g.voices : g.voices.slice(0, PREVIEW_COUNT)).map(row)}</ul>
                  </section>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The voice button: shows the chosen voice and opens the speaker settings. */
export function VoiceSelect({ voices, value, onChange }: { voices: VoiceOption[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = voices.find((v) => v.id === value);
  return (
    <>
      <button type="button" className="ve-voice-button" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span>
          <small>Voice</small>
          <strong>{current?.name ?? value}</strong>
          {current && <em>{voiceMeta(current)}</em>}
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && <VoiceDialog voices={voices} value={value} onPick={onChange} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ----------------------------------------------------------------- popovers */

/** A button with a drop-down panel that closes on an outside click or Escape. */
function Popover({ label, children }: { label: React.ReactNode; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <div
      className="ve-popover-wrap"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button type="button" className={`ve-pill ${open ? 'is-on' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        {label} <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && <div className="ve-popover">{children(() => setOpen(false))}</div>}
    </div>
  );
}

export function StylePicker({ value, onChange }: { value: string; onChange: (style: string) => void }) {
  const preset = VOICE_STYLES.find((s) => s.prompt === value);
  const label = value === '' ? 'Style' : preset ? preset.name : 'Custom style';
  return (
    <Popover label={label}>
      {(close) => (
        <>
          <textarea
            className="ve-script"
            rows={2}
            maxLength={120}
            value={preset ? '' : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. Tone, mood, pace…"
            aria-label="Describe the speaking style"
          />
          <ul className="ve-option-list" role="listbox" aria-label="Speaking styles">
            <li>
              <button type="button" role="option" aria-selected={value === ''} className={value === '' ? 'is-on' : ''} onClick={() => { onChange(''); close(); }}>
                <strong>Natural</strong>
                <span>No extra direction</span>
              </button>
            </li>
            {VOICE_STYLES.map((s) => (
              <li key={s.name}>
                <button type="button" role="option" aria-selected={s.prompt === value} className={s.prompt === value ? 'is-on' : ''} onClick={() => { onChange(s.prompt); close(); }}>
                  <strong>{s.name}</strong>
                  <span>{s.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Popover>
  );
}

const TAG_HINTS: Record<string, string> = {
  '<short pause>': 'A brief beat',
  '<long pause>': 'A longer silence',
  '<laugh>': 'A short laugh',
  '<sigh>': 'An audible sigh',
  '<gasp>': 'A sharp breath in',
  '<breath>': 'A natural breath',
};

export function ExpressionPicker({ onInsert }: { onInsert: (tag: string) => void }) {
  return (
    <Popover label={<><code aria-hidden="true">&lt; &gt;</code> Expression</>}>
      {(close) => (
        <ul className="ve-option-list" aria-label="Expressions">
          {VOICE_TAGS.map((tag) => (
            <li key={tag}>
              <button type="button" onClick={() => { onInsert(tag); close(); }}>
                <strong>{tag.slice(1, -1)}</strong>
                <span>{TAG_HINTS[tag] ?? 'Added at the cursor'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}
