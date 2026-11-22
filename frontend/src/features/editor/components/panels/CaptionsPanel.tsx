import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Copy, Plus, Scissors, Search, Trash2, Upload, X } from 'lucide-react';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useEditorStore } from '../../../../stores/editor/editorStore';
import { useActiveCaptionId } from '../../../../stores/editor/selectors';
import { useUIStore } from '../../../../stores/editor/uiStore';
import { useVideoStore } from '../../../../stores/editor/videoStore';
import type { CaptionSegment } from '../../model/types';
import { selectAndSeek } from '../../services/commands';
import { tip } from '../../shortcuts';
import { formatTimecode } from '../../utils/time';
import { countGraphemes, LANGUAGE_LABELS } from '../../utils/unicode';
import { VirtualList, type VirtualListHandle } from './VirtualList';

const ROW_HEIGHT = 108;

const CaptionRow = memo(function CaptionRow({
  caption,
  index,
  selected,
  active,
}: {
  caption: CaptionSegment;
  index: number;
  selected: boolean;
  active: boolean;
}) {
  const store = useCaptionStore.getState;
  const cps = useMemo(() => countGraphemes(caption.text.trim()) / Math.max(0.1, caption.end - caption.start), [caption]);
  return (
    <div
      className={`ed-cap-row ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''}`}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('textarea, button')) return;
        selectAndSeek(caption.id);
      }}
    >
      <div className="ed-cap-row-head">
        <span className="ed-cap-row-idx">{index + 1}</span>
        <button type="button" className="ed-cap-row-time" onClick={() => selectAndSeek(caption.id)} data-tip="Jump to caption">
          {formatTimecode(caption.start)} → {formatTimecode(caption.end)}
        </button>
        <span className="ed-cap-row-lang">{LANGUAGE_LABELS[caption.language]}</span>
        {cps > 17 && (
          <span className="ed-cap-row-warn" data-tip={`Fast: ${cps.toFixed(1)} chars/sec`}>
            <AlertCircle size={12} />
          </span>
        )}
        <span className="ed-cap-row-actions">
          <button type="button" data-tip={tip('Split at playhead', 'split')} onClick={() => store().splitAt(caption.id, useVideoStore.getState().currentTime)}>
            <Scissors size={13} />
          </button>
          <button type="button" data-tip={tip('Duplicate', 'duplicate')} onClick={() => store().duplicate(caption.id)}>
            <Copy size={13} />
          </button>
          <button type="button" className="is-danger" data-tip={tip('Delete', 'delete')} onClick={() => store().deleteCaption(caption.id)}>
            <Trash2 size={13} />
          </button>
        </span>
      </div>
      <textarea
        className="ed-cap-row-text"
        rows={2}
        value={caption.text}
        lang={caption.language === 'en' ? 'en' : 'si'}
        dir="auto"
        placeholder="Empty caption — type Sinhala or English"
        aria-label={`Caption ${index + 1} text`}
        onFocus={() => useEditorStore.getState().select(caption.id)}
        onChange={(e) => store().updateText(caption.id, e.target.value)}
      />
    </div>
  );
});

export const CaptionsPanel = memo(function CaptionsPanel() {
  const captions = useCaptionStore((s) => s.captions);
  const selectedId = useEditorStore((s) => s.selectedCaptionId);
  const activeId = useActiveCaptionId();
  const isPlaying = useVideoStore((s) => s.isPlaying);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const listRef = useRef<VirtualListHandle>(null);

  const rows = useMemo(() => {
    const q = deferredQuery.trim().normalize('NFC').toLowerCase();
    const all = captions.map((caption, index) => ({ caption, index }));
    return q ? all.filter(({ caption }) => caption.text.toLowerCase().includes(q)) : all;
  }, [captions, deferredQuery]);

  // Keep the playing caption (or the selection) in view.
  const followId = isPlaying ? activeId : selectedId;
  useEffect(() => {
    if (!followId) return;
    listRef.current?.ensureVisible(rows.findIndex((r) => r.caption.id === followId));
  }, [followId, rows]);

  const renderRow = useCallback(
    (i: number) => {
      const { caption, index } = rows[i];
      return <CaptionRow caption={caption} index={index} selected={caption.id === selectedId} active={caption.id === activeId} />;
    },
    [rows, selectedId, activeId]
  );

  return (
    <div className="ed-captions-panel">
      <div className="ed-captions-toolbar">
        <div className="ed-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search captions…"
            aria-label="Search captions"
            data-native-undo
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>
        <button
          type="button"
          className="ed-btn is-primary"
          onClick={() => useCaptionStore.getState().addCaption(useVideoStore.getState().currentTime)}
          data-tip={tip('Add caption at playhead', 'add')}
        >
          <Plus size={14} /> Add
        </button>
        <button
          type="button"
          className="ed-btn"
          onClick={() => useUIStore.getState().setImportOpen(true)}
          data-tip="Import captions from script text or subtitle files"
        >
          <Upload size={14} /> Import
        </button>
      </div>
      <div className="ed-captions-meta">
        {query ? `${rows.length} of ${captions.length} captions` : `${captions.length} captions`}
      </div>
      {rows.length === 0 ? (
        <div className="ed-empty-hint">
          {captions.length === 0 ? (
            <div className="ed-empty-actions">
              <p>No captions yet. Add a caption at the playhead or import from text.</p>
              <div className="ed-empty-btns">
                <button
                  type="button"
                  className="ed-btn is-primary"
                  onClick={() => useCaptionStore.getState().addCaption(useVideoStore.getState().currentTime)}
                >
                  <Plus size={14} /> Add caption
                </button>
                <button
                  type="button"
                  className="ed-btn"
                  onClick={() => useUIStore.getState().setImportOpen(true)}
                >
                  <Upload size={14} /> Import text
                </button>
              </div>
            </div>
          ) : (
            'No captions match your search.'
          )}
        </div>
      ) : (
        <VirtualList
          ref={listRef}
          count={rows.length}
          rowHeight={ROW_HEIGHT}
          getKey={(i) => rows[i].caption.id}
          renderRow={renderRow}
        />
      )}
    </div>
  );
});
