import { encodeWav } from '../audio';

/**
 * Background music made in the browser: each style is a short chord progression with a beat,
 * played by simple synthesizers and repeated to the length asked for. Being generated, the tracks
 * are free to use anywhere, with no licence or attribution.
 */

export type MusicStyleId = 'lofi' | 'upbeat' | 'ambient' | 'cinematic' | 'tropical';

interface MusicStyle {
  id: MusicStyleId;
  label: string;
  mood: string;
  bpm: number;
  /** One chord per bar, as MIDI note numbers. */
  chords: number[][];
  pad: OscillatorType;
  drums: 'lofi' | 'pop' | 'none' | 'soft';
  /** Melody notes per bar (offsets into the chord), or null for none. */
  arp: number[] | null;
  bass: boolean;
}

export const MUSIC_STYLES: MusicStyle[] = [
  { id: 'lofi', label: 'Lo-fi chill', mood: 'Relaxed, for vlogs and study', bpm: 80, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], pad: 'triangle', drums: 'lofi', arp: null, bass: true },
  { id: 'upbeat', label: 'Upbeat pop', mood: 'Happy and bright, for promos', bpm: 118, chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], pad: 'sawtooth', drums: 'pop', arp: [0, 1, 2, 1, 0, 1, 2, 3], bass: true },
  { id: 'ambient', label: 'Calm ambient', mood: 'Soft, for talks and travel', bpm: 70, chords: [[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 68]], pad: 'sine', drums: 'none', arp: [0, 2, 1, 3], bass: false },
  { id: 'cinematic', label: 'Cinematic', mood: 'Big and slow, for intros', bpm: 60, chords: [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 55]], pad: 'sawtooth', drums: 'soft', arp: null, bass: true },
  { id: 'tropical', label: 'Tropical', mood: 'Light and sunny, for food and fun', bpm: 100, chords: [[65, 69, 72], [62, 65, 69], [58, 62, 65], [60, 64, 67]], pad: 'sine', drums: 'pop', arp: [0, 2, 1, 2, 0, 2, 1, 2], bass: true },
];

const RATE = 44_100;
const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, RATE, RATE);
  const data = buffer.getChannelData(0);
  let seed = 7;
  for (let i = 0; i < data.length; i++) data[i] = ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  return buffer;
}

/** A WAV file of `seconds` of music in the given style, fading out at the end. */
export async function generateMusic(id: MusicStyleId, seconds: number): Promise<File> {
  const style = MUSIC_STYLES.find((s) => s.id === id) ?? MUSIC_STYLES[0]!;
  const length = Math.max(5, Math.min(600, seconds));
  const ctx = new OfflineAudioContext(2, Math.ceil(length * RATE), RATE);
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.8, 0);
  master.gain.setValueAtTime(0.8, Math.max(0, length - 3));
  master.gain.linearRampToValueAtTime(0, length);
  // A simple echo for some space.
  const delay = ctx.createDelay(1);
  delay.delayTime.value = (60 / style.bpm) * 0.75;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.3;
  const wet = ctx.createGain();
  wet.gain.value = 0.25;
  master.connect(ctx.destination);
  master.connect(delay).connect(feedback).connect(delay);
  delay.connect(wet).connect(ctx.destination);
  const noise = noiseBuffer(ctx);

  const tone = (midi: number, at: number, dur: number, type: OscillatorType, level: number, cutoff: number, attack = 0.01) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq(midi);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(filter).connect(env).connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  };
  const hit = (at: number, kind: 'kick' | 'snare' | 'hat', level: number) => {
    if (kind === 'kick') {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.frequency.setValueAtTime(140, at);
      osc.frequency.exponentialRampToValueAtTime(45, at + 0.15);
      env.gain.setValueAtTime(level, at);
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      osc.connect(env).connect(master);
      osc.start(at);
      osc.stop(at + 0.35);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = kind === 'hat' ? 'highpass' : 'bandpass';
    filter.frequency.value = kind === 'hat' ? 7000 : 1800;
    const env = ctx.createGain();
    const dur = kind === 'hat' ? 0.05 : 0.18;
    env.gain.setValueAtTime(level, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(env).connect(master);
    src.start(at, Math.random() * 0.5, dur + 0.05);
  };

  const beat = 60 / style.bpm;
  const bar = beat * 4;
  for (let b = 0; b * bar < length; b++) {
    const t0 = b * bar;
    const chord = style.chords[b % style.chords.length]!;
    // Pad: the chord held for the bar.
    for (const n of chord) tone(n, t0, bar * 0.98, style.pad, 0.05, style.pad === 'sawtooth' ? 1400 : 3000, bar * 0.2);
    if (style.bass) {
      for (let q = 0; q < 4; q += style.drums === 'pop' ? 1 : 2) tone(chord[0]! - 12, t0 + q * beat, beat * 0.9, 'triangle', 0.18, 600);
    }
    if (style.arp) {
      const step = bar / style.arp.length;
      style.arp.forEach((i, k) => tone(chord[i % chord.length]! + 12, t0 + k * step, step * 1.6, style.id === 'tropical' ? 'sine' : 'triangle', 0.07, 5000, 0.005));
    }
    for (let q = 0; q < 4; q++) {
      const at = t0 + q * beat;
      if (style.drums === 'pop') {
        hit(at, 'kick', 0.7);
        if (q % 2 === 1) hit(at, 'snare', 0.25);
        hit(at + beat / 2, 'hat', 0.08);
      } else if (style.drums === 'lofi') {
        if (q === 0 || q === 2) hit(at, 'kick', 0.5);
        if (q % 2 === 1) hit(at, 'snare', 0.15);
        hit(at, 'hat', 0.05);
        hit(at + beat / 2, 'hat', 0.03);
      } else if (style.drums === 'soft' && q === 0) {
        hit(at, 'kick', 0.6);
      }
    }
  }

  const rendered = await ctx.startRendering();
  const wav = encodeWav(rendered);
  return new File([wav], `${style.label} (${Math.round(length)}s).wav`, { type: 'audio/wav' });
}
