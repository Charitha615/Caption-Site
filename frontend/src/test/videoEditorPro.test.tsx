import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useVideoEditorStore } from '../features/videoEditor/store';
import { DEFAULT_CHROMA, keyframeValue, splitKeyframes, transformAt, type MediaItem } from '../features/videoEditor/model';
import { keyPixels } from '../features/videoEditor/chroma';
import { encodeWav, peaksOf } from '../features/videoEditor/audio';
import { mediaKindOf } from '../features/videoEditor/importMedia';
import { applyTransition } from '../features/videoEditor/render';
import { VideoEditorPage } from '../pages/VideoEditor/VideoEditorPage';

const video: MediaItem = { id: 'm-video', kind: 'video', name: 'vlog.mp4', url: 'blob:vlog', duration: 10, width: 1920, height: 1080 };
const store = () => useVideoEditorStore.getState();
const clip = () => store().clips[0]!;

describe('Keyframes', () => {
  beforeEach(() => {
    store().reset();
    store().addMedia(video);
    store().addMediaClip('m-video');
  });

  it('eases between keys and holds before the first and after the last', () => {
    const keys = [{ t: 2, v: 1 }, { t: 4, v: 2 }];
    expect(keyframeValue(keys, 0)).toBe(1);
    expect(keyframeValue(keys, 3)).toBeCloseTo(1.5);
    expect(keyframeValue(keys, 9)).toBe(2);
  });

  it('sets keys at the playhead, animates the transform, and removes them again', () => {
    store().setPlayhead(0);
    store().setKeyframe(clip().id, 'scale', 1);
    store().setPlayhead(4);
    store().setKeyframe(clip().id, 'scale', 2);
    expect(clip().keyframes.scale).toEqual([{ t: 0, v: 1 }, { t: 4, v: 2 }]);
    expect(transformAt(clip(), 2).scale).toBeCloseTo(1.5);
    // A key in the same spot is replaced, not added.
    store().setKeyframe(clip().id, 'scale', 3);
    expect(clip().keyframes.scale).toHaveLength(2);
    store().removeKeyframe(clip().id, 'scale');
    expect(clip().keyframes.scale).toEqual([{ t: 0, v: 1 }]);
    store().setPlayhead(0);
    store().removeKeyframe(clip().id, 'scale');
    expect(clip().keyframes.scale).toBeUndefined();
    expect(clip().transform.scale).toBe(1);
  });

  it('keeps the motion where it was when a clip is split, trimmed or sped up', () => {
    store().updateClip(clip().id, { keyframes: { x: [{ t: 0, v: 0 }, { t: 10, v: 1 }] } });
    const [left, right] = splitKeyframes(clip().keyframes, 4);
    expect(left.x!.at(-1)).toEqual({ t: 4, v: expect.closeTo(keyframeValue(clip().keyframes.x!, 4)) });
    expect(right.x![0]!.t).toBe(0);

    store().setPlayhead(4);
    store().splitAtPlayhead();
    const second = store().clips[1]!;
    // Same value just before and just after the cut.
    expect(transformAt(second, 4).x).toBeCloseTo(transformAt(store().clips[0]!, 3.9999).x, 3);

    store().undo();
    store().commit();
    store().trimClip(clip().id, 'start', 2);
    expect(clip().keyframes.x![0]!.t).toBe(-2);
    expect(transformAt(clip(), 5).x).toBeCloseTo(keyframeValue([{ t: 0, v: 0 }, { t: 10, v: 1 }], 5));

    store().undo();
    store().updateClip(clip().id, { speed: 2 });
    expect(clip().keyframes.x!.at(-1)!.t).toBe(5);
  });

  it('adds a zoom across the clip and clears it keeping the current value', () => {
    store().addZoomMotion(clip().id, 'in');
    expect(clip().keyframes.scale).toEqual([{ t: 0, v: 1 }, { t: 10, v: 1.25 }]);
    store().setPlayhead(10);
    store().clearKeyframes(clip().id);
    expect(clip().keyframes).toEqual({});
    expect(clip().transform.scale).toBeCloseTo(1.25);
  });

  it('moves transitions with the split: in stays left, out goes right', () => {
    store().updateClip(clip().id, { transitionIn: { type: 'slide-left' }, transitionOut: { type: 'wipe-right' } });
    store().setPlayhead(5);
    store().splitAtPlayhead();
    const [a, b] = store().clips;
    expect(a!.transitionIn.type).toBe('slide-left');
    expect(a!.transitionOut.type).toBe('none');
    expect(b!.transitionIn.type).toBe('none');
    expect(b!.transitionOut.type).toBe('wipe-right');
  });
});

describe('Audio tools', () => {
  beforeEach(() => {
    store().reset();
    store().addMedia(video);
    store().addMediaClip('m-video');
  });

  it('detaches a video clip’s sound to an audio track as one undo step', () => {
    store().updateClip(clip().id, { speed: 2 });
    store().detachAudio(clip().id);
    const [v, a] = store().clips;
    expect(v).toMatchObject({ kind: 'video', volume: 0 });
    expect(a).toMatchObject({ kind: 'audio', mediaId: 'm-video', trackId: 'track-audio', start: 0, duration: 5, speed: 2, volume: 1 });
    store().undo();
    expect(store().clips).toHaveLength(1);
    expect(clip().volume).toBe(1);
  });

  it('places a recording on a free audio track at a given time', () => {
    store().addMedia({ ...video, id: 'm-voice', kind: 'audio', name: 'voice.webm', duration: 4 });
    store().addMediaClip('m-voice', { start: 2, freeTrack: true });
    store().addMediaClip('m-voice', { start: 3, freeTrack: true });
    const voices = store().clips.filter((c) => c.mediaId === 'm-voice');
    expect(voices.map((c) => c.start)).toEqual([2, 3]);
    // They overlap, so the second one gets a new track.
    expect(voices[0]!.trackId).not.toBe(voices[1]!.trackId);
  });

  it('works out a waveform and writes a valid WAV header', () => {
    const left = new Float32Array(1000).map((_, i) => (i < 500 ? 0.1 : 0.5));
    expect(peaksOf([left], 1000, 2)).toEqual([0.2, 1]);
    const wav = encodeWav({ numberOfChannels: 1, sampleRate: 8000, length: 4, getChannelData: () => new Float32Array([0, 1, -1, 0.5]) });
    expect(wav.size).toBe(44 + 8);
    expect(wav.type).toBe('audio/wav');
  });
});

describe('Green screen, import and transitions', () => {
  it('removes the key colour and keeps other colours', () => {
    const px = new Uint8ClampedArray([0, 255, 0, 255, 220, 40, 40, 255, 20, 200, 30, 255]);
    keyPixels(px, { ...DEFAULT_CHROMA, enabled: true });
    expect(px[3]).toBe(0); // pure green
    expect(px[7]).toBe(255); // red stays
    expect(px[11]).toBe(0); // darker green is still green
    const people = new Uint8ClampedArray([230, 180, 150, 255, 128, 128, 128, 255]);
    keyPixels(people, { ...DEFAULT_CHROMA, enabled: true, similarity: 1 });
    expect([people[3], people[7]]).toEqual([255, 255]); // skin and grey survive even full strength
  });

  it('recognises .mov and other files the browser gives no type for', () => {
    const file = (name: string) => new File(['x'], name, { type: '' });
    expect(mediaKindOf(file('clip.MOV'))).toBe('video');
    expect(mediaKindOf(file('song.flac'))).toBe('audio');
    expect(mediaKindOf(file('notes.txt'))).toBeNull();
  });

  it('turns a transition into canvas moves and filters', () => {
    const calls: string[] = [];
    const ctx = {
      globalAlpha: 1,
      translate: (x: number, y: number) => calls.push(`translate ${Math.round(x)} ${Math.round(y)}`),
      beginPath: () => undefined,
      rect: (...a: number[]) => calls.push(`rect ${a.map(Math.round).join(' ')}`),
      clip: () => calls.push('clip'),
    } as unknown as CanvasRenderingContext2D;
    applyTransition(ctx, 'slide-left', 0, 'in', 100, 50, 1);
    expect(calls.at(-1)).toBe('translate 100 0');
    applyTransition(ctx, 'wipe-right', 0.5, 'in', 100, 50, 1);
    expect(calls).toContain('clip');
    expect(applyTransition(ctx, 'blur', 0, 'in', 100, 50, 1)).toMatch(/^blur\(/);
    expect(applyTransition(ctx, 'blur', 1, 'in', 100, 50, 1)).toBe('');
  });
});

describe('Pro editing controls', () => {
  beforeEach(() => {
    store().reset();
    store().addMedia(video);
  });

  it('crops, rotates by 90° and flips a selected clip from the panel', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><VideoEditorPage /></MemoryRouter>);
    store().addMediaClip('m-video');
    await user.click(await screen.findByRole('button', { name: /Crop & rotate/ }));
    const [rotateLeft, rotateRight] = screen.getAllByRole('button', { name: /90°/ });
    await user.click(rotateRight!);
    await user.click(rotateRight!);
    expect(clip().transform.rotation).toBe(180);
    await user.click(rotateLeft!);
    expect(clip().transform.rotation).toBe(90);
    await user.click(screen.getByRole('button', { name: 'Flip upside down' }));
    expect(clip().transform.flipV).toBe(true);

    await user.click(screen.getByRole('button', { name: '4×' }));
    expect(clip()).toMatchObject({ speed: 4, duration: 2.5 });

    await user.click(screen.getByRole('button', { name: 'Detach audio' }));
    expect(store().clips.map((c) => c.kind)).toEqual(['video', 'audio']);
  });

  it('shows the voice-over recorder in the Audio tab', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><VideoEditorPage /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Audio' }));
    expect(screen.getByRole('button', { name: /Record voice-over/ })).toBeInTheDocument();
  });
});
