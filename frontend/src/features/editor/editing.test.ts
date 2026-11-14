import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_DOCUMENT, useCaptionStore } from '../../stores/editor/captionStore';
import { useVideoStore } from '../../stores/editor/videoStore';
import { mergeCaptions, splitCaption, withTiming } from './model/captionOps';
import { pickTickInterval, snapTo } from './components/timeline/timelineMath';
import { serializeCaptions } from './services/serialization';
import type { CaptionSegment } from './model/types';

const seg = (id: string, start: number, end: number, text: string): CaptionSegment => ({ id, start, end, text, language: 'si' });

describe('caption editing', () => {
  beforeEach(() => {
    useVideoStore.getState()._set({ duration: 60 });
    useCaptionStore.getState().load({ ...EMPTY_DOCUMENT, captions: [seg('a', 0, 2, 'ආයුබෝවන්'), seg('b', 3, 5, 'ශ්‍රී ලංකාව')] });
  });

  it('edits text and undoes / redoes it', () => {
    const store = useCaptionStore.getState();
    store.updateText('a', 'සුභ උදෑසනක්');
    expect(useCaptionStore.getState().captions[0].text).toBe('සුභ උදෑසනක්');

    useCaptionStore.getState().undo();
    expect(useCaptionStore.getState().captions[0].text).toBe('ආයුබෝවන්');
    useCaptionStore.getState().redo();
    expect(useCaptionStore.getState().captions[0].text).toBe('සුභ උදෑසනක්');
  });

  it('changes timing and keeps captions inside the video', () => {
    useCaptionStore.getState().setTiming('b', 58, 70);
    const b = useCaptionStore.getState().captions.find((c) => c.id === 'b')!;
    expect(b.start).toBe(58);
    expect(b.end).toBeLessThanOrEqual(60);
  });

  it('adds and deletes captions', () => {
    const id = useCaptionStore.getState().addCaption(10, 'new line');
    expect(useCaptionStore.getState().captions.some((c) => c.id === id)).toBe(true);
    useCaptionStore.getState().deleteCaption(id);
    expect(useCaptionStore.getState().captions.some((c) => c.id === id)).toBe(false);
  });

  it('splits without breaking Sinhala conjuncts and merges back', () => {
    const parts = splitCaption(seg('x', 0, 4, 'ශ්‍රී ලංකාව සුන්දරයි'), 2);
    expect(parts).not.toBeNull();
    const [first, second] = parts!;
    expect(`${first.text} ${second.text}`).toBe('ශ්‍රී ලංකාව සුන්දරයි');
    expect(first.text.includes('‍') || second.text.includes('‍')).toBe(true);
    expect(mergeCaptions(first, second).text).toBe('ශ්‍රී ලංකාව සුන්දරයි');
  });

  it('moving a caption shifts its word timings with it', () => {
    const c = { ...seg('w', 1, 2, 'a b'), words: [{ text: 'a', start: 1, end: 1.5 }, { text: 'b', start: 1.5, end: 2 }] };
    const moved = withTiming(c, 3, 4, 60);
    expect(moved.words?.map((w) => w.start)).toEqual([3, 3.5]);
  });

  it('serialises captions for autosave with stable UUIDs', () => {
    const payload = serializeCaptions(useCaptionStore.getState().captions);
    expect(payload).toHaveLength(2);
    expect(payload[0]).toMatchObject({ start_time: 0, end_time: 2, text: 'ආයුබෝවන්', sequence: 1 });
  });
});

describe('timeline math', () => {
  it('picks readable ruler intervals for the zoom level', () => {
    expect(pickTickInterval(100).major).toBe(1);
    expect(pickTickInterval(10).major).toBe(10);
  });

  it('snaps to the nearest edge within the threshold only', () => {
    expect(snapTo(2.04, [2, 5], 0.1)).toEqual({ value: 2, guide: 2 });
    expect(snapTo(2.5, [2, 5], 0.1)).toEqual({ value: 2.5, guide: null });
  });
});
