// Builds art-directed, responsive hero images for the landing page.
//
// For each time-of-day slot (morning/afternoon/evening) we take ONE source
// photo and cut it into two different-aspect crops — a tall mobile crop and a
// wide desktop crop (matching CSS object-fit:cover + object-position via a
// focus point) — then emit each crop at 6 widths in both AVIF and WebP.
// 3 slots x 2 crops x 6 widths x 2 formats = 72 files.
//
// The MORNING and AFTERNOON variants in public/landing were re-cut in place on
// 26/08/2026 to level their horizons, from the largest existing render of each
// crop, because the source photos live on the main machine and this was not it.
// The evening variants are the untouched originals. Those in-place passes are
// done and must not be repeated — running THIS script from the original photos
// is the way back to full quality, and it straightens on its own.
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

// Filenames carry this suffix because netlify.toml serves /landing/* as
// `immutable, max-age=1 year`: the bytes behind a given URL may never change or
// returning visitors keep the old photo for a year, and no deploy can reach
// them. It is what happened on 26/08 — the straightened photos were live, and a
// laptop that had seen the site before still showed the tilted ones. (v3: the
// afternoon and evening "corrections" were withdrawn. v4: the afternoon one came
// back with the opposite sign, measured properly — see levelDeg.)
// BUMP THIS whenever the pixels change (new source photo, new crop, new
// correction). A re-run deletes every older version from public/landing, so the
// repository never accumulates them.
const ASSET_VERSION = 'v4';

const AVIF_OPTS = { quality: 50, effort: 4 };
const WEBP_OPTS = { quality: 76, effort: 4 };

// Per-slot source photo + focus point (0..1) for each crop direction. The
// focus point is where CSS object-position would sit — it decides which part
// of the "cover" crop survives (e.g. keeping the evening sun in frame).
//
// levelDeg = how far this photo's horizon leans DOWN TO THE RIGHT, in degrees.
// The image is rotated back by that much before anything is cropped. One degree
// is nothing in a square phone photo and glaring in a 21:9 band: at 2560px wide
// it drops the horizon 45px from one end of the screen to the other, and the
// straight things in frame (a lifeguard tower, a mast) visibly fall over.
//
// ONLY SET THIS FROM A REFERENCE THAT IS ACTUALLY LEVEL, AND LOOK AT IT.
// On 26/08/2026 all three were set from an automatic "strongest edge per column"
// fit and two came out wrong — in the evening photo the strongest edge is the
// sunset colour band, in the afternoon one it is a dark band inside the water.
// The evening photo had never leaned at all; the afternoon one leaned the
// OPPOSITE way from what the fit said, so the "correction" doubled it. Three
// deploys went out before a level rule was simply drawn on the picture and
// looked at.
//
// What works, in order: an open sea/sky horizon; a distant island's waterline
// (an island beyond the horizon has its base cut by it, so that line IS the
// horizon — but track it BY COLOUR, since the water's own shadow bands beat it
// on brightness); a man-made vertical. What never works: a near shoreline, a
// ridge, a cloud, or any fit whose residuals are worse than about a pixel.
const SLOTS = [
  {
    slot: 'morning',
    file: 'αρχείο λήψης (6).jpg',
    // The one that really leans. Open horizon across the whole frame says 0.69,
    // an independent whole-image fit says 0.66, and the lifeguard tower stands
    // up straight afterwards instead of falling to the right.
    levelDeg: 0.691,
    desktopFocusY: 0.5,
    mobileFocusX: 0.5,
  },
  {
    slot: 'afternoon',
    // Previous source (IMG20230622115305.jpg) had a visibly tilted horizon —
    // swapped for a level shot with the same vivid midday turquoise. It is less
    // tilted, not level: the island's waterline climbs 0.87 degrees to the RIGHT,
    // hence the negative sign. No open horizon anywhere in the frame (the island
    // fills it), which is why this one took three tries.
    file: 'IMG20240628121114.jpg',
    levelDeg: -0.874,
    desktopFocusY: 0.42,
    mobileFocusX: 0.5,
  },
  {
    slot: 'evening',
    file: 'αρχείο λήψης (7).jpg',
    // A level rule laid on the open horizon sits on it from end to end (fit over
    // 258 columns: 0.003 degrees, residuals 0.7px). Leave it alone.
    levelDeg: 0,
    desktopFocusY: 1,    // sun sits at ~76% down the source; bottom-anchor keeps it + the horizon in the wide band
    mobileFocusX: 0.15,  // shifts the tall crop toward the sun
  },
];

// Rotates the source back to level and returns the largest centred rectangle
// that contains no rotation wedge — everything downstream then treats it as if
// the photographer had held the camera straight. The fill colour is deliberately
// garish: if a wedge ever survived the crop, it must be impossible to miss.
const ROTATION_FILL = '#ff00ff';

const straightenedSource = async (sourcePath, levelDeg, sourceWidth, sourceHeight) => {
  if (!levelDeg) return { input: sourcePath, width: sourceWidth, height: sourceHeight };
  const rad = Math.abs(levelDeg) * Math.PI / 180;
  const rotated = await sharp(sourcePath).rotate(-levelDeg, { background: ROTATION_FILL }).toBuffer();
  const meta = await sharp(rotated).metadata();
  // Inscribed rect of the rotated frame, minus a 1px hair on each side so no
  // half-blended edge pixel of the fill can survive.
  const width = Math.floor(sourceWidth * Math.cos(rad) - sourceHeight * Math.sin(rad)) - 2;
  const height = Math.floor(sourceHeight * Math.cos(rad) - sourceWidth * Math.sin(rad)) - 2;
  if (width <= 0 || height <= 0) throw new Error(`levelDeg ${levelDeg} is too large for a ${sourceWidth}x${sourceHeight} source`);
  const input = await sharp(rotated)
    .extract({ left: Math.round((meta.width - width) / 2), top: Math.round((meta.height - height) / 2), width, height })
    .toBuffer();
  const { data } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let worstMagenta = 0;
  for (let i = 0; i < data.length; i += 3) {
    const m = Math.min(data[i], data[i + 2]) - data[i + 1];
    if (m > worstMagenta) worstMagenta = m;
  }
  if (worstMagenta > 60) throw new Error(`rotation wedge leaked into the straightened crop (${worstMagenta})`);
  return { input, width, height };
};

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

// `source` is either a path or an in-memory buffer (the straightened photo).
const buildCrop = async (source, rect, widths, destPrefix) => {
  const results = [];
  for (const width of widths) {
    const height = Math.round(width * (rect.height / rect.width));
    const base = sharp(source).extract(rect).resize({ width, height, fit: 'fill' });

    const avifPath = `${destPrefix}-${width}-${ASSET_VERSION}.avif`;
    const webpPath = `${destPrefix}-${width}-${ASSET_VERSION}.webp`;
    await base.clone().avif(AVIF_OPTS).toFile(path.join(outDir, avifPath));
    await base.clone().webp(WEBP_OPTS).toFile(path.join(outDir, webpPath));
    results.push({ width, avif: `/landing/${avifPath}`, webp: `/landing/${webpPath}` });
  }
  return results;
};

const main = async () => {
  await mkdir(outDir, { recursive: true });

  // Clean previously generated variants so a re-run never leaves orphans —
  // including the ones from earlier ASSET_VERSIONs, which nothing references
  // any more and which would otherwise sit in a public repo forever.
  const existing = await readdir(outDir).catch(() => []);
  await Promise.all(
    existing
      .filter(f => /^(morning|afternoon|evening)-(mobile|desktop)-\d+(-v\d+)?\.(avif|webp)$/.test(f))
      .map(f => rm(path.join(outDir, f)))
  );

  const manifest = {};
  let fileCount = 0;

  for (const { slot, file, levelDeg, desktopFocusY, mobileFocusX } of SLOTS) {
    const sourcePath = path.join(sourceDir, file);
    const meta = await sharp(sourcePath).metadata();

    // Straighten FIRST, crop after: rotating a finished crop would either shave
    // its edges or leave the wedge showing, and both crops must lean the same
    // way or the same beach looks level on a laptop and tipped on a phone.
    const { input, width, height } = await straightenedSource(sourcePath, levelDeg, meta.width, meta.height);

    const desktopRect = coverRect(width, height, DESKTOP_ASPECT, 0.5, desktopFocusY);
    const mobileRect = coverRect(width, height, MOBILE_ASPECT, mobileFocusX, 0.5);

    const desktop = await buildCrop(input, desktopRect, DESKTOP_WIDTHS, `${slot}-desktop`);
    const mobile = await buildCrop(input, mobileRect, MOBILE_WIDTHS, `${slot}-mobile`);
    fileCount += desktop.length * 2 + mobile.length * 2;

    manifest[slot] = { mobile, desktop };
    console.log(`[hero-assets] ${slot}: levelled ${levelDeg || 0}deg, desktop x${desktop.length} + mobile x${mobile.length} (avif+webp each)`);
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
