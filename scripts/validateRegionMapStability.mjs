import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const args = new Map(process.argv.slice(2).map(arg => {
  const [key, ...valueParts] = arg.replace(/^--/, '').split('=');
  return [key, valueParts.join('=') || '1'];
}));

const regionSlug = args.get('region-slug') || 'naxos';
const route = args.get('route') || `/beaches/${regionSlug}/`;
const host = '127.0.0.1';
const port = Number(args.get('port') || process.env.MAP_STABILITY_PORT || 4178);
const baseUrl = args.get('url') || `http://${host}:${port}`;
const outputDir = args.get('out-dir') || path.join('reports', 'map-stability');
const waitMs = Number(args.get('wait-ms') || 5500);
const startupTimeoutMs = Number(args.get('startup-timeout-ms') || 90000);

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const waitForUrl = async (url, timeoutMs = 30000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // Vite is still starting.
    }
    await wait(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const startServer = () => {
  if (args.has('url')) return undefined;
  const viteBin = path.join('node_modules', 'vite', 'bin', 'vite.js');
  return spawn(process.execPath, [viteBin, '--host', host, '--port', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
};

const colorTokens = [
  'bg-sky-500',
  'bg-yellow-400',
  'bg-orange-500',
  'bg-rose-600',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
];

const ringTokens = [
  'ring-sky-200',
  'ring-yellow-200',
  'ring-orange-200',
  'ring-rose-300',
  'ring-emerald-200',
  'ring-amber-200',
  'ring-rose-200',
];

const ignorableExternalResourceErrorPatterns = [
  /Failed to load resource: net::ERR_NO_BUFFER_SPACE/,
  /Failed to load resource: net::ERR_INSUFFICIENT_RESOURCES/,
  /Failed to load resource: net::ERR_NAME_NOT_RESOLVED/,
  /Failed to load resource: net::ERR_BLOCKED_BY_CLIENT/,
  /Failed to load resource: net::ERR_FAILED/,
  /Failed to load resource: the server responded with a status of 429 \(Too Many Requests\)/,
  /Access to fetch at 'https:\/\/api\.open-meteo\.com\/.* has been blocked by CORS policy/,
];

const isIgnorableExternalResourceError = error =>
  ignorableExternalResourceErrorPatterns.some(pattern => pattern.test(error));

const snapshotMarkerState = async (page, label) => page.evaluate(({ label, colorTokens, ringTokens }) => {
  const markerNodes = [...document.querySelectorAll('.leaflet-marker-icon .beach-map-marker-dot')];
  const markers = markerNodes.map((node, index) => {
    const classes = [...node.classList];
    return {
      index,
      color: colorTokens.find(token => classes.includes(token)) || 'unknown',
      ring: ringTokens.find(token => classes.includes(token)) || 'unknown',
      top: classes.includes('beach-map-top-pick-marker-dot'),
      evidence: classes.includes('beach-map-marker-evidence-supported')
        ? 'supported'
        : classes.includes('beach-map-marker-evidence-estimated')
          ? 'estimated'
          : 'unknown',
    };
  });

  const counts = markers.reduce((acc, marker) => {
    const key = `${marker.color}|${marker.ring}|${marker.top ? 'top' : 'normal'}|${marker.evidence}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const text = document.body.innerText;
  const controlText = [...document.querySelectorAll('button, [role="button"]')]
    .map(node => node.textContent?.trim())
    .filter(Boolean)
    .find(value => /Most suitable|Suitable|Sort|Καταλληλότερες|Ταξινόμηση/.test(value || '')) || null;

  return {
    label,
    markerCount: markers.length,
    counts,
    markers,
    controlText,
    textSample: text.slice(0, 1000),
  };
}, { label, colorTokens, ringTokens });

const waitForBeachMarkers = async page => {
  await page.waitForFunction(() => (
    document.querySelectorAll('.leaflet-marker-icon .beach-map-marker-dot').length > 0
  ), undefined, { timeout: 45000 });
};

const main = async () => {
  const url = `${baseUrl}${route}`;
  const server = startServer();

  try {
    if (server) {
      server.stdout.on('data', data => process.stdout.write(data));
      server.stderr.on('data', data => process.stderr.write(data));
    }
    await waitForUrl(url, startupTimeoutMs);
    await mkdir(outputDir, { recursive: true });

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    const errors = [];
    const ignoredExternalResourceErrors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() !== 'error') return;

      const error = `console: ${message.text()}`;
      if (isIgnorableExternalResourceError(error)) {
        ignoredExternalResourceErrors.push(error);
        return;
      }

      errors.push(error);
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await waitForBeachMarkers(page);
    const initial = await snapshotMarkerState(page, 'initial');
    await page.screenshot({ path: path.join(outputDir, `${regionSlug}-initial.png`), fullPage: false });
    await page.waitForTimeout(waitMs);
    const settled = await snapshotMarkerState(page, 'settled');
    await page.screenshot({ path: path.join(outputDir, `${regionSlug}-settled.png`), fullPage: false });
    await browser.close();

    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      url,
      route,
      regionSlug,
      waitMs,
      errors,
      ignoredExternalResourceErrors,
      initial,
      settled,
      assertions: {
        noBrowserErrors: errors.length === 0,
        markersRemainVisible: initial.markerCount > 0 && settled.markerCount > 0,
        markerCountStable: initial.markerCount === settled.markerCount,
        markerColorCountsStable: JSON.stringify(initial.counts) === JSON.stringify(settled.counts),
        sortControlVisible: Boolean(settled.controlText),
      },
    };

    const outPath = path.join(outputDir, `${regionSlug}-map-stability.json`);
    await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ outPath, assertions: report.assertions, initial: initial.counts, settled: settled.counts }, null, 2));

    if (!Object.values(report.assertions).every(Boolean)) process.exit(1);
  } finally {
    if (server) server.kill();
  }
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
