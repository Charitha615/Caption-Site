import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Music2, Square } from 'lucide-react';
import { MUSIC_STYLES, generateMusic, type MusicStyleId } from '../ai/music';
import { useToastStore } from '../../../stores/toastStore';
import { startVoiceRecording } from '../audio';
import { formatTime } from '../model';
import { totalDuration, useVideoEditorStore } from '../store';
import { useImportFiles } from '../useImportFiles';

type Recording = Awaited<ReturnType<typeof startVoiceRecording>>;
type Phase =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'recording'; startAt: number; since: number; stream: MediaStream }
  | { kind: 'saving' };

/** Live microphone level, 0 … 1. */
function useLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream || typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
      setLevel(peak);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      void ctx.close().catch(() => undefined);
    };
  }, [stream]);
  return level;
}

function VoiceOverRecorder() {
  const addToast = useToastStore((s) => s.addToast);
  const playhead = useVideoEditorStore((s) => s.playhead);
  const hasClips = useVideoEditorStore((s) => s.clips.length > 0);
  const { importFiles } = useImportFiles();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [playAlong, setPlayAlong] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef<Recording | null>(null);
  const level = useLevel(phase.kind === 'recording' ? phase.stream : null);

  // Stop the microphone if the panel closes mid-recording.
  useEffect(() => () => recRef.current?.cancel(), []);

  useEffect(() => {
    if (phase.kind !== 'recording') return;
    const timer = window.setInterval(() => setElapsed((performance.now() - phase.since) / 1000), 200);
    return () => window.clearInterval(timer);
  }, [phase]);

  const start = async () => {
    setPhase({ kind: 'starting' });
    try {
      const rec = await startVoiceRecording();
      recRef.current = rec;
      const s = useVideoEditorStore.getState();
      setElapsed(0);
      setPhase({ kind: 'recording', startAt: s.playhead, since: performance.now(), stream: rec.stream });
      if (playAlong && s.playhead < totalDuration(s.clips)) s.setPlaying(true);
    } catch (err) {
      setPhase({ kind: 'idle' });
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not start recording.' });
    }
  };

  const stop = async () => {
    if (phase.kind !== 'recording' || !recRef.current) return;
    const { startAt } = phase;
    useVideoEditorStore.getState().setPlaying(false);
    setPhase({ kind: 'saving' });
    try {
      const file = await recRef.current.stop();
      recRef.current = null;
      const [id] = await importFiles([file]);
      if (id) {
        useVideoEditorStore.getState().addMediaClip(id, { start: startAt, freeTrack: true });
        addToast({ type: 'success', message: 'Voice-over added to the timeline.' });
      }
    } finally {
      setPhase({ kind: 'idle' });
    }
  };

  const recording = phase.kind === 'recording';
  return (
    <div className="ve-recorder">
      <button
        type="button"
        className={`ve-record-btn ${recording ? 'is-recording' : ''}`}
        onClick={() => void (recording ? stop() : start())}
        disabled={phase.kind === 'starting' || phase.kind === 'saving'}
      >
        {recording ? <Square size={14} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
        {phase.kind === 'starting' ? 'Starting…' : phase.kind === 'saving' ? 'Adding…' : recording ? `Stop · ${formatTime(elapsed, false)}` : 'Record voice-over'}
        {recording && <span className="ve-record-dot" aria-hidden="true" />}
      </button>
      {recording && (
        <div className="ve-level" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
          <span style={{ width: `${Math.min(100, level * 140)}%` }} />
        </div>
      )}
      <label className="ve-field is-inline">
        <input type="checkbox" checked={playAlong} disabled={recording || !hasClips} onChange={(e) => setPlayAlong(e.target.checked)} />
        <span>Play the video while I record</span>
      </label>
      <p className="ve-panel-hint">
        Starts at the playhead ({formatTime(playhead)}) and goes on its own audio track. Use headphones so the video&apos;s sound isn&apos;t recorded too.
      </p>
    </div>
  );
}

function MusicLibrary() {
  const total = useVideoEditorStore((s) => totalDuration(s.clips));
  const addToast = useToastStore((s) => s.addToast);
  const { importFiles } = useImportFiles();
  const [busy, setBusy] = useState<MusicStyleId | null>(null);
  // Music fills the video (at least 30 s), so it can be trimmed rather than stretched.
  const seconds = Math.min(600, Math.max(30, Math.ceil(total)));

  const add = async (id: MusicStyleId) => {
    setBusy(id);
    try {
      const [mediaId] = await importFiles([await generateMusic(id, seconds)]);
      // Background level, so voices stay clear.
      if (mediaId) useVideoEditorStore.getState().addMediaClip(mediaId, { start: 0, freeTrack: true, volume: 0.35, fadeOut: 2 });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not make the music.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <ul className="ve-pick-list">
        {MUSIC_STYLES.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => void add(m.id)} disabled={busy !== null}>
              <strong>{busy === m.id ? <Loader2 size={13} className="ve-spin" aria-hidden="true" /> : <Music2 size={13} aria-hidden="true" />} {m.label}</strong>
              <span>{m.mood}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="ve-panel-hint">Made for your video ({formatTime(seconds, false)}) and free to use anywhere. Added from the start at a background volume.</p>
    </>
  );
}

export function AudioPanel() {
  return (
    <div className="ve-panel">
      <h2 className="ve-panel-title">Voice-over</h2>
      <VoiceOverRecorder />

      <h2 className="ve-panel-title">Background music</h2>
      <MusicLibrary />

      <h2 className="ve-panel-title">Sound tools</h2>
      <ul className="ve-tool-list">
        <li><strong>Music and sound files</strong><span>Import MP3, WAV, M4A or OGG in Media and add them to an audio track.</span></li>
        <li><strong>Trim and split</strong><span>Drag a clip&apos;s edges, or press S to split at the playhead.</span></li>
        <li><strong>Volume and fades</strong><span>Select an audio clip and use the panel on the right.</span></li>
        <li><strong>Clean up voice</strong><span>Turn it on for a clip to reduce hum, rumble and hiss.</span></li>
        <li><strong>Detach audio</strong><span>Select a video clip and choose “Detach audio” to edit its sound on its own track.</span></li>
        <li><strong>Save audio as WAV</strong><span>In Media, use the download button on a video.</span></li>
      </ul>
    </div>
  );
}
