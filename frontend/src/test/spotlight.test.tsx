import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CaptionBox } from '../features/editor/components/player/CaptionBox';
import { cascadeOpacity, cascadeWindows } from '../features/editor/utils/cascade';
import { sanitizeStyle } from '../features/editor/utils/captionStyle';
import { useVideoStore } from '../stores/editor/videoStore';
import { DEFAULT_STYLE, BUILT_IN_PRESETS, PRESETS_BY_KEY } from '../features/editor/model/presets';
import { deserializeEditorSettings } from '../features/editor/services/serialization';
import { EMPTY_DOCUMENT, useCaptionStore } from '../stores/editor/captionStore';

describe('Spotlight default caption style', () => {
  it('is the default: white text, spoken word highlighted yellow', () => {
    expect(DEFAULT_STYLE.preset).toBe('spotlight');
    expect(DEFAULT_STYLE.textColor).toBe('#FFFFFF');
    expect(DEFAULT_STYLE.highlightColor).toBe('#FFD400');
    expect(DEFAULT_STYLE.animation).toBe('karaoke');
  });

  it('is the first built-in preset', () => {
    expect(BUILT_IN_PRESETS[0].key).toBe('spotlight');
    expect(PRESETS_BY_KEY.spotlight.look.backgroundOpacity).toBe(0);
  });

  it('new projects (no saved style) start with Spotlight', () => {
    expect(deserializeEditorSettings({}).style).toMatchObject({ preset: 'spotlight', highlightColor: '#FFD400', animation: 'karaoke' });
  });

  it('Hormozi Style: centred, English in caps, yellow box with black text', () => {
    useCaptionStore.getState().load({ ...EMPTY_DOCUMENT });
    useCaptionStore.getState().applyPreset('hormozi', null);
    const style = useCaptionStore.getState().style;

    expect(style).toMatchObject({ preset: 'hormozi', alignMatrix: 'center', positionY: 50, textTransform: 'uppercase', animation: 'highlight', highlightTextColor: '#000000' });
  });

  it('look-only presets keep the user’s caption position', () => {
    useCaptionStore.getState().load({ ...EMPTY_DOCUMENT, style: { ...DEFAULT_STYLE, positionY: 20, alignMatrix: 'top-center' } });
    useCaptionStore.getState().applyPreset('modern', null);

    expect(useCaptionStore.getState().style).toMatchObject({ positionY: 20, alignMatrix: 'top-center' });
  });

  it('Spotlight has no black outline and cascades words in and out', () => {
    expect(PRESETS_BY_KEY.spotlight.look).toMatchObject({ outlineWidth: 0, lineTransition: 'cascade' });
    expect(PRESETS_BY_KEY.hormozi.look.lineTransition).toBe('none');
    // Styles saved before the option existed: only Spotlight gets it.
    expect(sanitizeStyle({ preset: 'spotlight' }).lineTransition).toBe('cascade');
    expect(sanitizeStyle({ preset: 'hormozi' }).lineTransition).toBe('none');
  });

  it('cascade timing matches the exporter: in first → last, out last → first', () => {
    const w = cascadeWindows(3, 10, 12);
    expect(w.map((x) => x.inStart)).toEqual([10, 10.06, 10.12]);
    expect(w.map((x) => +x.outEnd.toFixed(2))).toEqual([12, 11.94, 11.88]);
    expect(cascadeOpacity(w[0], 10.11)).toBeCloseTo(0.5);
    expect(cascadeOpacity(w[2], 11)).toBe(1);
    expect(cascadeOpacity(w[2], 11.9)).toBe(0); // last word already gone…
    expect(cascadeOpacity(w[0], 11.9)).toBeGreaterThan(0); // …while the first is still fading
  });

  it('preview fades each word by its own window', () => {
    const caption = { start: 10, end: 12, text: 'one two six', language: 'en' as const };
    act(() => useVideoStore.getState()._set({ currentTime: 10.07 }));
    const { container } = render(<CaptionBox caption={caption} style={DEFAULT_STYLE} scale={0.5} />);
    const opacities = () => [...container.querySelectorAll('.cap-layer-fill .cap-word')].map((el) => Number((el as HTMLElement).style.opacity));

    const early = opacities();
    expect(early[0]).toBeGreaterThan(early[1]);
    expect(early[2]).toBe(0);

    act(() => useVideoStore.getState()._set({ currentTime: 11 }));
    expect(opacities()).toEqual([1, 1, 1]);
  });
});
