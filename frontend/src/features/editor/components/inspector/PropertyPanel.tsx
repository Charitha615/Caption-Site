import { memo, useMemo } from 'react';
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  ChevronDown,
  ChevronUp,
  Combine,
  Copy,
  RotateCcw,
  Scissors,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useEditorStore } from '../../../../stores/editor/editorStore';
import { useSelectedCaption } from '../../../../stores/editor/selectors';
import { useVideoStore } from '../../../../stores/editor/videoStore';
import type { CaptionLanguage, CaptionSegment } from '../../model/types';
import { selectRelative } from '../../services/commands';
import { TEXT_INPUT_ID, tip } from '../../shortcuts';
import { resolveStyle } from '../../utils/captionStyle';
import { countGraphemes, detectLanguage, LANGUAGE_LABELS } from '../../utils/unicode';
import { IconButton, Segmented, TimeInput } from '../controls';
import { StyleControls } from './StyleControls';
import { AiOriginal } from './AiOriginal';

const MAX_CPS = 17; // common reading-speed guideline (characters per second)

function CaptionStats({ caption }: { caption: CaptionSegment }) {
  const stats = useMemo(() => {
    const chars = countGraphemes(caption.text.replace(/\s+/g, ' ').trim());
    const duration = caption.end - caption.start;
    const lines = caption.text.split('\n').length;
    return { chars, cps: duration > 0 ? chars / duration : 0, lines };
  }, [caption.text, caption.start, caption.end]);
  const tooFast = stats.cps > MAX_CPS;
  return (
    <div className="ed-text-stats">
      <span>{stats.chars} chars</span>
      <span>{stats.lines} {stats.lines === 1 ? 'line' : 'lines'}</span>
      <span className={tooFast ? 'is-warn' : ''} data-tip={tooFast ? `Reading speed above ${MAX_CPS} chars/sec — consider a longer duration or shorter text` : 'Reading speed'}>
        {stats.cps.toFixed(1)} cps
      </span>
    </div>
  );
}

const CaptionEditor = memo(function CaptionEditor({ caption, index, total, compact }: { caption: CaptionSegment; index: number; total: number; compact: boolean }) {
  const store = useCaptionStore.getState;
  const globalStyle = useCaptionStore((s) => s.style);
  const scope = useEditorStore((s) => s.styleScope);
  const step = useEditorStore((s) => s.nudgeStep);
  const duration = caption.end - caption.start;
  const playheadTime = () => useVideoStore.getState().currentTime;
  const isLast = index >= total - 1;
  const styleValue = scope === 'caption' ? resolveStyle(globalStyle, caption.styleOverride) : globalStyle;
  const overrideCount = caption.styleOverride ? Object.keys(caption.styleOverride).length : 0;

  return (
    <>
      <div className="ed-inspector-block">
        <label className="ed-field-label" htmlFor={TEXT_INPUT_ID}>Text</label>
        <textarea
          id={TEXT_INPUT_ID}
          className="ed-input ed-textarea"
          rows={3}
          lang={caption.language === 'en' ? 'en' : 'si'}
          dir="auto"
          value={caption.text}
          placeholder="Type Sinhala or English…  (සිංහල / English)"
          onChange={(e) => store().updateText(caption.id, e.target.value)}
        />
        <CaptionStats caption={caption} />
        <AiOriginal caption={caption} />
      </div>

      <div className="ed-inspector-block">
        <div className="ed-timing-grid">
          <div className="ed-field">
            <span className="ed-field-label">Start</span>
            <div className="ed-time-row">
              <TimeInput label="Start time" value={caption.start} onCommit={(v) => store().setTiming(caption.id, v, Math.max(caption.end, v + 0.2), 'Set start')} />
              <IconButton tip={tip('Start at playhead', 'setStart')} onClick={() => store().setTiming(caption.id, playheadTime(), Math.max(caption.end, playheadTime() + 0.2), 'Set start')}>
                <ArrowLeftToLine size={14} />
              </IconButton>
            </div>
          </div>
          <div className="ed-field">
            <span className="ed-field-label">End</span>
            <div className="ed-time-row">
              <TimeInput label="End time" value={caption.end} onCommit={(v) => store().setTiming(caption.id, Math.min(caption.start, v - 0.2), v, 'Set end')} />
              <IconButton tip={tip('End at playhead', 'setEnd')} onClick={() => store().setTiming(caption.id, Math.min(caption.start, playheadTime() - 0.2), playheadTime(), 'Set end')}>
                <ArrowRightToLine size={14} />
              </IconButton>
            </div>
          </div>
          <div className="ed-field">
            <span className="ed-field-label">Duration</span>
            <TimeInput label="Duration" value={duration} onCommit={(v) => store().setTiming(caption.id, caption.start, caption.start + Math.max(0.2, v), 'Set duration')} />
          </div>
          <div className="ed-field">
            <span className="ed-field-label">Shift</span>
            <div className="ed-seg ed-seg-sm">
              <button type="button" data-tip={tip('Move earlier', 'nudgeBack')} onClick={() => store().nudge(caption.id, -step)}>−{step}s</button>
              <button type="button" data-tip={tip('Move later', 'nudgeForward')} onClick={() => store().nudge(caption.id, step)}>+{step}s</button>
            </div>
          </div>
        </div>
      </div>

      <div className="ed-inspector-block">
        <div className="ed-field-label-row">
          <span className="ed-field-label">Language</span>
          <button type="button" className="ed-link-btn" onClick={() => store().setLanguage(caption.id, detectLanguage(caption.text))}>
            <Sparkles size={12} /> Detect
          </button>
        </div>
        <Segmented<CaptionLanguage>
          ariaLabel="Caption language"
          value={caption.language}
          onChange={(v) => store().setLanguage(caption.id, v)}
          options={(['si', 'en', 'mixed'] as const).map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))}
        />
      </div>

      <div className="ed-inspector-actions">
        <button type="button" className="ed-btn" onClick={() => store().splitAt(caption.id, playheadTime())} data-tip={tip('Split at playhead', 'split')}>
          <Scissors size={14} /> Split
        </button>
        <button type="button" className="ed-btn" disabled={isLast} onClick={() => store().mergeWithNext(caption.id)} data-tip={tip('Merge with next', 'merge')}>
          <Combine size={14} /> Merge
        </button>
        <button type="button" className="ed-btn" onClick={() => store().duplicate(caption.id)} data-tip={tip('Duplicate', 'duplicate')}>
          <Copy size={14} /> Duplicate
        </button>
        <button type="button" className="ed-btn is-danger" onClick={() => store().deleteCaption(caption.id)} data-tip={tip('Delete', 'delete')}>
          <Trash2 size={14} />
        </button>
      </div>

      {!compact && (
        <>
          <div className="ed-scope-bar">
            <span className="ed-field-label">Style applies to</span>
            <Segmented
              ariaLabel="Style scope"
              size="sm"
              value={scope}
              onChange={(v) => useEditorStore.getState().setStyleScope(v)}
              options={[
                { value: 'all', label: 'All captions' },
                { value: 'caption', label: 'This caption' },
              ]}
            />
          </div>
          {overrideCount > 0 && (
            <div className="ed-notice">
              <span>
                This caption has {overrideCount} custom style {overrideCount === 1 ? 'property' : 'properties'}
                {scope === 'all' ? ' that override the project style.' : '.'}
              </span>
              <button type="button" className="ed-link-btn" onClick={() => store().clearOverride(caption.id)}>
                <RotateCcw size={12} /> Reset
              </button>
            </div>
          )}
          <StyleControls value={styleValue} target={scope === 'caption' ? caption.id : null} />
        </>
      )}
    </>
  );
});

export const PropertyPanel = memo(function PropertyPanel({ compact = false, onClose }: { compact?: boolean; onClose?: () => void }) {
  const caption = useSelectedCaption();
  const captions = useCaptionStore((s) => s.captions);
  const globalStyle = useCaptionStore((s) => s.style);
  const index = caption ? captions.indexOf(caption) : -1;

  return (
    <aside className="ed-inspector" aria-label="Caption properties">
      <header className="ed-panel-head">
        <div className="ed-panel-title">
          <h2>{caption ? `Caption ${index + 1}` : 'Project style'}</h2>
          <span className="ed-panel-sub">{caption ? `of ${captions.length}` : 'Applies to all captions'}</span>
        </div>
        <div className="ed-panel-head-actions">
          {caption && (
            <>
              <IconButton tip={tip('Previous caption', 'prevCaption')} onClick={() => selectRelative(-1)} disabled={index <= 0}>
                <ChevronUp size={15} />
              </IconButton>
              <IconButton tip={tip('Next caption', 'nextCaption')} onClick={() => selectRelative(1)} disabled={index >= captions.length - 1}>
                <ChevronDown size={15} />
              </IconButton>
            </>
          )}
          {onClose && (
            <IconButton tip="Close" onClick={onClose}>
              <X size={15} />
            </IconButton>
          )}
        </div>
      </header>
      <div className="ed-panel-scroll">
        {caption ? (
          <CaptionEditor caption={caption} index={index} total={captions.length} compact={compact} />
        ) : (
          <>
            <p className="ed-empty-hint">
              Select a caption on the timeline, in the list or on the video to edit its text and timing.
              Changes below restyle every caption.
            </p>
            {!compact && <StyleControls value={globalStyle} target={null} />}
          </>
        )}
      </div>
    </aside>
  );
});

