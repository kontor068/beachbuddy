// Seatrac accessibility importer (region-agnostic, safety-first).
//
//   node scripts/importSeatracAccessibility.mjs match   # fuzzy-match seed -> dataset, write adjudication report
//   node scripts/importSeatracAccessibility.mjs apply    # read REVIEWED report, write metadata.seatrac
//
// Seed:    scripts/data/seatrac-seed.json   (PDF transcription — authored content)
// Report:  reports/seatrac-match-adjudication.json   (machine-proposed; a human reviews/edits before apply)
// Target:  public/greek_beaches.json
//
// SAFETY: every applied record gets needsVerification:true; amenities the seed doesn't state stay 'unknown'
// (never 'no'); status defaults to 'listed-unverified'; confidence: medium for online, low otherwise.
// Never invents a beach — no-match seed rows are reported, not created (those go to Phase D2).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SEED = new URL('./data/seatrac-seed.json', import.meta.url);
const REPORT = new URL('../reports/seatrac-match-adjudication.json', import.meta.url);
const DATA = new URL('../public/greek_beaches.json', import.meta.url);

const SOURCE_LABEL = 'Seatrac accessible-beaches research compilation (June 2026)';
const VERIFIED_AT = '2026-06-14';
const AMENITY_KEYS = ['disabledParking', 'boardwalkToWater', 'accessibleWc', 'changingRoom', 'shower', 'shade'];
// Score thresholds (0-100). >=CONFIDENT single candidate => auto-proposed; >=AMBIGUOUS => needs human pick.
const CONFIDENT = 88;
const AMBIGUOUS = 72;

// --- Greek-aware normalization (self-contained; mirrors scripts/buildBeachRegionData.mjs) ---
const GREEK_MAP = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k',
  λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't',
  υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
};
const stripAccents = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ');
const greeklish = (v) => stripAccents(v).toLowerCase().split('').map((c) => GREEK_MAP[c] ?? c).join('');
// Two normalized latin keys per name, both transliterated + de-accented:
//  - full:    everything (keeps suffixes like "akti b" so Γλυφάδα Ακτή Α/Β/Γ stay distinct)
//  - core:    generic words (paralia/akti/beach/plaz) stripped (so "Ραφήνα" ≈ "Πλαζ Ραφήνας")
// We score against both and take the max — full disambiguates suffix-only beaches, core rescues
// the "Παραλία X" vs "X" mismatch. (Stripping-only collapsed Ακτή Α/Β/Γ; keeping-only buried
// the flagship Γλυφάδα under its "παραλια" prefix.)
const baseKey = (v) => greeklish(v).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const coreKey = (v) => baseKey(v).replace(/\b(paralia|akti|beach|plaz)\b/g, ' ').replace(/\s+/g, ' ').trim();
const keysOf = (v) => {
  const full = baseKey(v);
  const core = coreKey(v);
  return core && core !== full ? [full, core] : [full];
};
// Back-compat alias used by region gating (a single representative key is enough there).
const normKey = (v) => coreKey(v) || baseKey(v);

// Dice coefficient on bigrams — robust to small spelling differences.
const bigrams = (s) => {
  const t = s.replace(/\s/g, '');
  const set = new Map();
  for (let i = 0; i < t.length - 1; i += 1) {
    const g = t.slice(i, i + 2);
    set.set(g, (set.get(g) || 0) + 1);
  }
  return set;
};
const diceScore = (a, b) => {
  if (!a || !b) return 0;
  if (a === b) return 100;
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return a === b ? 100 : 0;
  let overlap = 0;
  for (const [g, n] of A) if (B.has(g)) overlap += Math.min(n, B.get(g));
  return Math.round((200 * overlap) / (sizeOf(A) + sizeOf(B)));
};
const sizeOf = (m) => { let n = 0; for (const v of m.values()) n += v; return n; };

// Region/island gate to cut cross-Greece false positives. Compares seed.region to the dataset
// region key (top-level) OR the subregion/municipality, transliterated.
const regionMatches = (seedRegion, datasetRegion, datasetSub, datasetSubSub) => {
  if (!seedRegion) return true;
  const sr = normKey(seedRegion);
  return [datasetRegion, datasetSub, datasetSubSub].some((d) => {
    const dk = normKey(d || '');
    return dk && (dk.includes(sr) || sr.includes(dk));
  });
};

// --- Walk the 4-level nested dataset ---
function* iterBeaches(data) {
  for (const [region, sub] of Object.entries(data)) {
    for (const [subName, subSub] of Object.entries(sub)) {
      for (const [subSubName, arr] of Object.entries(subSub)) {
        if (!Array.isArray(arr)) continue;
        for (const beach of arr) yield { beach, region, subName, subSubName };
      }
    }
  }
}

const loadJson = (url) => JSON.parse(readFileSync(url, 'utf8'));

const buildCandidates = (data) => {
  const list = [];
  for (const entry of iterBeaches(data)) {
    const { beach } = entry;
    const names = [beach.name, ...(beach.metadata?.aliases || []), ...(beach.aliases || [])].filter(Boolean);
    const keys = [...new Set(names.flatMap(keysOf).filter(Boolean))];
    list.push({ ...entry, keys, names });
  }
  return list;
};

const matchSeed = (seedRow, candidates) => {
  const seedKeys = [...new Set([...keysOf(seedRow.nameGr || ''), ...keysOf(seedRow.nameEn || '')].filter(Boolean))];
  const scored = [];
  for (const cand of candidates) {
    if (!regionMatches(seedRow.region, cand.region, cand.subName, cand.subSubName)) continue;
    let best = 0;
    for (const sk of seedKeys) {
      for (const k of cand.keys) best = Math.max(best, diceScore(sk, k));
    }
    if (best > 0) scored.push({ cand, score: best });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 4);
};

const expandAmenities = (seedRow) => {
  const out = {};
  for (const key of AMENITY_KEYS) {
    if (seedRow.full) { out[key] = 'yes'; continue; }
    out[key] = seedRow[key] || 'unknown';
  }
  return out;
};

const buildSeatracRecord = (seedRow) => {
  const amenities = expandAmenities(seedRow);
  const fullSet = AMENITY_KEYS.every((k) => amenities[k] === 'yes' || amenities[k] === 'seasonal');
  return {
    hasSeatrac: true,
    status: seedRow.status || 'listed-unverified',
    seasonal: true,
    amenities,
    fullSet,
    source: SOURCE_LABEL,
    sourceUrls: seedRow.sourceUrls && seedRow.sourceUrls.length ? seedRow.sourceUrls : ['https://seatrac.gr/'],
    verifiedAt: VERIFIED_AT,
    confidence: seedRow.status === 'online' ? 'medium' : 'low',
    needsVerification: true,
    region: seedRow.region,
    ...(seedRow.notes ? { notes: seedRow.notes } : {}),
  };
};

// ----------------------- MATCH MODE -----------------------
const runMatch = () => {
  const seed = loadJson(SEED);
  const data = loadJson(DATA);
  const candidates = buildCandidates(data);

  const confident = [];
  const ambiguous = [];
  const noMatch = [];

  for (const row of seed.beaches) {
    const top = matchSeed(row, candidates);
    const summary = (m) => ({
      id: m.cand.beach.id,
      name: m.cand.beach.name,
      region: m.cand.region,
      sub: m.cand.subName,
      subSub: m.cand.subSubName,
      score: m.score,
    });
    if (top.length && top[0].score >= CONFIDENT && (top.length === 1 || top[0].score - top[1].score >= 6)) {
      confident.push({ seed: row, decision: 'accept', chosenId: top[0].cand.beach.id, candidates: top.map(summary) });
    } else if (top.length && top[0].score >= AMBIGUOUS) {
      ambiguous.push({ seed: row, decision: 'PICK_ONE', chosenId: null, candidates: top.map(summary) });
    } else {
      noMatch.push({ seed: row, decision: 'no-match (Phase D2 candidate)', candidates: top.map(summary) });
    }
  }

  const report = {
    _meta: {
      generatedAt: new Date().toISOString(),
      seedCount: seed.beaches.length,
      confident: confident.length,
      ambiguous: ambiguous.length,
      noMatch: noMatch.length,
      instructions: "Review each entry. For 'confident': verify chosenId or set to null to skip. For ambiguous (PICK_ONE): set chosenId to the correct candidate id, or null to skip. 'no-match': leave for Phase D2. Then run: node scripts/importSeatracAccessibility.mjs apply",
      thresholds: { CONFIDENT, AMBIGUOUS },
    },
    confident,
    ambiguous,
    noMatch,
  };

  mkdirSync(dirname(REPORT.pathname.replace(/^\//, '')), { recursive: true });
  writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`Seed: ${seed.beaches.length} | confident: ${confident.length} | ambiguous: ${ambiguous.length} | no-match: ${noMatch.length}`);
  console.log(`Wrote adjudication report -> ${REPORT.pathname.replace(/^\//, '')}`);
  console.log('Review it, then run: node scripts/importSeatracAccessibility.mjs apply');
};

// ----------------------- APPLY MODE -----------------------
const runApply = () => {
  let report;
  try { report = loadJson(REPORT); } catch {
    console.error('No adjudication report found. Run `match` first, then review it.');
    process.exit(1);
  }
  const data = loadJson(DATA);
  const byId = new Map();
  for (const { beach } of iterBeaches(data)) byId.set(beach.id, beach);

  const decisions = [...(report.confident || []), ...(report.ambiguous || [])]
    .filter((e) => Number.isInteger(e.chosenId));

  let applied = 0;
  const skipped = [];
  for (const entry of decisions) {
    const beach = byId.get(entry.chosenId);
    if (!beach || !beach.metadata) { skipped.push({ id: entry.chosenId, why: 'id not found / no metadata' }); continue; }
    const record = buildSeatracRecord(entry.seed);
    record.match = {
      officialNameGr: entry.seed.nameGr,
      officialNameEn: entry.seed.nameEn,
      matchMethod: 'greeklish-dice+manual',
      matchScore: entry.candidates?.[0]?.score ?? 0,
    };
    beach.metadata.seatrac = record;
    applied += 1;
  }

  writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Applied metadata.seatrac to ${applied} beach(es). Skipped: ${skipped.length}`);
  if (skipped.length) console.log(JSON.stringify(skipped, null, 2));
  console.log('Next: rebuild app data -> node scripts/buildBeachRegionData.mjs ; then npm run lint && npm run quality:beach-data');
};

const mode = process.argv[2];
if (mode === 'match') runMatch();
else if (mode === 'apply') runApply();
else { console.error('Usage: node scripts/importSeatracAccessibility.mjs <match|apply>'); process.exit(1); }
