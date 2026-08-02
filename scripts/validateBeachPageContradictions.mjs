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
 *
 * ── REWRITTEN 02/08/2026, AFTER THREE DAYS RED ────────────────────────────────────────────────
 *
 * This gate scrapes rendered text with regexes, which makes it the one check in the repo that a
 * deliberate UI change can break without anything being wrong. That is exactly what happened: it
 * went red on 31/07 and nobody noticed until 02/08, because it is NOT in
 * scripts/runCriticalQualityChecks.mjs — only `npm run quality:page`. Three of its anchors had
 * been intentionally removed or renamed underneath it:
 *
 *   • the «Good … at 14:00» tier badge — restricted to boat-only / no-swim-window days (34161add)
 *   • the heading «Conditions today» — renamed «Swell right now» (25f639bd)
 *   • the shore-incidence sentence in the conditions block — silenced on purpose by
 *     `suppressIncidence`, because the hero above already says the same thing (5284e710)
 *
 * The product was fine the whole time; the page still states how the wind meets this shore, in
 * `weatherNow.liveSentence` in the HERO — above where this script was looking.
 *
 * Two lessons are built into the rewrite. It now reads the WHOLE page instead of the slice after
 * one heading, so renaming a heading cannot blind it. And it anchors on the SENTENCES the copy
 * modules actually emit (utils/weatherNowCopy, utils/shoreIncidenceCopy) rather than on layout,
 * so a phrase that moves between sections keeps counting. It also joins the critical gate set —
 * a check nobody runs is a check that goes stale.
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
// `shelter` is NOT a guess — it is each beach's committed N-sector geometry under this fixture
// (public/data/geospatial/exposure/south-aegean-ios.json), checked 02/08/2026:
//
//   Kolitsani     facing 170,2°  protected  onshore −0,985   → lee
//   Valmas        facing 278,8°  partial    onshore +0,153   → cross-shore
//   Agia Theodoti facing  48,9°  partial    onshore +0,657   → windward
//   Gero Aggeli   facing 354,8°  exposed    onshore +0,996   → windward
//
// Valmas was labelled `lee` when this file was written, which was simply wrong: at +0,153 it sits
// a thousandth above the cross/offshore boundary (INCIDENCE_CROSS_MIN, utils/windIncidence.ts) and
// the page correctly calls it side-on. The gate was asserting the app should print something untrue.
const PAGES = [
  { slug: 'ios/1773-kolitsani', name: 'Kolitsani', shelter: 'lee' },
  { slug: 'ios/1765-valmas', name: 'Valmas', shelter: 'cross' },
  { slug: 'ios/1759-agia-theodoti', name: 'Agia Theodoti', shelter: 'windward' },
  { slug: 'ios/1756-gero-aggeli', name: 'Gero Aggeli', shelter: 'windward' },
];

const server = spawn(process.execPath, [path.join('node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(PORT)], { stdio: ['ignore', 'ignore', 'inherit'], env: process.env });

/**
 * How the page says the wind meets THIS shore — the one fact that legitimately differs between two
 * beaches sharing a marine cell, and therefore the thing this gate exists to protect.
 *
 * Both lists are lifted from the copy modules, not invented here: the first four come from
 * utils/weatherNowCopy (the hero sentence), the last from utils/shoreIncidenceCopy (the line above
 * the wave graphic, which is usually suppressed as a duplicate of the hero but must still count
 * when it appears). If the wording changes, this list is what needs updating — and a phrase moving
 * to a different part of the page changes nothing, because the whole body is searched.
 */
const SHELTERED_PHRASES = [
  /is off this shore, so it is the calmer side/,
  /it is relatively sheltered here/,
  /blows off the land here/,
];
const EXPOSED_PHRASES = [
  /catches this shore more directly/,
  /hits more directly/,
  /blows straight onto this shore/,
];
// The third, legitimate answer. Its absence is why the first rewrite failed Valmas: a shore the
// wind merely grazes is neither sheltered nor head-on, and demanding one of the two would push the
// app toward a claim its own geometry does not support.
const CROSS_PHRASES = [
  /catches this shore side-on/,
];
const matchAny = (text, patterns) => patterns.some(p => p.test(text));

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
    badge: (text.match(/(Excellent|Good|OK|Poor|Skip|Not ideal|Not recommended|Not suitable|Rough water)[^\n]*at \d{1,2}:\d{2}[^\n]*/) || [])[0] ?? null,
    swimming: (text.match(/(Difficult for swimming|Fine for swimming|Great for swimming|Not for swimming|Hard work in the water)/) || [])[0] ?? null,
    sea: (text.match(/(Rough sea|Choppy|Calm sea|Some chop|Flat)/) || [])[0] ?? null,
    shelteredClaim: /relatively sheltered here/.test(text),
    // Searched over the WHOLE body, deliberately — see the header note. The previous version
    // sliced the text after a heading and went silently null the day that heading was renamed.
    saysSheltered: matchAny(text, SHELTERED_PHRASES),
    saysExposed: matchAny(text, EXPOSED_PHRASES),
    saysCross: matchAny(text, CROSS_PHRASES),
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

  const readsAs = r => (r.saysSheltered ? 'lee' : r.saysExposed ? 'windward' : r.saysCross ? 'cross' : '— NOTHING —');
  for (const r of results) {
    console.log(`${r.name.padEnd(16)} ${String(r.wave).padEnd(5)} m | geometry says ${r.shelter.padEnd(8)} | page reads ${readsAs(r)}`);
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
  // 2b. THE TIER-BADGE RULE WAS REMOVED, NOT RELAXED (02/08/2026). It asserted that the four
  //     beaches must not all carry the same «Good … at 14:00» pill. That pill no longer renders
  //     on an ordinary day — the beach page was deliberately narrowed on 31/07 so the verdict is
  //     said once — so the rule was asserting a difference between elements that are not on the
  //     page at all, and reported the absence as `"null"`. Its INTENT (an island must not read as
  //     one undifferentiated block) is fully carried by rule 3 below, which now tests the fact
  //     that actually differs per beach instead of a pill that happened to display it.

  // 3. The lee and the windward side of the SAME island must not read identically. The metre
  //    figure legitimately cannot differ — one ~9 km marine cell serves the whole island, and two
  //    attempts to make it differ were refuted by measurement (docs/team/99-decision-log.md). So
  //    the assertion is on the thing that CAN differ and that the app genuinely knows per beach:
  //    how today's wind meets this particular shoreline.
  for (const r of results) {
    if (!r.saysSheltered && !r.saysExposed && !r.saysCross) {
      failures.push(`${r.name}: the page never says how the wind meets this shore`);
      continue;
    }
    // Only the two ends are asserted. A cross-shore beach may legitimately be described either
    // way depending on which sentence the hero picked, so demanding an exact word there would be
    // testing the copy's mood rather than its correctness.
    if (r.shelter === 'lee' && r.saysExposed && !r.saysSheltered) {
      failures.push(`${r.name} is in the lee of this wind but the page reads it as taking the wind head-on`);
    }
    if (r.shelter === 'windward' && r.saysSheltered && !r.saysExposed) {
      failures.push(`${r.name} takes this wind head-on but the page calls it sheltered`);
    }
  }
  const leeReadsSheltered = results.filter(r => r.shelter === 'lee').some(r => r.saysSheltered);
  const windReadsExposed = results.filter(r => r.shelter === 'windward').some(r => r.saysExposed);
  if (!leeReadsSheltered || !windReadsExposed) {
    failures.push('no differentiation: the lee and the windward side of one island read the same');
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
