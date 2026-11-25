/** Fonts the user uploads (TTF, OTF, WOFF, WOFF2). Autosave keeps their files in the browser with the project. */

export interface CustomFont {
  /** Also the CSS font-family name, so `fontCss(id)` finds it. */
  id: string;
  label: string;
}

export const ACCEPTED_FONTS = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';

const faces = new Map<string, FontFace>();
/** The uploaded files, so autosave can store them. */
const files = new Map<string, Blob>();
let counter = 0;

/** Loads a font file and makes it available to the preview and the export. */
export async function loadFontFile(file: File): Promise<CustomFont> {
  if (typeof FontFace === 'undefined') throw new Error('This browser cannot load fonts.');
  if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) throw new Error(`“${file.name}” is not a font file. Use TTF, OTF, WOFF or WOFF2.`);
  const id = `custom-${Date.now().toString(36)}-${(counter++).toString(36)}`;
  const font = { id, label: file.name.replace(/\.(ttf|otf|woff2?)$/i, '') };
  try {
    await registerFont(id, file);
  } catch {
    throw new Error(`Could not read the font “${file.name}”.`);
  }
  return font;
}

async function registerFont(id: string, data: Blob) {
  const face = new FontFace(id, await data.arrayBuffer());
  await face.load();
  document.fonts.add(face);
  faces.set(id, face);
  files.set(id, data);
}

/** The file of an uploaded font (for saving). */
export const customFontFile = (id: string) => files.get(id);

/** Loads a saved font again under its old id, so text using it looks the same. */
export async function restoreFont(font: CustomFont, data: Blob): Promise<boolean> {
  if (typeof FontFace === 'undefined') return false;
  try {
    await registerFont(font.id, data);
    return true;
  } catch {
    return false;
  }
}

export function forgetCustomFonts() {
  if (typeof document !== 'undefined' && document.fonts) faces.forEach((face) => document.fonts.delete(face));
  faces.clear();
  files.clear();
}
