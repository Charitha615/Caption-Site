import { useEffect, useRef, useState } from 'react';
import { AudioWaveform, Link2, Loader2, Mic2, Scissors, Sparkles, Star, Type, Wand2, X } from 'lucide-react';
import { useToastStore } from '../../../stores/toastStore';
import {
  BUILT_IN_VOICES, VOICE_STYLES, VOICE_TAGS, aiErrorMessage, aiService, type Moment, type TextLanguage, type VoiceOption,
} from '../ai/aiService';
import { cleanClipAudio } from '../ai/cleanAudio';
import { DEFAULT_SILENCE, SPEECH_RATE, findSilences, mixTimeline } from '../ai/timelineAudio';
import { clipEnd, formatTime } from '../model';
import { mergeRanges, totalDuration, useVideoEditorStore } from '../store';
import { useImportFiles } from '../useImportFiles';

const LANGUAGES: { value: TextLanguage; label: string }[] = [
  { value: 'si', label: 'Sinhala' },
  { value: 'en', label: 'English' },
  { value: 'ta', label: 'Tamil' },
];

/** Runs one job at a time and shows its error as a toast. */
function useTask() {
  const [busy, setBusy] = useState<string | null>(null);
  const addToast = useToastStore((s) => s.addToast);
  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try {
      await fn();
    } catch (err) {
      addToast({ type: 'error', message: await aiErrorMessage(err) });
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

const Spin = ({ on, icon }: { on: boolean; icon: React.ReactNode }) => (on ? <Loader2 size={14} className="ve-spin" aria-hidden="true" /> : <>{icon}</>);

/** Everything said in the visible subtitles, for titles and highlights. */
function useTranscript() {
  const tracks = useVideoEditorStore((s) => s.tracks);
  const clips = useVideoEditorStore((s) => s.clips);
  const track = tracks.find((t) => t.subtitles && !t.hidden) ?? tracks.find((t) => t.subtitles);
  return track
    ? clips.filter((c) => c.trackId === track.id && c.text?.trim()).sort((a, b) => a.start - b.start).map((c) => ({ start: c.start, end: clipEnd(c), text: c.text!.trim() }))
    : [];
}

/** The voice list from the server (AI Studio's catalogue), loaded once. */
let voiceList: Promise<VoiceOption[]> | null = null;
function useVoices(): VoiceOption[] {
  const [voices, setVoices] = useState<VoiceOption[]>(BUILT_IN_VOICES);
  useEffect(() => {
    let alive = true;
    voiceList ??= aiService.voices().catch(() => {
      voiceList = null;
      return BUILT_IN_VOICES;
    });
    void voiceList.then((v) => alive && setVoices(v));
    return () => {
      alive = false;
    };
  }, []);
  return voices;
}

function VoiceOver({ text, setText }: { text: string; setText: (t: string) => void }) {
  const voices = useVoices();
  const [voice, setVoice] = useState('Kore');
  const [style, setStyle] = useState('');
  const { busy, run } = useTask();
  const { importFiles } = useImportFiles();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const current = voices.find((v) => v.id === voice);

  const generate = () => run('voice', async () => {
    const blob = await aiService.speech(text.trim(), voice, style.trim());
    const at = useVideoEditorStore.getState().playhead;
    const [id] = await importFiles([new File([blob], `AI voice ${current?.name ?? voice} ${new Date().toTimeString().slice(0, 5)}.wav`, { type: 'audio/wav' })]);
    if (id) useVideoEditorStore.getState().addMediaClip(id, { start: at, freeTrack: true });
  });

  /** Puts a sound tag where the cursor is. */
  const insertTag = (tag: string) => {
    const el = textRef.current;
    const at = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? at;
    setText(`${text.slice(0, at)}${tag} ${text.slice(end)}`);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + tag.length + 1, at + tag.length + 1);
    });
  };

  return (
    <div className="ve-recorder">
      <label className="ve-field">
        <span>What should the voice say?</span>
        <textarea ref={textRef} rows={4} maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} placeholder="ආයුබෝවන්! අද අපි බලමු…" />
      </label>
      <div className="ve-field">
        <span>Sound effects (added at the cursor)</span>
        <div className="ve-chips">
          {VOICE_TAGS.map((tag) => <button key={tag} type="button" onClick={() => insertTag(tag)}>{tag.slice(1, -1)}</button>)}
        </div>
      </div>
      <label className="ve-field">
        <span>Voice</span>
        <select className="ve-select" value={voice} onChange={(e) => setVoice(e.target.value)}>
          {voices.map((v) => (
            <option key={v.id} value={v.id}>{v.name}{v.description ? ` · ${v.description}` : ''}{v.gender ? ` (${v.gender})` : ''}</option>
          ))}
        </select>
      </label>
      <div className="ve-field">
        <span>Style</span>
        <div className="ve-chips">
          <button type="button" className={style === '' ? 'is-on' : ''} aria-pressed={style === ''} onClick={() => setStyle('')}>Natural</button>
          {VOICE_STYLES.map((st) => (
            <button key={st} type="button" className={style === st ? 'is-on' : ''} aria-pressed={style === st} onClick={() => setStyle(st)}>{st}</button>
          ))}
        </div>
        <input className="ve-input" value={style} maxLength={120} placeholder="Or describe it: e.g. like a friendly radio host" onChange={(e) => setStyle(e.target.value)} aria-label="Speaking style" />
      </div>
      <button type="button" className="ve-secondary-btn" disabled={!text.trim() || busy !== null} onClick={() => void generate()}>
        <Spin on={busy === 'voice'} icon={<Mic2 size={14} aria-hidden="true" />} /> {busy ? 'Making the voice…' : 'Make voice-over at the playhead'}
      </button>
      <p className="ve-panel-hint">Speaks Sinhala, English, Tamil and 100+ more languages, including mixed Sinhala and English. Emoji are skipped.</p>
    </div>
  );
}

function SilenceRemoval() {
  const [threshold, setThreshold] = useState(DEFAULT_SILENCE.thresholdDb);
  const [minSilence, setMinSilence] = useState(DEFAULT_SILENCE.minSilence);
  const [found, setFound] = useState<[number, number][] | null>(null);
  const { busy, run } = useTask();
  const addToast = useToastStore((s) => s.addToast);
  const find = () => run('find', async () => {
    const s = useVideoEditorStore.getState();
    s.setPlaying(false);
    const samples = await mixTimeline(s.clips, s.tracks, s.media);
    setFound(findSilences(samples, SPEECH_RATE, { ...DEFAULT_SILENCE, thresholdDb: threshold, minSilence }));
  });
  const seconds = found ? found.reduce((n, [a, b]) => n + b - a, 0) : 0;
  return (
    <div className="ve-recorder">
      <label className="ve-field">
        <span>Quieter than <b>{threshold} dB</b></span>
        <input type="range" min={-60} max={-20} value={threshold} onChange={(e) => { setThreshold(Number(e.target.value)); setFound(null); }} />
      </label>
      <label className="ve-field">
        <span>Pauses longer than <b>{minSilence.toFixed(1)}s</b></span>
        <input type="range" min={0.3} max={3} step={0.1} value={minSilence} onChange={(e) => { setMinSilence(Number(e.target.value)); setFound(null); }} />
      </label>
      <button type="button" className="ve-secondary-btn" disabled={busy !== null} onClick={() => void find()}>
        <Spin on={busy === 'find'} icon={<AudioWaveform size={14} aria-hidden="true" />} /> Find pauses
      </button>
      {found && (found.length === 0 ? (
        <p className="ve-panel-hint">No pauses that long. Try a higher dB value or shorter pauses.</p>
      ) : (
        <button
          type="button"
          className="ve-export"
          onClick={() => {
            useVideoEditorStore.getState().removeRanges(found);
            addToast({ type: 'success', message: `Removed ${found.length} pauses (${seconds.toFixed(1)}s). Undo with Ctrl+Z.` });
            setFound(null);
          }}
        >
          <Scissors size={16} aria-hidden="true" /> Cut {found.length} pauses ({seconds.toFixed(1)}s)
        </button>
      ))}
      <p className="ve-panel-hint">Cuts the quiet parts from every track at once, so pictures, sound and subtitles stay in sync.</p>
    </div>
  );
}

function NoiseRemoval() {
  const clip = useVideoEditorStore((s) => s.clips.find((c) => c.id === s.selectedId));
  const [strength, setStrength] = useState(0.7);
  const [progress, setProgress] = useState(0);
  const { busy, run } = useTask();
  const { importFiles } = useImportFiles();
  const addToast = useToastStore((s) => s.addToast);
  const usable = clip && (clip.kind === 'video' || clip.kind === 'audio');

  const clean = () => run('clean', async () => {
    let s = useVideoEditorStore.getState();
    s.setPlaying(false);
    let target = s.clips.find((c) => c.id === s.selectedId)!;
    // A video's sound is cleaned on its own track.
    if (target.kind === 'video') {
      s.detachAudio(target.id);
      s = useVideoEditorStore.getState();
      target = s.clips.find((c) => c.id === s.selectedId)!;
    }
    const item = s.media.find((m) => m.id === target.mediaId);
    if (!item) throw new Error('The media for this clip is missing.');
    setProgress(0);
    const file = await cleanClipAudio(target, item, strength, setProgress);
    const [id] = await importFiles([file]);
    if (!id) return;
    // The cleaned file starts where the clip did.
    useVideoEditorStore.getState().replaceClipMedia(target.id, id, 0);
    addToast({ type: 'success', message: 'Noise removed. The original stays in your media.' });
  });

  return (
    <div className="ve-recorder">
      <label className="ve-field">
        <span>Strength <b>{Math.round(strength * 100)}%</b></span>
        <input type="range" min={0.2} max={1} step={0.05} value={strength} onChange={(e) => setStrength(Number(e.target.value))} />
      </label>
      <button type="button" className="ve-secondary-btn" disabled={!usable || busy !== null} onClick={() => void clean()}>
        <Spin on={busy === 'clean'} icon={<Wand2 size={14} aria-hidden="true" />} /> {busy ? `Cleaning… ${Math.round(progress * 100)}%` : 'Remove background noise'}
      </button>
      <p className="ve-panel-hint">
        {usable ? 'Learns the steady background (fans, hiss, hum, traffic rumble) from the quiet moments and removes it.' : 'Select a video or audio clip with speech first.'}
      </p>
    </div>
  );
}

function ScriptWriter({ onUseAsVoice }: { onUseAsVoice: (text: string) => void }) {
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState<TextLanguage>('si');
  const [seconds, setSeconds] = useState(60);
  const [tone, setTone] = useState('friendly');
  const [lines, setLines] = useState<string[]>([]);
  const { busy, run } = useTask();

  const addAsText = () => {
    let at = useVideoEditorStore.getState().playhead;
    const items = lines.filter((l) => l.trim()).map((text) => {
      // About 2.5 words a second, at least 1.5 s on screen.
      const duration = Math.max(1.5, text.split(/\s+/).length / 2.5);
      const item = { text: text.trim(), start: at, duration };
      at += duration;
      return item;
    });
    useVideoEditorStore.getState().addTextSequence(items, { y: 0.84, animation: 'fade', background: 'rgba(0, 0, 0, 0.6)', fontSize: 52 });
  };

  return (
    <div className="ve-recorder">
      <label className="ve-field">
        <span>What is the video about?</span>
        <textarea rows={2} maxLength={2000} value={topic} placeholder="A quick guide to the best kottu in Colombo" onChange={(e) => setTopic(e.target.value)} />
      </label>
      <div className="ve-field-row">
        <select className="ve-select" value={language} onChange={(e) => setLanguage(e.target.value as TextLanguage)} aria-label="Script language">
          {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <select className="ve-select" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} aria-label="Length">
          {[30, 60, 90, 180, 300].map((n) => <option key={n} value={n}>{n < 120 ? `${n} sec` : `${n / 60} min`}</option>)}
        </select>
        <select className="ve-select" value={tone} onChange={(e) => setTone(e.target.value)} aria-label="Tone">
          {['friendly', 'exciting', 'professional', 'funny', 'calm', 'storytelling'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <button type="button" className="ve-secondary-btn" disabled={!topic.trim() || busy !== null} onClick={() => void run('script', async () => setLines(await aiService.script(topic.trim(), language, seconds, tone)))}>
        <Spin on={busy === 'script'} icon={<Sparkles size={14} aria-hidden="true" />} /> Write script
      </button>
      {lines.length > 0 && (
        <>
          <textarea className="ve-script" rows={Math.min(10, lines.length + 1)} value={lines.join('\n')} onChange={(e) => setLines(e.target.value.split('\n'))} aria-label="Script" />
          <div className="ve-field-row">
            <button type="button" className="ve-secondary-btn" onClick={addAsText}><Type size={14} aria-hidden="true" /> Add as text</button>
            <button type="button" className="ve-secondary-btn" onClick={() => onUseAsVoice(lines.join(' '))}><Mic2 size={14} aria-hidden="true" /> Use for voice-over</button>
          </div>
        </>
      )}
    </div>
  );
}

function TitleIdeas() {
  const transcript = useTranscript();
  const setName = useVideoEditorStore((s) => s.setName);
  const [about, setAbout] = useState('');
  const [language, setLanguage] = useState<TextLanguage>('si');
  const [titles, setTitles] = useState<string[]>([]);
  const { busy, run } = useTask();
  const context = transcript.length ? transcript.map((l) => l.text).join(' ').slice(0, 20000) : about.trim();
  return (
    <div className="ve-recorder">
      {transcript.length === 0 && (
        <label className="ve-field">
          <span>Describe the video (or generate subtitles first)</span>
          <textarea rows={2} value={about} onChange={(e) => setAbout(e.target.value)} />
        </label>
      )}
      <div className="ve-field-row">
        <select className="ve-select" value={language} onChange={(e) => setLanguage(e.target.value as TextLanguage)} aria-label="Title language">
          {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <button type="button" className="ve-secondary-btn" disabled={!context || busy !== null} onClick={() => void run('titles', async () => setTitles(await aiService.titles(context, language)))}>
          <Spin on={busy === 'titles'} icon={<Sparkles size={14} aria-hidden="true" />} /> Suggest titles
        </button>
      </div>
      {titles.length > 0 && (
        <ul className="ve-pick-list">
          {titles.map((t) => <li key={t}><button type="button" onClick={() => setName(t)} title="Use as the video name">{t}</button></li>)}
        </ul>
      )}
    </div>
  );
}

function Highlights() {
  const transcript = useTranscript();
  const [count, setCount] = useState(3);
  const [moments, setMoments] = useState<Moment[]>([]);
  const { busy, run } = useTask();
  const { setPlayhead, removeRanges } = useVideoEditorStore.getState();
  const keepOnly = () => {
    const total = totalDuration(useVideoEditorStore.getState().clips);
    const keep = mergeRanges(moments.map((m) => [m.start, m.end]));
    const cut: [number, number][] = [];
    let cursor = 0;
    for (const [a, b] of keep) {
      if (a > cursor) cut.push([cursor, a]);
      cursor = b;
    }
    if (cursor < total) cut.push([cursor, total]);
    removeRanges(cut);
    setMoments([]);
  };
  return (
    <div className="ve-recorder">
      {transcript.length === 0 ? (
        <p className="ve-panel-hint">Generate subtitles first: highlights are picked from what is said.</p>
      ) : (
        <>
          <div className="ve-field-row">
            <select className="ve-select" value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="How many highlights">
              {[1, 3, 5, 8].map((n) => <option key={n} value={n}>{n} moment{n > 1 ? 's' : ''}</option>)}
            </select>
            <button type="button" className="ve-secondary-btn" disabled={busy !== null} onClick={() => void run('highlights', async () => setMoments(await aiService.highlights(transcript, count)))}>
              <Spin on={busy === 'highlights'} icon={<Star size={14} aria-hidden="true" />} /> Find highlights
            </button>
          </div>
          {moments.length > 0 && (
            <>
              <ul className="ve-pick-list">
                {moments.map((m) => (
                  <li key={`${m.start}-${m.end}`}>
                    <button type="button" onClick={() => setPlayhead(m.start)} title={m.reason}>
                      <strong>{formatTime(m.start, false)}–{formatTime(m.end, false)}</strong> {m.title}
                      {m.reason && <span>{m.reason}</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="ve-export" onClick={keepOnly}><Scissors size={16} aria-hidden="true" /> Keep only these moments</button>
            </>
          )}
        </>
      )}
    </div>
  );
}

const sizeText = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

/** Paste a TikTok (or direct media) link: the server downloads it and it lands in Media. */
function ImportFromLink() {
  const [url, setUrl] = useState('');
  const [allowed, setAllowed] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number | null } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const addToast = useToastStore((s) => s.addToast);
  const { importFiles } = useImportFiles();
  useEffect(() => () => abortRef.current?.abort(), []);

  const isTikTok = /(^|\.)tiktok\.com/i.test((() => {
    try {
      return new URL(url.trim()).hostname;
    } catch {
      return '';
    }
  })());

  const start = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ loaded: 0, total: null });
    try {
      const file = await aiService.importLink(url.trim(), (loaded, total) => setProgress({ loaded, total }), controller.signal);
      const [id] = await importFiles([file]);
      if (id) {
        addToast({ type: 'success', message: `“${file.name}” is in your media.` });
        setUrl('');
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
        <span>Video link</span>
        <input
          className="ve-input"
          type="url"
          inputMode="url"
          value={url}
          disabled={busy}
          placeholder="https://www.tiktok.com/@name/video/…"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && allowed && url.trim() && !busy && void start()}
        />
      </label>
      <label className="ve-field is-inline">
        <input type="checkbox" checked={allowed} disabled={busy} onChange={(e) => setAllowed(e.target.checked)} />
        <span>I own this video or have permission to use it</span>
      </label>
      {busy ? (
        <>
          <div className="ve-progress" role="progressbar" aria-label="Download progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.total ? Math.round((progress.loaded / progress.total) * 100) : undefined}>
            <span style={{ width: progress.total ? `${(progress.loaded / progress.total) * 100}%` : '6%' }} />
          </div>
          <p className="ve-panel-hint" aria-live="polite">{progress.loaded > 0 ? `Downloading… ${sizeText(progress.loaded)}${progress.total ? ` of ${sizeText(progress.total)}` : ''}` : 'Getting the video…'}</p>
          <button type="button" className="ve-secondary-btn" onClick={() => abortRef.current?.abort()}><X size={14} aria-hidden="true" /> Cancel</button>
        </>
      ) : (
        <button type="button" className="ve-export" disabled={!url.trim() || !allowed} onClick={() => void start()}>
          <Link2 size={16} aria-hidden="true" /> {isTikTok ? 'Download TikTok (no watermark)' : 'Download and import'}
        </button>
      )}
      <p className="ve-panel-hint">TikTok videos come without the TikTok watermark. Direct links to video, audio or image files work too. The file goes into Media.</p>
    </div>
  );
}

export function AiToolsPanel() {
  const [voiceText, setVoiceText] = useState('');
  return (
    <div className="ve-panel">
      <h2 className="ve-panel-title">Import from a link</h2>
      <ImportFromLink />
      <h2 className="ve-panel-title">AI voice-over</h2>
      <VoiceOver text={voiceText} setText={setVoiceText} />
      <h2 className="ve-panel-title">Remove silences</h2>
      <SilenceRemoval />
      <h2 className="ve-panel-title">Remove noise</h2>
      <NoiseRemoval />
      <h2 className="ve-panel-title">Script writer</h2>
      <ScriptWriter onUseAsVoice={setVoiceText} />
      <h2 className="ve-panel-title">Title ideas</h2>
      <TitleIdeas />
      <h2 className="ve-panel-title">Highlights</h2>
      <Highlights />
    </div>
  );
}
