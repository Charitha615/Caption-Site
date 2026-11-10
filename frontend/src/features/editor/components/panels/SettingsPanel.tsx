import { memo } from 'react';
import { Keyboard, RotateCcw } from 'lucide-react';
import { useCaptionStore } from '../../../../stores/editor/captionStore';
import { useEditorProjectStore } from '../../../../stores/editor/editorProjectStore';
import { useEditorStore } from '../../../../stores/editor/editorStore';
import { useTimelineStore } from '../../../../stores/editor/timelineStore';
import { useUIStore } from '../../../../stores/editor/uiStore';
import type { CanvasAspect } from '../../model/types';
import { Field, Segmented, Toggle } from '../controls';

const ASPECTS: Array<{ value: CanvasAspect; label: string; tip: string }> = [
  { value: 'source', label: 'Source', tip: 'Match the video' },
  { value: '16:9', label: '16:9', tip: 'YouTube / landscape' },
  { value: '9:16', label: '9:16', tip: 'Reels / TikTok / Shorts' },
  { value: '1:1', label: '1:1', tip: 'Square feed' },
  { value: '4:5', label: '4:5', tip: 'Portrait feed' },
];

export const SettingsPanel = memo(function SettingsPanel() {
  const aspect = useCaptionStore((s) => s.canvas.aspect);
  const hasOverrides = useCaptionStore((s) => s.captions.some((c) => c.styleOverride));
  const snapping = useTimelineStore((s) => s.snapping);
  const preventOverlap = useTimelineStore((s) => s.preventOverlap);
  const follow = useTimelineStore((s) => s.followPlayhead);
  const nudgeStep = useEditorStore((s) => s.nudgeStep);
  const safeArea = useUIStore((s) => s.showSafeArea);
  const isDemo = useEditorProjectStore((s) => s.isDemo);

  return (
    <div className="ed-panel-scroll">
      <Field label="Canvas" hint="Saved with the project and used by export">
        <Segmented ariaLabel="Canvas aspect" size="sm" value={aspect} onChange={(v) => useCaptionStore.getState().setCanvas({ aspect: v })} options={ASPECTS} />
      </Field>
      <Toggle label="Safe-area guides" description="Show title-safe and action-safe margins on the video." checked={safeArea} onChange={(v) => useUIStore.getState().setShowSafeArea(v)} />

      <h3 className="ed-subhead">Timeline</h3>
      <Toggle label="Snapping" description="Snap edges to other captions and the playhead. Hold Alt to bypass." checked={snapping} onChange={(v) => useTimelineStore.getState().setSnapping(v)} />
      <Toggle label="Prevent overlaps" description="Dragging stops at neighbouring captions." checked={preventOverlap} onChange={(v) => useTimelineStore.getState().setPreventOverlap(v)} />
      <Toggle label="Follow playhead" description="Scroll the timeline during playback." checked={follow} onChange={(v) => useTimelineStore.getState().setFollowPlayhead(v)} />
      <Field label="Arrow-key nudge" hint="Shift moves ×10">
        <select className="ed-input" value={nudgeStep} onChange={(e) => useEditorStore.getState().setNudgeStep(Number(e.target.value))}>
          {[0.04, 0.1, 0.25, 0.5, 1].map((v) => <option key={v} value={v}>{v} s{v === 0.04 ? ' (≈1 frame)' : ''}</option>)}
        </select>
      </Field>

      <h3 className="ed-subhead">Project</h3>
      <button type="button" className="ed-btn" disabled={!hasOverrides} onClick={() => useCaptionStore.getState().clearAllOverrides()}>
        <RotateCcw size={14} /> Remove per-caption styles
      </button>
      <button type="button" className="ed-btn" onClick={() => useUIStore.getState().setShortcutsOpen(true)}>
        <Keyboard size={14} /> Keyboard shortcuts
      </button>
      <p className="ed-help">
        {isDemo
          ? 'Demo mode: changes stay in this tab and are not saved.'
          : 'Changes save automatically about a second after you stop editing. Undo history lasts for this session.'}
      </p>
    </div>
  );
});
