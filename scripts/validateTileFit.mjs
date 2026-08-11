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
 * EXTENDED 11/08/2026 to the fixed bottom bar, which became a tab bar the same day:
 * navigation plus up to three jump tabs now share one row, which is the same
 * four-things-on-a-320px-phone shape that clipped words in the hero. It rides this
 * script's server and browser rather than paying for its own. Two checks the tiles do
 * not need: the row must not overflow the viewport (controls can each fit and still
 * push the row wide), and every control must clear the 44 px touch minimum. Then, once,
 * the tabs are CLICKED — fitting and working are different failures, and the landing
 * depends on a `scroll-mt` that has to stay in step with the sticky header's height.
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
      //
      // The `.catch(() => {})` used to end it there, and on 11/08/2026 that produced a red gate
      // on a run where nothing was wrong: one viewport out of twenty (en @320) came back with
      // zero tiles while the other nineteen measured clean. A gate that cries wolf once every
      // few runs gets ignored on the run that matters, so a missed render now costs a reload and
      // a second look before it is allowed to be a failure — never a lowered bar, just a
      // refusal to report a timing miss as a layout defect.
      let appeared = await page.waitForSelector('[data-tilefit]', { timeout: 60000 }).then(() => true, () => false);
      if (!appeared) {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
        appeared = await page.waitForSelector('[data-tilefit]', { timeout: 60000 }).then(() => true, () => false);
        console.log(`  (retry after empty first paint: ${lang} @${width}px → ${appeared ? 'rendered' : 'STILL EMPTY'})`);
      }
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

        // The fixed bottom bar, added 11/08/2026: navigation plus up to three jump tabs
        // sharing one row. Same clipping question as the tiles, so it rides the same
        // browser rather than paying for a second one. Two things are checked that the
        // tiles do not need: the ROW itself must not overflow the viewport (four
        // controls can fit individually and still push the row wide), and every control
        // must clear the 44 px touch minimum the 05/08 decision put on this page.
        const bar = document.querySelector('[data-tabfit]');
        const barNodes = [];
        let barOverflowPx = 0;
        if (bar) {
          barOverflowPx = Math.round(bar.scrollWidth - bar.clientWidth);
          for (const control of bar.querySelectorAll('button')) {
            const box = control.getBoundingClientRect();
            for (const n of control.querySelectorAll('span')) {
              if (n.children.length || !(n.textContent || '').trim()) continue;
              barNodes.push({
                text: n.textContent.trim(),
                overflowPx: Math.round(n.scrollWidth - n.clientWidth),
                fontSize: getComputedStyle(n).fontSize,
                heightPx: Math.round(box.height),
              });
            }
          }
        }
        return { tiles: tiles.length, nodes, bar: Boolean(bar), barOverflowPx, barNodes };
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

      // Same treatment as `tiles === 0`: a bar that never rendered proves nothing, and a
      // silent skip is exactly how the German run once passed on an empty page.
      if (!found.bar) {
        failures.push(`${lang} @${width}px: no [data-tabfit] bottom bar on ${route} — nothing was measured`);
      } else {
        measured += found.barNodes.length;
        if (found.barOverflowPx > 1) {
          failures.push(`${lang} @${width}px: the bottom bar row overflows by ${found.barOverflowPx}px`);
        }
        for (const n of found.barNodes) {
          if (n.overflowPx > 1) {
            failures.push(`${lang} @${width}px: bottom-bar «${n.text}» is clipped by ${n.overflowPx}px at ${n.fontSize}`);
          }
          if (n.heightPx < 44) {
            failures.push(`${lang} @${width}px: bottom-bar «${n.text}» sits in a ${n.heightPx}px control, under the 44px minimum`);
          }
        }
      }

      console.log(`${lang} @${width}px  tiles=${found.tiles}  texts=${found.nodes.length}  clipped=${found.nodes.filter(n => n.overflowPx > 1).length}  bar=${found.barNodes.length} labels, overflow=${found.barOverflowPx}px`);
    }
  }

  // ---- The tabs must LAND, not just fit ----
  //
  // Fitting in the bar and working are different failures. The one that will actually
  // happen: the header is `sticky top-0` and was measured at 77 px, so each target
  // carries `scroll-mt-24` (96 px) to clear it. Change the header's padding, its font
  // or its icon size and every tab silently starts dropping its heading UNDERNEATH the
  // header — the visitor jumps and lands on a paragraph that begins mid-sentence, with
  // nothing on screen saying where they are. Nothing else in the suite would notice.
  //
  // Clicked for real, at one width in Greek: this asks a question about geometry and
  // wiring, not about translation, so repeating it 20 times would buy nothing.
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 780 },
      deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Europe/Athens',
    });
    const page = await ctx.newPage();
    await page.goto(BASE + PAGES[0][1], { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('[data-tabfit]', { timeout: 60000 }).catch(() => {});
    await wait(2000);

    const headerH = await page.evaluate(() => {
      const h = document.querySelector('header');
      return h ? Math.round(h.getBoundingClientRect().height) : 0;
    });

    let landed = 0;
    for (const [label, id] of [['Κύμα', 'today-conditions'], ['Πληροφορίες', 'beach-story'], ['Εναλλακτικές', 'nearby-beaches']]) {
      if (!(await page.$('#' + id))) continue;
      // Send it back to the top first, so a pass can never be an accident of where the
      // previous jump happened to leave us.
      await page.evaluate(() => window.scrollTo(0, 0));
      await wait(400);
      await page.getByRole('button', { name: label, exact: true }).click();
      await wait(1400);

      const r = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        const box = el.getBoundingClientRect();
        return { top: Math.round(box.top), focused: document.activeElement === el };
      }, '#' + id);

      landed += 1;
      if (r.top < headerH) {
        failures.push(`tab «${label}» landed #${id} at ${r.top}px, UNDER the ${headerH}px sticky header`);
      } else if (r.top > headerH + 40) {
        failures.push(`tab «${label}» landed #${id} at ${r.top}px, ${r.top - headerH}px below a ${headerH}px header — overshot`);
      }
      // A jump control that only scrolls leaves keyboard focus at the top of the page,
      // so the visitor's next Tab throws them back where they started.
      if (!r.focused) {
        failures.push(`tab «${label}» scrolled to #${id} but focus stayed behind — the next Tab returns to the top`);
      }
      console.log(`tab «${label}» -> #${id}  top=${r.top}px (header ${headerH}px)  focused=${r.focused}`);
    }
    if (landed === 0) {
      failures.push('no jump tab could be clicked on ' + PAGES[0][1] + ' — the landing check measured nothing');
    }
    await ctx.close();
  }

  await browser.close();
} finally {
  server.kill();
}

console.log(`\nMeasured ${measured} tile and bar text nodes · ${PAGES.length} languages × ${WIDTHS.length} widths, plus the tab landings`);
if (failures.length > 0) {
  console.error(`\nFAILED: ${failures.length} problem(s).\n`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('PASS — no tile or tab clips a word at any tested width in any language, and every tab lands its section clear of the header.');
