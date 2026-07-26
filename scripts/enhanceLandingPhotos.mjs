import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// De-block heavily compressed JPEGs: high-quality downsample (averages the 8x8
// JPEG blocks together), a whisper of blur to dissolve remaining block edges,
// slight saturation/contrast recovery, then re-encode at high quality.
const JOBS = [
  { src: 'C:/Users/Miltos/Desktop/αρχείο λήψης (1).jpg', out: 'public/landing/hero-morning.jpg' },
  { src: 'C:/Users/Miltos/Desktop/αρχείο λήψης (3).jpg', out: 'public/landing/hero-afternoon.jpg' },
  { src: 'C:/Users/Miltos/Desktop/αρχείο λήψης (2).jpg', out: 'public/landing/hero-evening.jpg' },
];
const TARGET_W = 1920;

const b = await chromium.launch();
const page = await b.newPage();
for (const j of JOBS) {
  const dataUrl = 'data:image/jpeg;base64,' + readFileSync(j.src).toString('base64');
  const out = await page.evaluate(async ({ dataUrl, TARGET_W }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const scale = TARGET_W / img.naturalWidth;
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    // Two-step downscale: halving first gives much cleaner averaging of blocks.
    let srcCanvas = document.createElement('canvas');
    srcCanvas.width = img.naturalWidth; srcCanvas.height = img.naturalHeight;
    let sctx = srcCanvas.getContext('2d');
    sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(img, 0, 0);
    let curW = img.naturalWidth, curH = img.naturalHeight;
    while (curW / 2 > w) {
      const half = document.createElement('canvas');
      half.width = Math.round(curW / 2); half.height = Math.round(curH / 2);
      const hctx = half.getContext('2d');
      hctx.imageSmoothingEnabled = true; hctx.imageSmoothingQuality = 'high';
      hctx.drawImage(srcCanvas, 0, 0, half.width, half.height);
      srcCanvas = half; curW = half.width; curH = half.height;
    }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.filter = 'blur(0.35px) saturate(1.07) contrast(1.04)';
    ctx.drawImage(srcCanvas, 0, 0, w, h);
    return { data: c.toDataURL('image/jpeg', 0.94), w, h };
  }, { dataUrl, TARGET_W });
  const buf = Buffer.from(out.data.split(',')[1], 'base64');
  writeFileSync(path.resolve(j.out), buf);
  const before = readFileSync(j.src).length;
  console.log(`${path.basename(j.out).padEnd(20)} ${out.w}x${out.h}  ${(buf.length/1024).toFixed(0)}KB  (was ${(before/1024).toFixed(0)}KB)  ${(buf.length/(out.w*out.h)).toFixed(3)} b/px`);
}
await b.close();
