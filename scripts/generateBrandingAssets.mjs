// Generate rasterized branding assets (favicons, PWA icons, apple-touch, og-image)
// from the SVG sources of truth in assets/branding/ into public/.
//
// "Sheltered Cove" brand. SVG sources are authoritative; rasters are build output.
// sharp handles SVG->PNG. sharp in this project cannot emit .ico, so favicon.ico
// is assembled by hand as an ICO container wrapping PNG frames (16/32/48), which
// is valid per the ICO spec and supported by all modern browsers.
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'branding');
const OUT = path.join(ROOT, 'public');

const BRAND_TEAL = '#0d9488';

const markSvg = path.join(SRC, 'calmbeach-mark.svg');
const appiconSvg = path.join(SRC, 'appicon.svg');
const maskableSvg = path.join(SRC, 'appicon-maskable.svg');
const ogSvg = path.join(SRC, 'og-image.svg');

/** Render an SVG file to a PNG buffer at the given square size. */
async function svgToPng(svgPath, size, { flattenTo } = {}) {
  const svg = await readFile(svgPath);
  let pipe = sharp(svg, { density: 384 }).resize(size, size, { fit: 'contain' });
  if (flattenTo) pipe = pipe.flatten({ background: flattenTo });
  return pipe.png({ compressionLevel: 9 }).toBuffer();
}

/** Assemble a multi-image .ico from PNG frame buffers (ICO supports embedded PNG). */
function buildIco(frames) {
  // frames: [{ size, png: Buffer }]
  const count = frames.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const body = [];

  frames.forEach((frame, i) => {
    const base = i * 16;
    // width/height: 0 means 256; our sizes are <256 so write directly
    dir.writeUInt8(frame.size >= 256 ? 0 : frame.size, base + 0);
    dir.writeUInt8(frame.size >= 256 ? 0 : frame.size, base + 1);
    dir.writeUInt8(0, base + 2); // palette
    dir.writeUInt8(0, base + 3); // reserved
    dir.writeUInt16LE(1, base + 4); // color planes
    dir.writeUInt16LE(32, base + 6); // bits per pixel
    dir.writeUInt32LE(frame.png.length, base + 8); // size of image data
    dir.writeUInt32LE(offset, base + 12); // offset of image data
    offset += frame.png.length;
    body.push(frame.png);
  });

  return Buffer.concat([header, dir, ...body]);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const written = [];

  // SVG favicon: copy the mark verbatim (vector, crisp at any size).
  await copyFile(markSvg, path.join(OUT, 'calmbeach-mark.svg'));
  written.push('calmbeach-mark.svg');

  // PNG favicons from the mark (transparent background is correct here).
  const fav16 = await svgToPng(markSvg, 16);
  const fav32 = await svgToPng(markSvg, 32);
  const fav48 = await svgToPng(markSvg, 48);
  await writeFile(path.join(OUT, 'favicon-16.png'), fav16);
  await writeFile(path.join(OUT, 'favicon-32.png'), fav32);
  written.push('favicon-16.png', 'favicon-32.png');

  // Multi-resolution favicon.ico (16/32/48).
  const ico = buildIco([
    { size: 16, png: fav16 },
    { size: 32, png: fav32 },
    { size: 48, png: fav48 },
  ]);
  await writeFile(path.join(OUT, 'favicon.ico'), ico);
  written.push('favicon.ico');

  // Apple touch icon: iOS ignores transparency and composites on black,
  // so flatten onto the brand teal. Use the full app icon (rounded tile art).
  const apple = await svgToPng(appiconSvg, 180, { flattenTo: BRAND_TEAL });
  await writeFile(path.join(OUT, 'apple-touch-icon.png'), apple);
  written.push('apple-touch-icon.png');

  // PWA icons (any) from the app icon.
  const pwa192 = await svgToPng(appiconSvg, 192);
  const pwa512 = await svgToPng(appiconSvg, 512);
  await writeFile(path.join(OUT, 'pwa-192.png'), pwa192);
  await writeFile(path.join(OUT, 'pwa-512.png'), pwa512);
  written.push('pwa-192.png', 'pwa-512.png');

  // PWA maskable icon (full-bleed art with safe-zone padding).
  const maskable = await svgToPng(maskableSvg, 512);
  await writeFile(path.join(OUT, 'pwa-maskable-512.png'), maskable);
  written.push('pwa-maskable-512.png');

  // Social card 1200x630.
  const ogSvgBuf = await readFile(ogSvg);
  const og = await sharp(ogSvgBuf, { density: 144 })
    .resize(1200, 630, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(OUT, 'og-image.png'), og);
  written.push('og-image.png');

  console.log('Generated branding assets in public/:');
  for (const f of written) console.log('  -', f);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
