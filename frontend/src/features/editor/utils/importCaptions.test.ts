import { describe, expect, it } from 'vitest';
import {
  assignTimingsToCues,
  enhanceTextForCaptions,
  parseSubtitles,
  repairSinhalaScript,
  splitTextIntoCues,
} from './importCaptions';

describe('importCaptions utilities', () => {
  it('repairs broken Sinhala rakaranshaya and yansaya conjuncts', () => {
    // 'ප්ර' (without ZWJ) -> 'ප්‍ර' (with ZWJ)
    const broken = 'ලංකාවේ තෙල් ප්රශ්නෙත් එක්ක හයිබ්රිඩ් කාර් සහ සත්යාපිත විකුණුම්කරුවන්';
    const repaired = repairSinhalaScript(broken);

    expect(repaired).toContain('ප්‍රශ්නෙත්');
    expect(repaired).toContain('හයිබ්‍රිඩ්');
    expect(repaired).toContain('සත්‍යාපිත');
  });

  it('replaces common transliterated vehicle terms with clean English words', () => {
    const raw = 'මේ තමයි ටොයොටා ඇක්වා. එක්දහස් පන්සිය සීසී හයිබ්රිඩ් එන්ජින් එකක් එක්ක එන මේ කාර් එක, නගරබද ට්රැෆික් එකේ යන්න හොඳයි.';
    const enhanced = enhanceTextForCaptions(raw);

    expect(enhanced).toContain('Toyota Aqua');
    expect(enhanced).toContain('1500cc');
    expect(enhanced).toContain('Hybrid');
    expect(enhanced).toContain('Engine');
    expect(enhanced).toContain('Car එක');
    expect(enhanced).toContain('Traffic එකේ');
  });

  it('splits plain script into bite-sized cues respecting sentence boundaries', () => {
    const script = `ලංකාවේ තෙල් ප්‍රශ්නෙත් එක්ක, අදටත් Market එකේ රජ කරන සුපිරිම Hybrid Car එක ගැන තමයි අද කතා කරන්නේ! හැබැයි මේ Car එක ගන්න කලින් ඔයා අනිවාර්යයෙන්ම දැනගන්න ඕනේ දේවල් ටිකක් තියෙනවා. වීඩියෝ එක අන්තිම වෙනකන් බලන්න!`;
    const cues = splitTextIntoCues(script);

    expect(cues.length).toBeGreaterThanOrEqual(3);
    for (const cue of cues) {
      expect(cue.length).toBeGreaterThan(0);
      expect(cue.length).toBeLessThanOrEqual(90);
    }
  });

  it('assigns balanced timings across video duration', () => {
    const cues = ['පළමු පේළිය', 'දෙවන පේළිය', 'තුන්වන පේළිය'];
    const timed = assignTimingsToCues(cues, { videoDuration: 30, mode: 'fit-video' });

    expect(timed).toHaveLength(3);
    expect(timed[0].start).toBe(0);
    expect(timed[2].end).toBeLessThanOrEqual(30);
    expect(timed[1].start).toBeGreaterThanOrEqual(timed[0].end);
  });

  it('parses SRT subtitle blocks when timestamps are present', () => {
    const srt = `1
00:00:01,000 --> 00:00:04,500
ලංකාවේ තෙල් ප්‍රශ්නය

2
00:00:04,600 --> 00:00:08,200
Toyota Aqua වාහනය`;

    const parsed = parseSubtitles(srt);
    expect(parsed).not.toBeNull();
    expect(parsed).toHaveLength(2);
    expect(parsed![0].start).toBe(1);
    expect(parsed![0].end).toBe(4.5);
    expect(parsed![0].text).toBe('ලංකාවේ තෙල් ප්‍රශ්නය');
    expect(parsed![1].start).toBe(4.6);
    expect(parsed![1].end).toBe(8.2);
  });
});
