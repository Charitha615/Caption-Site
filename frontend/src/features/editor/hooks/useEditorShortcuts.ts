import { useEffect } from 'react';
import { useCaptionStore } from '../../../stores/editor/captionStore';
import { useEditorStore } from '../../../stores/editor/editorStore';
import { getTargetCaptionId } from '../../../stores/editor/selectors';
import { useTimelineStore } from '../../../stores/editor/timelineStore';
import { useUIStore } from '../../../stores/editor/uiStore';
import { useVideoStore } from '../../../stores/editor/videoStore';
import { flush } from '../services/autosave';
import { playback } from '../services/playback';
import { IS_MAC, TEXT_INPUT_ID } from '../shortcuts';
import { selectRelative } from '../services/commands';

function isTextField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'range', 'button', 'color'].includes(el.type);
  }
  return false;
}

/**
 * Global editor shortcuts. Registered once; reads state lazily via getState()
 * so it never re-binds (the old handler re-bound on every time update).
 */
export function useEditorShortcuts(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return; // never interfere with Sinhala IME composition
      const mod = IS_MAC ? e.metaKey : e.ctrlKey;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const typing = isTextField(e.target);
      const nativeUndo = e.target instanceof HTMLElement && e.target.closest('[data-native-undo]');
      const captions = useCaptionStore.getState();
      const editor = useEditorStore.getState();
      const ui = useUIStore.getState();

      // Commands that also work while typing.
      if (mod && key === 'z' && !nativeUndo) {
        e.preventDefault();
        if (e.shiftKey) captions.redo();
        else captions.undo();
        return;
      }
      if (mod && key === 'y' && !IS_MAC && !nativeUndo) {
        e.preventDefault();
        captions.redo();
        return;
      }
      if (mod && key === 's') {
        e.preventDefault();
        void flush();
        return;
      }
      if (typing) {
        if (key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      if (ui.isShortcutsOpen || ui.isExportOpen) return;

      const target = getTargetCaptionId();
      const selected = editor.selectedCaptionId;
      const time = useVideoStore.getState().currentTime;
      const step = editor.nudgeStep * (e.shiftKey ? 10 : 1);

      if (mod && key === 'd') {
        e.preventDefault();
        if (target) captions.duplicate(target);
        return;
      }
      if (mod || e.ctrlKey || e.metaKey) return;

      switch (key) {
        case ' ':
          e.preventDefault();
          playback.toggle();
          break;
        case 'ArrowLeft':
        case 'ArrowRight': {
          e.preventDefault();
          const dir = key === 'ArrowLeft' ? -1 : 1;
          if (selected && !e.altKey) captions.nudge(selected, dir * step);
          else playback.seekBy(dir * (e.shiftKey ? 1 : 0.1));
          break;
        }
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault();
          selectRelative(key === 'ArrowUp' ? -1 : 1);
          break;
        case 'Delete':
        case 'Backspace':
          if (selected) {
            e.preventDefault();
            captions.deleteCaption(selected);
          }
          break;
        case 'a':
          e.preventDefault();
          captions.addCaption(time);
          break;
        case 's':
          e.preventDefault();
          if (target) captions.splitAt(target, time);
          break;
        case 'm':
          e.preventDefault();
          if (target) captions.mergeWithNext(target);
          break;
        case '[':
        case ']': {
          if (!target) break;
          e.preventDefault();
          const c = captions.captions.find((x) => x.id === target);
          if (!c) break;
          if (key === '[') captions.setTiming(target, time, Math.max(c.end, time + 0.2), 'Set start');
          else captions.setTiming(target, Math.min(c.start, time - 0.2), time, 'Set end');
          break;
        }
        case 'Enter':
          if (selected) {
            e.preventDefault();
            const input = document.getElementById(TEXT_INPUT_ID) as HTMLTextAreaElement | null;
            input?.focus();
            input?.setSelectionRange(input.value.length, input.value.length);
          }
          break;
        case 'c':
          e.preventDefault();
          playback.setCaptionsVisible(!useVideoStore.getState().captionsVisible);
          break;
        case '+':
        case '=':
          e.preventDefault();
          useTimelineStore.getState().zoomBy(1.25);
          break;
        case '-':
        case '_':
          e.preventDefault();
          useTimelineStore.getState().zoomBy(0.8);
          break;
        case 'Home':
          e.preventDefault();
          playback.seek(0);
          break;
        case 'End':
          e.preventDefault();
          playback.seek(useVideoStore.getState().duration);
          break;
        case 'Escape':
          if (ui.isPreviewMode) ui.setPreviewMode(false);
          else editor.select(null);
          break;
        case '?':
          e.preventDefault();
          ui.setShortcutsOpen(true);
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
