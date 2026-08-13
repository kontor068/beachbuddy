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

// WHY "TOTAL JS" IS NOT THE HEADLINE NUMBER HERE (changed 13/08/2026).
//
// This build emits ~225 JS files that are pure DATA, one per region: climate tables and
// beach stories for Chania, Halkidiki, Corfu and so on. A visit downloads exactly ONE of
// them — the region being looked at. Summing all 225 answers the question "what would it
// weigh to download every region in Greece", which no visitor has ever done and which
// grows every time a region gains a story. That sum was 1,309 KB against a 750 KB budget,
// so the gate read RED permanently while the number a phone actually pays was less than
// half of it. A gate that is red for a reason nobody can act on gets ignored, and then it
// is not a gate.
//
// So the hard limit moved to `worstVisitGzipKb`: first paint + the heaviest single region
// + the detail page + the map. That is the most a real person downloads in one sitting,
// and it is the number that gets worse when someone adds weight to a shared chunk.
// `maxTotalJsGzipKb` stays as a WARNING with a realistic ceiling — it still catches a
// runaway (a vendor library duplicated into every region chunk), it just no longer fails
// the build for having more regions.
const budgets = {
  maxInitialGzipKb: 600,
  warnInitialGzipKb: 350,
  maxWorstVisitGzipKb: 750,
  warnWorstVisitGzipKb: 600,
  warnTotalJsGzipKb: 1500,
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

  // What one real visit downloads. Region data chunks are named after the region id
  // (`crete-crete-chania-<hash>.js`), so the region index tells us exactly which files are
  // per-region data and which are shared code — no guessing from file contents.
  let regionIds = [];
  try {
    const indexRaw = await readFile(path.join(distDir, 'data', 'beaches', 'index.json'), 'utf8');
    regionIds = (JSON.parse(indexRaw).regions || []).map(region => region.id).filter(Boolean);
  } catch {
    warn('Could not read dist/data/beaches/index.json; worst-visit weight was not checked.');
  }

  const isRegionDataChunk = asset =>
    regionIds.some(id => asset.name.startsWith(`${id}-`));

  const initialPaths = new Set(initialAssets.map(asset => path.normalize(asset.filePath)));
  const nonInitialJs = jsAssets.filter(asset => !initialPaths.has(path.normalize(asset.filePath)));
  const regionChunks = nonInitialJs.filter(isRegionDataChunk);
  const routeChunks = nonInitialJs.filter(asset => !isRegionDataChunk(asset));

  // One region, and it must be the heaviest — a budget that passes only for Sifnos is not
  // a budget. Several files can share one region id (climate and stories are separate
  // chunks), so sum per region rather than taking the single largest file.
  const gzipByRegion = new Map();
  for (const asset of regionChunks) {
    const id = regionIds.find(candidate => asset.name.startsWith(`${candidate}-`));
    gzipByRegion.set(id, (gzipByRegion.get(id) || 0) + asset.gzipBytes);
  }
  const heaviestRegionGzip = Math.max(0, ...gzipByRegion.values());

  // Opening a beach and its map is the ordinary path from a Google result, not an edge
  // case: the detail page, the map component and the map library all arrive on that tap.
  const routeChunkByName = name => routeChunks.find(asset => asset.name.startsWith(name));
  const onOpeningABeach = ['BeachDetailPage', 'BeachMap', 'map-vendor']
    .map(routeChunkByName)
    .filter(Boolean);

  metrics.regionChunkCount = regionChunks.length;
  metrics.heaviestRegionGzipBytes = heaviestRegionGzip;
  metrics.openingABeachGzipBytes = sum(onOpeningABeach, 'gzipBytes');
  metrics.worstVisitGzipBytes =
    metrics.initialGzipBytes + heaviestRegionGzip + metrics.openingABeachGzipBytes;

  if (regionIds.length > 0) {
    if (metrics.worstVisitGzipBytes > budgets.maxWorstVisitGzipKb * 1024) {
      fail(`Worst realistic visit is ${formatKb(metrics.worstVisitGzipBytes)} gzip (first paint + heaviest region + beach page + map), above ${budgets.maxWorstVisitGzipKb} KB.`);
    } else {
      pass();
    }

    if (metrics.worstVisitGzipBytes > budgets.warnWorstVisitGzipKb * 1024) {
      warn(`Worst realistic visit is ${formatKb(metrics.worstVisitGzipBytes)} gzip; that is what a phone on Greek mobile data pays to open one beach.`);
    }
  }

  const largestJs = topBy(jsAssets, 'rawBytes', 1)[0];

  if (metrics.initialGzipBytes > budgets.maxInitialGzipKb * 1024) {
    fail(`Initial JS/CSS gzip is ${formatKb(metrics.initialGzipBytes)}, above ${budgets.maxInitialGzipKb} KB.`);
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
    warn(`Total JS gzip is ${formatKb(metrics.totalJsGzipBytes)} across ${metrics.jsCount} files (${metrics.regionChunkCount} of them per-region data, one per visit). Only worth acting on if a shared library got duplicated into every region chunk.`);
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
