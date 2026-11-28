import { beforeEach, describe, expect, it } from 'vitest';
import { captureAttribution, getAttribution } from '../utils/attribution';

describe('sign-up attribution', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps the UTM tags of the first visit', () => {
    captureAttribution('https://sinsub.cc/?utm_source=tiktok&utm_medium=social&utm_campaign=launch', 'https://www.tiktok.com/');
    expect(getAttribution()).toEqual({ source: 'tiktok', medium: 'social', campaign: 'launch', referrer: 'www.tiktok.com' });
  });

  it('does not let a later visit overwrite the first one', () => {
    captureAttribution('https://sinsub.cc/?utm_source=tiktok', '');
    captureAttribution('https://sinsub.cc/?utm_source=facebook', '');
    expect(getAttribution()?.source).toBe('tiktok');
  });

  it('treats ?ref= as a creator link', () => {
    captureAttribution('https://sinsub.cc/?ref=kasun', '');
    expect(getAttribution()).toMatchObject({ source: 'kasun', medium: 'creator' });
  });

  it('keeps an outside referring site but ignores our own pages and direct visits', () => {
    captureAttribution('https://sinsub.cc/register', 'https://sinsub.cc/');
    captureAttribution('https://sinsub.cc/', '');
    expect(getAttribution()).toBeUndefined();

    captureAttribution('https://sinsub.cc/', 'https://m.facebook.com/story');
    expect(getAttribution()).toEqual({ source: undefined, medium: undefined, campaign: undefined, referrer: 'm.facebook.com' });
  });

  it('forgets attribution older than 90 days', () => {
    localStorage.setItem('samplecap_signup_attribution', JSON.stringify({ source: 'old', at: Date.now() - 91 * 86_400_000 }));
    expect(getAttribution()).toBeUndefined();
  });
});
