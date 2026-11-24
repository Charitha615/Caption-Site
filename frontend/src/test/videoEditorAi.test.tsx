import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useVideoEditorStore } from '../features/videoEditor/store';
import { spokenWordIndex, trackGaps, type MediaItem } from '../features/videoEditor/model';
import { findSilences, partWav, splitAtPauses } from '../features/videoEditor/ai/timelineAudio';
import { denoiseChannel } from '../features/videoEditor/ai/denoise';
import { toSrt } from '../features/videoEditor/ai/subtitles';
import { VideoEditorPage } from '../pages/VideoEditor/VideoEditorPage';

const video: MediaItem = { id: 'm-video', kind: 'video', name: 'vlog.mp4', url: 'blob:vlog', duration: 10, width: 1920, height: 1080 };
const store = () => useVideoEditorStore.getState();

describe('Subtitles on the timeline', () => {
  beforeEach(() => {
    store().reset();
    store().addMedia(video);
    store().addMediaClip('m-video');
  });

  it('puts lines on a new top track without overlaps, with word times relative to each line', () => {
    const id = store().setSubtitles([
      { start: 0.5, end: 3, text: 'ආයුබෝවන් ඔබට', words: [{ word: 'ආයුබෝවන්', start: 0.5, end: 1.4 }, { word: 'ඔබට', start: 1.5, end: 2.4 }] },
      { start: 2.5, end: 5, text: 'Second line' },
      { start: 6, end: 7, text: '   ' },
    ]);
    expect(store().tracks[0]).toMatchObject({ id, subtitles: true, hidden: false });
    const subs = store().clips.filter((c) => c.trackId === id);
    expect(subs.map((c) => [c.start, c.duration])).toEqual([[0.5, 2], [2.5, 2.5]]);
    expect(subs[0]!.words).toEqual([{ text: 'ආයුබෝවන්', t: 0, e: expect.closeTo(0.9) }, { text: 'ඔබට', t: 1, e: expect.closeTo(1.9) }]);

    // A translation goes on its own track and becomes the one showing.
    const second = store().setSubtitles([{ start: 0.5, end: 2, text: 'Hello you' }], { name: 'Subtitles (English)' });
    expect(store().tracks.find((t) => t.id === id)!.hidden).toBe(true);
    store().styleSubtitles({ captionMode: 'karaoke' }, second);
    expect(store().clips.find((c) => c.trackId === second)!.style!.captionMode).toBe('karaoke');
    expect(store().clips.find((c) => c.trackId === id)!.style!.captionMode).toBe('line');

    // Editing the words drops their (now wrong) timings.
    const first = subs[0]!;
    store().updateClip(first.id, { text: 'වෙනස් වචන' });
    expect(store().clips.find((c) => c.id === first.id)!.words).toBeUndefined();
  });

  it('finds the spoken word from word times, or estimates it from word lengths', () => {
    store().setSubtitles([{ start: 0, end: 4, text: 'one two', words: [{ word: 'one', start: 0, end: 1 }, { word: 'two', start: 2, end: 3 }] }]);
    const clip = store().clips.find((c) => c.kind === 'text')!;
    expect(spokenWordIndex(clip, ['one', 'two'], 1.5)).toBe(0);
    expect(spokenWordIndex(clip, ['one', 'two'], 2.1)).toBe(1);
    expect(spokenWordIndex({ ...clip, words: undefined }, ['aa', 'bb'], 3.5)).toBe(1);
  });

  it('cuts ranges out of every track and keeps the source in step', () => {
    store().setSubtitles([{ start: 5, end: 7, text: 'Later' }]);
    store().setPlayhead(9);
    store().removeRanges([[2, 4], [3, 4.5]]);
    const pieces = store().clips.filter((c) => c.kind === 'video').sort((a, b) => a.start - b.start);
    expect(pieces.map((c) => [c.start, c.duration, c.offset])).toEqual([[0, 2, 0], [2, 5.5, 4.5]]);
    expect(store().clips.find((c) => c.kind === 'text')!.start).toBeCloseTo(2.5);
    expect(store().playhead).toBeCloseTo(6.5);
    store().undo();
    expect(store().clips.filter((c) => c.kind === 'video')).toHaveLength(1);
  });

  it('adds a script as text clips in one undo step and swaps a clip’s media', () => {
    store().addTextSequence([{ text: 'One', start: 0, duration: 2 }, { text: 'Two', start: 2, duration: 2 }]);
    expect(store().clips.filter((c) => c.kind === 'text').map((c) => c.start)).toEqual([0, 2]);
    store().undo();
    expect(store().clips.filter((c) => c.kind === 'text')).toHaveLength(0);

    store().addMedia({ ...video, id: 'm-clean', kind: 'audio', name: 'clean.wav' });
    const id = store().clips[0]!.id;
    store().replaceClipMedia(id, 'm-clean', 0);
    expect(store().clips[0]).toMatchObject({ mediaId: 'm-clean', offset: 0 });
  });
});

describe('Sound analysis', () => {
  const rate = 1000;
  const tone = (seconds: number, amp: number) => Float32Array.from({ length: seconds * rate }, (_, i) => amp * Math.sin(i / 3));
  const join = (...parts: Float32Array[]) => {
    const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  };

  it('finds pauses, keeping a little padding next to speech', () => {
    const samples = join(tone(2, 0.5), tone(1, 0), tone(2, 0.5), tone(0.3, 0), tone(1, 0.5));
    const ranges = findSilences(samples, rate, { thresholdDb: -40, minSilence: 0.5, padding: 0.1 });
    expect(ranges).toHaveLength(1);
    expect(ranges[0]![0]).toBeCloseTo(2.1, 1);
    expect(ranges[0]![1]).toBeCloseTo(2.9, 1);
  });

  it('cuts long sound into parts at the quietest moment near the target', () => {
    const samples = join(tone(33, 0.5), tone(0.5, 0), tone(30, 0.5));
    const parts = splitAtPauses(samples, rate, 30, 8);
    expect(parts).toHaveLength(2);
    expect(parts[1]!.offset).toBeGreaterThanOrEqual(33);
    expect(parts[1]!.offset).toBeLessThanOrEqual(33.5);
    expect(partWav(parts[0]!.samples, rate, 1).size).toBe(44 + (parts[0]!.samples.length + rate) * 2);
  });

  it('removes steady noise and keeps the voice', async () => {
    let seed = 1;
    const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.1;
    const n = 8 * 8000;
    const input = Float32Array.from({ length: n }, (_, i) => noise() + (i > n / 2 ? 0.5 * Math.sin((2 * Math.PI * 440 * i) / 8000) : 0));
    const out = await denoiseChannel(input, { strength: 0.9 });
    const rms = (a: Float32Array, from: number, to: number) => Math.sqrt(a.subarray(from, to).reduce((s, v) => s + v * v, 0) / (to - from));
    expect(rms(out, 4000, n / 2 - 4000)).toBeLessThan(rms(input, 4000, n / 2 - 4000) * 0.4);
    expect(rms(out, n / 2 + 4000, n - 4000)).toBeGreaterThan(rms(input, n / 2 + 4000, n - 4000) * 0.8);
  });

  it('writes SRT with hours, minutes, seconds and milliseconds', () => {
    store().reset();
    store().setSubtitles([{ start: 3661.5, end: 3663, text: 'Hello' }]);
    expect(toSrt(store().clips)).toBe('1\n01:01:01,500 --> 01:01:03,000\nHello\n');
  });
});

describe('Subtitle generation', () => {
  it('shifts each part’s lines by its offset and keeps the finished parts when one fails', async () => {
    vi.resetModules();
    vi.doMock('../features/videoEditor/ai/timelineAudio', async (orig) => ({
      ...(await orig<typeof import('../features/videoEditor/ai/timelineAudio')>()),
      mixTimeline: async () => new Float32Array(10),
      splitAtPauses: () => [{ offset: 0, samples: new Float32Array(5) }, { offset: 30, samples: new Float32Array(5) }, { offset: 60, samples: new Float32Array(5) }],
    }));
    const transcribePart = vi.fn(async (_wav: Blob, _lang: string, part: number) => {
      if (part === 3) throw new Error('busy');
      return [{ start: 1, end: 2, text: `part ${part}`, language: 'si', words: [{ word: 'part', start: 1, end: 1.5 }] }];
    });
    vi.doMock('../features/videoEditor/ai/aiService', async (orig) => ({
      ...(await orig<typeof import('../features/videoEditor/ai/aiService')>()),
      aiService: { transcribePart },
    }));
    const { generateSubtitles } = await import('../features/videoEditor/ai/subtitles');
    const { lines, error } = await generateSubtitles({ clips: [], tracks: [], media: [] }, 'si', () => undefined, new AbortController().signal);
    expect(lines.map((l) => [l.start, l.text])).toEqual([[1, 'part 1'], [31, 'part 2']]);
    expect(lines[1]!.words![0]!.start).toBe(31);
    expect((error as Error).message).toBe('busy');
    vi.doUnmock('../features/videoEditor/ai/timelineAudio');
    vi.doUnmock('../features/videoEditor/ai/aiService');
  });
});

describe('Subtitles and AI tabs', () => {
  beforeEach(() => store().reset());

  it('asks for media before generating, and shows the AI tools', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><VideoEditorPage /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Subtitles' }));
    expect(screen.getByRole('button', { name: /Generate subtitles/ })).toBeDisabled();
    expect(screen.getByText(/Add a video with sound/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'AI tools' }));
    expect(screen.getByRole('button', { name: /Make voice-over/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Find pauses/ })).toBeInTheDocument();
  });
});

describe('Stabilization maths', () => {
  it('finds how far the picture moved and turns the camera path into shake', async () => {
    const { estimateShift, shakeFromPath, shakeAt } = await import('../features/videoEditor/ai/stabilize');
    const w = 64;
    const h = 48;
    const pattern = (x: number, y: number) => ((x * 7) ^ (y * 13)) % 97;
    const prev = Float32Array.from({ length: w * h }, (_, i) => pattern(i % w, Math.floor(i / w)));
    // Content moves 3 px right and 2 px up.
    const cur = Float32Array.from({ length: w * h }, (_, i) => pattern((i % w) - 3, Math.floor(i / w) + 2));
    expect(estimateShift(prev, cur, w, h, 6)).toEqual([3, -2]);

    // A steady pan has no shake; a jolt does, and correction pulls it back toward the smooth path.
    expect(shakeFromPath([0, 1, 2, 3, 4], 1).slice(1, 4)).toEqual([0, 0, 0]);
    expect(shakeFromPath([0, 0, 6, 0, 0], 1)[2]).toBeLessThan(0);
    const [sx, sy] = shakeAt({ from: 2, rate: 10, dx: [0, 0.1], dy: [0, -0.1] }, 2.05);
    expect(sx).toBeCloseTo(0.05);
    expect(sy).toBeCloseTo(-0.05);
  });
});

describe('Per-clip mute and dropping files', () => {
  beforeEach(() => {
    store().reset();
    store().addMedia(video);
    store().addMedia({ ...video, id: 'm-song', kind: 'audio', name: 'song.mp3' });
    store().addMediaClip('m-video');
    store().addMediaClip('m-song');
  });

  it('mutes one clip at a time, as one undo step, and leaves it out of the sound mix', async () => {
    const { soundingClips } = await import('../features/videoEditor/ai/timelineAudio');
    const [v, a] = store().clips;
    store().toggleClipMute(a!.id);
    expect(store().clips.map((c) => !!c.muted)).toEqual([false, true]);
    expect(soundingClips(store().clips, store().tracks).map((c) => c.id)).toEqual([v!.id]);
    store().undo();
    expect(store().clips[1]!.muted).toBeFalsy();
  });

  it('has a mute button on each sound clip in the timeline', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><VideoEditorPage /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Mute audio clip song.mp3' }));
    expect(store().clips.find((c) => c.kind === 'audio')!.muted).toBe(true);
    expect(store().clips.find((c) => c.kind === 'video')!.muted).toBeFalsy();
    expect(screen.getByRole('button', { name: 'Unmute audio clip song.mp3' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Layers and gaps', () => {
  beforeEach(() => {
    store().reset();
    store().addMedia(video);
  });

  it('adds tracks above or below the others of their kind, and removes empty ones', () => {
    const top = store().addTrack('video', 'top');
    const bottom = store().addTrack('video', 'bottom');
    const audio = store().addTrack('audio', 'top');
    const order = store().tracks.map((t) => t.id);
    expect(order[0]).toBe(top);
    expect(order.indexOf(bottom)).toBe(order.indexOf('track-video') + 1);
    expect(order.indexOf(audio)).toBe(order.indexOf('track-audio') - 1);
    expect(new Set(store().tracks.map((t) => t.name)).size).toBe(store().tracks.length);

    store().removeTrack(bottom);
    expect(store().tracks.some((t) => t.id === bottom)).toBe(false);
    // The last text track stays.
    store().removeTrack('track-text');
    expect(store().tracks.some((t) => t.id === 'track-text')).toBe(true);
  });

  it('moves a dragged clip onto a new track in the same undo step as the drag', () => {
    store().addMediaClip('m-video');
    const id = store().clips[0]!.id;
    store().commit();
    store().moveClip(id, 3);
    store().moveClipToNewTrack(id, 'bottom');
    const track = store().tracks.find((t) => t.id === store().clips[0]!.trackId)!;
    expect(track).toMatchObject({ kind: 'video' });
    expect(track.id).not.toBe('track-video');
    store().undo();
    expect(store().clips[0]).toMatchObject({ trackId: 'track-video', start: 0 });
    expect(store().tracks.some((t) => t.id === track.id)).toBe(false);
  });

  it('finds gaps on a track and closes one, pulling only later clips left', () => {
    store().addMediaClip('m-video', { start: 2 });
    store().addMediaClip('m-video', { start: 15 });
    store().addMediaClip('m-video', { start: 30 });
    expect(trackGaps(store().clips, 'track-video')).toEqual([[0, 2], [12, 15], [25, 30]]);
    store().closeGap('track-video', 12, 15);
    expect(store().clips.map((c) => c.start)).toEqual([2, 12, 27]);
    // Not a gap (a clip is in it): nothing happens.
    store().closeGap('track-video', 5, 8);
    expect(store().clips.map((c) => c.start)).toEqual([2, 12, 27]);
  });

  it('shows a bin for each gap and removes the gap when clicked', async () => {
    const user = userEvent.setup();
    store().addMediaClip('m-video', { start: 0 });
    store().addMediaClip('m-video', { start: 14 });
    render(<MemoryRouter><VideoEditorPage /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /Remove the 4\.0 second gap on Video/ }));
    expect(store().clips.map((c) => c.start)).toEqual([0, 10]);
    expect(screen.queryByRole('button', { name: /second gap on Video/ })).not.toBeInTheDocument();
  });
});

describe('Selecting several clips', () => {
  beforeEach(() => {
    store().reset();
    store().addMedia(video);
    store().addMediaClip('m-video');
    store().addMediaClip('m-video');
    store().addMediaClip('m-video');
  });

  it('toggles clips in and out, and picking one clip again resets the selection', () => {
    const [a, b, c] = store().clips.map((x) => x.id);
    store().select(a!);
    store().toggleSelect(b!);
    store().toggleSelect(c!);
    expect(store().selectedIds).toEqual([a, b, c]);
    expect(store().selectedId).toBe(c);
    store().toggleSelect(c!);
    expect(store().selectedIds).toEqual([a, b]);
    expect(store().selectedId).toBe(b);
    store().select(c!);
    expect(store().selectedIds).toEqual([c]);
  });

  it('deletes all selected clips in one undo step, or closes their gaps', () => {
    const [a, , c] = store().clips.map((x) => x.id);
    store().selectMany([a!, c!]);
    store().deleteSelected();
    expect(store().clips).toHaveLength(1);
    expect(store().selectedIds).toEqual([]);
    store().undo();
    expect(store().clips).toHaveLength(3);

    store().selectMany([a!, c!]);
    store().rippleDeleteSelected();
    expect(store().clips.map((x) => x.start)).toEqual([0]);
  });

  it('moves selected clips together', () => {
    const [a, b] = store().clips.map((x) => x.id);
    store().setClipStarts({ [a!]: 2, [b!]: 12 });
    expect(store().clips.map((x) => x.start)).toEqual([2, 12, 20]);
  });

  it('Ctrl-click picks several clips in the timeline, and Delete removes them all', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><VideoEditorPage /></MemoryRouter>);
    const [first, second] = screen.getAllByRole('button', { name: /^video clip vlog\.mp4/ });
    await user.click(first!);
    await user.keyboard('{Control>}');
    await user.click(second!);
    await user.keyboard('{/Control}');
    expect(screen.getByRole('heading', { name: '2 clips selected' })).toBeInTheDocument();
    await user.keyboard('{Delete}');
    expect(store().clips).toHaveLength(1);
  });
});

describe('Import from a link', () => {
  beforeEach(() => store().reset());

  it('needs a link and the permission box, and names TikTok downloads', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><VideoEditorPage /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'AI tools' }));
    const button = screen.getByRole('button', { name: /Download and import/ });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText('Video link'), 'https://www.tiktok.com/@kandy/video/123');
    expect(screen.getByRole('button', { name: /Download TikTok \(no watermark\)/ })).toBeDisabled();
    await user.click(screen.getByLabelText('I own this video or have permission to use it'));
    expect(screen.getByRole('button', { name: /Download TikTok \(no watermark\)/ })).toBeEnabled();
  });
});
