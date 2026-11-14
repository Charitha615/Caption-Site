import { VIDEO_UPLOAD } from '../config/constants';
import { formatFileSize } from './formatters';

/** Client-side pre-check for a user-picked video. The server re-validates content and size. */
export function validateVideoFile(file: File, maxMb: number): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!(VIDEO_UPLOAD.EXTENSIONS as readonly string[]).includes(ext)) {
    return `Unsupported format (.${ext || '?'}). Choose an MP4, MOV, WEBM, MKV or AVI video.`;
  }
  if (file.size === 0) return 'This file is empty.';
  if (file.size > maxMb * 1024 * 1024) {
    return `This file is ${formatFileSize(file.size)}. Your plan allows videos up to ${maxMb} MB.`;
  }
  return null;
}
