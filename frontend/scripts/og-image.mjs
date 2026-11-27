/**
 * Renders scripts/og-image.html to public/og-image.png (1200×630) with headless Chrome.
 *   node scripts/og-image.mjs            → shows sinsub.cc
 *   node scripts/og-image.mjs sinsub.lk  → after the move to sinsub.lk
 * Needs Google Chrome installed and internet (for the Google Fonts).
 */
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const domain = process.argv[2] || 'sinsub.cc';
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const page = `${pathToFileURL(join(root, 'scripts', 'og-image.html')).href}?domain=${encodeURIComponent(domain)}`;
const out = join(root, 'public', 'og-image.png');

execFileSync(chrome, [
  '--headless=new',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--window-size=1200,630',
  '--virtual-time-budget=5000',
  `--screenshot=${out}`,
  page,
], { stdio: 'inherit' });
console.log(`Wrote ${out} (${domain})`);
