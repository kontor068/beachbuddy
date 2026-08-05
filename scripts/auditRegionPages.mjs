/**
 * Region pages: the gate for `/beaches/{region}/` in every locale.
 *
 * Written BEFORE the 05/08/2026 rewrite of `staticRegionFallback`, on purpose.
 * The Search Console snapshot of 05/08 showed the region page losing its own
 * head term ("preveza beaches", "lemnos beaches", "kavala beach") to our own
 * sub-guides — three of our URLs at position 13-15 and zero clicks — because
 *
 *   (a) its H1 asked the SHELTERED question, which is the job of
 *       /sheltered-beaches/{region}/, not of the region page, and
 *   (b) its body was 264 words against the sibling guide's 742.
 *
 * So this file asserts the two things that were wrong, plus the structural
 * signals a list page needs. It must FAIL on the pre-rewrite build: that is how
 * we know it is not decorative. See docs/team/10-seo-specialist.md (05/08) and
 * docs/team/99-decision-log.md.
 *
 * Requires a build: run `npm run build` first.
 *
 * Run: node scripts/auditRegionPages.mjs
 * Writes: reports/seo/region-pages.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const outDir = path.join(rootDir, 'reports', 'seo');
const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://calmbeach.gr').replace(/\/+$/, '');

const LOCALE_PREFIXES = new Set(['el', 'de', 'fr', 'it']);

// Greek glyphs are wider, so Google truncates Greek titles a few px earlier.
// Same budget as `beachTitleMaxLen` / `pickUnderLimit` in prerenderBeachPages.mjs.
const TITLE_MAX = { en: 60, el: 58, de: 60, fr: 60, it: 60 };

// The word that proves the H1 is about beaches at all. One per locale.
const BEACH_WORD = {
  en: ['beaches', 'beach'],
  el: ['παραλιες', 'παραλια'],
  de: ['strände', 'strande', 'strand'],
  fr: ['plages', 'plage'],
  it: ['spiagge', 'spiaggia'],
};

// A head-term H1 ("Beaches in Preveza") is short and is not a question. The old
// one — "Which Preveza beaches are more sheltered from the wind?" — is both long
// and interrogative, in every language it was emitted in.
const H1_MAX_WORDS = 6;

// Body-length floor. Tiered because a 2-beach region cannot reach the same word
// count as a 26-beach one: the list carries most of the length, and the two
// climatology sections need >= 3 beaches to render at all (MIN_BEACHES in
// utils/seaSeasonProfile.mjs), so a tiny region loses both.
//
// Both numbers are MEASURED over the 05/08/2026 build, not guessed: regions with
// >= 5 beaches run 462-1086 words, regions below that run 247-504. The floors sit
// just under each observed minimum on purpose — this gate exists to catch a body
// that COLLAPSED (drop the sections and a small region falls to ~120), not to
// make a 1-beach island pad its prose to hit a round number.
const MIN_WORDS_LARGE = 450; // regions with >= 5 built beach pages; observed min 462
const MIN_WORDS_SMALL = 230; // observed min 247 (el/halki, 2 beaches)
const SMALL_REGION_BEACHES = 5;

// Every guide that was actually built for a region must be linked from it. Not
// a fixed count: getIslandGuides() only emits guides that cleared their own
// beach-count threshold, so most regions legitimately have 1-3, not 5.
const GUIDE_PREFIXES = ['sheltered', 'family', 'snorkeling', 'organized', 'secluded', 'sunset'];

const REQUIRED_JSONLD = ['CollectionPage', 'ItemList', 'BreadcrumbList', 'FAQPage'];

if (!fs.existsSync(distDir)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s) => stripAccents(String(s || '').toLowerCase());

const decodeEntities = (s) =>
  String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ');

/** Visible text of an HTML fragment: no scripts, no styles, no tags. */
const visibleText = (html) =>
  decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();

const wordCount = (text) => (text ? text.split(' ').filter(Boolean).length : 0);

/**
 * Find every built region page: `[locale/]beaches/{region}/index.html`, i.e.
 * exactly one path segment after `beaches` (two would be a beach page).
 */
const findRegionPages = () => {
  const found = [];
  const scan = (localeDir, locale) => {
    const beachesDir = path.join(distDir, localeDir, 'beaches');
    if (!fs.existsSync(beachesDir)) return;
    for (const entry of fs.readdirSync(beachesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const file = path.join(beachesDir, entry.name, 'index.html');
      if (!fs.existsSync(file)) continue;
      found.push({
        file,
        locale,
        region: entry.name,
        url: `${siteUrl}${localeDir ? `/${localeDir}` : ''}/beaches/${entry.name}/`,
      });
    }
  };
  scan('', 'en');
  for (const prefix of LOCALE_PREFIXES) scan(prefix, prefix);
  return found.sort((a, b) => a.url.localeCompare(b.url));
};

/** Ground truth for "how many beaches does this region have": built pages. */
const builtBeachCount = (region) => {
  const dir = path.join(distDir, 'beaches', region);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && /^\d+-/.test(e.name)).length;
};

/** Ground truth for "which guides exist for this region": built pages. */
const builtGuidesFor = (region) =>
  GUIDE_PREFIXES.filter((key) => fs.existsSync(path.join(distDir, `${key}-beaches`, region, 'index.html')));

const parseJsonLdTypes = (html) => {
  const types = new Set();
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed;
    try {
      parsed = JSON.parse(decodeEntities(m[1]));
    } catch {
      types.add('__INVALID__');
      continue;
    }
    const visit = (node) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object') return;
      const t = node['@type'];
      if (Array.isArray(t)) t.forEach((x) => types.add(x));
      else if (t) types.add(t);
      if (node.mainEntity) visit(node.mainEntity);
    };
    visit(parsed);
  }
  return types;
};

/** The region label as the page itself declares it, from BreadcrumbList item 2. */
const regionLabelFromBreadcrumb = (html) => {
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed;
    try {
      parsed = JSON.parse(decodeEntities(m[1]));
    } catch {
      continue;
    }
    const list = (Array.isArray(parsed) ? parsed : [parsed]).find((n) => n && n['@type'] === 'BreadcrumbList');
    const second = list?.itemListElement?.find((i) => i?.position === 2);
    if (second?.name) return String(second.name);
  }
  return '';
};

const checkPage = (page) => {
  const html = fs.readFileSync(page.file, 'utf8');
  const errors = [];
  const language = page.locale;

  // --- the page's own <main>, which is what Google reads on this page type ---
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const mainHtml = mainMatch ? mainMatch[1] : '';
  if (!mainHtml) errors.push('no <main> element');
  const words = wordCount(visibleText(mainHtml));
  const beaches = builtBeachCount(page.region);
  const minWords = beaches >= SMALL_REGION_BEACHES ? MIN_WORDS_LARGE : MIN_WORDS_SMALL;
  if (words < minWords) errors.push(`thin body: ${words} words in <main>, need >= ${minWords} (${beaches} beaches)`);

  // --- 2. exactly one h1 ---
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => visibleText(m[1]));
  if (h1s.length !== 1) errors.push(`${h1s.length} <h1> elements, need exactly 1`);
  const h1 = h1s[0] || '';

  // --- 3. the H1 must be the head term, not the sheltered question ---
  if (h1) {
    const h1n = norm(h1);
    const beachWords = BEACH_WORD[language] || BEACH_WORD.en;
    if (!beachWords.some((w) => h1n.includes(norm(w)))) {
      errors.push(`h1 does not name beaches (${language}): "${h1}"`);
    }
    if (/[?;]\s*$/.test(h1.trim())) errors.push(`h1 is a question, not a head term: "${h1}"`);
    const h1Words = h1.split(/\s+/).filter(Boolean).length;
    if (h1Words > H1_MAX_WORDS) errors.push(`h1 is ${h1Words} words, max ${H1_MAX_WORDS}: "${h1}"`);
    // The region has to be named. The page declares its own label in the
    // breadcrumb, so we compare against that instead of duplicating the
    // REGION_DECLENSION table of prerenderBeachPages.mjs here.
    const label = regionLabelFromBreadcrumb(html);
    if (label) {
      // Ignore the beach noun of EVERY language, not just this page's: the
      // breadcrumb label is built as `${islandName} beaches` with a hardcoded
      // English suffix, so a Greek page's label reads "Λήμνος beaches".
      const beachWordSet = new Set(Object.values(BEACH_WORD).flat().map(norm));
      const labelTokens = norm(label)
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length >= 4 && !beachWordSet.has(t));
      // Compare on the STEM, not the whole word. Greek declines the region name
      // in running prose ("Λήμνος" -> "Λήμνου" / "Λήμνο"), so full containment
      // would fail on a perfectly good H1. Declension changes endings, not stems.
      // Floor of 3, not 4: "Χίος" -> "Χίο" loses two of its four letters.
      const stem = (t) => t.slice(0, Math.max(3, t.length - 2));
      if (labelTokens.length && !labelTokens.some((t) => h1n.includes(stem(t)))) {
        errors.push(`h1 does not name the region ("${label}"): "${h1}"`);
      }
    }
  }

  // --- 4. title budget ---
  const title = decodeEntities((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').trim();
  const titleMax = TITLE_MAX[language] ?? 60;
  if (!title) errors.push('no <title>');
  else if (title.length > titleMax) errors.push(`title ${title.length} chars, max ${titleMax}: "${title}"`);

  // --- 5. internal beach links: every beach up to the render cap of 80 ---
  const beachHrefs = new Set(
    [...html.matchAll(/<a\s[^>]*href=["']([^"']+)["']/gi)]
      .map((m) => m[1])
      .filter((href) => new RegExp(`/beaches/${page.region}/\\d+-`).test(href)),
  );
  // Every built beach, not a sample: the 80-cap this replaced left 96 beach
  // pages with no internal link from anywhere (Halkidiki, Evia, Corfu, Chania).
  const expectedLinks = Math.min(200, beaches);
  if (beachHrefs.size < expectedLinks) {
    errors.push(`links ${beachHrefs.size} beaches, expected >= ${expectedLinks} of ${beaches} built`);
  }

  // --- 6. structured data ---
  const types = parseJsonLdTypes(html);
  if (types.has('__INVALID__')) errors.push('unparseable JSON-LD block');
  for (const required of REQUIRED_JSONLD) if (!types.has(required)) errors.push(`missing JSON-LD ${required}`);

  // --- 7. self-referential canonical ---
  const canonical = decodeEntities(
    (html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i) || [])[1] || '',
  );
  if (canonical !== page.url) errors.push(`canonical "${canonical}" != "${page.url}"`);

  // --- 8. every guide that exists for this region must be linked from it ---
  const guides = builtGuidesFor(page.region);
  const missingGuides = guides.filter(
    (key) => !new RegExp(`href=["'][^"']*/${key}-beaches/${page.region}/`).test(html),
  );
  if (missingGuides.length) errors.push(`does not link its own guides: ${missingGuides.join(', ')}`);

  return { ...page, words, beaches, h1, title, guideCount: guides.length, errors };
};

const pages = findRegionPages();
if (!pages.length) {
  console.error('No region pages found under dist/ — did the prerender run?');
  process.exit(1);
}

const results = pages.map(checkPage);
const failures = results.filter((r) => r.errors.length);

const byRule = new Map();
for (const r of failures) {
  for (const e of r.errors) {
    const rule = e.split(':')[0].replace(/\d+/g, 'N').trim();
    byRule.set(rule, (byRule.get(rule) || 0) + 1);
  }
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'region-pages.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      pagesChecked: results.length,
      failing: failures.length,
      thresholds: { MIN_WORDS_LARGE, MIN_WORDS_SMALL, SMALL_REGION_BEACHES, H1_MAX_WORDS, TITLE_MAX },
      medianWords: results.map((r) => r.words).sort((a, b) => a - b)[Math.floor(results.length / 2)],
      byRule: Object.fromEntries([...byRule.entries()].sort((a, b) => b[1] - a[1])),
      failures: failures.slice(0, 200).map((r) => ({ url: r.url, words: r.words, h1: r.h1, errors: r.errors })),
    },
    null,
    2,
  ),
  'utf8',
);

console.log(`Region pages — ${results.length} checked in ${new Set(results.map((r) => r.locale)).size} locales`);
console.log(`Median <main> words: ${results.map((r) => r.words).sort((a, b) => a - b)[Math.floor(results.length / 2)]}`);
if (!failures.length) {
  console.log('All region pages pass.');
  console.log('Wrote reports/seo/region-pages.json');
  process.exit(0);
}

console.log(`\nFAILING: ${failures.length} of ${results.length}\n`);
for (const [rule, count] of [...byRule.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(5)}  ${rule}`);
}
console.log('\nFirst 10:');
for (const r of failures.slice(0, 10)) {
  console.log(`\n  ${r.url}`);
  for (const e of r.errors) console.log(`    - ${e}`);
}
console.log('\nWrote reports/seo/region-pages.json');
process.exit(1);
