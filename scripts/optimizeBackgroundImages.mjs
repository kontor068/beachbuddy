import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const appPath = path.join(rootDir, 'App.tsx');
const publicDir = path.join(rootDir, 'public');

const force = process.argv.includes('--force');
const maxWidth = Number(process.env.BG_MAX_WIDTH || 1600);
const quality = Number(process.env.BG_WEBP_QUALITY || 74);

const formatBytes = (bytes) => `${(bytes / 1024).toFixed(1)}KB`;

const readBackgroundBasePaths = async () => {
  const appSource = await fs.readFile(appPath, 'utf8');
  const matches = appSource.matchAll(/'\/([^']+-bg)\.(?:jpg|webp)'/g);

  return [...new Set([...matches].map((match) => match[1]))].sort();
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const statSize = async (filePath) => (await fs.stat(filePath)).size;

const optimizeBackground = async (basePath) => {
  const jpgPath = path.join(publicDir, `${basePath}.jpg`);
  const webpPath = path.join(publicDir, `${basePath}.webp`);
  const tmpPath = `${webpPath}.tmp`;

  if (!(await fileExists(jpgPath))) {
    return { basePath, status: 'missing-source', jpgSize: 0, webpSize: 0 };
  }

  const jpgSize = await statSize(jpgPath);
  const hasWebp = await fileExists(webpPath);

  if (hasWebp && !force) {
    return {
      basePath,
      status: 'exists',
      jpgSize,
      webpSize: await statSize(webpPath),
    };
  }

  await sharp(jpgPath)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality, effort: 6, smartSubsample: true })
    .toFile(tmpPath);

  const nextWebpSize = await statSize(tmpPath);
  const currentWebpSize = hasWebp ? await statSize(webpPath) : Number.POSITIVE_INFINITY;

  if (hasWebp && nextWebpSize >= currentWebpSize) {
    await fs.rm(tmpPath, { force: true });
    return {
      basePath,
      status: 'kept-existing',
      jpgSize,
      webpSize: currentWebpSize,
    };
  }

  await fs.rename(tmpPath, webpPath);

  return {
    basePath,
    status: hasWebp ? 'optimized' : 'created',
    jpgSize,
    webpSize: nextWebpSize,
  };
};

const main = async () => {
  const backgroundBasePaths = await readBackgroundBasePaths();
  const results = [];

  for (const basePath of backgroundBasePaths) {
    results.push(await optimizeBackground(basePath));
  }

  const missing = results.filter((result) => result.status === 'missing-source');
  const generated = results.filter((result) => ['created', 'optimized'].includes(result.status));
  const kept = results.filter((result) => result.status === 'kept-existing');
  const existing = results.filter((result) => result.status === 'exists');
  const jpgTotal = results.reduce((sum, result) => sum + result.jpgSize, 0);
  const webpTotal = results.reduce((sum, result) => sum + result.webpSize, 0);
  const savingsPct = jpgTotal > 0 ? Math.round((1 - webpTotal / jpgTotal) * 100) : 0;

  console.log(`Background sources: ${results.length}`);
  console.log(`Existing WebP: ${existing.length}`);
  console.log(`Generated/optimized: ${generated.length}`);
  console.log(`Kept smaller existing WebP: ${kept.length}`);
  console.log(`Missing JPG sources: ${missing.length}`);
  console.log(`JPG total: ${formatBytes(jpgTotal)}`);
  console.log(`WebP total: ${formatBytes(webpTotal)}`);
  console.log(`Estimated transfer reduction: ${savingsPct}%`);

  if (missing.length > 0) {
    console.error('Missing background JPG sources:');
    missing.forEach((result) => console.error(`- public/${result.basePath}.jpg`));
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
