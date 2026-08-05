/**
 * THE ANSWER CARD MUST NOT CLIP A WORD — browser gate.
 *
 * The hero on a beach page packs four instruments and four practical facts into two rows of
 * four tiles. On a 320 px phone that leaves ~66 px per tile, and a single long word ("Χωμάτινος",
 * "Handhabbare", "Παπούτσια") does not wrap — it gets cut, and the reader is told half a fact.
 *
 * This measurement already existed: `components/BeachAnswerHero.tsx:143-148` describes it in
 * detail and the component still carries the `data-tilefit` attributes it was written against.
 * The probe itself was never committed, so from the day it was run the constraint has been
 * enforced by nothing at all — and on 05/08/2026, when the tile LABELS were raised off 9 px for
 * legibility, there was no way to answer "did that break the fit?" other than writing the probe
 * again. This is that probe, committed this time.
 *
 * It asserts the narrow thing only: no text node inside a tile is horizontally clipped, at
 * 320 / 360 / 390 / 430 px, in all five languages. It does NOT assert line counts — a label
 * wrapping onto two lines is fine and always was; a word being cut in half is not.
 *
 * Needs Chromium and a build-free vite dev server, like validateBeachPageContradictions.mjs.
 *
 * Run: node scripts/validateTileFit.mjs
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import path from 'node:path';

const PORT = 4191;
const BASE = `http://127.0.0.1:${PORT}`;
const wait = ms => new Promise(r => setTimeout(r, ms));

const waitForUrl = async (url, timeoutMs = 90000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch {}
    await wait(500);
  }
  throw new Error('dev server never came up: ' + url);
};

// The narrowest phone still in use, the two common sizes, and a large one. 320 is the case that
// matters: everything fits at 390, which is why this kept shipping broken.
const WIDTHS = [320, 360, 390, 430];

// Greek and English on the same beach (so the only variable is the language), plus the three
// localised languages on a beach that actually HAS them — Milos is in LOCALIZED_REGIONS, Corfu
// is not, and asking for /de/beaches/corfu/… silently returns a page with no hero to measure.
// That mistake cost a whole clean run: 15 labels in Greek, 0 in German, and the report said PASS.
const PAGES = [
  ['gr', '/el/beaches/corfu/965-kanali-tou-erota/'],
  ['en', '/beaches/corfu/965-kanali-tou-erota/'],
  ['de', '/de/beaches/milos/1900-agios-sostis/'],
  ['fr', '/fr/beaches/milos/1900-agios-sostis/'],
  ['it', '/it/beaches/milos/1900-agios-sostis/'],
];

const server = spawn(
  process.execPath,
  [path.join('node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(PORT)],
  { stdio: ['ignore', 'ignore', 'inherit'], env: process.env },
);

const failures = [];
let measured = 0;
try {
  await waitForUrl(BASE + '/');
  const browser = await chromium.launch();

  for (const [lang, route] of PAGES) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        timezoneId: 'Europe/Athens',
      });
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 90000 });
      // Wait for the tiles themselves, not for a stopwatch. A cold vite server compiles the
      // first route on demand and the first two viewports came back empty on a fixed 4 s wait —
      // which this gate would then have reported as a layout failure. Measure or say why not.
      await page.waitForSelector('[data-tilefit]', { timeout: 60000 }).catch(() => {});
      await wait(1200);

      const found = await page.evaluate(() => {
        const tiles = Array.from(document.querySelectorAll('[data-tilefit]'));
        const nodes = [];
        for (const tile of tiles) {
          for (const n of tile.querySelectorAll('p, span')) {
            if (n.children.length || !(n.textContent || '').trim()) continue;
            nodes.push({
              text: n.textContent.trim(),
              overflowPx: Math.round(n.scrollWidth - n.clientWidth),
              fontSize: getComputedStyle(n).fontSize,
            });
          }
        }
        return { tiles: tiles.length, nodes };
      });

      await ctx.close();

      // A page that rendered no tiles proves nothing, and silence is how the German run passed
      // while measuring an empty page. Treat it as a failure of the gate, not of the layout.
      if (found.tiles === 0) {
        failures.push(`${lang} @${width}px: no [data-tilefit] tiles on ${route} — nothing was measured`);
        continue;
      }
      measured += found.nodes.length;
      for (const n of found.nodes) {
        if (n.overflowPx > 1) {
          failures.push(`${lang} @${width}px: «${n.text}» is clipped by ${n.overflowPx}px at ${n.fontSize}`);
        }
      }
      console.log(`${lang} @${width}px  tiles=${found.tiles}  texts=${found.nodes.length}  clipped=${found.nodes.filter(n => n.overflowPx > 1).length}`);
    }
  }

  await browser.close();
} finally {
  server.kill();
}

console.log(`\nMeasured ${measured} tile text nodes · ${PAGES.length} languages × ${WIDTHS.length} widths`);
if (failures.length > 0) {
  console.error(`\nFAILED: ${failures.length} clipped tile text(s).\n`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('PASS — no tile clips a word, at any tested width, in any language.');
