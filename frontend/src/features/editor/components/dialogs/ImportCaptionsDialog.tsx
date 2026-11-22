import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, AudioLines, Check, Clock, Loader2, Sparkles, Upload } from 'lucide-react';
import { Modal } from '../../../../components/Modal/Modal';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useUIStore } from '../../../../stores/editor/uiStore';
import { useVideoStore } from '../../../../stores/editor/videoStore';
import { useEditorProjectStore } from '../../../../stores/editor/editorProjectStore';
import { captionService, type AlignResult } from '../../../../services/captionService';
import { toAppError } from '../../../../services/errors';
import { detectLanguage } from '../../utils/unicode';
import type { CaptionLanguage } from '../../model/types';
import {
  assignTimingsToCues,
  enhanceTextForCaptions,
  parseSubtitles,
  repairSinhalaScript,
  splitTextIntoCues,
  type ParsedImportCue,
} from '../../utils/importCaptions';
import { createId } from '../../model/captionOps';
import { formatTimecode } from '../../utils/time';
import { LANGUAGE_LABELS } from '../../utils/unicode';

export const ImportCaptionsDialog = memo(function ImportCaptionsDialog() {
  const open = useUIStore((s) => s.isImportOpen);
  const onClose = useCallback(() => useUIStore.getState().setImportOpen(false), []);
  const videoDuration = useVideoStore((s) => s.duration || 60);
  const currentTime = useVideoStore((s) => s.currentTime || 0);

  const [rawText, setRawText] = useState('');
  const projectUuid = useEditorProjectStore((s) => s.projectUuid);
  const isDemo = useEditorProjectStore((s) => s.isDemo);
  const canMatchSpeech = !!projectUuid && !isDemo;
  const [timingMode, setTimingMode] = useState<'speech' | 'fit-video' | 'from-playhead'>(canMatchSpeech ? 'speech' : 'fit-video');
  const [aiEnglish, setAiEnglish] = useState(true);
  const [aligned, setAligned] = useState<AlignResult | null>(null);
  const [aligning, setAligning] = useState(false);
  const [alignError, setAlignError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [autoEnhance, setAutoEnhance] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

  useEffect(() => {
    setAligned(null);
    setAlignError(null);
  }, [rawText, aiEnglish, autoEnhance, timingMode]);

  const matchSpeech = async () => {
    if (!projectUuid || !rawText.trim()) return;
    setAligning(true);
    setAlignError(null);
    try {
      const text = autoEnhance ? enhanceTextForCaptions(rawText) : repairSinhalaScript(rawText);
      setAligned(await captionService.alignScript(projectUuid, text, aiEnglish));
    } catch (err) {
      setAlignError(toAppError(err, 'Could not match the script to the speech.').message);
    } finally {
      setAligning(false);
    }
  };

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Enhance text directly in the textarea
  const handleEnhanceClick = () => {
    if (!rawText.trim()) return;
    setRawText(enhanceTextForCaptions(rawText));
  };

  // Parse and preview cues
  const parsedCues: ParsedImportCue[] = useMemo(() => {
    const trimmed = rawText.trim();
    if (!trimmed) return [];

    // 1. Check if input has subtitle timestamps (SRT / VTT)
    const subtitleCues = parseSubtitles(trimmed);
    if (subtitleCues) {
      if (autoEnhance) {
        return subtitleCues.map((c) => ({
          ...c,
          text: enhanceTextForCaptions(c.text),
        }));
      }
      return subtitleCues;
    }

    // 2. Plain text matched to the speech (server-side alignment)
    if (timingMode === 'speech') {
      return (aligned?.captions ?? []).map((c) => ({
        id: createId(),
        start: c.start_time,
        end: c.end_time,
        text: c.text,
        language: (['si', 'en', 'mixed'].includes(c.language) ? c.language : detectLanguage(c.text)) as CaptionLanguage,
        words: c.words.map((w) => ({ text: w.word, start: w.start, end: w.end })),
      }));
    }

    // 3. Plain text / paragraphs, timed by length
    const processedText = autoEnhance ? enhanceTextForCaptions(trimmed) : repairSinhalaScript(trimmed);
    const cues = splitTextIntoCues(processedText);

    return assignTimingsToCues(cues, {
      videoDuration,
      startAt: currentTime,
      mode: timingMode,
    });
  }, [rawText, autoEnhance, videoDuration, currentTime, timingMode, aligned]);

  const isSubtitleFile = useMemo(() => parseSubtitles(rawText.trim()) !== null, [rawText]);
  const needsAlignment = timingMode === 'speech' && !isSubtitleFile && rawText.trim() !== '' && !aligned;

  // Execute import
  const handleImport = () => {
    if (parsedCues.length === 0) return;

    useCaptionStore.getState().importCaptions(
      parsedCues.map((c) => ({
        id: c.id,
        start: c.start,
        end: c.end,
        text: c.text,
        language: c.language,
        ...(c.words ? { words: c.words } : {}),
      })),
      importMode
    );

    onClose();
    setRawText('');
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Import Captions" size="lg">
      <div className="ed-import-dialog">
        <p className="ed-import-intro">
          Paste script text, paragraphs, or upload an <strong>SRT / VTT / TXT</strong> subtitle file.
          Text will be cleanly segmented into caption lines with proper timing alignment.
        </p>

        <div className="ed-import-textarea-wrap">
          <textarea
            className="ed-import-textarea"
            rows={8}
            placeholder={`Paste your script or subtitles here, for example:\n\nලංකාවේ තෙල් ප්රශ්නෙත් එක්ක, අදටත් මාකට් එකේ රජ කරන, ලීටරයට කිලෝමීටර් විසිපහත් තිහත් අතර තෙල් වැඩ කරන සුපිරිම හයිබ්රිඩ් කාර් එක ගැන තමයි අද කතා කරන්නේ!\n\nOr drop an SRT / WebVTT file with timestamps.`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />

          <div className="ed-import-text-actions">
            <button
              type="button"
              className="ed-btn is-ghost"
              onClick={() => fileInputRef.current?.click()}
              data-tip="Upload .txt, .srt or .vtt file"
            >
              <Upload size={13} /> Upload File
            </button>
            <input
              id={fileInputId}
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".txt,.srt,.vtt"
              onChange={handleFileUpload}
            />

            <button
              type="button"
              className="ed-btn is-ghost"
              disabled={!rawText.trim()}
              onClick={handleEnhanceClick}
              data-tip="Convert transliterated car/tech loanwords to clean English & repair Sinhala script"
            >
              <Sparkles size={13} /> Fix English Words & Sinhala
            </button>
          </div>
        </div>

        <div className="ed-import-controls-row">
          <label className="ed-import-checkbox">
            <input
              type="checkbox"
              checked={autoEnhance}
              onChange={(e) => setAutoEnhance(e.target.checked)}
            />
            <span>
              <strong>Smart Auto-Format</strong>: Use standard English for vehicle/tech terms (Hybrid, Traffic, Toyota Aqua, etc.) &amp; repair Sinhala conjuncts.
            </span>
          </label>

          <div className="ed-import-options-grid">
            <div className="ed-import-option-group">
              <span className="ed-import-label"><Clock size={12} /> Timing alignment:</span>
              <div className="ed-btn-group">
                {canMatchSpeech && (
                  <button
                    type="button"
                    className={`ed-btn ${timingMode === 'speech' ? 'is-primary' : 'is-ghost'}`}
                    onClick={() => setTimingMode('speech')}
                    data-tip="Line each word up with the video's speech (uses the AI transcript)"
                  >
                    <AudioLines size={13} /> Match speech
                  </button>
                )}
                <button
                  type="button"
                  className={`ed-btn ${timingMode === 'fit-video' ? 'is-primary' : 'is-ghost'}`}
                  onClick={() => setTimingMode('fit-video')}
                >
                  Fit across video ({formatTimecode(videoDuration)})
                </button>
                <button
                  type="button"
                  className={`ed-btn ${timingMode === 'from-playhead' ? 'is-primary' : 'is-ghost'}`}
                  onClick={() => setTimingMode('from-playhead')}
                >
                  From playhead ({formatTimecode(currentTime)})
                </button>
              </div>
            </div>

            <div className="ed-import-option-group">
              <span className="ed-import-label">Destination:</span>
              <div className="ed-btn-group">
                <button
                  type="button"
                  className={`ed-btn ${importMode === 'replace' ? 'is-primary' : 'is-ghost'}`}
                  onClick={() => setImportMode('replace')}
                >
                  Replace existing
                </button>
                <button
                  type="button"
                  className={`ed-btn ${importMode === 'append' ? 'is-primary' : 'is-ghost'}`}
                  onClick={() => setImportMode('append')}
                >
                  Append after
                </button>
              </div>
            </div>
          </div>
        </div>

        {timingMode === 'speech' && !isSubtitleFile && (
          <div className="ed-import-align">
            <label className="ed-import-checkbox">
              <input type="checkbox" checked={aiEnglish} onChange={(e) => setAiEnglish(e.target.checked)} />
              <span>
                <strong>AI English words</strong>: write English words that are spelled in Sinhala letters in English (e.g. ට්‍රැෆික් → traffic). Uses your Google AI key.
              </span>
            </label>
            <button type="button" className="ed-btn is-accent" disabled={!rawText.trim() || aligning} onClick={() => void matchSpeech()}>
              {aligning ? <Loader2 size={14} className="ed-spin" /> : <AudioLines size={14} />}
              {aligning ? 'Matching to speech…' : aligned ? 'Match again' : 'Match script to speech'}
            </button>
            {aligned && (
              <p className="ed-help" role="status">
                {aligned.stats.matched} of {aligned.stats.script_words} words matched the speech
                {aligned.stats.placed > 0 && <>; {aligned.stats.placed} placed between them (the AI didn’t hear them — check their timing)</>}.
                {aiEnglish && !aligned.english_applied && ' English-word conversion was skipped (the AI was busy) — your script was used as written.'}
              </p>
            )}
            {alignError && (
              <p className="ed-notice is-error" role="alert"><AlertTriangle size={14} /> {alignError}</p>
            )}
          </div>
        )}

        {parsedCues.length > 0 && (
          <div className="ed-import-preview-section">
            <div className="ed-import-preview-header">
              <h4>Preview ({parsedCues.length} captions generated)</h4>
              <span className="ed-badge">{formatTimecode(parsedCues[0].start)} → {formatTimecode(parsedCues[parsedCues.length - 1].end)}</span>
            </div>

            <div className="ed-import-preview-list">
              {parsedCues.slice(0, 15).map((cue, idx) => (
                <div key={cue.id} className="ed-import-preview-item">
                  <span className="ed-import-cue-idx">#{idx + 1}</span>
                  <span className="ed-import-cue-time">
                    {formatTimecode(cue.start)} → {formatTimecode(cue.end)}
                  </span>
                  <span className="ed-import-cue-lang">{LANGUAGE_LABELS[cue.language]}</span>
                  <span className="ed-import-cue-text">{cue.text}</span>
                </div>
              ))}
              {parsedCues.length > 15 && (
                <div className="ed-import-preview-more">
                  + {parsedCues.length - 15} more captions...
                </div>
              )}
            </div>
          </div>
        )}

        <div className="ed-import-footer">
          <button type="button" className="ed-btn is-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="ed-btn is-primary"
            disabled={parsedCues.length === 0 || needsAlignment}
            onClick={handleImport}
          >
            <Check size={14} /> Import {parsedCues.length > 0 ? `${parsedCues.length} Captions` : 'Captions'}
          </button>
        </div>
      </div>
    </Modal>
  );
});
