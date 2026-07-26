// Builds art-directed, responsive hero images for the landing page.
//
// For each time-of-day slot (morning/afternoon/evening) we take ONE source
// photo and cut it into two different-aspect crops — a tall mobile crop and a
// wide desktop crop (matching CSS object-fit:cover + object-position via a
// focus point) — then emit each crop at 6 widths in both AVIF and WebP.
// 3 slots x 2 crops x 6 widths x 2 formats = 72 files.
//
// Run: node scripts/buildLandingHeroAssets.mjs
// Regenerates components/landing/heroSources.ts (the manifest LandingHeroPhoto
// reads from) alongside the image files.

import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const sourceDir = 'C:\\Users\\Miltos\\Desktop\\landing page';
const outDir = path.join(projectRoot, 'public', 'landing');
const manifestPath = path.join(projectRoot, 'components', 'landing', 'heroSources.ts');

// The band is a FIXED-HEIGHT strip (h-72 = 288px mobile, sm:h-96 = 384px), so its
// aspect ratio is set by the viewport width, not by us:
//   • 390px phone  → 390/288 ≈ 1.35:1   (NOT portrait — an early 4:5 crop here got
//                                        re-cropped by object-fit and lost the shot)
//   • 640px+       → 640/384 ≈ 1.67:1 up to 5:1 on a wide desktop
// So: a gentle landscape crop for phones, a wide cinematic one for desktop.
const MOBILE_ASPECT = 4 / 3;   // ≈1.33 — matches the phone band, minimal re-crop
const DESKTOP_ASPECT = 21 / 9; // wide band from sm: upward

const MOBILE_WIDTHS = [480, 640, 828, 960, 1200, 1440];
const DESKTOP_WIDTHS = [960, 1280, 1600, 1920, 2200, 2560];

const AVIF_OPTS = { quality: 50, effort: 4 };
const WEBP_OPTS = { quality: 76, effort: 4 };

// Per-slot source photo + focus point (0..1) for each crop direction. The
// focus point is where CSS object-position would sit — it decides which part
// of the "cover" crop survives (e.g. keeping the evening sun in frame).
const SLOTS = [
  {
    slot: 'morning',
    file: 'αρχείο λήψης (6).jpg',
    desktopFocusY: 0.5,
    mobileFocusX: 0.5,
  },
  {
    slot: 'afternoon',
    // Previous source (IMG20230622115305.jpg) had a visibly tilted horizon —
    // swapped for a level shot with the same vivid midday turquoise.
    file: 'IMG20240628121114.jpg',
    desktopFocusY: 0.42,
    mobileFocusX: 0.5,
  },
  {
    slot: 'evening',
    file: 'αρχείο λήψης (7).jpg',
    desktopFocusY: 1,    // sun sits at ~76% down the source; bottom-anchor keeps it + the horizon in the wide band
    mobileFocusX: 0.15,  // shifts the tall crop toward the sun
  },
];

// Replicates CSS object-fit:cover + object-position for a given target aspect
// ratio, returning a pixel rect to sharp.extract().
const coverRect = (width, height, targetAspect, focusX, focusY) => {
  const sourceAspect = width / height;
  if (sourceAspect > targetAspect) {
    // Source is relatively wider than target -> crop left/right, keep full height.
    const cropWidth = Math.round(height * targetAspect);
    const left = Math.round((width - cropWidth) * focusX);
    return { left: Math.max(0, Math.min(left, width - cropWidth)), top: 0, width: cropWidth, height };
  }
  // Source is relatively taller/narrower than target -> crop top/bottom, keep full width.
  const cropHeight = Math.round(width / targetAspect);
  const top = Math.round((height - cropHeight) * focusY);
  return { left: 0, top: Math.max(0, Math.min(top, height - cropHeight)), width, height: cropHeight };
};

const buildCrop = async (sourcePath, rect, widths, destPrefix) => {
  const results = [];
  for (const width of widths) {
    const height = Math.round(width * (rect.height / rect.width));
    const base = sharp(sourcePath).extract(rect).resize({ width, height, fit: 'fill' });

    const avifPath = `${destPrefix}-${width}.avif`;
    const webpPath = `${destPrefix}-${width}.webp`;
    await base.clone().avif(AVIF_OPTS).toFile(path.join(outDir, avifPath));
    await base.clone().webp(WEBP_OPTS).toFile(path.join(outDir, webpPath));
    results.push({ width, avif: `/landing/${avifPath}`, webp: `/landing/${webpPath}` });
  }
  return results;
};

const main = async () => {
  await mkdir(outDir, { recursive: true });

  // Clean previously generated variants so a re-run never leaves orphans.
  const existing = await readdir(outDir).catch(() => []);
  await Promise.all(
    existing
      .filter(f => /^(morning|afternoon|evening)-(mobile|desktop)-\d+\.(avif|webp)$/.test(f))
      .map(f => rm(path.join(outDir, f)))
  );

  const manifest = {};
  let fileCount = 0;

  for (const { slot, file, desktopFocusY, mobileFocusX } of SLOTS) {
    const sourcePath = path.join(sourceDir, file);
    const meta = await sharp(sourcePath).metadata();
    const { width, height } = meta;

    const desktopRect = coverRect(width, height, DESKTOP_ASPECT, 0.5, desktopFocusY);
    const mobileRect = coverRect(width, height, MOBILE_ASPECT, mobileFocusX, 0.5);

    const desktop = await buildCrop(sourcePath, desktopRect, DESKTOP_WIDTHS, `${slot}-desktop`);
    const mobile = await buildCrop(sourcePath, mobileRect, MOBILE_WIDTHS, `${slot}-mobile`);
    fileCount += desktop.length * 2 + mobile.length * 2;

    manifest[slot] = { mobile, desktop };
    console.log(`[hero-assets] ${slot}: desktop x${desktop.length} + mobile x${mobile.length} (avif+webp each)`);
  }

  const banner = `// AUTO-GENERATED by scripts/buildLandingHeroAssets.mjs — do not hand-edit.\n// Re-run the script after replacing source photos in "${sourceDir}".\n\n`;
  const body =
    `export type HeroSlot = 'morning' | 'afternoon' | 'evening';\n\n` +
    `export interface HeroVariant {\n  width: number;\n  avif: string;\n  webp: string;\n}\n\n` +
    `export interface HeroSlotSources {\n  mobile: HeroVariant[];\n  desktop: HeroVariant[];\n}\n\n` +
    `export const HERO_SOURCES: Record<HeroSlot, HeroSlotSources> = ${JSON.stringify(manifest, null, 2)};\n` +
    `\n// Desktop band takes over at this breakpoint (matches Tailwind's \`sm:\`).\n` +
    `export const HERO_DESKTOP_MEDIA = '(min-width: 640px)';\n`;

  await writeFile(manifestPath, banner + body, 'utf8');

  const files = await readdir(outDir);
  let totalBytes = 0;
  for (const f of files) {
    if (/\.(avif|webp)$/.test(f)) totalBytes += (await stat(path.join(outDir, f))).size;
  }
  console.log(`[hero-assets] wrote ${fileCount} image files (${(totalBytes / 1024 / 1024).toFixed(2)} MB) + heroSources.ts`);
};

main().catch(err => {
  console.error('[hero-assets] failed:', err);
  process.exit(1);
});
