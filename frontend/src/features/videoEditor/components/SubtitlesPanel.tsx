import { useEffect, useRef, useState } from 'react';
import { Captions, Download, Languages, Loader2, Wand2, X } from 'lucide-react';
import { useToastStore } from '../../../stores/toastStore';
import { aiErrorMessage, aiService, type SpeechLanguage, type TextLanguage } from '../ai/aiService';
import { generateSubtitles, toSrt, type SubtitleProgress } from '../ai/subtitles';
import { clipEnd, fontCss, formatTime, type TextStyle } from '../model';
import { downloadBlob, fileBase } from '../sources';
import { SUBTITLE_STYLE, useVideoEditorStore } from '../store';

const SPEECH_LANGUAGES: { value: SpeechLanguage; label: string }[] = [
  { value: 'si', label: 'Sinhala (සිංහල)' },
  { value: 'mixed', label: 'Sinhala with English words' },
  { value: 'en', label: 'English' },
  { value: 'auto', label: 'Detect automatically' },
];

const TEXT_LANGUAGES: { value: TextLanguage; label: string }[] = [
  { value: 'si', label: 'Sinhala' },
  { value: 'en', label: 'English' },
  { value: 'ta', label: 'Tamil' },
];

/** Ready-made subtitle looks ("auto caption styling"). */
const CAPTION_STYLES: { label: string; style: Partial<TextStyle> }[] = [
  { label: 'Classic', style: { ...SUBTITLE_STYLE, color: '#ffffff', background: null, font: 'sans' } },
  { label: 'Karaoke', style: { ...SUBTITLE_STYLE, captionMode: 'karaoke', highlight: '#facc15', color: '#ffffff', background: null, font: 'rounded' } },
  { label: 'Word pop', style: { ...SUBTITLE_STYLE, captionMode: 'word', fontSize: 104, y: 0.7, font: 'impact', color: '#ffffff', background: null } },
  { label: 'Boxed', style: { ...SUBTITLE_STYLE, outline: false, background: 'rgba(0, 0, 0, 0.72)', color: '#ffffff', font: 'sans' } },
  { label: 'Yellow', style: { ...SUBTITLE_STYLE, color: '#ffd400', background: null, font: 'sans' } },
  { label: 'Neon', style: { ...SUBTITLE_STYLE, captionMode: 'karaoke', color: '#a5f3fc', highlight: '#f0abfc', font: 'rounded', background: null } },
  { label: 'Purple box', style: { ...SUBTITLE_STYLE, outline: false, background: 'rgba(124, 58, 237, 0.92)', color: '#ffffff', font: 'rounded', captionMode: 'karaoke', highlight: '#fde047' } },
  { label: 'Minimal', style: { ...SUBTITLE_STYLE, fontSize: 44, bold: false, outline: false, background: null, color: '#ffffff', font: 'sans' } },
];

const POSITIONS = [
  { label: 'Top', y: 0.12 },
  { label: 'Middle', y: 0.5 },
  { label: 'Bottom', y: 0.84 },
];

function useToastError() {
  const addToast = useToastStore((s) => s.addToast);
  return async (err: unknown) => addToast({ type: 'error', message: await aiErrorMessage(err) });
}

function AutoSubtitles({ replaceTrackId }: { replaceTrackId?: string }) {
  const hasClips = useVideoEditorStore((s) => s.clips.some((c) => c.kind === 'video' || c.kind === 'audio'));
  const addToast = useToastStore((s) => s.addToast);
  const [language, setLanguage] = useState<SpeechLanguage>('si');
  const [progress, setProgress] = useState<SubtitleProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async () => {
    const s = useVideoEditorStore.getState();
    s.setPlaying(false);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { lines, error } = await generateSubtitles(s, language, setProgress, controller.signal);
      if (controller.signal.aborted) return;
      if (lines.length > 0) {
        useVideoEditorStore.getState().setSubtitles(lines, { replaceTrackId });
      }
      if (error) {
        const message = await aiErrorMessage(error);
        addToast({ type: lines.length ? 'warning' : 'error', message: lines.length ? `Subtitles stopped early: ${message} The lines made so far were added.` : message });
      } else if (lines.length === 0) {
        addToast({ type: 'info', message: 'No speech was found on the timeline.' });
      } else {
        addToast({ type: 'success', message: `${lines.length} subtitle lines added.` });
      }
    } catch (err) {
      if (!controller.signal.aborted) addToast({ type: 'error', message: await aiErrorMessage(err) });
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };

  const busy = progress !== null;
  return (
    <div className="ve-recorder">
      <label className="ve-field">
        <span>Spoken language</span>
        <select className="ve-select" value={language} disabled={busy} onChange={(e) => setLanguage(e.target.value as SpeechLanguage)}>
          {SPEECH_LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </label>
      {busy ? (
        <>
          <div className="ve-progress" role="progressbar" aria-label="Subtitle progress" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            <span style={{ width: `${progress.phase === 'mixing' ? 3 : Math.max(3, (progress.done / progress.total) * 100)}%` }} />
          </div>
          <p className="ve-panel-hint" aria-live="polite">
            {progress.phase === 'mixing' ? 'Reading the sound…' : `Listening… part ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`}
          </p>
          <button type="button" className="ve-secondary-btn" onClick={() => abortRef.current?.abort()}><X size={14} aria-hidden="true" /> Cancel</button>
        </>
      ) : (
        <button type="button" className="ve-export" onClick={() => void run()} disabled={!hasClips}>
          <Captions size={16} aria-hidden="true" /> {replaceTrackId ? 'Generate again' : 'Generate subtitles'}
        </button>
      )}
      <p className="ve-panel-hint">
        {hasClips
          ? 'The sound is sent to our server in short parts and written by Google AI, using your API key and caption minutes.'
          : 'Add a video with sound or an audio clip first.'}
      </p>
    </div>
  );
}

/** A small "busy while running" wrapper that shows errors as toasts. */
function useTask() {
  const [busy, setBusy] = useState<string | null>(null);
  const toastError = useToastError();
  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try {
      await fn();
    } catch (err) {
      await toastError(err);
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

function SinglishConverter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const { busy, run } = useTask();
  const addTextClip = useVideoEditorStore((s) => s.addTextClip);
  return (
    <div className="ve-recorder">
      <label className="ve-field">
        <span>Type in Singlish</span>
        <textarea rows={2} value={input} placeholder="ada api yamu kandy balanna" onChange={(e) => setInput(e.target.value)} />
      </label>
      <button
        type="button"
        className="ve-secondary-btn"
        disabled={!input.trim() || busy !== null}
        onClick={() => void run('convert', async () => setOutput((await aiService.singlishToSinhala(input.split('\n'))).join('\n')))}
      >
        {busy ? <Loader2 size={14} className="ve-spin" aria-hidden="true" /> : <Languages size={14} aria-hidden="true" />} Convert to Sinhala
      </button>
      {output && (
        <>
          <label className="ve-field">
            <span>Sinhala</span>
            <textarea rows={2} value={output} onChange={(e) => setOutput(e.target.value)} />
          </label>
          <button type="button" className="ve-secondary-btn" onClick={() => addTextClip(output)}>Add as text at the playhead</button>
        </>
      )}
    </div>
  );
}

export function SubtitlesPanel() {
  const tracks = useVideoEditorStore((s) => s.tracks);
  const clips = useVideoEditorStore((s) => s.clips);
  const name = useVideoEditorStore((s) => s.name);
  const { setPlayhead, updateClip, styleSubtitles, setSubtitles, toggleTrack, select } = useVideoEditorStore.getState();
  const { busy, run } = useTask();
  const [to, setTo] = useState<TextLanguage>('en');
  const addToast = useToastStore((s) => s.addToast);

  const subtitleTracks = tracks.filter((t) => t.subtitles);
  const active = subtitleTracks.find((t) => !t.hidden) ?? subtitleTracks[0];
  const lines = active ? clips.filter((c) => c.trackId === active.id).sort((a, b) => a.start - b.start) : [];
  const first = lines[0]?.style;

  const show = (id: string) => subtitleTracks.forEach((t) => (t.id === id) === t.hidden && toggleTrack(t.id, 'hidden'));

  const translate = () => run('translate', async () => {
    const texts = await aiService.translate(lines.map((c) => c.text ?? ''), to);
    const label = TEXT_LANGUAGES.find((l) => l.value === to)!.label;
    setSubtitles(
      lines.map((c, i) => ({ start: c.start, end: clipEnd(c), text: texts[i] ?? '' })),
      { name: `Subtitles (${label})`, style: first },
    );
    addToast({ type: 'success', message: `Translated to ${label} on a new subtitles track.` });
  });

  const singlish = () => run('singlish', async () => {
    const texts = await aiService.singlishToSinhala(lines.map((c) => c.text ?? ''));
    setSubtitles(lines.map((c, i) => ({ start: c.start, end: clipEnd(c), text: texts[i] ?? c.text ?? '' })), { replaceTrackId: active!.id, style: first });
  });

  return (
    <div className="ve-panel">
      <h2 className="ve-panel-title">Auto subtitles</h2>
      <AutoSubtitles replaceTrackId={active?.id} />

      {active && (
        <>
          {subtitleTracks.length > 1 && (
            <label className="ve-field">
              <span>Showing</span>
              <select className="ve-select" value={active.id} onChange={(e) => show(e.target.value)}>
                {subtitleTracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}

          <h2 className="ve-panel-title">Caption style</h2>
          <div className="ve-tile-grid">
            {CAPTION_STYLES.map((preset) => (
              <button key={preset.label} type="button" className="ve-tile" onClick={() => styleSubtitles(preset.style, active.id)}>
                <span className="ve-tile-art is-text" aria-hidden="true">
                  <span
                    style={{
                      color: preset.style.color,
                      background: preset.style.background ?? undefined,
                      fontFamily: fontCss(preset.style.font ?? 'sans'),
                      fontWeight: preset.style.bold === false ? 500 : 800,
                      WebkitTextStroke: preset.style.outline ? '0.5px #000' : undefined,
                    }}
                  >
                    {preset.style.captionMode === 'karaoke' ? <>Say <span style={{ color: preset.style.highlight }}>this</span></> : preset.style.captionMode === 'word' ? 'WORD' : 'Subtitle'}
                  </span>
                </span>
                <span className="ve-tile-label">{preset.label}</span>
              </button>
            ))}
          </div>
          <div className="ve-field">
            <span>Position</span>
            <div className="ve-chips">
              {POSITIONS.map((p) => (
                <button key={p.label} type="button" className={first && Math.abs(first.y - p.y) < 0.05 ? 'is-on' : ''} onClick={() => styleSubtitles({ y: p.y }, active.id)}>{p.label}</button>
              ))}
            </div>
          </div>
          {first && (
            <label className="ve-field">
              <span>Size <b>{first.fontSize}</b></span>
              <input type="range" min={28} max={140} value={first.fontSize} onChange={(e) => styleSubtitles({ fontSize: Number(e.target.value) }, active.id)} />
            </label>
          )}

          <h2 className="ve-panel-title">Lines ({lines.length})</h2>
          <ol className="ve-sub-list">
            {lines.map((c) => (
              <li key={c.id}>
                <button type="button" className="ve-sub-time" onClick={() => { setPlayhead(c.start); select(c.id); }} title="Go to this line">{formatTime(c.start)}</button>
                <textarea
                  key={`${c.id}-${c.text}`}
                  defaultValue={c.text}
                  rows={1}
                  aria-label={`Subtitle at ${formatTime(c.start)}`}
                  onBlur={(e) => e.target.value !== c.text && updateClip(c.id, { text: e.target.value })}
                />
              </li>
            ))}
          </ol>

          <h2 className="ve-panel-title">Language</h2>
          <div className="ve-field-row">
            <select className="ve-select" value={to} onChange={(e) => setTo(e.target.value as TextLanguage)} aria-label="Translate to">
              {TEXT_LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <button type="button" className="ve-secondary-btn" disabled={busy !== null || lines.length === 0} onClick={() => void translate()}>
              {busy === 'translate' ? <Loader2 size={14} className="ve-spin" aria-hidden="true" /> : <Languages size={14} aria-hidden="true" />} Translate
            </button>
          </div>
          <button type="button" className="ve-secondary-btn" disabled={busy !== null || lines.length === 0} onClick={() => void singlish()} title="For subtitles written in English letters">
            {busy === 'singlish' ? <Loader2 size={14} className="ve-spin" aria-hidden="true" /> : <Wand2 size={14} aria-hidden="true" />} Singlish lines → Sinhala
          </button>
          <button
            type="button"
            className="ve-secondary-btn"
            disabled={lines.length === 0}
            onClick={() => downloadBlob(new Blob([toSrt(lines)], { type: 'application/x-subrip' }), `${fileBase(name)}.srt`)}
          >
            <Download size={14} aria-hidden="true" /> Download .srt
          </button>
        </>
      )}

      <h2 className="ve-panel-title">Singlish to Sinhala</h2>
      <SinglishConverter />
    </div>
  );
}
