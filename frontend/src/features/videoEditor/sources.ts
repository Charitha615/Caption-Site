import type { Clip } from './model';
import type { SourceLookup } from './render';

/** Loaded images by media id, shared by the preview and the export. */
const images = new Map<string, HTMLImageElement>();

export function imageFor(mediaId: string, url: string): HTMLImageElement {
  let img = images.get(mediaId);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = url;
    images.set(mediaId, img);
  }
  return img;
}

export function forgetImages() {
  images.clear();
}

/** <video> elements the preview keeps in step with the playhead, by clip id. */
export const previewVideos = new Map<string, HTMLVideoElement>();

/** Looks up pictures for the preview (and for "save frame"). */
export function previewLookup(urls: Map<string, string>): SourceLookup {
  return (clip: Clip) => {
    if (clip.kind === 'video') return previewVideos.get(clip.id);
    if (clip.kind === 'image' && clip.mediaId) {
      const url = urls.get(clip.mediaId);
      return url ? imageFor(clip.mediaId, url) : undefined;
    }
    return undefined;
  };
}

/** Saves a blob as a file through a temporary link. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A safe file name from the project name. */
export const fileBase = (name: string) => name.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 80) || 'video';
