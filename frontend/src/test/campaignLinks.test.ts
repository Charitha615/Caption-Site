import { beforeEach, describe, expect, it } from 'vitest';
import { campaignUrl, toTag } from '../services/adminSignupService';
import { captureAttribution, getAttribution } from '../utils/attribution';

describe('Campaign links', () => {
  beforeEach(() => localStorage.clear());

  it('builds the tagged link to share', () => {
    expect(campaignUrl('https://sinsub.cc', { source: 'facebook', medium: 'post', campaign: 'text-captions', path: '/' }))
      .toBe('https://sinsub.cc/?utm_source=facebook&utm_medium=post&utm_campaign=text-captions');
    expect(campaignUrl('https://sinsub.cc/', { source: 'TikTok', medium: null, campaign: 'Launch Dec', path: '/si' }))
      .toBe('https://sinsub.cc/si?utm_source=tiktok&utm_campaign=launch-dec');
    expect(toTag('  Text Captions!! ')).toBe('text-captions');
  });

  it('is read back by the sign-up tracking with the same tags', () => {
    const url = campaignUrl('https://sinsub.cc', { source: 'facebook', medium: 'post', campaign: 'text-captions', path: '/' });
    captureAttribution(url, '');
    expect(getAttribution()).toMatchObject({ source: 'facebook', medium: 'post', campaign: 'text-captions' });
  });
});
