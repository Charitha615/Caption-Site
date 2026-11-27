import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { totalDuration, useVideoEditorStore } from '../features/videoEditor/store';
import { fadeLevel, sourceTime, type MediaItem } from '../features/videoEditor/model';
import { filterCss } from '../features/videoEditor/filters';
import { frameSize } from '../features/videoEditor/render';
import { VideoEditorPage } from '../pages/VideoEditor/VideoEditorPage';

const video: MediaItem = { id: 'm-video', kind: 'video', name: 'vlog.mp4', url: 'blob:vlog', duration: 10, width: 1920, height: 1080 };
const image: MediaItem = { id: 'm-image', kind: 'image', name: 'logo.png', url: 'blob:logo', duration: 0 };
const store = () => useVideoEditorStore.getState();

describe('Video editor timeline', () => {
  beforeEach(() => {
    store().reset();
    store().addMedia(video);
    store().addMedia(image);
  });

  it('places media one after another on the matching track', () => {
    store().addMediaClip('m-video');
    store().addMediaClip('m-video');
    store().addMediaClip('m-image');
    const [a, b, c] = store().clips;
    expect(a).toMatchObject({ trackId: 'track-video', start: 0, duration: 10 });
    expect(b).toMatchObject({ trackId: 'track-video', start: 10 });
    // Images go on the video track too and get a default length.
    expect(c).toMatchObject({ trackId: 'track-video', start: 20, duration: 5 });
    expect(totalDuration(store().clips)).toBe(25);
  });

  it('splits the clip under the playhead and keeps the source in step', () => {
    store().addMediaClip('m-video');
    store().setPlayhead(4);
    store().splitAtPlayhead();
    const [left, right] = store().clips;
    expect(left).toMatchObject({ start: 0, duration: 4, offset: 0 });
    expect(right).toMatchObject({ start: 4, duration: 6, offset: 4 });
  });

  it('cannot trim a video past the ends of its source', () => {
    store().addMediaClip('m-video');
    const id = store().clips[0]!.id;
    store().trimClip(id, 'end', 30);
    expect(store().clips[0]!.duration).toBe(10);
    store().trimClip(id, 'start', 3);
    expect(store().clips[0]).toMatchObject({ start: 3, duration: 7, offset: 3 });
    store().trimClip(id, 'start', 0);
    expect(store().clips[0]).toMatchObject({ start: 0, duration: 10, offset: 0 });
  });

  it('keeps clips on tracks of their own kind', () => {
    store().addMediaClip('m-video');
    const id = store().clips[0]!.id;
    store().moveClip(id, 2, 'track-audio');
    expect(store().clips[0]).toMatchObject({ trackId: 'track-video', start: 2 });
  });

  it('undoes and redoes changes', () => {
    store().addMediaClip('m-video');
    store().addTextClip('Hello');
    expect(store().clips).toHaveLength(2);
    store().undo();
    expect(store().clips).toHaveLength(1);
    store().redo();
    expect(store().clips.map((c) => c.text)).toContain('Hello');
  });
});

describe('Video editor tools', () => {
  beforeEach(() => {
    store().reset();
    store().addMedia(video);
  });

  it('plays a clip faster: shorter on the timeline, same part of the source', () => {
    store().addMediaClip('m-video');
    const id = store().clips[0]!.id;
    store().updateClip(id, { speed: 2 });
    expect(store().clips[0]).toMatchObject({ duration: 5, speed: 2 });
    expect(sourceTime(store().clips[0]!, 2.5)).toBe(5);
    // Splitting at 2 s of timeline = 4 s into the source.
    store().setPlayhead(2);
    store().splitAtPlayhead();
    expect(store().clips[1]).toMatchObject({ start: 2, duration: 3, offset: 4 });
  });

  it('deletes a clip and closes the gap after it', () => {
    store().addMediaClip('m-video');
    store().addMediaClip('m-video');
    store().select(store().clips[0]!.id);
    store().rippleDeleteSelected();
    expect(store().clips).toHaveLength(1);
    expect(store().clips[0]!.start).toBe(0);
  });

  it('duplicates a clip right after itself, pushing later clips along', () => {
    store().addMediaClip('m-video');
    store().addMediaClip('m-video');
    store().select(store().clips[0]!.id);
    store().duplicateSelected();
    expect(store().clips.map((c) => c.start).sort((a, b) => a - b)).toEqual([0, 10, 20]);
  });

  it('removes gaps on the main video track', () => {
    store().addMediaClip('m-video', { start: 3 });
    store().addMediaClip('m-video', { start: 20 });
    store().closeGaps();
    expect(store().clips.map((c) => c.start)).toEqual([0, 10]);
  });

  it('adds a title card as one undo step, on free tracks', () => {
    store().addMediaClip('m-video');
    store().addTitleCard({ from: '#000', to: null }, 'Intro', 'Hello', {}, 3);
    const kinds = store().clips.map((c) => c.kind);
    expect(kinds).toEqual(['video', 'color', 'text']);
    // The video track is busy at 0 s, so the background gets a new video track above it.
    expect(store().clips[1]!.trackId).not.toBe('track-video');
    store().undo();
    expect(store().clips.map((c) => c.kind)).toEqual(['video']);
  });

  it('builds filters, fades and output sizes', () => {
    expect(filterCss({ preset: 'none', brightness: 1, contrast: 1, saturation: 1, blur: 0 })).toBe('none');
    expect(filterCss({ preset: 'bw', brightness: 1.2, contrast: 1, saturation: 1, blur: 4 }, 0.5)).toBe('grayscale(1) contrast(1.1) brightness(1.2) blur(2.00px)');
    store().addMediaClip('m-video');
    const id = store().clips[0]!.id;
    store().updateClip(id, { fadeIn: 2, fadeOut: 1 });
    const clip = store().clips[0]!;
    expect(fadeLevel(clip, 1)).toBe(0.5);
    expect(fadeLevel(clip, 5)).toBe(1);
    expect(fadeLevel(clip, 9.5)).toBeCloseTo(0.5);
    expect(frameSize('16:9', 1080)).toEqual({ width: 1920, height: 1080 });
    expect(frameSize('9:16', 720)).toEqual({ width: 720, height: 1280 });
    expect(frameSize('4:5', 1080)).toEqual({ width: 1080, height: 1350 });
  });
});

describe('Video editor page', () => {
  beforeEach(() => store().reset());

  it('opens in development with an empty project, and adds text from the Text panel', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><VideoEditorPage /></MemoryRouter>);
    expect(screen.getByText('Your video shows here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Export/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Text' }));
    await user.click(screen.getByRole('button', { name: 'Title' }));
    expect(store().clips).toHaveLength(1);
    expect(screen.getByRole('complementary', { name: 'Clip properties' })).toBeInTheDocument();

    // Export opens; jsdom can't record video, so the dialog says so instead of failing later.
    await user.click(screen.getByRole('button', { name: /^Export/ }));
    const dialog = screen.getByRole('dialog', { name: 'Export video' });
    expect(dialog).toHaveTextContent(/can.t record video/);
  });
});

describe('Video editor: trimming and the right-click menus', () => {
  beforeEach(() => {
    store().reset();
    store().addMedia(video);
  });

  it('trims a clip from the edge that is dragged, keeping the other edge where it is', () => {
    store().addMediaClip('m-video');
    const id = store().clips[0]!.id;
    store().trimClip(id, 'start', 3);
    // Start edge: the front is cut and the end stays at 10 s.
    expect(store().clips[0]).toMatchObject({ start: 3, duration: 7, offset: 3 });
    store().trimClip(id, 'end', 8);
    // End edge: the back is cut and the start stays at 3 s.
    expect(store().clips[0]).toMatchObject({ start: 3, duration: 5, offset: 3 });
  });

  it('opens a clip menu on right-click that splits the clip where it was clicked', async () => {
    store().addMediaClip('m-video');
    const { container } = render(<MemoryRouter><VideoEditorPage /></MemoryRouter>);
    const clip = container.querySelector<HTMLElement>('[data-clip-id]')!;
    const zoom = store().zoom;
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 4 * zoom });
    clip.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const menu = await screen.findByRole('menu', { name: 'Clip actions' });
    expect(menu).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: /Split here/ }));
    expect(store().clips.map((c) => [c.start, c.duration, c.offset])).toEqual([[0, 4, 0], [4, 6, 4]]);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens a timeline menu on empty track space that closes the gap under the pointer', async () => {
    store().addMediaClip('m-video');
    store().addMediaClip('m-video');
    const second = store().clips[1]!;
    store().moveClip(second.id, 14);
    const { container } = render(<MemoryRouter><VideoEditorPage /></MemoryRouter>);
    const lane = container.querySelector<HTMLElement>('[data-track-id="track-video"]')!;
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 12 * store().zoom });
    lane.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await screen.findByRole('menu', { name: 'Timeline actions' });
    await userEvent.click(screen.getByRole('menuitem', { name: /Close this gap/ }));
    expect(store().clips.map((c) => c.start)).toEqual([0, 10]);
    store().undo();
    expect(store().clips.map((c) => c.start)).toEqual([0, 14]);
  });
});

describe('Video editor on a phone', () => {
  it('suggests a tablet or computer, and can be dismissed', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: true, media: query, onchange: null,
      addEventListener: () => undefined, removeEventListener: () => undefined,
      addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    sessionStorage.clear();
    try {
      store().reset();
      render(<MemoryRouter><VideoEditorPage /></MemoryRouter>);
      const notice = screen.getByRole('dialog', { name: /works best on a bigger screen/ });
      expect(within(notice).getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/dashboard');
      await userEvent.click(screen.getByRole('button', { name: 'Continue anyway' }));
      expect(screen.queryByRole('dialog', { name: /works best on a bigger screen/ })).not.toBeInTheDocument();
    } finally {
      window.matchMedia = original;
      sessionStorage.clear();
    }
  });
});
