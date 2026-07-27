/**
 * validateTripQueryParsing.mjs — the safety net for the search-to-plan parser.
 *
 * The parser scores PER TOKEN, which is far sharper than the whole-string region
 * matcher it sits beside — and therefore far easier to make trigger-happy. The
 * stopword sweep below is the non-negotiable check: before this file existed,
 * typing «θα» scored 92 against Θάσος and the live suggestion dropdown offered
 * it on the second keystroke of the feature's own headline example.
 *
 * Runs the REAL utils/tripQueryParser.ts over the REAL region list.
 *
 *   node scripts/validateTripQueryParsing.mjs            # assert
 *   node scripts/validateTripQueryParsing.mjs --report   # deterministic JSON dump
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const { parseTripQuery, TRIP_QUERY_TOKEN_TABLES } = require('../utils/tripQueryParser.ts');

// ─── Real region list ───────────────────────────────────────────────────────
// Built from the shipped index + display names, the same two sources
// services/beachDataLoader.ts uses to build island shells at runtime.
const regionIndex = JSON.parse(readFileSync(path.join(root, 'public/data/beaches/index.json'), 'utf8'));
const displayNames = JSON.parse(readFileSync(path.join(root, 'utils/regionDisplayNames.json'), 'utf8'));

const INFO_ONLY = new Set(['south-aegean-milos']);
const islands = (regionIndex.regions || [])
  .filter(entry => !INFO_ONLY.has(entry.id))
  .map(entry => ({
    id: entry.id,
    name: displayNames[entry.id] || entry.name || { en: entry.id, gr: entry.id },
    beaches: [],
  }));

if (islands.length < 50) {
  console.error(`FATAL: only ${islands.length} regions loaded — the index shape changed.`);
  process.exit(1);
}

const failures = [];
const passes = [];
const fail = (name, detail) => failures.push(`${name} — ${detail}`);
const pass = name => passes.push(name);

const parse = (query, language = 'gr') => parseTripQuery(query, islands, language);
const regionIdOf = result => result.region?.id;

// ─── 1. Recall: real sentences must resolve ─────────────────────────────────
const RECALL = [
  ['θα μείνω Νάξο για 5 μέρες', 'gr', 'south-aegean-naxos', 5],
  ['5 μέρες στη Νάξο', 'gr', 'south-aegean-naxos', 5],
  ['Νάξο 5 μέρες', 'gr', 'south-aegean-naxos', 5],
  ['θα πάμε Πάρο για 3 μέρες', 'gr', 'south-aegean-paros', 3],
  ['μία εβδομάδα στη Σκιάθο', 'gr', 'thessaly-skiathos', 7],
  ['σαββατοκύριακο στην Άνδρο', 'gr', 'south-aegean-andros', 2],
  ['Μύκονο τέσσερις μέρες', 'gr', 'south-aegean-mykonos', 4],
  ['διακοπές στη Σαντορίνη 6 μέρες', 'gr', 'south-aegean-santorini', 6],
  ['Κέρκυρα 4 νύχτες', 'gr', 'ionian-islands-corfu', 4],
  ['Naxos for 5 days', 'en', 'south-aegean-naxos', 5],
  ['staying in Paros for three days', 'en', 'south-aegean-paros', 3],
  ['a week in Corfu', 'en', 'ionian-islands-corfu', 7],
  ['ich bleibe 5 Tage auf Naxos', 'de', 'south-aegean-naxos', 5],
  ['je reste 5 jours à Naxos', 'fr', 'south-aegean-naxos', 5],
  ['resto 5 giorni a Naxos', 'it', 'south-aegean-naxos', 5],
];
for (const [query, language, expectedRegion, expectedDays] of RECALL) {
  const result = parse(query, language);
  const gotRegion = regionIdOf(result);
  const gotDays = result.requestedDays;
  if (gotRegion === expectedRegion && gotDays === expectedDays) pass(`recall: ${query}`);
  else fail(`recall: ${query}`, `expected ${expectedRegion}/${expectedDays}, got ${gotRegion}/${gotDays}`);
}

// ─── 2. Precision: these must NOT produce a day count ───────────────────────
const NO_DAYS = [
  'Νάξος', 'παραλία', 'Ελαφονήσι', 'beach bar Νάξος',
  '5 Αυγούστου', '5/8/2026', 'Dimotiki Plaz 2', 'Παραλία 100 Ρίζες',
  '2 άτομα', '4 ώρες', '5', 'ηλιοβασίλεμα', 'παραλίες με άμμο',
  '10 χλμ', '5 αστέρια', '30 βαθμοί', '5 μποφόρ',
];
for (const query of NO_DAYS) {
  const result = parse(query);
  if (result.requestedDays === undefined) pass(`precision: ${query}`);
  else fail(`precision: ${query}`, `expected no days, got ${result.requestedDays}`);
}

// ─── 3. Stopword sweep — THE non-negotiable one ─────────────────────────────
// «θα» scored 92 against Θάσος before this existed.
{
  const tokens = [
    ...TRIP_QUERY_TOKEN_TABLES.STOPWORDS,
    ...TRIP_QUERY_TOKEN_TABLES.NUMBER_WORDS,
    ...TRIP_QUERY_TOKEN_TABLES.DURATION_UNITS,
    ...TRIP_QUERY_TOKEN_TABLES.NEGATIVE_UNITS,
  ];
  const leaks = [];
  for (const token of tokens) {
    for (const language of ['gr', 'en']) {
      const result = parse(token, language);
      if (result.region) leaks.push(`"${token}" (${language}) -> ${result.region.id}`);
    }
  }
  if (leaks.length === 0) pass(`stopword sweep: ${tokens.length} tokens, no region leaks`);
  else fail('stopword sweep', `${leaks.length} tokens matched a region: ${leaks.slice(0, 8).join('; ')}`);
}

// ─── 4. Order invariance ────────────────────────────────────────────────────
{
  const variants = ['Νάξο 5 μέρες', '5 μέρες Νάξο', 'θα μείνω Νάξο για 5 μέρες', 'για 5 μέρες στη Νάξο'];
  const keys = variants.map(query => {
    const result = parse(query);
    return `${regionIdOf(result)}/${result.requestedDays}`;
  });
  if (new Set(keys).size === 1) pass(`order invariance: ${keys[0]}`);
  else fail('order invariance', variants.map((query, index) => `"${query}"->${keys[index]}`).join(' | '));
}

// ─── 5. Ambiguity must refuse, not guess ────────────────────────────────────
const AMBIGUOUS = ['Ρόδο 5 μέρες', 'Πάρο ή Νάξο 5 μέρες'];
for (const query of AMBIGUOUS) {
  const result = parse(query);
  if (!result.region && result.ambiguousRegions.length >= 2) pass(`ambiguity refused: ${query}`);
  else fail(`ambiguity: ${query}`, `expected refusal, got region=${regionIdOf(result)} ambiguous=${result.ambiguousRegions.length}`);
}

// ─── 6. Full sweep: every region resolves from its own Greek name ───────────
// A new region whose name collides with a stopword fails the build here rather
// than shipping. Known genuine collisions are listed, not silently tolerated.
const KNOWN_AMBIGUOUS = new Set([
  'south-aegean-rhodes', 'east-macedonia-and-thrace-rodopi-mainland',
  'attica-east-attica-mainland', 'attica-west-attica-mainland',
]);
{
  const misses = [];
  for (const island of islands) {
    const name = island.name?.gr || island.name?.en;
    if (!name) continue;
    const result = parse(`${name} 3 μέρες`);
    if (result.requestedDays !== 3) { misses.push(`${island.id}: days=${result.requestedDays}`); continue; }
    if (regionIdOf(result) === island.id) continue;
    if (result.ambiguousRegions.length >= 2 && KNOWN_AMBIGUOUS.has(island.id)) continue;
    misses.push(`${island.id}: got ${regionIdOf(result) ?? `ambiguous(${result.ambiguousRegions.length})`}`);
  }
  if (misses.length === 0) pass(`full sweep: all ${islands.length} regions resolve from their own name`);
  else fail('full sweep', `${misses.length} regions: ${misses.slice(0, 10).join('; ')}`);
}

// ─── 7. Days without a place must never invent one ──────────────────────────
for (const query of ['5 μέρες', 'θα μείνω 5 μέρες', 'for 5 days']) {
  const result = parse(query);
  if (!result.region && result.requestedDays === 5) pass(`days-only: ${query}`);
  else fail(`days-only: ${query}`, `region=${regionIdOf(result)} days=${result.requestedDays}`);
}

// ─── 8. Filters survive alongside a place and a duration ────────────────────
{
  const result = parse('Νάξο 5 μέρες με ηλιοβασίλεμα');
  const ok = regionIdOf(result) === 'south-aegean-naxos' && result.requestedDays === 5 && result.filters.includes('sunset');
  if (ok) pass('filters alongside place+days');
  else fail('filters alongside place+days', `region=${regionIdOf(result)} days=${result.requestedDays} filters=${result.filters.join(',')}`);
}

// ─── Output ─────────────────────────────────────────────────────────────────
if (process.argv.includes('--report')) {
  const report = [...RECALL.map(([q, l]) => [q, l]), ...NO_DAYS.map(q => [q, 'gr']), ...AMBIGUOUS.map(q => [q, 'gr'])]
    .map(([query, language]) => {
      const result = parse(query, language);
      return {
        query,
        language,
        region: regionIdOf(result) ?? null,
        ambiguous: result.ambiguousRegions.map(island => island.id),
        days: result.requestedDays ?? null,
        residual: result.residualQuery,
        filters: result.filters,
      };
    });
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const name of passes) console.log(`PASS  ${name}`);
  for (const detail of failures) console.error(`FAIL  ${detail}`);
  console.log(`\nTrip query parsing: ${passes.length} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exitCode = 1;
}
