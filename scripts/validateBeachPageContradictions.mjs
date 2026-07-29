/**
 * WHAT THE USER ACTUALLY SEES — browser gate.
 *
 * Every other check in this repo reasons about numbers; none of them ever opened a page. Both
 * defects reported on 29/07/2026 were found by a human looking at a screen, and all fourteen
 * gates were green while they shipped. This one drives the real app in a real browser against a
 * deterministic weather fixture (?bbWeatherFixture, dev + localhost only) and asserts what is
 * printed:
 *
 *   1. the badge never endorses a day the swim chip refuses;
 *   2. no page claims shelter beside a rough sea;
 *   3. a lee shore and a windward shore on the SAME island do not read identically.
 *
 * Rule 3 deliberately does NOT assert on the metre figure. One ~9 km marine cell serves a whole
 * small island, so that number legitimately cannot differ — two attempts to make it differ were
 * refuted by measurement (docs/team/99-decision-log.md). It asserts on the line that can.
 *
 * Needs a build-free vite dev server and Chromium; it is a local/CI-with-browser check, not part
 * of the pure-computation gate set.
 *
 * Run: node scripts/validateBeachPageContradictions.mjs
 *
 * Renders real beach pages in a browser against the live feed and asserts what the USER sees.
 * This is the check that was missing: every existing gate reasons about numbers, none of them
 * ever opened the page. Both bugs in this session were found by a human looking at a screen.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import path from 'node:path';

const PORT = 4189;
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

// Two beaches on ONE island, one in the lee of the meltemi and one taking it head-on. If the app
// cannot tell these apart, it cannot tell any two beaches apart.
const PAGES = [
  { slug: 'ios/1773-kolitsani', name: 'Kolitsani', shelter: 'lee' },
  { slug: 'ios/1765-valmas', name: 'Valmas', shelter: 'lee' },
  { slug: 'ios/1759-agia-theodoti', name: 'Agia Theodoti', shelter: 'windward' },
  { slug: 'ios/1756-gero-aggeli', name: 'Gero Aggeli', shelter: 'windward' },
];

const server = spawn(process.execPath, [path.join('node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(PORT)], { stdio: ['ignore', 'ignore', 'inherit'], env: process.env });

const read = async (browser, page1) => {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1600 } });
  await page.goto(`${BASE}/beaches/${page1.slug}?bbWeatherFixture=Paros_N_5BFT`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await wait(9000);
  const text = await page.evaluate(() => document.body.innerText);
  await page.close();
  const waves = [...text.matchAll(/~([\d.,]+)\s*m/g)].map(m => Number(m[1].replace(',', '.')));
  return {
    ...page1,
    wave: waves.length ? waves[0] : null,
    badge: (text.match(/(Excellent|Good|OK|Poor|Skip|Not ideal|Not recommended|Not suitable)[^\n]*at \d{1,2}:\d{2}/) || [])[0] ?? null,
    swimming: (text.match(/(Difficult for swimming|Fine for swimming|Great for swimming|Not for swimming|Hard work in the water)/) || [])[0] ?? null,
    sea: (text.match(/(Rough sea|Choppy|Calm sea|Some chop|Flat)/) || [])[0] ?? null,
    shelteredClaim: /relatively sheltered here/.test(text),
    lead: (text.split(String.fromCharCode(67,111,110,100,105,116,105,111,110,115,32,116,111,100,97,121))[1]||"").split(String.fromCharCode(10)).map(l=>l.trim()).filter(Boolean)[0] || null,
    text,
  };
};

const failures = [];
try {
  await waitForUrl(BASE + '/');
  const browser = await chromium.launch();
  const results = [];
  for (const p of PAGES) results.push(await read(browser, p));
  await browser.close();

  for (const r of results) {
    console.log(`${r.name.padEnd(16)} ${String(r.wave).padEnd(5)} | ${r.lead}`);
  }

  // 1. A page must not praise the day at the top and refuse the water below.
  for (const r of results) {
    if (/^(Excellent|Good|OK)/.test(r.badge ?? '') && /Difficult for swimming|Not for swimming/.test(r.swimming ?? '')) {
      failures.push(`${r.name}: badge "${r.badge}" sits above "${r.swimming}"`);
    }
  }
  // 2. A page must not claim shelter beside a rough sea.
  for (const r of results) {
    if (r.shelteredClaim && /Rough sea/.test(r.sea ?? '')) {
      failures.push(`${r.name}: claims shelter while printing "${r.sea}"`);
    }
  }
  // 3. The lee and the windward side of the SAME island must not read identically. The metre
  //    figure legitimately cannot differ (one marine cell per island), so the assertion is on the
  //    line that CAN: how the wind meets this shore and where it sits among its neighbours.
  const leadOf = s => results.filter(r => r.shelter === s).map(r => r.lead);
  const leeLeads = leadOf("lee");
  const windLeads = leadOf("windward");
  if (leeLeads.some(l => !l) || windLeads.some(l => !l)) {
    failures.push("a beach page printed no shore-incidence line at all");
  } else if (leeLeads.some(l => windLeads.includes(l))) {
    failures.push("no differentiation: a lee beach and a windward beach print the same line");
  }
} finally {
  server.kill();
}

if (failures.length) {
  console.error('\nFAIL:');
  failures.forEach(f => console.error('- ' + f));
  process.exit(1);
}
console.log('\nPASS');
