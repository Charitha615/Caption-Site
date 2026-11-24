/** Sound helpers: waveforms, audio extraction to WAV, the voice clean-up chain and voice-over recording. */

export const PEAKS_PER_SECOND = 50;
/** Decoding needs the whole file in memory as raw samples; skip waveforms for files bigger than this. */
const MAX_DECODE_BYTES = 300 * 1024 * 1024;

const OfflineCtx = () => (typeof OfflineAudioContext !== 'undefined' ? new OfflineAudioContext(1, 1, 44_100) : null);

async function decode(source: Blob): Promise<AudioBuffer> {
  const ctx = OfflineCtx();
  if (!ctx) throw new Error('This browser cannot read audio.');
  return ctx.decodeAudioData(await source.arrayBuffer());
}

/** Loudest sample in each 1/PEAKS_PER_SECOND slice, all channels together, scaled so the loudest slice is 1. */
export function peaksOf(channels: Float32Array[], sampleRate: number, perSecond = PEAKS_PER_SECOND): number[] {
  const length = channels[0]?.length ?? 0;
  const slice = Math.max(1, Math.round(sampleRate / perSecond));
  const peaks: number[] = [];
  let loudest = 0;
  for (let start = 0; start < length; start += slice) {
    let peak = 0;
    const end = Math.min(length, start + slice);
    for (const data of channels) {
      // Every 4th sample is plenty to find a slice's peak.
      for (let i = start; i < end; i += 4) peak = Math.max(peak, Math.abs(data[i]!));
    }
    peaks.push(peak);
    loudest = Math.max(loudest, peak);
  }
  return loudest > 0 ? peaks.map((p) => Math.round((p / loudest) * 1000) / 1000) : peaks;
}

/** Waveform of a file, or null when it has no sound, is too big, or can't be decoded. */
export async function computePeaks(file: Blob): Promise<number[] | null> {
  if (file.size > MAX_DECODE_BYTES) return null;
  try {
    const buffer = await decode(file);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    return peaksOf(channels, buffer.sampleRate);
  } catch {
    return null;
  }
}

/** 16-bit PCM WAV from decoded audio. */
export function encodeWav(buffer: { numberOfChannels: number; sampleRate: number; length: number; getChannelData: (channel: number) => Float32Array }): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const { sampleRate, length } = buffer;
  const dataBytes = length * channels * 2;
  const view = new DataView(new ArrayBuffer(44 + dataBytes));
  const text = (at: number, s: string) => [...s].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, dataBytes, true);
  const data = Array.from({ length: channels }, (_, i) => buffer.getChannelData(i));
  let at = 44;
  for (let i = 0; i < length; i++) {
    for (const ch of data) {
      const s = Math.max(-1, Math.min(1, ch[i]!));
      view.setInt16(at, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      at += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}

/** The sound of a video file as a WAV file. */
export async function extractAudioWav(url: string): Promise<Blob> {
  if (typeof OfflineAudioContext === 'undefined') throw new Error('This browser cannot read audio.');
  const blob = await (await fetch(url)).blob();
  if (blob.size > MAX_DECODE_BYTES) throw new Error('This file is too big to extract the sound in the browser.');
  let buffer: AudioBuffer;
  try {
    buffer = await decode(blob);
  } catch {
    throw new Error('This video has no sound the browser can read.');
  }
  return encodeWav(buffer);
}

/**
 * Voice clean-up: cuts rumble and mains hum (high-pass), hiss (low-pass), and evens out loudness
 * (compressor plus make-up gain). It is a filter chain, not a learned noise model, so it won't remove
 * noise that sits inside the voice's frequencies (traffic, chatter).
 */
export function voiceChain(ctx: BaseAudioContext): { input: AudioNode; output: AudioNode } {
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 90;
  highpass.Q.value = 0.7;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 8500;
  lowpass.Q.value = 0.7;
  // A gentle dip where hiss is most audible.
  const hiss = ctx.createBiquadFilter();
  hiss.type = 'highshelf';
  hiss.frequency.value = 6000;
  hiss.gain.value = -4;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -26;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.2;
  const makeup = ctx.createGain();
  makeup.gain.value = 1.6;
  highpass.connect(lowpass).connect(hiss).connect(compressor).connect(makeup);
  return { input: highpass, output: makeup };
}

let previewContext: AudioContext | null = null;

/** The AudioContext the preview routes cleaned-up clips through (made on first use). */
export function previewAudioContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  previewContext ??= new AudioContext();
  return previewContext;
}

/** Records the microphone. `stop()` resolves with the recording as a file. */
export async function startVoiceRecording(): Promise<{ stop: () => Promise<File>; cancel: () => void; stream: MediaStream }> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('This browser cannot record from a microphone.');
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    throw new Error('Microphone access was blocked. Allow it in the browser’s address bar and try again.');
  }
  const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const release = () => stream.getTracks().forEach((t) => t.stop());
  recorder.start(250);
  return {
    stream,
    cancel: () => {
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
      release();
    },
    stop: () =>
      new Promise<File>((resolve) => {
        recorder.onstop = () => {
          release();
          const type = recorder.mimeType.split(';')[0] || 'audio/webm';
          const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
          resolve(new File(chunks, `Voice-over ${stamp}.${type.includes('mp4') ? 'm4a' : 'webm'}`, { type }));
        };
        recorder.stop();
      }),
  };
}
