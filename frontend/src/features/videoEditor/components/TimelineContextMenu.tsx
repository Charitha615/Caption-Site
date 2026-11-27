import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlignHorizontalJustifyStart, Copy, Crosshair, Film, ListChecks, Music, Plus, Scissors, Trash2, Type, Unlink, Volume2, VolumeX, X } from 'lucide-react';
import { clipEnd, MIN_CLIP_DURATION, trackGaps, type Clip, type Track } from '../model';
import { useVideoEditorStore } from '../store';

/** An open right-click menu: on a clip, or on empty space of a track. Positions are viewport pixels. */
export type TimelineMenuState =
  | { kind: 'clip'; clipId: string; x: number; y: number; time: number }
  | { kind: 'lane'; trackId: string; x: number; y: number; time: number };

interface Item {
  label: string;
  hint?: string;
  icon: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  run: () => void;
}

/** The timeline's right-click menu (`time` is the timeline time under the pointer). */
export function TimelineContextMenu({ menu, onClose }: { menu: TimelineMenuState; onClose: () => void }) {
  const clip = useVideoEditorStore((s) => (menu.kind === 'clip' ? s.clips.find((c) => c.id === menu.clipId) : undefined));
  const track = useVideoEditorStore((s) => (menu.kind === 'lane' ? s.tracks.find((t) => t.id === menu.trackId) : undefined));
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: menu.x, top: menu.y });

  // Keep the menu on screen (open it up / to the left near the edges).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(4, Math.min(menu.x, window.innerWidth - width - 4)),
      top: menu.y + height > window.innerHeight - 4 ? Math.max(4, menu.y - height) : menu.y,
    });
    el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [menu.x, menu.y]);

  // Close on a press outside, Escape, scrolling, resizing or leaving the window.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onClose);
    window.addEventListener('blur', onClose);
    document.addEventListener('scroll', onClose, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('blur', onClose);
      document.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  const items = clip ? clipItems(clip, menu.time) : track ? laneItems(track, menu.time) : null;
  if (!items) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    e.stopPropagation();
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1
      : (at + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <div
      ref={ref}
      className="ve-context-menu"
      role="menu"
      aria-label={clip ? 'Clip actions' : 'Timeline actions'}
      style={pos}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item === 'sep' ? (
          <div key={`sep-${i}`} className="ve-context-sep" role="separator" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={item.danger ? 'is-danger' : undefined}
            disabled={item.disabled}
            onClick={() => {
              item.run();
              onClose();
            }}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.hint && <kbd>{item.hint}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}

function clipItems(clip: Clip, time: number): (Item | 'sep')[] {
  const st = useVideoEditorStore.getState();
  const canSplitAt = (t: number) => t > clip.start + MIN_CLIP_DURATION && t < clipEnd(clip) - MIN_CLIP_DURATION;
  /** Splits just this clip at `t` (the playhead moves there, as with the S key). */
  const splitAt = (t: number) => {
    st.select(clip.id);
    st.setPlayhead(t);
    st.splitAtPlayhead();
  };
  const hasSound = clip.kind === 'video' || clip.kind === 'audio';
  const items: (Item | 'sep')[] = [
    { label: 'Split here', icon: <Scissors size={15} />, disabled: !canSplitAt(time), run: () => splitAt(time) },
    { label: 'Split at playhead', hint: 'S', icon: <Scissors size={15} />, disabled: !canSplitAt(st.playhead), run: () => splitAt(st.playhead) },
    'sep',
    { label: 'Duplicate', hint: 'Ctrl+D', icon: <Copy size={15} />, run: () => st.duplicateSelected() },
  ];
  if (hasSound) {
    items.push({
      label: clip.muted ? 'Unmute clip' : 'Mute clip',
      icon: clip.muted ? <Volume2 size={15} /> : <VolumeX size={15} />,
      run: () => st.toggleClipMute(clip.id),
    });
  }
  if (clip.kind === 'video') {
    items.push({ label: 'Detach audio', icon: <Unlink size={15} />, run: () => st.detachAudio(clip.id) });
  }
  items.push(
    'sep',
    { label: 'Delete', hint: 'Del', icon: <Trash2 size={15} />, danger: true, run: () => st.deleteSelected() },
    { label: 'Delete and close gap', hint: 'Shift+Del', icon: <Trash2 size={15} />, danger: true, run: () => st.rippleDeleteSelected() },
  );
  return items;
}

/** Right-click on empty track space. */
function laneItems(track: Track, time: number): (Item | 'sep')[] {
  const st = useVideoEditorStore.getState();
  const onTrack = st.clips.filter((c) => c.trackId === track.id);
  const gaps = trackGaps(st.clips, track.id);
  const gap = gaps.find(([from, to]) => time >= from && time < to);
  const underPlayhead = st.clips.some((c) => st.playhead > c.start + MIN_CLIP_DURATION && st.playhead < clipEnd(c) - MIN_CLIP_DURATION);
  const sameKind = st.tracks.filter((t) => t.kind === track.kind).length;
  const addTrack = (kind: Track['kind']) => {
    st.commit();
    st.addTrack(kind, 'top');
  };
  const items: (Item | 'sep')[] = [
    { label: 'Move playhead here', icon: <Crosshair size={15} />, run: () => st.setPlayhead(time) },
    {
      label: 'Split at playhead',
      hint: 'S',
      icon: <Scissors size={15} />,
      disabled: !underPlayhead,
      run: () => {
        st.select(null);
        st.splitAtPlayhead();
      },
    },
  ];
  if (track.kind === 'text') {
    items.push({ label: 'Add text here', icon: <Type size={15} />, run: () => st.addTextSequence([{ text: 'Text', start: time, duration: 3 }]) });
  }
  items.push(
    'sep',
    { label: 'Close this gap', icon: <AlignHorizontalJustifyStart size={15} />, disabled: !gap, run: () => gap && st.closeGap(track.id, gap[0], gap[1]) },
    { label: 'Close all gaps on this track', icon: <AlignHorizontalJustifyStart size={15} />, disabled: gaps.length === 0, run: () => st.closeGaps(track.id) },
    { label: 'Select all on this track', icon: <ListChecks size={15} />, disabled: onTrack.length === 0, run: () => st.selectMany(onTrack.map((c) => c.id)) },
    'sep',
    { label: 'Add video track', icon: <Film size={15} />, run: () => addTrack('video') },
    { label: 'Add audio track', icon: <Music size={15} />, run: () => addTrack('audio') },
    { label: 'Add text track', icon: <Plus size={15} />, run: () => addTrack('text') },
  );
  if (onTrack.length === 0 && sameKind > 1) {
    items.push({ label: 'Remove this empty track', icon: <X size={15} />, danger: true, run: () => st.removeTrack(track.id) });
  }
  return items;
}
