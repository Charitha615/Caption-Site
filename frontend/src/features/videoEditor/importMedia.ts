import { uid, type MediaItem, type MediaKind } from './model';

export const ACCEPTED_MEDIA = 'video/*,audio/*,image/*,.mp4,.mov,.m4v,.webm,.mkv,.mp3,.wav,.m4a,.aac,.ogg,.flac';

const EXTENSION_KIND: Record<string, MediaKind> = {
  mp4: 'video', mov: 'video', m4v: 'video', webm: 'video', mkv: 'video',
  mp3: 'audio', wav: 'audio', m4a: 'audio', aac: 'audio', ogg: 'audio', oga: 'audio', flac: 'audio', opus: 'audio',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', avif: 'image', bmp: 'image',
};

/** Kind from the MIME type, or from the extension when the browser gives none (common for .mov and .mkv). */
export function mediaKindOf(file: File): MediaKind | null {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('image/')) return 'image';
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  return ext ? EXTENSION_KIND[ext] ?? null : null;
}

/**
 * Some files (notably browser recordings) report an endless duration until the end has been found.
 * Seeking far past the end makes the browser work it out.
 */
function findDuration(el: HTMLMediaElement): Promise<number> {
  if (Number.isFinite(el.duration)) return Promise.resolve(el.duration);
  return new Promise((resolve) => {
    const done = () => {
      if (!Number.isFinite(el.duration)) return;
      el.removeEventListener('durationchange', done);
      el.removeEventListener('timeupdate', done);
      window.clearTimeout(timer);
      resolve(el.duration);
    };
    const timer = window.setTimeout(() => {
      el.removeEventListener('durationchange', done);
      el.removeEventListener('timeupdate', done);
      resolve(0);
    }, 5000);
    el.addEventListener('durationchange', done);
    el.addEventListener('timeupdate', done);
    el.currentTime = 1e9;
  });
}

const THUMB_WIDTH = 160;

function loadImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Could not read this image.'));
    img.src = url;
  });
}

/** Reads duration, size and one preview frame from a local video or audio file. */
function loadTimed(url: string, kind: 'video' | 'audio'): Promise<{ duration: number; width?: number; height?: number; thumb?: string }> {
  return new Promise((resolve, reject) => {
    const el = document.createElement(kind);
    el.preload = 'auto';
    el.muted = true;
    if (el instanceof HTMLVideoElement) el.playsInline = true;
    const fail = () => reject(new Error(`Could not read this ${kind} file. Try MP4, WebM, MP3 or WAV.`));
    el.onerror = fail;
    el.onloadedmetadata = async () => {
      el.onloadedmetadata = null;
      const duration = await findDuration(el);
      if (!(el instanceof HTMLVideoElement)) {
        resolve({ duration });
        return;
      }
      const { videoWidth: width, videoHeight: height } = el;
      el.onseeked = () => {
        let thumb: string | undefined;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = THUMB_WIDTH;
          canvas.height = Math.round((THUMB_WIDTH * height) / Math.max(width, 1)) || 90;
          canvas.getContext('2d')?.drawImage(el, 0, 0, canvas.width, canvas.height);
          thumb = canvas.toDataURL('image/jpeg', 0.7);
        } catch {
          thumb = undefined;
        }
        resolve({ duration, width, height, thumb });
      };
      // A little way in: many videos open on a black frame.
      el.currentTime = Math.min(Math.max(0.5, duration * 0.1), 3, duration / 2);
    };
    el.src = url;
  });
}

export async function readMediaFile(file: File): Promise<MediaItem> {
  const kind = mediaKindOf(file);
  if (!kind) throw new Error(`“${file.name}” is not a video, audio or image file.`);
  const url = URL.createObjectURL(file);
  try {
    if (kind === 'image') {
      const size = await loadImage(url);
      return { id: uid('media'), kind, name: file.name, url, duration: 0, ...size, thumb: url };
    }
    const info = await loadTimed(url, kind);
    if (info.duration <= 0) throw new Error(`“${file.name}” has no playable length.`);
    return { id: uid('media'), kind, name: file.name, url, ...info };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}
