import { afterEach, describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import { STORAGE_KEYS } from '../config/constants';
import { getInitialTheme } from '../stores/themeStore';

describe('Theme', () => {
  afterEach(() => localStorage.clear());

  it('starts light for new visitors and keeps a saved choice', () => {
    expect(getInitialTheme()).toBe('light');
    localStorage.setItem(STORAGE_KEYS.THEME, 'dark');
    expect(getInitialTheme()).toBe('dark');
  });

  it('applies a saved choice before first paint with the same storage key', () => {
    const html = indexHtml;
    expect(html).toContain('<html lang="en" data-theme="light">');
    expect(html).toContain(`localStorage.getItem('${STORAGE_KEYS.THEME}')==='dark'`);
  });
});
