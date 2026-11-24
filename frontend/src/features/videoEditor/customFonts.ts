/** Fonts the user uploads (TTF, OTF, WOFF, WOFF2). They live in this tab only, like the rest of the project's media. */

export interface CustomFont {
  /** Also the CSS font-family name, so `fontCss(id)` finds it. */
  id: string;
  label: string;
}

export const ACCEPTED_FONTS = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';

const faces = new Map<string, FontFace>();
let counter = 0;

/** Loads a font file and makes it available to the preview and the export. */
export async function loadFontFile(file: File): Promise<CustomFont> {
  if (typeof FontFace === 'undefined') throw new Error('This browser cannot load fonts.');
  if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) throw new Error(`“${file.name}” is not a font file. Use TTF, OTF, WOFF or WOFF2.`);
  const id = `custom-${Date.now().toString(36)}-${(counter++).toString(36)}`;
  const face = new FontFace(id, await file.arrayBuffer());
  try {
    await face.load();
  } catch {
    throw new Error(`Could not read the font “${file.name}”.`);
  }
  document.fonts.add(face);
  faces.set(id, face);
  return { id, label: file.name.replace(/\.(ttf|otf|woff2?)$/i, '') };
}

export function forgetCustomFonts() {
  if (typeof document !== 'undefined' && document.fonts) faces.forEach((face) => document.fonts.delete(face));
  faces.clear();
}
