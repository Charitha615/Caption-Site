import { useState } from 'react';
import { AudioWaveform, Loader2, Mic2, Scissors, Sparkles, Star, Type, Wand2 } from 'lucide-react';
import { useToastStore } from '../../../stores/toastStore';
import { aiErrorMessage, aiService, VOICES, type Moment, type TextLanguage, type Voice } from '../ai/aiService';
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

function VoiceOver({ text, setText }: { text: string; setText: (t: string) => void }) {
  const [voice, setVoice] = useState<Voice>('Kore');
  const [style, setStyle] = useState('');
  const { busy, run } = useTask();
  const { importFiles } = useImportFiles();
  const generate = () => run('voice', async () => {
    const blob = await aiService.speech(text.trim(), voice, style.trim());
    const s = useVideoEditorStore.getState();
    const at = s.playhead;
    const [id] = await importFiles([new File([blob], `AI voice ${voice} ${new Date().toTimeString().slice(0, 5)}.wav`, { type: 'audio/wav' })]);
    if (id) useVideoEditorStore.getState().addMediaClip(id, { start: at, freeTrack: true });
  });
  return (
    <div className="ve-recorder">
      <label className="ve-field">
        <span>What should the voice say?</span>
        <textarea rows={3} maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} placeholder="ආයුබෝවන්! අද අපි බලමු…" />
      </label>
      <div className="ve-field-row">
        <label className="ve-field">
          <span>Voice</span>
          <select className="ve-select" value={voice} onChange={(e) => setVoice(e.target.value as Voice)}>
            {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="ve-field" style={{ flex: 1 }}>
          <span>Style (optional)</span>
          <input className="ve-input" value={style} maxLength={120} placeholder="cheerfully, slowly…" onChange={(e) => setStyle(e.target.value)} />
        </label>
      </div>
      <button type="button" className="ve-secondary-btn" disabled={!text.trim() || busy !== null} onClick={() => void generate()}>
        <Spin on={busy === 'voice'} icon={<Mic2 size={14} aria-hidden="true" />} /> {busy ? 'Making the voice…' : 'Make voice-over at the playhead'}
      </button>
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

export function AiToolsPanel() {
  const [voiceText, setVoiceText] = useState('');
  return (
    <div className="ve-panel">
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
