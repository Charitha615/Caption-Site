import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE, BUILT_IN_PRESETS, PRESETS_BY_KEY } from '../features/editor/model/presets';
import { deserializeEditorSettings } from '../features/editor/services/serialization';

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
});
