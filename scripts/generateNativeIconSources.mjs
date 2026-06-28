// Rasterises the brand SVG into the PNG source set that @capacitor/assets consumes to
// generate every Android (and later iOS) launcher/splash density, plus a couple of
// Play Console listing assets. Run via `npm run native:icons` then `npm run native:assets`.
//
// Sources live in ./cap-assets (input for capacitor-assets) and ./store-assets (manual
// upload to the Play Console). Both folders are git-ignored build artifacts.
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const capDir = join(root, 'cap-assets');
const storeDir = join(root, 'store-assets');

// Brand teal gradient + the CalmBeach wave mark, lifted verbatim from
// assets/branding/appicon.svg so the native icon matches the web favicon exactly.
const GRAD = `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#0f766e"/></linearGradient>`;
const MARK = `<path d="M85.5 56.3 A36 36 0 1 0 40.7 84.8" fill="none" stroke="#ffffff" stroke-width="15" stroke-linecap="round"/><circle cx="50" cy="50" r="20" fill="#ffffff" opacity="0.16"/><path d="M38 48 q6 -7 12 0 q6 7 12 0" fill="none" stroke="#ffffff" stroke-width="5.5" stroke-linecap="round"/><path d="M40 60 q5 -5.5 10 0 q5 5.5 10 0" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" opacity="0.55"/>`;

// Each builder embeds width/height = target px so sharp rasterises the SVG natively
// (crisp) instead of rendering at the 100px viewBox and upscaling.
const wrap = (s, body, vb = '0 0 100 100') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="${vb}">${body}</svg>`;

const iconOnly = (s) => wrap(s, `<defs>${GRAD}</defs><rect width="100" height="100" rx="22" fill="url(#g)"/>${MARK}`);
const iconSquare = (s) => wrap(s, `<defs>${GRAD}</defs><rect width="100" height="100" fill="url(#g)"/>${MARK}`); // no transparent corners
const iconBackground = (s) => wrap(s, `<defs>${GRAD}</defs><rect width="100" height="100" fill="url(#g)"/>`);
const iconForeground = (s) => wrap(s, `<g transform="translate(20,20) scale(0.6)">${MARK}</g>`); // mark in adaptive safe zone
const splash = (s) => wrap(s, `<defs>${GRAD}</defs><rect width="100" height="100" fill="url(#g)"/><g transform="translate(32,32) scale(0.36)">${MARK}</g>`);

// 1024x500 Play feature graphic — graphical only (text added later in a design tool if wanted).
const feature = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500"><defs>${GRAD}</defs>` +
  `<rect width="1024" height="500" fill="url(#g)"/>` +
  `<g transform="translate(690,40) scale(4.2)">${MARK}</g>` +
  `<g transform="translate(40,150) scale(2.6)">${MARK}</g>` +
  `</svg>`;

const png = async (svg) => sharp(Buffer.from(svg)).png().toBuffer();

await mkdir(capDir, { recursive: true });
await mkdir(storeDir, { recursive: true });

await writeFile(join(capDir, 'icon-only.png'), await png(iconOnly(1024)));
await writeFile(join(capDir, 'icon-background.png'), await png(iconBackground(1024)));
await writeFile(join(capDir, 'icon-foreground.png'), await png(iconForeground(1024)));
await writeFile(join(capDir, 'splash.png'), await png(splash(2732)));
await writeFile(join(capDir, 'splash-dark.png'), await png(splash(2732)));

await writeFile(join(storeDir, 'play-icon-512.png'), await png(iconSquare(512)));
await writeFile(join(storeDir, 'feature-graphic-1024x500.png'), await png(feature()));

console.log('Wrote native icon/splash sources to cap-assets/ and Play listing assets to store-assets/');
