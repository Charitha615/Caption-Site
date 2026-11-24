import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { AlertTriangle, AudioLines, Check, FileText, Loader2, Upload } from 'lucide-react';
import { Modal } from '../../../../components/Modal/Modal';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useUIStore } from '../../../../stores/editor/uiStore';
import { useVideoStore } from '../../../../stores/editor/videoStore';
import { useEditorProjectStore } from '../../../../stores/editor/editorProjectStore';
import { captionService, type AlignResult } from '../../../../services/captionService';
import { toAppError } from '../../../../services/errors';
import {
  assignTimingsToCues,
  enhanceTextForCaptions,
  parseSubtitles,
  repairSinhalaScript,
  splitTextIntoCues,
  stripCaptionPunctuation,
  type ParsedImportCue,
} from '../../utils/importCaptions';
import { createId } from '../../model/captionOps';
import type { CaptionLanguage, CaptionSegment } from '../../model/types';
import { formatTimecode } from '../../utils/time';
import { detectLanguage, LANGUAGE_LABELS } from '../../utils/unicode';

type TimingMode = 'speech' | 'fit-video' | 'from-playhead';

/** Segmented single-choice control (radio group) with a clear selected state. */
function Choice<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="ed-imp-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`ed-imp-seg-btn ${value === o.value ? 'is-selected' : ''}`}
          onClick={() => onChange(o.value)}
          data-tip={o.hint}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Import captions from a pasted script or a .txt/.srt/.vtt file.
 * Plain text can be matched to the video's speech (server-side alignment) or spread by length.
 * Every imported caption keeps its original line (meta.original_text) for review/restore.
 */
export const ImportCaptionsDialog = memo(function ImportCaptionsDialog() {
  const open = useUIStore((s) => s.isImportOpen);
  const onClose = useCallback(() => useUIStore.getState().setImportOpen(false), []);
  const videoDuration = useVideoStore((s) => s.duration || 60);
  const currentTime = useVideoStore((s) => s.currentTime || 0);
  const projectUuid = useEditorProjectStore((s) => s.projectUuid);
  const isDemo = useEditorProjectStore((s) => s.isDemo);
  const canMatchSpeech = !!projectUuid && !isDemo;

  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [timingMode, setTimingMode] = useState<TimingMode>(canMatchSpeech ? 'speech' : 'fit-video');
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  // Pasting back copied captions: same count → only their text changes (timing, word timing, style kept).
  const [textOnly, setTextOnly] = useState(true);
  const existing = useCaptionStore((s) => s.captions);
  const [removePunctuation, setRemovePunctuation] = useState(true);
  const [smartEnglish, setSmartEnglish] = useState(true);
  const [aiEnglish, setAiEnglish] = useState(true);
  // A speech match is only valid for the exact inputs it was made from.
  const [match, setMatch] = useState<{ key: string; result: AlignResult } | null>(null);
  const [aligning, setAligning] = useState(false);
  const [alignError, setAlignError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const matchKey = `${timingMode}|${smartEnglish}|${aiEnglish}|${rawText}`;
  const aligned = match?.key === matchKey ? match.result : null;

  const isSubtitleFile = useMemo(() => parseSubtitles(rawText.trim()) !== null, [rawText]);
  const prepared = useCallback((text: string) => (smartEnglish ? enhanceTextForCaptions(text) : repairSinhalaScript(text)), [smartEnglish]);

  const matchSpeech = async () => {
    if (!projectUuid || !rawText.trim()) return;
    setAligning(true);
    setAlignError(null);
    try {
      setMatch({ key: matchKey, result: await captionService.alignScript(projectUuid, prepared(rawText), aiEnglish) });
    } catch (err) {
      setAlignError(toAppError(err, 'Could not match the script to the speech.').message);
    } finally {
      setAligning(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawText(String(reader.result ?? ''));
      setFileName(file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  /** Cues before punctuation removal; `original` keeps the line exactly as provided. */
  const cues: ParsedImportCue[] = useMemo(() => {
    const trimmed = rawText.trim();
    if (!trimmed) return [];

    const subtitleCues = parseSubtitles(trimmed);
    if (subtitleCues) {
      return subtitleCues.map((c) => ({ ...c, original: c.text, text: smartEnglish ? enhanceTextForCaptions(c.text) : c.text }));
    }
    if (timingMode === 'speech') {
      return (aligned?.captions ?? []).map((c) => ({
        id: createId(),
        start: c.start_time,
        end: c.end_time,
        text: c.text,
        original: c.text,
        language: (['si', 'en', 'mixed'].includes(c.language) ? c.language : detectLanguage(c.text)) as CaptionLanguage,
        words: c.words.map((w) => ({ text: w.word, start: w.start, end: w.end })),
      }));
    }
    const lines = splitTextIntoCues(prepared(trimmed));
    return assignTimingsToCues(lines, { videoDuration, startAt: currentTime, mode: timingMode }).map((c) => ({ ...c, original: c.text }));
  }, [rawText, smartEnglish, timingMode, aligned, prepared, videoDuration, currentTime]);

  /** What will actually be imported (punctuation removed if chosen). */
  const finalCues = useMemo(() => {
    if (!removePunctuation) return cues;
    return cues
      .map((c) => ({
        ...c,
        text: stripCaptionPunctuation(c.text),
        words: c.words?.map((w) => ({ ...w, text: stripCaptionPunctuation(w.text) })).filter((w) => w.text !== ''),
      }))
      .filter((c) => c.text !== '');
  }, [cues, removePunctuation]);

  const canUpdateText = isSubtitleFile && existing.length > 0 && finalCues.length === existing.length;
  const updatingText = canUpdateText && textOnly;

  const needsAlignment = timingMode === 'speech' && !isSubtitleFile && rawText.trim() !== '' && !aligned;

  const handleImport = () => {
    if (finalCues.length === 0) return;
    if (updatingText) {
      useCaptionStore.getState().updateTexts(existing.map((c, i) => ({ id: c.id, text: finalCues[i].text })));
      onClose();
      setRawText('');
      setFileName(null);
      return;
    }
    const source = isSubtitleFile ? 'subtitles' : timingMode === 'speech' ? 'script-matched' : 'script';
    const segments: CaptionSegment[] = finalCues.map((c) => ({
      id: c.id,
      start: c.start,
      end: c.end,
      text: c.text,
      language: c.language,
      ...(c.words?.length ? { words: c.words } : {}),
      meta: { original_text: c.original ?? c.text, source: { imported: source } },
    }));
    useCaptionStore.getState().importCaptions(segments, importMode);
    onClose();
    setRawText('');
    setFileName(null);
  };

  const timingOptions: Array<{ value: TimingMode; label: string; hint: string }> = [
    ...(canMatchSpeech ? [{ value: 'speech' as const, label: 'Match speech', hint: 'Line every word up with the speech in the video (recommended)' }] : []),
    { value: 'fit-video', label: `Spread over video (${formatTimecode(videoDuration)})`, hint: 'Share the whole video by line length' },
    { value: 'from-playhead', label: `From playhead (${formatTimecode(currentTime)})`, hint: 'Start at the playhead, natural reading pace' },
  ];

  return (
    <Modal isOpen={open} onClose={onClose} title="Import captions" size="lg">
      <div className="ed-imp">
        {/* 1. Script */}
        <section className="ed-imp-step">
          <div className="ed-imp-step-head">
            <span className="ed-imp-num" aria-hidden="true">1</span>
            <h3>Your script or subtitle file</h3>
            <button type="button" className="ed-btn is-ghost is-sm" onClick={() => fileInputRef.current?.click()}>
              <Upload size={13} aria-hidden="true" /> Upload .txt / .srt / .vtt
            </button>
            <input ref={fileInputRef} type="file" accept=".txt,.srt,.vtt,text/plain" hidden onChange={handleFile} />
          </div>
          <textarea
            className="ed-imp-textarea"
            rows={7}
            lang="si"
            aria-label="Script or subtitles to import"
            placeholder="Paste your script here (Sinhala, English or both) — or upload an SRT / VTT file with timings."
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setFileName(null);
              setAlignError(null);
            }}
          />
          <div className="ed-imp-meta">
            {fileName && <span><FileText size={12} aria-hidden="true" /> {fileName}</span>}
            {isSubtitleFile && <span className="ed-imp-pill">Subtitle file — its own timings will be used</span>}
            {rawText.trim() && !isSubtitleFile && <span>{rawText.trim().split(/\s+/).length} words</span>}
          </div>
        </section>

        {/* 2. Timing */}
        {!isSubtitleFile && (
          <section className="ed-imp-step">
            <div className="ed-imp-step-head">
              <span className="ed-imp-num" aria-hidden="true">2</span>
              <h3>Timing</h3>
            </div>
            <Choice label="Timing" value={timingMode} options={timingOptions} onChange={setTimingMode} />
          </section>
        )}

        {/* 3. Options */}
        <section className="ed-imp-step">
          <div className="ed-imp-step-head">
            <span className="ed-imp-num" aria-hidden="true">{isSubtitleFile ? 2 : 3}</span>
            <h3>Options</h3>
          </div>
          <div className="ed-imp-options">
            <label className="ed-imp-check">
              <input type="checkbox" checked={removePunctuation} onChange={(e) => setRemovePunctuation(e.target.checked)} />
              <span><strong>Remove punctuation</strong> — dots, commas, quotes and symbols are removed from the captions. The original text is kept for review.</span>
            </label>
            <label className="ed-imp-check">
              <input type="checkbox" checked={smartEnglish} onChange={(e) => setSmartEnglish(e.target.checked)} />
              <span><strong>Common English words</strong> — e.g. හයිබ්‍රිඩ් → Hybrid, ට්‍රැෆික් → Traffic (instant, built-in list).</span>
            </label>
            {timingMode === 'speech' && !isSubtitleFile && (
              <label className="ed-imp-check">
                <input type="checkbox" checked={aiEnglish} onChange={(e) => setAiEnglish(e.target.checked)} />
                <span><strong>Detect English words</strong> — any English word spelled in Sinhala letters is written in English. Uses your Google API key.</span>
              </label>
            )}
          </div>
          {canUpdateText && (
            <label className="ed-imp-check">
              <input type="checkbox" checked={textOnly} onChange={(e) => setTextOnly(e.target.checked)} />
              <span><strong>Update text only</strong> — same number of captions as the editor ({existing.length}), so only their text is replaced. Timing, word timing and styles stay as they are.</span>
            </label>
          )}
          {!updatingText && <div className="ed-imp-inline">
            <span className="ed-field-label">Existing captions</span>
            <Choice
              label="Existing captions"
              value={importMode}
              options={[{ value: 'replace', label: 'Replace' }, { value: 'append', label: 'Keep and add' }]}
              onChange={setImportMode}
            />
          </div>}
        </section>

        {/* Speech matching */}
        {timingMode === 'speech' && !isSubtitleFile && (
          <section className="ed-imp-match">
            <button type="button" className="ed-btn is-accent" disabled={!rawText.trim() || aligning} onClick={() => void matchSpeech()}>
              {aligning ? <Loader2 size={14} className="ed-spin" aria-hidden="true" /> : <AudioLines size={14} aria-hidden="true" />}
              {aligning ? 'Matching to speech…' : aligned ? 'Match again' : 'Match script to speech'}
            </button>
            {aligned && (
              <p className="ed-help" role="status">
                {aligned.stats.matched} of {aligned.stats.script_words} words matched the speech
                {aligned.stats.placed > 0 && <>; {aligned.stats.placed} placed between them (check their timing)</>}.
                {aiEnglish && !aligned.english_applied && ' English word detection was skipped (the service was busy).'}
              </p>
            )}
            {alignError && <p className="ed-notice is-error" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {alignError}</p>}
          </section>
        )}

        {/* Preview */}
        {finalCues.length > 0 && (
          <section className="ed-imp-preview" aria-label="Preview">
            <div className="ed-imp-preview-head">
              <h3>Preview · {finalCues.length} captions</h3>
              <span className="ed-badge">{formatTimecode(finalCues[0].start)} → {formatTimecode(finalCues[finalCues.length - 1].end)}</span>
            </div>
            <ol className="ed-imp-preview-list">
              {finalCues.slice(0, 30).map((cue) => (
                <li key={cue.id}>
                  <span className="ed-imp-time">{formatTimecode(cue.start)}</span>
                  <span className="ed-imp-lang">{LANGUAGE_LABELS[cue.language]}</span>
                  <span className="ed-imp-text" dir="auto">{cue.text}</span>
                </li>
              ))}
            </ol>
            {finalCues.length > 30 && <p className="ed-help">+ {finalCues.length - 30} more</p>}
          </section>
        )}

        <div className="ed-imp-footer">
          <button type="button" className="ed-btn is-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="ed-btn is-primary" disabled={finalCues.length === 0 || needsAlignment} onClick={handleImport}>
            <Check size={14} aria-hidden="true" /> {updatingText ? `Update ${finalCues.length} captions` : `Import ${finalCues.length > 0 ? `${finalCues.length} captions` : 'captions'}`}
          </button>
        </div>
      </div>
    </Modal>
  );
});
