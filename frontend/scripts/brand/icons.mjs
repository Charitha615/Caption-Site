/**
 * Renders scripts/brand/icon.html into every icon the site uses (public/):
 *   favicon-16.png, favicon-32.png, favicon-48.png, favicon-96.png  browser tabs, Google results
 *   favicon.ico                                                     older browsers (16, 32, 48 inside)
 *   apple-touch-icon.png (180)                                      iPhone / iPad home screen
 *   icon-192.png, icon-512.png, icon-maskable-512.png               Android home screen (web manifest)
 * Run: node scripts/brand/icons.mjs   (needs Google Chrome and internet for the Google Font)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pub = join(root, 'public');
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const page = pathToFileURL(join(root, 'scripts', 'brand', 'icon.html')).href;

const ICONS = [
  ['favicon-16.png', 16, 'round'],
  ['favicon-32.png', 32, 'round'],
  ['favicon-48.png', 48, 'round'],
  ['favicon-96.png', 96, 'round'],
  ['apple-touch-icon.png', 180, 'square'],
  ['icon-192.png', 192, 'round'],
  ['icon-512.png', 512, 'round'],
  ['icon-maskable-512.png', 512, 'maskable'],
];

for (const [file, size, shape] of ICONS) {
  execFileSync(chrome, [
    '--headless=new',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    // Transparent page, so rounded corners stay see-through.
    '--default-background-color=00000000',
    `--window-size=${size},${size}`,
    '--virtual-time-budget=5000',
    `--screenshot=${join(pub, file)}`,
    `${page}?size=${size}&shape=${shape}`,
  ], { stdio: 'ignore' });
  console.log(`  ${file}`);
}

/** favicon.ico holding the 16, 32 and 48 px PNGs (PNG-in-ICO, supported by every current browser). */
const pngs = ['favicon-16.png', 'favicon-32.png', 'favicon-48.png'].map((f) => [Number(f.match(/\d+/)[0]), readFileSync(join(pub, f))]);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2); // icon
header.writeUInt16LE(pngs.length, 4);
let offset = 6 + 16 * pngs.length;
const entries = pngs.map(([size, data]) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(size, 0);
  e.writeUInt8(size, 1);
  e.writeUInt16LE(1, 4); // colour planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(data.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += data.length;
  return e;
});
writeFileSync(join(pub, 'favicon.ico'), Buffer.concat([header, ...entries, ...pngs.map(([, d]) => d)]));
console.log('  favicon.ico');
