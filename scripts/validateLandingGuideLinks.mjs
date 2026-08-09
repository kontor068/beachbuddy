#!/usr/bin/env node
/**
 * The landing page links six guide articles by name (utils/landingGuideLinks.ts).
 * It cannot check that those pages exist the way every other surface does — the
 * ≥5-beach predicate gate needs a region's beach records loaded, and the landing
 * loads none. So this gate does the checking instead, against the real build.
 *
 * It asserts, for every curated pair AND every one of the five languages, that
 * the exact URL the app will emit resolves to a file in dist/. That covers the
 * three ways this can silently break:
 *
 *   1. A topic stops qualifying for a region (a data correction drops it under
 *      the threshold) and the page is no longer generated → 404 from the
 *      landing, the site's highest-CTR page.
 *   2. The slug drifts. getRegionUrlSlug() normalises the region ID while the
 *      prerender normalises `region.name.en`, and across the 110 regions those
 *      already disagree on one (Pelion: `magnesia-mainland-pelion` vs the
 *      `magnesia-pelion` on disk). The pairs therefore write the slug out
 *      literally, and this gate is what proves the literal is right.
 *   3. de/fr/it prefixing. Guides in those languages exist only for the 16
 *      multilingual-pilot regions; getBeachLocalePrefix falls back to the
 *      unprefixed English article elsewhere. Get that backwards and three
 *      languages get a URL that 404s on reload, because the host has no SPA
 *      catch-all.
 *
 * It also refuses to pass on an empty pair list, so deleting the links cannot
 * turn the gate green.
 *
 * Reads the TypeScript sources as text on purpose: no build step, no ts-node,
 * and it fails loudly if the shapes it depends on are refactored away.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const PAIRS_FILE = path.join(ROOT, 'utils', 'landingGuideLinks.ts');
const TOPICS_FILE = path.join(ROOT, 'utils', 'beachGuides.ts');
const URLS_FILE = path.join(ROOT, 'utils', 'beachUrls.ts');
const INDEX_FILE = path.join(ROOT, 'public', 'data', 'beaches', 'index.json');

const LANGUAGES = ['en', 'gr', 'de', 'fr', 'it'];

const failures = [];
const fail = message => failures.push(message);

const read = file => {
  if (!fs.existsSync(file)) {
    fail(`missing source file: ${path.relative(ROOT, file)}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
};

// ── 1. the curated pairs ────────────────────────────────────────────────────
const pairsSrc = read(PAIRS_FILE);

// Isolate the array body first, so the count below is taken from the same text
// the pairs are parsed out of and cannot be inflated by a `topic:` appearing in
// a comment elsewhere in the file.
const pairsBlock = pairsSrc.match(/LANDING_GUIDE_PAIRS[^=]*=\s*\[([\s\S]*?)\n\];/);
if (!pairsBlock) {
  fail('could not find the LANDING_GUIDE_PAIRS array in utils/landingGuideLinks.ts — the shape changed and this gate went blind.');
}
const pairsBody = pairsBlock ? pairsBlock[1] : '';

const pairs = [...pairsBody.matchAll(
  /\{\s*topic:\s*'([^']+)'\s*,\s*regionId:\s*'([^']+)'\s*,\s*slug:\s*'([^']+)'\s*\}/g,
)].map(([, topic, regionId, slug]) => ({ topic, regionId, slug }));

// PARSED COUNT vs DECLARED COUNT. Checking only for zero is not enough: the
// regex insists on three properties in one exact order, so reordering the keys
// of ONE pair — or adding a fourth property to it — makes that pair vanish while
// the other five keep the gate green. A silently unchecked link is precisely the
// 404 this gate exists to prevent, so an entry the parser could not read is a
// failure, not a skip.
const declared = (pairsBody.match(/\btopic:/g) || []).length;
if (declared !== pairs.length) {
  fail(
    `LANDING_GUIDE_PAIRS declares ${declared} entr${declared === 1 ? 'y' : 'ies'} but only ${pairs.length} could be parsed — `
    + 'the unparsed one(s) would ship UNCHECKED. Keep each entry as { topic, regionId, slug } on one line, in that order.',
  );
}

if (pairs.length === 0) {
  fail(
    'no LANDING_GUIDE_PAIRS found in utils/landingGuideLinks.ts — either the links were '
    + 'removed (then remove this gate deliberately) or the shape changed and this gate went blind.',
  );
}

// ── 2. topic → path prefix, from the single client-side authority ───────────
const topicsSrc = read(TOPICS_FILE);
const topicPrefixes = new Map();
for (const match of topicsSrc.matchAll(/key:\s*'([^']+)'\s*,\s*pathPrefix:\s*'([^']+)'/g)) {
  topicPrefixes.set(match[1], match[2]);
}
if (topicPrefixes.size === 0) {
  fail('could not read GUIDE_TOPICS pathPrefix values out of utils/beachGuides.ts');
}

// ── 3. which regions actually get de/fr/it pages ────────────────────────────
const urlsSrc = read(URLS_FILE);
const localizedBlock = urlsSrc.match(/LOCALIZED_REGION_SLUGS\s*=\s*new Set<string>\(\[([\s\S]*?)\]\)/);
// STRIP COMMENTS BEFORE HARVESTING. That Set is interleaved with English prose
// comments ("// Wave 2 — top foreign-tourist destinations"), and a single
// apostrophe in one of them ("the pilot's regions") would make the quote-pair
// scanner swallow everything up to the next quote — silently losing slugs and
// with them the de/fr/it half of the URL checks. The gate would still print a
// confident ✓ over a third fewer assertions.
const localizedBody = localizedBlock
  ? localizedBlock[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  : '';
const localizedSlugs = new Set(
  [...localizedBody.matchAll(/^\s*'([a-z0-9-]+)'\s*,?\s*$/gm)].map(m => m[1]),
);
if (localizedSlugs.size === 0) {
  fail('could not read LOCALIZED_REGION_SLUGS out of utils/beachUrls.ts');
} else if (localizedSlugs.size < 16) {
  // 17 entries shipped when this was written. A harvest that suddenly returns
  // three has not found a shrinking pilot — it has found a parsing failure, and
  // the difference matters because the small number still "passes".
  fail(
    `LOCALIZED_REGION_SLUGS parsed as only ${localizedSlugs.size} slug(s) — expected at least 16. `
    + 'That is a parsing failure, not a smaller pilot; the de/fr/it URL checks would be silently skipped.',
  );
}

// Mirrors getBeachLocalePrefix in utils/beachUrls.ts. Kept as a copy rather than
// an import because this is a .mjs gate over .ts sources — if the two ever
// disagree, the dist check below is what catches it.
const localePrefix = (language, slug) => {
  if (language === 'gr') return '/el';
  if (language === 'de' || language === 'fr' || language === 'it') {
    return localizedSlugs.has(slug) ? `/${language}` : '';
  }
  return '';
};

// ── 4. the region ids must be real, or the link renders unlabelled ──────────
let regionIds = new Set();
try {
  const index = JSON.parse(read(INDEX_FILE) || '{"regions":[]}');
  regionIds = new Set((index.regions || []).map(region => region.id));
} catch (error) {
  fail(`could not parse public/data/beaches/index.json: ${error.message}`);
}

// ── 5. the actual assertion ─────────────────────────────────────────────────
if (!fs.existsSync(DIST)) {
  fail('dist/ is missing — run `npm run build` before this gate (quality:critical already does).');
}

/**
 * existsSync, but CASE-SENSITIVE — because the web server is.
 *
 * This gate is authored and usually run on Windows, where `dist/SHELTERED-Beaches/NAXOS/`
 * and `dist/sheltered-beaches/naxos/` are the same path. Netlify serves from
 * Linux, where they are not. A slug typed as 'Naxos' therefore passes here and
 * 404s in production — the gate would certify exactly the bug it exists to
 * catch. So each segment is matched against the real directory listing.
 */
const existsExact = (relative) => {
  const segments = relative.split('/').filter(Boolean);
  let current = DIST;
  for (const segment of segments) {
    let entries;
    try {
      entries = fs.readdirSync(current);
    } catch {
      return false;
    }
    if (!entries.includes(segment)) return false;
    current = path.join(current, segment);
  }
  return true;
};

let checked = 0;
const seenTopics = new Set();

// THE HUB IS A LINK ON THIS PAGE TOO. GuideTopicsSection renders it under the
// six pairs, so a gate that says "every guide the landing links actually exists"
// and then skips it is telling a small lie. It is en+el only by design —
// getGuidesHubPath sends de/fr/it to the English hub — so those three resolve to
// the same file, which is the behaviour worth asserting.
if (fs.existsSync(DIST)) {
  for (const language of LANGUAGES) {
    const href = `${language === 'gr' ? '/el' : ''}/beach-guides/`;
    checked += 1;
    if (!existsExact(`${href}index.html`)) {
      fail(`[${language}] ${href} → the guides hub is missing from dist/`);
    }
  }
}

for (const pair of pairs) {
  const prefix = topicPrefixes.get(pair.topic);
  if (!prefix) {
    fail(`pair "${pair.topic}/${pair.slug}": topic "${pair.topic}" is not in GUIDE_TOPICS`);
    continue;
  }
  if (seenTopics.has(pair.topic)) {
    fail(`topic "${pair.topic}" is used twice — the block exists to show six DIFFERENT questions`);
  }
  seenTopics.add(pair.topic);

  if (regionIds.size > 0 && !regionIds.has(pair.regionId)) {
    fail(`pair "${pair.topic}/${pair.slug}": regionId "${pair.regionId}" is not in the beach index — the link would render without a place name and be dropped`);
  }

  if (!fs.existsSync(DIST)) continue;

  for (const language of LANGUAGES) {
    const href = `${localePrefix(language, pair.slug)}${prefix}/${pair.slug}/`;
    checked += 1;
    if (!existsExact(`${href}index.html`)) {
      fail(`[${language}] ${href} → no such page (looked for dist${href}index.html, case-sensitively)`);
    }
  }
}

// ── report ──────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error('✗ landing guide links: BROKEN\n');
  failures.forEach(message => console.error(`  - ${message}`));
  console.error(`\n${failures.length} problem(s). ${checked} URL(s) checked.`);
  process.exit(1);
}

console.log(
  `✓ landing guide links: ${pairs.length} pairs + the hub, × ${LANGUAGES.length} languages `
  + `= ${checked} URLs, all present in dist/ (case-sensitively).`,
);
