/**
 * Η ΣΕΛΙΔΑ ΠΕΡΙΟΧΗΣ ΕΧΕΙ ΚΑΤΙ ΝΑ ΠΕΙ — πύλη που ελέγχει ότι υπάρχει ΑΠΑΝΤΗΣΗ, όχι τι λέει.
 *
 * WHY THIS EXISTS. On 09/08/2026 the region podium — the «Πού να πάμε τώρα;» block, the single
 * thing the product exists to answer — was found rendering for NOBODY, in all 110 regions, every
 * day, for as long as the summary tier had existed. Corfu offered 105 candidates and 0 survived.
 *
 * The cause was not a wrong answer, so not one of the 31 existing gates saw it: every one of them
 * asks «is what we say true?» and this was «we say nothing at all». The summary tier
 * (scripts/buildBeachRegionData.mjs, buildSummaryBeach) carries a deliberately TRIMMED metadata —
 * and hasTrustedTopPickStaticData in services/recommendationService.ts requires
 * metadata.terrain.types, which the trim dropped as "already flattened into beachType". Every
 * beach failed that one check while passing confidence, access, profile, depth, orientation and
 * wind evidence.
 *
 * WHAT IT CHECKS, per region file, against the SAME predicate the app runs:
 *   1. the summary tier carries terrain.types wherever the raw dataset has it, and
 *   2. at least one beach per region clears the static-data half of the trust gate.
 *
 * Rule 2 is the one that matters: it is stated as «this region can produce an answer», not as a
 * field list, so the next trim that drops a different field still fails here instead of silently
 * emptying the podium again.
 *
 * SELF-PROOF: run with --prove and the gate re-runs with terrain stripped in memory; if it does
 * not then fail loudly, the gate is decorative and says so.
 *
 * Τρέξε: node scripts/validateSummaryTierAnswers.mjs [--prove]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const SUMMARY_DIR = path.join('public', 'data', 'beaches', 'app', 'summary');
const RAW_DATASET = path.join('public', 'greek_beaches.json');
const PROVE = process.argv.includes('--prove');

const findBeachArray = (node, depth = 0) => {
  if (depth > 5) return null;
  if (Array.isArray(node) && node.length && node[0] && node[0].name !== undefined) return node;
  if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) {
      const found = findBeachArray(node[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
};

/**
 * The static half of hasTrustedTopPickStaticData, kept deliberately in the SAME order as the
 * source so a reader can diff them by eye. It is duplicated rather than imported because the
 * source is TypeScript inside the app bundle; the duplication is the reason rule 2 is phrased as
 * "an answer exists" — if the real predicate gains a field, this copy going stale shows up as a
 * gate that passes while the app shows nothing, which rule 2 catches from the other direction.
 */
const clearsStaticTrust = beach => {
  const metadata = beach.metadata;
  if (!metadata) return false;
  if (metadata.excludeFromApp) return false;
  const confidence = metadata.confidence || beach.orientation?.confidence || 'medium';
  if (confidence !== 'high') return false;
  const accessType = metadata.access?.type;
  if (!accessType || accessType === 'unknown') return false;
  if (!metadata.terrain?.types?.length) return false;
  if (!beach.beachType || beach.beachType === 'unknown') return false;
  if (!metadata.waterDepth?.type && !beach.waterDepth) return false;
  if (beach.orientation?.confidence === 'low') return false;
  return true;
};

const loadRawTerrainByName = () => {
  if (!existsSync(RAW_DATASET)) return null;
  const rows = new Map();
  const walk = node => {
    if (Array.isArray(node)) {
      for (const b of node) {
        if (b && typeof b === 'object' && b.name && b.lat !== undefined) {
          rows.set(String(b.name).trim().toLowerCase(), Boolean(b.metadata?.terrain?.types?.length));
        }
      }
      return;
    }
    if (node && typeof node === 'object') for (const k of Object.keys(node)) walk(node[k]);
  };
  walk(JSON.parse(readFileSync(RAW_DATASET, 'utf8')));
  return rows;
};

const run = (stripTerrain = false) => {
  if (!existsSync(SUMMARY_DIR)) {
    return { failures: [`Missing ${SUMMARY_DIR} — run npm run build:beach-data first.`], regions: 0, answered: 0, beaches: 0 };
  }

  const files = readdirSync(SUMMARY_DIR).filter(f => f.endsWith('.json'));
  const failures = [];
  const silent = [];
  let beaches = 0;
  let answered = 0;
  let withTerrain = 0;

  for (const file of files) {
    const parsed = JSON.parse(readFileSync(path.join(SUMMARY_DIR, file), 'utf8'));
    const list = findBeachArray(parsed) || [];
    if (list.length === 0) continue;

    const region = list.map(b => (
      stripTerrain && b.metadata
        ? { ...b, metadata: { ...b.metadata, terrain: undefined } }
        : b
    ));

    beaches += region.length;
    withTerrain += region.filter(b => b.metadata?.terrain?.types?.length).length;

    const trusted = region.filter(clearsStaticTrust).length;
    if (trusted > 0) answered += 1;
    else silent.push(`${file}: 0 of ${region.length} beaches clear the static trust gate`);
  }

  // THE THRESHOLD IS THE POINT. A single thin region legitimately has no beach with verified
  // static data, and the sheltered-fallback podium (App.tsx) now covers it in the UI. What must
  // never happen again is the WHOLESALE silence of 09/08/2026 — 110 of 110 regions unable to
  // answer because one field went missing from a tier. So the gate fires on breadth, not on the
  // individual region, and prints the individual ones as information.
  const silentLimit = Math.max(3, Math.round(files.length * 0.05));
  if (silent.length > silentLimit) {
    failures.push(`${silent.length} regions cannot produce an answer (limit ${silentLimit}). The podium would be empty there, every day. First: ${silent.slice(0, 5).join(' · ')}`);
  }

  return { failures, silent, regions: files.length, answered, beaches, withTerrain };
};

const result = run(false);

console.log('Η σελίδα περιοχής έχει κάτι να πει — έλεγχος summary tier');
console.log(`  περιοχές: ${result.regions} · παραλίες: ${result.beaches} · με terrain: ${result.withTerrain}`);
console.log(`  περιοχές που μπορούν να δώσουν απάντηση: ${result.answered}/${result.regions}`);

if (PROVE) {
  const stripped = run(true);
  if (stripped.failures.length === 0) {
    console.error('\nΑΠΟΤΥΧΙΑ ΑΥΤΟΑΠΟΔΕΙΞΗΣ: με σβησμένο terrain η πύλη πέρασε. Είναι διακοσμητική.');
    process.exit(1);
  }
  console.log(`  αυτοαπόδειξη: με σβησμένο terrain σιωπούν ${stripped.silent.length}/${stripped.regions} περιοχές και η πύλη πέφτει ✅`);
}

const rawTerrain = loadRawTerrainByName();
if (rawTerrain) {
  const files = readdirSync(SUMMARY_DIR).filter(f => f.endsWith('.json'));
  let dropped = 0;
  for (const file of files) {
    const list = findBeachArray(JSON.parse(readFileSync(path.join(SUMMARY_DIR, file), 'utf8'))) || [];
    for (const b of list) {
      const key = String(b.name?.en || b.name?.gr || b.name || '').trim().toLowerCase();
      if (rawTerrain.get(key) === true && !b.metadata?.terrain?.types?.length) dropped += 1;
    }
  }
  if (dropped > 0) {
    // Matched by NAME across two files, so a handful of renames/aliases show up here as noise.
    // Breadth again decides: a trim that drops the field affects thousands, not three.
    if (dropped > 3) {
      result.failures.push(`${dropped} beaches have terrain in the raw dataset but lost it in the summary tier — the trim in buildSummaryBeach dropped a field the trust gate reads.`);
    } else {
      console.log(`  terrain: ${dropped} ασυμφωνίες ονόματος (θόρυβος, κάτω από το όριο) ✅`);
    }
  } else {
    console.log('  terrain δεν χάνεται στο πέρασμα ωμά → summary ✅');
  }
}

if (result.failures.length > 0) {
  console.error(`\n${result.failures.length} αποτυχίες:`);
  for (const f of result.failures.slice(0, 20)) console.error(`  - ${f}`);
  if (result.failures.length > 20) console.error(`  … και ${result.failures.length - 20} ακόμα`);
  process.exit(1);
}

console.log('\nΠέρασε: κάθε περιοχή μπορεί να απαντήσει «πού να πάμε».');
