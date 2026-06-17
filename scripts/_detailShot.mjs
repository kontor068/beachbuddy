import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import path from 'node:path';

const PORT = 4188;
const URL = `http://127.0.0.1:${PORT}/beaches/milos/1922-sarakiniko/`;
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const server = spawn(process.execPath, [path.join('node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--outDir', 'dist'], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
server.stdout.on('data', d => process.stdout.write(d));
server.stderr.on('data', d => process.stderr.write(d));

const ready = async () => { for (let i = 0; i < 60; i++) { try { const r = await fetch(URL); if (r.status < 500) return; } catch {} await wait(500); } throw new Error('server not ready'); };

const errors = [];
try {
  await ready();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await wait(3500); // let weather/marine fetches settle
  await page.screenshot({ path: 'reports/visual-qa/detail-sarakiniko-mobile.png', fullPage: true });
  await browser.close();
  console.log('SHOT_OK console_errors=' + errors.length);
  if (errors.length) console.log(errors.slice(0, 8).join('\n'));
} catch (e) {
  console.log('SHOT_FAIL ' + e.message);
} finally {
  server.kill();
}
