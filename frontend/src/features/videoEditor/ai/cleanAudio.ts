import { encodeWav } from '../audio';
import type { Clip, MediaItem } from '../model';
import { denoiseChannel } from './denoise';
import { decodeMedia } from './timelineAudio';

/**
 * The part of the clip's source it plays, with steady background noise removed, as a WAV file.
 * The clip can then point at this file with an in-point of 0.
 */
export async function cleanClipAudio(clip: Clip, item: MediaItem, strength: number, onProgress: (p: number) => void): Promise<File> {
  const buffer = await decodeMedia(item);
  if (!buffer) throw new Error('This clip has no sound to clean up.');
  const rate = buffer.sampleRate;
  const from = Math.max(0, Math.floor(clip.offset * rate));
  const to = Math.min(buffer.length, Math.ceil((clip.offset + clip.duration * clip.speed) * rate));
  const channels = Math.min(2, buffer.numberOfChannels);
  const cleaned: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) {
    cleaned.push(await denoiseChannel(buffer.getChannelData(ch).subarray(from, to), { strength }, (p) => onProgress((ch + p) / channels)));
  }
  const wav = encodeWav({ numberOfChannels: channels, sampleRate: rate, length: to - from, getChannelData: (i) => cleaned[i]! });
  const base = item.name.replace(/\.[^.]+$/, '');
  return new File([wav], `${base} (clean).wav`, { type: 'audio/wav' });
}
