/**
 * GATE: the snippet Google shows for a beach page must (a) tell the truth about
 * that beach's measured shelter level, and (b) not be the same sentence as
 * hundreds of its neighbours.
 *
 * Why this exists (08/08/2026). Search Console, 06/07–02/08: the 2.854 beach
 * pages took 4.509 impressions and returned 44 clicks — 1,0% against 16,9% on
 * the home page — with pages sitting at position 3,6 earning literally zero
 * clicks. Rank did not explain it. Measured on the built site, every page had a
 * technically unique description (the name differs) but only ~926 distinct
 * BODIES across 2.854 Greek pages: one sentence, "Παραλία με βότσαλο, καλή για
 * snorkeling, συχνά πιο απάνεμη σε βόρειους ανέμους", carried 241 pages, and the
 * top four bodies covered a quarter of the site. Worse, the measured seasonal
 * verdict — the single fact here that no tourism page can copy — had shipped into
 * the page BODY on 06/08 and never reached the snippet.
 *
 * So this gate asserts, over the built site:
 *   1. TRUTH, both directions — a page whose data says `protected` carries the
 *      protected meta line and NEITHER of the other two levels'. A page whose
 *      model abstained carries none of the three. (The 05/08 lesson: every gate
 *      this project had looked in one direction only.)
 *   2. COVERAGE — beaches with a baked verdict actually print it.
 *   3. DISTINCTNESS — no single snippet body may cover more than
 *      MAX_BODY_SHARE of a language's pages, and the distinct-body count may not
 *      regress below MIN_DISTINCT_BODIES.
 *   4. LENGTH — nothing over 160 characters, or Google truncates mid-sentence.
 *
 * Self-proof: `--prove` rotates the three levels before asserting and requires
 * mass failures. A gate that still passes on rotated data is decorative.
 *
 * Run:  node scripts/validateBeachMetaDescriptions.mjs [--prove]
 * Needs a completed build (reads dist/ and public/data).
 */
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRegionWindContext } from '../utils/localWindContext.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(projectRoot, 'dist');
const dataDir = path.join(projectRoot, 'public', 'data', 'beaches');
const prove = process.argv.includes('--prove');

const LEVELS = ['protected', 'partial', 'exposed'];
const LANGS = { el: 'gr', de: 'de', fr: 'fr', it: 'it', en: 'en' };

// Thresholds. Deliberately set just below what the change measures today, so a
// regression trips the gate but ordinary data drift does not.
// Measured on the 08/08/2026 build, with the pre-change number in brackets:
// gr 1.201 [926] · en 1.206 [938] · de 239 [97] · fr 241 [84] · it 219 [89].
// Top-body share went gr 8,4% → 2,5%, fr 12,2% → 5,7%, it 12,0% → 5,1%.
// Floors sit a little under measured so ordinary data drift does not trip them
// but a structural regression (a clause silently dropping out) does.
const MAX_BODY_SHARE = 0.07;
const MIN_DISTINCT_BODIES = { gr: 1150, en: 1150, de: 225, fr: 225, it: 205 };
const MAX_LENGTH = 160;

// Mirror of the builder's table. Kept as a literal copy on purpose: a gate that
// imports the thing it is checking cannot catch the thing being wrong.
const SHELTER = {
  aegean: {
    protected: { en: 'Usually a sheltered shore in the meltemi.', gr: 'Συνήθως προστατευμένη ακτή στα μελτέμια.', de: 'Beim Meltemi meist geschützte Küste.', fr: 'Côte généralement abritée au meltemi.', it: 'Costa di solito riparata dal meltemi.' },
    partial:   { en: 'Partial shelter in the meltemi.',           gr: 'Μερική προστασία στα μελτέμια.',          de: 'Teilweiser Schutz beim Meltemi.',     fr: 'Abri partiel au meltemi.',            it: 'Riparo parziale dal meltemi.' },
    exposed:   { en: 'Exposed shore in the meltemi.',             gr: 'Εκτεθειμένη ακτή στα μελτέμια.',          de: 'Beim Meltemi exponierte Küste.',      fr: 'Côte exposée au meltemi.',            it: 'Costa esposta al meltemi.' },
  },
  ionian: {
    protected: { en: 'Usually a sheltered shore in the maistros.', gr: 'Συνήθως προστατευμένη ακτή στον μαΐστρο.', de: 'Beim Maistros meist geschützte Küste.', fr: 'Côte généralement abritée au maïstro.', it: 'Costa di solito riparata dal maestrale.' },
    partial:   { en: 'Partial shelter in the maistros.',           gr: 'Μερική προστασία στον μαΐστρο.',           de: 'Teilweiser Schutz beim Maistros.',      fr: 'Abri partiel au maïstro.',              it: 'Riparo parziale dal maestrale.' },
    exposed:   { en: 'Exposed shore in the maistros.',             gr: 'Εκτεθειμένη ακτή στον μαΐστρο.',           de: 'Beim Maistros exponierte Küste.',       fr: 'Côte exposée au maïstro.',              it: 'Costa esposta al maestrale.' },
  },
  thermaic: {
    protected: { en: 'Usually a sheltered shore in the summer wind.', gr: 'Συνήθως προστατευμένη ακτή στον καλοκαιρινό αέρα.', de: 'Beim Sommerwind meist geschützte Küste.', fr: "Côte généralement abritée par le vent d'été.", it: 'Costa di solito riparata dal vento estivo.' },
    partial:   { en: 'Partial shelter in the summer wind.',           gr: 'Μερική προστασία στον καλοκαιρινό αέρα.',           de: 'Teilweiser Schutz beim Sommerwind.',      fr: "Abri partiel par le vent d'été.",             it: 'Riparo parziale dal vento estivo.' },
    exposed:   { en: 'Exposed shore in the summer wind.',             gr: 'Εκτεθειμένη ακτή στον καλοκαιρινό αέρα.',           de: 'Beim Sommerwind exponierte Küste.',       fr: "Côte exposée au vent d'été.",                 it: 'Costa esposta al vento estivo.' },
  },
};

const decodeEntities = value => String(value ?? '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'");

const findBeachArray = node => {
  if (Array.isArray(node) && node[0] && node[0].id !== undefined) return node;
  if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) {
      const found = findBeachArray(node[key]);
      if (found) return found;
    }
  }
  return null;
};

const collectHtmlFiles = dir => {
  const out = [];
  const walk = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'index.html') out.push(full.split(path.sep).join('/'));
    }
  };
  walk(dir);
  return out;
};

const main = async () => {
  if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
    console.error('dist/ not found — run a build first.');
    process.exitCode = 1;
    return;
  }

  // baked status per beach id, plus the beach's region (for the wind regime)
  const index = JSON.parse(await readFile(path.join(dataDir, 'index.json'), 'utf8'));
  const regions = Array.isArray(index) ? index : Object.values(index).find(Array.isArray);
  const baked = new Map();
  for (const region of regions) {
    const rel = (region.appDataPath || `/data/beaches/app/${region.id}.json`).replace(/^\//, '');
    const file = path.join(projectRoot, 'public', rel);
    if (!existsSync(file)) continue;
    const beaches = findBeachArray(JSON.parse(await readFile(file, 'utf8'))) || [];
    for (const beach of beaches) {
      baked.set(String(beach.id), {
        status: LEVELS.includes(beach.localWindStatus) ? beach.localWindStatus : null,
        regime: getRegionWindContext(region.id),
      });
    }
  }

  const rotate = status => (status ? LEVELS[(LEVELS.indexOf(status) + 1) % LEVELS.length] : null);

  const beachPageRe = /\/beaches\/[^/]+\/(\d+)-[^/]+\/index\.html$/;
  const files = collectHtmlFiles(distDir).filter(f => beachPageRe.test(f));

  const failures = [];
  const perLang = {};
  let checked = 0;
  let verdictPrinted = 0;
  let abstained = 0;

  for (const file of files) {
    const id = file.match(beachPageRe)[1];
    const record = baked.get(id);
    if (!record) continue;
    const localeMatch = file.match(/dist\/(el|de|fr|it)\//);
    const lang = LANGS[localeMatch ? localeMatch[1] : 'en'];

    const html = await readFile(file, 'utf8');
    const raw = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1];
    if (raw === undefined) {
      failures.push(`${file}: no meta description`);
      continue;
    }
    const description = decodeEntities(raw);
    checked += 1;

    if (description.length > MAX_LENGTH) {
      failures.push(`${file}: description ${description.length} chars > ${MAX_LENGTH}`);
    }

    const status = prove ? rotate(record.status) : record.status;
    const table = SHELTER[record.regime];
    if (!table) {
      failures.push(`${file}: unknown wind regime "${record.regime}"`);
      continue;
    }

    // Curated editorial stories legitimately replace the trait snippet with their
    // own opener, so shelter coverage is asserted only where the trait template
    // owns the line. Truth, however, is asserted everywhere: a story snippet may
    // not claim a level either.
    const present = LEVELS.filter(level => description.includes(table[level][lang]));
    const wrong = present.filter(level => level !== status);
    if (wrong.length) {
      failures.push(`${file}: data says ${status || 'no verdict'} but snippet claims ${wrong.join('+')}`);
    }
    // Loose shelter vocabulary, not just our own exact strings. This is the rule
    // that catches hand-written copy: on 08/08/2026 two overrides written before
    // the verdict existed told Google a beach was "υπήνεμη στο μελτέμι" while our
    // own measurement said *exposed*. Matching only the generated sentences would
    // have walked straight past both.
    const POSITIVE_SHELTER = /υπήνεμ|απάνεμ|προστατευμέν|sheltered|wind-protected|riparat|abritée|abrité|geschützt/i;
    const PARTIAL_HEDGE = /μερικ|partial|parzial|partiel|teilweise/i;
    if (POSITIVE_SHELTER.test(description)) {
      if (status === 'exposed') {
        failures.push(`${file}: snippet claims shelter but the measured verdict is EXPOSED — "${description.slice(0, 110)}"`);
      } else if (status === 'partial' && !PARTIAL_HEDGE.test(description)) {
        failures.push(`${file}: snippet claims unqualified shelter but the measured verdict is PARTIAL — "${description.slice(0, 110)}"`);
      }
    }

    if (status && present.includes(status)) verdictPrinted += 1;
    if (!status) abstained += 1;

    const body = description.replace(/^[^:]*:\s*/, '');
    const bucket = (perLang[lang] = perLang[lang] || { total: 0, freq: new Map(), withVerdict: 0, verdictEligible: 0 });
    bucket.total += 1;
    bucket.freq.set(body, (bucket.freq.get(body) || 0) + 1);
    if (status) {
      bucket.verdictEligible += 1;
      if (present.includes(status)) bucket.withVerdict += 1;
    }
  }

  console.log(`Checked ${checked} beach page snippets across ${Object.keys(perLang).length} languages.`);
  console.log(`Baked verdict printed in the snippet: ${verdictPrinted} · model abstained: ${abstained}`);

  for (const [lang, bucket] of Object.entries(perLang)) {
    const distinct = bucket.freq.size;
    const [topBody, topCount] = [...bucket.freq.entries()].sort((a, b) => b[1] - a[1])[0] || ['', 0];
    const share = topCount / bucket.total;
    const coverage = bucket.verdictEligible ? bucket.withVerdict / bucket.verdictEligible : 1;
    console.log(
      `  ${lang}: ${bucket.total} pages · ${distinct} distinct bodies · ` +
      `top body ${topCount} (${(share * 100).toFixed(1)}%) · verdict coverage ${(coverage * 100).toFixed(1)}%`,
    );
    if (share > MAX_BODY_SHARE) {
      failures.push(`${lang}: one snippet body covers ${(share * 100).toFixed(1)}% of pages (max ${(MAX_BODY_SHARE * 100).toFixed(0)}%) — "${topBody.slice(0, 90)}"`);
    }
    const floor = MIN_DISTINCT_BODIES[lang];
    if (floor && distinct < floor) {
      failures.push(`${lang}: only ${distinct} distinct snippet bodies (floor ${floor})`);
    }
    if (coverage < 0.9) {
      failures.push(`${lang}: only ${(coverage * 100).toFixed(1)}% of beaches with a baked verdict print it in the snippet`);
    }
  }

  if (prove) {
    if (failures.length === 0) {
      console.error('\n✗ SELF-PROOF FAILED: levels were rotated and the gate still passed. It is decorative.');
      process.exitCode = 1;
      return;
    }
    console.log(`\n✓ Self-proof: ${failures.length} failures with the three levels rotated — the gate bites.`);
    return;
  }

  if (failures.length) {
    console.error(`\n✗ ${failures.length} failures:`);
    for (const failure of failures.slice(0, 25)) console.error(`  - ${failure}`);
    if (failures.length > 25) console.error(`  … and ${failures.length - 25} more`);
    process.exitCode = 1;
    return;
  }
  console.log('\n✓ Beach meta descriptions: truthful, distinct and within length.');
};

main().catch(error => {
  console.error('Failed to validate beach meta descriptions.', error);
  process.exitCode = 1;
});
