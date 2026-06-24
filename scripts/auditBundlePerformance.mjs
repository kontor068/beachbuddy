import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const distDir = path.join(projectRoot, 'dist');
const assetsDir = path.join(distDir, 'assets');
const reportPath = path.join(projectRoot, '.tmp', 'bundle-performance-report.json');

const failures = [];
const warnings = [];
let checks = 0;

const budgets = {
  maxInitialGzipKb: 600,
  warnInitialGzipKb: 350,
  maxTotalJsGzipKb: 750,
  warnTotalJsGzipKb: 500,
  maxLargestJsGzipKb: 200,
  warnLargestJsRawKb: 500,
  warnCssGzipKb: 60,
};

const exists = async filePath => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const fail = message => {
  checks += 1;
  failures.push(message);
};

const warn = message => {
  warnings.push(message);
};

const pass = () => {
  checks += 1;
};

const bytesToKb = bytes => Math.round((bytes / 1024) * 10) / 10;
const formatKb = bytes => `${bytesToKb(bytes).toLocaleString('en-US')} KB`;

const gzipSize = buffer => gzipSync(buffer, { level: 9 }).length;

const brotliSize = buffer => brotliCompressSync(buffer, {
  params: {
    [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
  },
}).length;

const assetRefsFromHtml = html => {
  const refs = [];
  const matches = html.matchAll(/<(script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi);
  for (const match of matches) {
    const tag = match[0];
    const ref = match[2];
    if (!ref.startsWith('/assets/')) continue;
    if (!/\.(?:js|css)$/i.test(ref)) continue;
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1] || (match[1].toLowerCase() === 'script' ? 'script' : '');
    refs.push({
      ref,
      rel,
      filePath: path.join(distDir, ref.replace(/^\/+/, '')),
    });
  }
  return refs;
};

const collectAssets = async () => {
  if (!await exists(assetsDir)) {
    fail('dist/assets is missing. Run npm run build first.');
    return [];
  }

  const entries = await readdir(assetsDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/\.(?:js|css)$/i.test(entry.name)) continue;
    const filePath = path.join(assetsDir, entry.name);
    const buffer = await readFile(filePath);
    const fileStat = await stat(filePath);
    files.push({
      name: entry.name,
      filePath,
      type: entry.name.endsWith('.css') ? 'css' : 'js',
      rawBytes: fileStat.size,
      gzipBytes: gzipSize(buffer),
      brotliBytes: brotliSize(buffer),
    });
  }
  return files;
};

const sum = (items, field) => items.reduce((total, item) => total + item[field], 0);

const topBy = (items, field, count = 8) => [...items]
  .sort((a, b) => b[field] - a[field])
  .slice(0, count);

const printTable = (title, items) => {
  console.log(`\n${title}`);
  for (const item of items) {
    console.log(`- ${item.name}: raw ${formatKb(item.rawBytes)}, gzip ${formatKb(item.gzipBytes)}, br ${formatKb(item.brotliBytes)}`);
  }
};

const main = async () => {
  if (!await exists(distDir)) {
    fail('dist directory is missing. Run npm run build first.');
  } else {
    pass();
  }

  const indexPath = path.join(distDir, 'index.html');
  if (!await exists(indexPath)) {
    fail('dist/index.html is missing.');
  } else {
    pass();
  }

  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL: ${message}`);
    process.exitCode = 1;
    return;
  }

  const html = await readFile(indexPath, 'utf8');
  const refs = assetRefsFromHtml(html);
  const assets = await collectAssets();
  const assetByPath = new Map(assets.map(asset => [path.normalize(asset.filePath), asset]));
  const initialAssets = refs
    .map(ref => assetByPath.get(path.normalize(ref.filePath)))
    .filter(Boolean);

  if (initialAssets.length === 0) fail('No initial JS/CSS assets found in dist/index.html.');
  else pass();

  const jsAssets = assets.filter(asset => asset.type === 'js');
  const cssAssets = assets.filter(asset => asset.type === 'css');
  const initialJsAssets = initialAssets.filter(asset => asset.type === 'js');
  const initialCssAssets = initialAssets.filter(asset => asset.type === 'css');

  const metrics = {
    assetCount: assets.length,
    jsCount: jsAssets.length,
    cssCount: cssAssets.length,
    initialAssetCount: initialAssets.length,
    totalJsRawBytes: sum(jsAssets, 'rawBytes'),
    totalJsGzipBytes: sum(jsAssets, 'gzipBytes'),
    totalJsBrotliBytes: sum(jsAssets, 'brotliBytes'),
    totalCssRawBytes: sum(cssAssets, 'rawBytes'),
    totalCssGzipBytes: sum(cssAssets, 'gzipBytes'),
    totalCssBrotliBytes: sum(cssAssets, 'brotliBytes'),
    initialRawBytes: sum(initialAssets, 'rawBytes'),
    initialGzipBytes: sum(initialAssets, 'gzipBytes'),
    initialBrotliBytes: sum(initialAssets, 'brotliBytes'),
    initialJsGzipBytes: sum(initialJsAssets, 'gzipBytes'),
    initialCssGzipBytes: sum(initialCssAssets, 'gzipBytes'),
  };

  const largestJs = topBy(jsAssets, 'rawBytes', 1)[0];

  if (metrics.initialGzipBytes > budgets.maxInitialGzipKb * 1024) {
    fail(`Initial JS/CSS gzip is ${formatKb(metrics.initialGzipBytes)}, above ${budgets.maxInitialGzipKb} KB.`);
  } else {
    pass();
  }

  if (metrics.totalJsGzipBytes > budgets.maxTotalJsGzipKb * 1024) {
    fail(`Total JS gzip is ${formatKb(metrics.totalJsGzipBytes)}, above ${budgets.maxTotalJsGzipKb} KB.`);
  } else {
    pass();
  }

  if (largestJs && largestJs.gzipBytes > budgets.maxLargestJsGzipKb * 1024) {
    fail(`Largest JS gzip is ${formatKb(largestJs.gzipBytes)} (${largestJs.name}), above ${budgets.maxLargestJsGzipKb} KB.`);
  } else {
    pass();
  }

  if (metrics.initialGzipBytes > budgets.warnInitialGzipKb * 1024) {
    warn(`Initial JS/CSS gzip is ${formatKb(metrics.initialGzipBytes)}; monitor mobile Core Web Vitals.`);
  }

  if (metrics.totalJsGzipBytes > budgets.warnTotalJsGzipKb * 1024) {
    warn(`Total JS gzip is ${formatKb(metrics.totalJsGzipBytes)}; look for code-splitting wins before adding more features.`);
  }

  if (largestJs && largestJs.rawBytes > budgets.warnLargestJsRawKb * 1024) {
    warn(`Largest raw JS chunk is ${formatKb(largestJs.rawBytes)} (${largestJs.name}); Vite will keep warning about this.`);
  }

  if (metrics.totalCssGzipBytes > budgets.warnCssGzipKb * 1024) {
    warn(`Total CSS gzip is ${formatKb(metrics.totalCssGzipBytes)}; check render-blocking CSS if PageSpeed flags LCP.`);
  }

  const report = {
    ok: failures.length === 0,
    budgets,
    metrics,
    initialAssets: initialAssets.map(asset => ({
      name: asset.name,
      type: asset.type,
      rawKb: bytesToKb(asset.rawBytes),
      gzipKb: bytesToKb(asset.gzipBytes),
      brotliKb: bytesToKb(asset.brotliBytes),
    })),
    largestAssets: topBy(assets, 'rawBytes', 12).map(asset => ({
      name: asset.name,
      type: asset.type,
      rawKb: bytesToKb(asset.rawBytes),
      gzipKb: bytesToKb(asset.gzipBytes),
      brotliKb: bytesToKb(asset.brotliBytes),
    })),
    warnings,
    failures,
    generatedAt: new Date().toISOString(),
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('Bundle performance audit');
  console.log(`Assets: ${metrics.assetCount} total (${metrics.jsCount} JS, ${metrics.cssCount} CSS)`);
  console.log(`Initial JS/CSS: raw ${formatKb(metrics.initialRawBytes)}, gzip ${formatKb(metrics.initialGzipBytes)}, br ${formatKb(metrics.initialBrotliBytes)}`);
  console.log(`Total JS: raw ${formatKb(metrics.totalJsRawBytes)}, gzip ${formatKb(metrics.totalJsGzipBytes)}, br ${formatKb(metrics.totalJsBrotliBytes)}`);
  console.log(`Total CSS: raw ${formatKb(metrics.totalCssRawBytes)}, gzip ${formatKb(metrics.totalCssGzipBytes)}, br ${formatKb(metrics.totalCssBrotliBytes)}`);
  printTable('Initial assets', initialAssets);
  printTable('Largest assets', topBy(assets, 'rawBytes', 8));
  console.log(`\nBundle performance audit: ${checks} checks, ${failures.length} failures, ${warnings.length} warnings`);
  console.log(`Report: ${path.relative(projectRoot, reportPath).replaceAll(path.sep, '/')}`);

  for (const message of warnings) console.warn(`WARN: ${message}`);
  for (const message of failures) console.error(`FAIL: ${message}`);

  if (failures.length > 0) process.exitCode = 1;
};

main().catch(error => {
  console.error('Bundle performance audit crashed.', error);
  process.exitCode = 1;
});
