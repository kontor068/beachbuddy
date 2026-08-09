/**
 * GATE: the static beach page prints EXACTLY the shelter verdict the baked data holds.
 *
 * Why this exists (06/08/2026): until today the prerendered beach page only offered
 * orientation-with-disclaimer and deferred the real verdict to "the app" — the one
 * thing the product actually knows (the nationally measured seasonal shelter level)
 * never reached the layer Google and first-time visitors read. When we started
 * printing it, a new class of lie became possible: the page saying "protected" over
 * data that says "exposed" (or vice versa). This gate closes BOTH directions —
 * the project's 05/08 lesson is that every earlier gate looked only one way.
 *
 * What it asserts, for every built beach page in every language:
 *   1. baked `localWindStatus` present  → the page contains that level's exact
 *      LOCAL_WIND_SECTION sentence (the same copy the app renders), and contains
 *      NEITHER of the other two levels' sentences (over- AND under-claim check);
 *   2. baked status absent (model abstained) → the page contains none of the three;
 *   3. data coherence: `shelteredFromLocalWind` === (status === 'protected').
 *
 * Self-proof: `--prove` reruns the assertion with the three levels rotated and
 * requires mass failures — if the rotated run passes, the gate is decorative.
 *
 * Run:  node scripts/validateStaticShelterVerdict.mjs [--prove]
 * Needs a completed build (reads dist/ and public/data).
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCAL_WIND_SECTION, getRegionWindContext } from '../utils/localWindContext.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(projectRoot, 'dist');
const dataDir = path.join(projectRoot, 'public', 'data', 'beaches');
const prove = process.argv.includes('--prove');

// The sentences are matched against built HTML, so both sides have to agree on
// entities. Escaping the expected sentence was the original approach and it was
// wrong in one direction: the narrative paragraph reaches the page through a
// path that leaves the apostrophe raw, so every French sentence containing one
// — "les jours d'été de N/NE", "les après-midis d'été" — could never match.
// Measured 08/08/2026: 349 false failures, all of them French `exposed` pages,
// and it also means the gate was structurally blind to a French over-claim.
// Decoding the page instead of escaping the sentence works whichever way the
// builder happens to emit it.
const decodeEntities = value => String(value ?? '')
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

const LEVELS = ['protected', 'partial', 'exposed'];
const LANGS = ['en', 'gr', 'de', 'fr', 'it'];
const langOfDir = dir => (dir === 'el' ? 'gr' : dir);

// level -> language -> [escaped sentence variants] (normal + Greek boat-neuter)
const sentenceSets = context => {
  const section = LOCAL_WIND_SECTION[context];
  const map = {};
  for (const level of LEVELS) {
    map[level] = {};
    for (const lang of LANGS) {
      const variants = [section.status[level][lang]];
      if (lang === 'gr') variants.push(section.statusBoatGr[level]);
      map[level][lang] = variants;
    }
  }
  return map;
};
const SENTENCES = { aegean: sentenceSets('aegean'), ionian: sentenceSets('ionian'), thermaic: sentenceSets('thermaic') };

async function loadBakedStatuses() {
  const index = JSON.parse(await readFile(path.join(dataDir, 'index.json'), 'utf8'));
  const byId = new Map();
  const problems = [];
  for (const region of index.regions || []) {
    const appPath = path.join(dataDir, 'app', `${region.id}.json`);
    if (!existsSync(appPath)) continue;
    const payload = JSON.parse(await readFile(appPath, 'utf8'));
    for (const beach of payload.island?.beaches || []) {
      if (!Number.isInteger(beach.id)) continue;
      const status = LEVELS.includes(beach.localWindStatus) ? beach.localWindStatus : null;
      const flag = beach.shelteredFromLocalWind === true;
      if (flag !== (status === 'protected')) {
        problems.push(`data incoherence beach ${beach.id} (${region.id}): shelteredFromLocalWind=${flag} but localWindStatus=${status ?? 'absent'}`);
      }
      byId.set(beach.id, { status, context: getRegionWindContext(region.id), regionId: region.id });
    }
  }
  return { byId, problems };
}

async function collectBeachPages() {
  const pages = [];
  const langDirs = ['', 'el', 'de', 'fr', 'it'];
  for (const dir of langDirs) {
    const beachesRoot = path.join(distDir, dir, 'beaches');
    if (!existsSync(beachesRoot)) continue;
    for (const regionSlug of await readdir(beachesRoot)) {
      const regionDir = path.join(beachesRoot, regionSlug);
      if (!(await stat(regionDir)).isDirectory()) continue;
      for (const entry of await readdir(regionDir)) {
        const m = /^(\d+)-/.exec(entry);
        if (!m) continue;
        const file = path.join(regionDir, entry, 'index.html');
        if (!existsSync(file)) continue;
        pages.push({ file, id: Number(m[1]), lang: langOfDir(dir || 'en') });
      }
    }
  }
  return pages;
}

const rotate = status => (status === 'protected' ? 'exposed' : status === 'exposed' ? 'partial' : 'protected');

async function run(rotated) {
  const { byId, problems } = await loadBakedStatuses();
  const failures = rotated ? [] : problems.slice();
  const pages = await collectBeachPages();
  if (pages.length < 1000) failures.push(`only ${pages.length} built beach pages found under dist/ — expected thousands; wrong dir or incomplete build`);
  let checkedWithStatus = 0;
  for (const page of pages) {
    const baked = byId.get(page.id);
    if (!baked) continue; // legacy/redirect ids — no claim to check
    const html = decodeEntities(await readFile(page.file, 'utf8'));
    const sets = SENTENCES[baked.context];
    const expected = rotated && baked.status ? rotate(baked.status) : baked.status;
    for (const level of LEVELS) {
      const present = sets[level][page.lang].some(sentence => html.includes(sentence));
      if (expected === level && !present) {
        failures.push(`${path.relative(distDir, page.file)}: baked '${expected}' but its sentence is missing (${page.lang})`);
      }
      if (expected !== level && present) {
        failures.push(`${path.relative(distDir, page.file)}: prints '${level}' sentence but baked status is '${expected ?? 'absent'}' (${page.lang})`);
      }
    }
    if (baked.status) checkedWithStatus += 1;
  }
  return { failures, pages: pages.length, checkedWithStatus };
}

const real = await run(false);
if (real.failures.length) {
  console.error(`validateStaticShelterVerdict: FAIL — ${real.failures.length} problems (${real.pages} pages scanned).`);
  for (const f of real.failures.slice(0, 25)) console.error(`  - ${f}`);
  if (real.failures.length > 25) console.error(`  … and ${real.failures.length - 25} more`);
  process.exit(1);
}
if (real.checkedWithStatus === 0) {
  console.error('validateStaticShelterVerdict: FAIL — zero pages carried a baked status; the gate would be vacuously green.');
  process.exit(1);
}
if (prove) {
  const sabotaged = await run(true);
  if (sabotaged.failures.length < real.checkedWithStatus / 2) {
    console.error(`validateStaticShelterVerdict: SELF-PROOF FAIL — rotated statuses produced only ${sabotaged.failures.length} failures for ${real.checkedWithStatus} status pages; the gate is decorative.`);
    process.exit(1);
  }
  console.log(`validateStaticShelterVerdict: self-proof OK (rotation triggered ${sabotaged.failures.length} failures).`);
}
console.log(`validateStaticShelterVerdict: OK — ${real.pages} beach pages, ${real.checkedWithStatus} with a printed verdict, both directions checked.`);
