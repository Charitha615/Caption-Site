/** Single source of truth for keyboard shortcuts: used by the handler, tooltips and the help dialog. */

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
export const MOD = IS_MAC ? '⌘' : 'Ctrl';
export const SHIFT = IS_MAC ? '⇧' : 'Shift';
export const ALT = IS_MAC ? '⌥' : 'Alt';

export const SHORTCUTS = {
  playPause: { keys: ['Space'], label: 'Play / pause' },
  undo: { keys: [MOD, 'Z'], label: 'Undo' },
  redo: { keys: [MOD, SHIFT, 'Z'], label: 'Redo' },
  save: { keys: [MOD, 'S'], label: 'Save now' },
  delete: { keys: ['Delete'], label: 'Delete selected caption' },
  nudgeBack: { keys: ['←'], label: 'Move selected caption earlier' },
  nudgeForward: { keys: ['→'], label: 'Move selected caption later' },
  nudgeBig: { keys: [SHIFT, '← / →'], label: 'Move caption ×10 step' },
  seekBack: { keys: [ALT, '←'], label: 'Playhead back (no caption selected: ←)' },
  seekForward: { keys: [ALT, '→'], label: 'Playhead forward' },
  prevCaption: { keys: ['↑'], label: 'Select previous caption' },
  nextCaption: { keys: ['↓'], label: 'Select next caption' },
  add: { keys: ['A'], label: 'Add caption at playhead' },
  split: { keys: ['S'], label: 'Split caption at playhead' },
  merge: { keys: ['M'], label: 'Merge with next caption' },
  duplicate: { keys: [MOD, 'D'], label: 'Duplicate caption' },
  setStart: { keys: ['['], label: 'Set caption start to playhead' },
  setEnd: { keys: [']'], label: 'Set caption end to playhead' },
  editText: { keys: ['Enter'], label: 'Edit selected caption text' },
  toggleCaptions: { keys: ['C'], label: 'Show / hide captions' },
  zoomIn: { keys: ['+'], label: 'Zoom timeline in' },
  zoomOut: { keys: ['−'], label: 'Zoom timeline out' },
  home: { keys: ['Home'], label: 'Go to start' },
  end: { keys: ['End'], label: 'Go to end' },
  deselect: { keys: ['Esc'], label: 'Deselect / exit preview' },
  help: { keys: ['?'], label: 'Show keyboard shortcuts' },
} as const;

export type ShortcutId = keyof typeof SHORTCUTS;

export const SHORTCUT_GROUPS: Array<{ title: string; items: ShortcutId[] }> = [
  { title: 'Playback', items: ['playPause', 'seekBack', 'seekForward', 'home', 'end', 'toggleCaptions'] },
  { title: 'Editing', items: ['add', 'split', 'merge', 'duplicate', 'delete', 'editText', 'setStart', 'setEnd'] },
  { title: 'Timing & navigation', items: ['nudgeBack', 'nudgeForward', 'nudgeBig', 'prevCaption', 'nextCaption', 'zoomIn', 'zoomOut'] },
  { title: 'General', items: ['undo', 'redo', 'save', 'deselect', 'help'] },
];

/** "Undo (⌘ Z)" — for tooltips. */
export function tip(label: string, id?: ShortcutId): string {
  return id ? `${label}  ·  ${SHORTCUTS[id].keys.join(' ')}` : label;
}

export const TEXT_INPUT_ID = 'cap-inspector-text';
