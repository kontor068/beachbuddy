import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const DEFAULT_PORT = Number(process.env.VISUAL_QA_PORT || 4177);
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_URL = process.env.VISUAL_QA_URL || `http://${DEFAULT_HOST}:${DEFAULT_PORT}/`;
const OUTPUT_DIR = process.env.VISUAL_QA_OUTPUT || path.join('reports', 'visual-qa');

const viewports = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
];

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const waitForUrl = async (url, timeoutMs = 30000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // Keep polling until Vite is ready.
    }
    await wait(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const startDevServer = () => {
  const viteBin = path.join('node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(
    process.execPath,
    [viteBin, '--host', DEFAULT_HOST, '--port', String(DEFAULT_PORT)],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    }
  );

  child.stdout.on('data', data => process.stdout.write(data));
  child.stderr.on('data', data => process.stderr.write(data));
  return child;
};

const dismissCookieBanner = async (page) => {
  if (process.env.VISUAL_QA_KEEP_COOKIES === '1') return;

  const labels = ['Reject analytics', 'Allow analytics'];
  for (const label of labels) {
    const button = page.getByRole('button', { name: label });
    if (await button.count().catch(() => 0) > 0) {
      await button.first().click({ timeout: 5000 });
      return;
    }
  }
};

const main = async () => {
  const externalUrl = Boolean(process.env.VISUAL_QA_URL);
  const server = externalUrl ? undefined : startDevServer();

  try {
    await waitForUrl(DEFAULT_URL);
    await mkdir(OUTPUT_DIR, { recursive: true });

    const browser = await chromium.launch();
    const pageErrors = [];

    try {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport });
        page.on('pageerror', error => pageErrors.push(`${viewport.name}: ${error.message}`));
        page.on('console', message => {
          if (message.type() === 'error') {
            pageErrors.push(`${viewport.name}: ${message.text()}`);
          }
        });

        await page.goto(DEFAULT_URL, { waitUntil: 'networkidle', timeout: 45000 });
        await dismissCookieBanner(page);
        await page.screenshot({
          path: path.join(OUTPUT_DIR, `home-${viewport.name}.png`),
          fullPage: true,
        });
        await page.close();
      }
    } finally {
      await browser.close();
    }

    if (pageErrors.length > 0) {
      console.warn('Visual QA captured browser console/page errors:');
      pageErrors.slice(0, 10).forEach(error => console.warn(`- ${error}`));
      if (pageErrors.length > 10) console.warn(`- ...and ${pageErrors.length - 10} more`);
    }

    console.log(`Visual QA screenshots written to ${OUTPUT_DIR}`);
  } finally {
    if (server) {
      server.kill();
    }
  }
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
