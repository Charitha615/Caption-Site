import { customFontFile } from '../customFonts';
import { currentProject, fontFileKey, mediaFileKey, type SavedProject } from '../autosave';
import { useVideoEditorStore } from '../store';

/**
 * Project files (".sinsub"): the whole video editor project in one download, media included, to
 * keep as a backup or open on another computer. Nothing goes to the server.
 *
 * Layout: the 8 bytes "SINSUBVP", a uint32 (little endian) header length, the header as UTF-8 JSON
 * ({ format, version, project, files: [{ key, size, type }] }), then each file's bytes in order.
 */

const MAGIC = 'SINSUBVP';
export const PROJECT_FILE_EXTENSION = '.sinsub';

interface Header {
  format: 'sinsub-video-project';
  version: 1;
  project: SavedProject;
  files: Array<{ key: string; size: number; type: string }>;
}

/** Packs the open project with its media and font files. */
export async function packProjectFile(blobOf: (url: string) => Promise<Blob> = async (url) => (await fetch(url)).blob()): Promise<Blob> {
  const s = useVideoEditorStore.getState();
  const files: Array<{ key: string; blob: Blob }> = [];
  for (const item of s.media) {
    if (!item.missing && item.url) files.push({ key: mediaFileKey(item.id), blob: await blobOf(item.url) });
  }
  for (const font of s.fonts) {
    const file = customFontFile(font.id);
    if (file) files.push({ key: fontFileKey(font.id), blob: file });
  }
  // The copy in the account belongs to this browser's project; an opened file starts its own.
  const header: Header = {
    format: 'sinsub-video-project',
    version: 1,
    project: { ...currentProject(), projectUuid: null },
    files: files.map((f) => ({ key: f.key, size: f.blob.size, type: f.blob.type })),
  };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const prefix = new Uint8Array(12);
  prefix.set(new TextEncoder().encode(MAGIC), 0);
  new DataView(prefix.buffer).setUint32(8, json.byteLength, true);
  return new Blob([prefix, json, ...files.map((f) => f.blob)], { type: 'application/octet-stream' });
}

/** Reads a project file back into a project and its files. */
export async function unpackProjectFile(file: Blob): Promise<{ project: SavedProject; files: Map<string, Blob> }> {
  const bad = () => new Error('This is not a සිංSub video project file.');
  if (file.size < 12) throw bad();
  const prefix = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (new TextDecoder().decode(prefix.slice(0, 8)) !== MAGIC) throw bad();
  const headerLength = new DataView(prefix.buffer).getUint32(8, true);
  if (headerLength <= 0 || 12 + headerLength > file.size) throw bad();
  let header: Header;
  try {
    header = JSON.parse(await file.slice(12, 12 + headerLength).text()) as Header;
  } catch {
    throw bad();
  }
  if (header.format !== 'sinsub-video-project' || header.project?.version !== 1 || !Array.isArray(header.files)) throw bad();
  if (header.version !== 1) throw new Error('This project file was made by a newer version of the editor.');

  const files = new Map<string, Blob>();
  let offset = 12 + headerLength;
  for (const f of header.files) {
    if (typeof f.key !== 'string' || !(f.size >= 0) || offset + f.size > file.size) throw bad();
    files.set(f.key, file.slice(offset, offset + f.size, f.type || undefined));
    offset += f.size;
  }
  return { project: header.project, files };
}

/** A safe file name for the download. */
export const projectFileName = (name: string) => `${(name.trim() || 'video').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)}${PROJECT_FILE_EXTENSION}`;
