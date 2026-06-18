// Paid-entry importer ("you pay to be here") — hybrid OSM + manual, human-adjudicated.
//
//   node scripts/importPaidEntry.mjs match   # match both seeds -> dataset, write adjudication report
//   node scripts/importPaidEntry.mjs apply    # read REVIEWED report, write metadata.paidEntry
//
// Seeds:   scripts/data/paid-beaches-osm.json  (OSM candidates from harvestPaidBeachesOsm.mjs)
//          scripts/data/paid-entry-seed.json   (hand-authored, well-known cases)
// Report:  reports/paid-entry/adjudication.json  (machine-proposed; a human reviews before apply)
// Target:  public/greek_beaches.json
//
// SAFETY: we publicly tell people "this beach charges". The dangerous error is the false
// positive (a free beach flagged paid). So nothing is applied without an explicit chosenId
// in the reviewed report, every applied record carries needsVerification:true, and apply is
// idempotent — it recomputes from the report and clears a stale flag this pipeline wrote.
// Mirrors scripts/importSeatracAccessibility.mjs (match/apply, greeklish-dice) and adds
// coordinate proximity (the OSM candidates have coordinates, seatrac did not).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { distanceMeters } from './lib/placeResolution.mjs';

const OSM_SEED = new URL('./data/paid-beaches-osm.json', import.meta.url);
const MANUAL_SEED = new URL('./data/paid-entry-seed.json', import.meta.url);
const REPORT = new URL('../reports/paid-entry/adjudication.json', import.meta.url);
const DATA = new URL('../public/greek_beaches.json', import.meta.url);

const SOURCE_MANUAL = 'CalmBeach paid-entry research compilation (June 2026)';
const SOURCE_OSM = 'OpenStreetMap (leisure=beach_resort / fee / access tags)';
const VERIFIED_AT = '2026-06-17';
const KIND_PRIORITY = { entrance_fee: 3, private_club: 2, sunbed_required: 1 };

// Score thresholds (0-100). >=CONFIDENT single candidate => auto-proposed; >=AMBIGUOUS => human pick.
const CONFIDENT = 88;
const AMBIGUOUS = 72;
// A fee=yes (entrance_fee) OSM candidate is only auto-accepted when its NAME matches the beach
// (the paid thing IS the beach, not a differently-named bar projected onto a free beach). An
// access=private/customers signal (private_club) is reliable on its own, so it skips this gate.
const NAME_GATE = 70;

// --- Greek-aware normalization (self-contained; mirrors importSeatracAccessibility.mjs) ---
const GREEK_MAP = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k',
  λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't',
  υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
};
const stripAccents = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ');
const greeklish = (v) => stripAccents(v).toLowerCase().split('').map((c) => GREEK_MAP[c] ?? c).join('');
const baseKey = (v) => greeklish(v).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const coreKey = (v) => baseKey(v).replace(/\b(paralia|akti|beach|plaz)\b/g, ' ').replace(/\s+/g, ' ').trim();
const keysOf = (v) => {
  const full = baseKey(v);
  const core = coreKey(v);
  return core && core !== full ? [full, core] : [full];
};
const normKey = (v) => coreKey(v) || baseKey(v);

// Dice coefficient on bigrams — robust to small spelling differences.
const sizeOf = (m) => { let n = 0; for (const v of m.values()) n += v; return n; };
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

// Proximity → score. The OSM/manual candidate sits on the same beach when very close.
const proximityScore = (seedCoord, beach) => {
  if (!seedCoord || !Number.isFinite(beach.lat) || !Number.isFinite(beach.lon)) return { score: 0, meters: null };
  const m = distanceMeters(seedCoord, { lat: beach.lat, lon: beach.lon });
  if (!Number.isFinite(m)) return { score: 0, meters: null };
  const score = m <= 150 ? 100 : m <= 400 ? 92 : m <= 800 ? 82 : m <= 1500 ? 60 : 0;
  return { score, meters: Math.round(m) };
};

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
const tryLoad = (url) => { try { return loadJson(url); } catch { return null; } };

// Normalize both seeds into one shape: { nameGr, nameEn?, region?, coordinates?, kind, priceText?,
// amount?, currency?, sourceUrls?, osmUrl?, notes?, source, expectId? }
const loadSeeds = () => {
  const rows = [];
  const manual = tryLoad(MANUAL_SEED);
  if (manual?.beaches) for (const r of manual.beaches) rows.push({ ...r, source: r.source || 'manual' });
  const osm = tryLoad(OSM_SEED);
  if (Array.isArray(osm)) for (const r of osm) {
    rows.push({
      nameGr: r.name,
      nameEn: r.nameEn,
      coordinates: r.coordinates,
      kind: r.kind,
      priceText: r.priceText,
      sourceUrls: r.sourceUrls,
      osmUrl: r.osmUrl,
      source: 'osm',
    });
  }
  return rows;
};

const buildCandidates = (data) => {
  const list = [];
  for (const entry of iterBeaches(data)) {
    const { beach } = entry;
    const names = [beach.name, ...(beach.metadata?.aliases || []), ...(beach.aliases || [])].filter(Boolean);
    const keys = [...new Set(names.flatMap(keysOf).filter(Boolean))];
    list.push({ ...entry, keys });
  }
  return list;
};

const matchSeed = (seedRow, candidates) => {
  const seedKeys = [...new Set([...keysOf(seedRow.nameGr || ''), ...keysOf(seedRow.nameEn || '')].filter(Boolean))];
  const scored = [];
  for (const cand of candidates) {
    if (!regionMatches(seedRow.region, cand.region, cand.subName, cand.subSubName)) continue;
    let nameScore = 0;
    for (const sk of seedKeys) for (const k of cand.keys) nameScore = Math.max(nameScore, diceScore(sk, k));
    const prox = proximityScore(seedRow.coordinates, cand.beach);
    const score = Math.max(nameScore, prox.score);
    if (score > 0) scored.push({ cand, score, nameScore, proxMeters: prox.meters });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 4);
};

const summarizeCand = (m) => ({
  id: m.cand.beach.id,
  name: m.cand.beach.name,
  region: m.cand.region,
  sub: m.cand.subName,
  subSub: m.cand.subSubName,
  score: m.score,
  nameScore: m.nameScore,
  proxMeters: m.proxMeters,
});

// ----------------------- MATCH MODE -----------------------
const runMatch = () => {
  const seeds = loadSeeds();
  if (!seeds.length) {
    console.error('No seed rows. Run `node scripts/harvestPaidBeachesOsm.mjs` and/or author scripts/data/paid-entry-seed.json first.');
    process.exit(1);
  }
  const data = loadJson(DATA);
  const candidates = buildCandidates(data);
  const idSet = new Set();
  for (const c of candidates) idSet.add(c.beach.id);

  const confident = [];
  const ambiguous = [];
  const noMatch = [];

  for (const row of seeds) {
    // Manual rows can pin a known dataset id directly — deterministic, skip fuzzy ambiguity.
    if (Number.isInteger(row.expectId) && idSet.has(row.expectId)) {
      confident.push({ seed: row, decision: 'accept', chosenId: row.expectId, method: 'manual-pin', candidates: [] });
      continue;
    }
    const top = matchSeed(row, candidates);
    // private_club here is always access-derived (reliable); entrance_fee must also clear the name gate.
    const passesNameGate = row.kind === 'private_club' || (top[0] && top[0].nameScore >= NAME_GATE);
    if (top.length && top[0].score >= CONFIDENT && (top.length === 1 || top[0].score - top[1].score >= 6) && passesNameGate) {
      confident.push({ seed: row, decision: 'accept', chosenId: top[0].cand.beach.id, method: 'greeklish-dice+proximity', candidates: top.map(summarizeCand) });
    } else if (top.length && top[0].score >= AMBIGUOUS) {
      ambiguous.push({ seed: row, decision: 'PICK_ONE', chosenId: null, candidates: top.map(summarizeCand) });
    } else {
      noMatch.push({ seed: row, decision: 'no-match', candidates: top.map(summarizeCand) });
    }
  }

  const report = {
    _meta: {
      generatedAt: new Date().toISOString(),
      seedCount: seeds.length,
      confident: confident.length,
      ambiguous: ambiguous.length,
      noMatch: noMatch.length,
      instructions: "Review each entry. 'confident': verify chosenId or set null to skip. ambiguous (PICK_ONE): set chosenId to the correct candidate id, or null to skip. 'no-match': set chosenId if you know it, else leave. Then run: node scripts/importPaidEntry.mjs apply",
      thresholds: { CONFIDENT, AMBIGUOUS },
    },
    confident,
    ambiguous,
    noMatch,
  };

  mkdirSync(dirname(REPORT.pathname.replace(/^\//, '')), { recursive: true });
  writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`Seeds: ${seeds.length} | confident: ${confident.length} | ambiguous: ${ambiguous.length} | no-match: ${noMatch.length}`);
  console.log(`Wrote adjudication report -> ${REPORT.pathname.replace(/^\//, '')}`);
  console.log('Review it, then run: node scripts/importPaidEntry.mjs apply');
};

const buildPaidEntryRecord = (seedRow, matchScore, method) => ({
  paid: true,
  kind: seedRow.kind,
  ...(seedRow.priceText ? { priceText: seedRow.priceText } : {}),
  ...(Number.isFinite(seedRow.amount) ? { amount: seedRow.amount } : {}),
  ...(seedRow.currency ? { currency: seedRow.currency } : {}),
  source: seedRow.source === 'manual' ? SOURCE_MANUAL : SOURCE_OSM,
  ...(seedRow.sourceUrls?.length ? { sourceUrls: seedRow.sourceUrls } : {}),
  ...(seedRow.osmUrl ? { osmUrl: seedRow.osmUrl } : {}),
  verifiedAt: VERIFIED_AT,
  confidence: seedRow.source === 'manual' ? 'medium' : 'low',
  needsVerification: true,
  ...(seedRow.notes ? { notes: seedRow.notes } : {}),
  ...(seedRow.region ? { region: seedRow.region } : {}),
  match: { officialNameGr: seedRow.nameGr, officialNameEn: seedRow.nameEn, matchMethod: method, matchScore },
});

// Prefer the stronger claim when two rows resolve to the same beach: manual over osm, then
// entrance_fee > private_club > sunbed_required, then higher match score.
const stronger = (a, b) => {
  if ((a.seed.source === 'manual') !== (b.seed.source === 'manual')) return a.seed.source === 'manual' ? a : b;
  const ap = KIND_PRIORITY[a.seed.kind] || 0;
  const bp = KIND_PRIORITY[b.seed.kind] || 0;
  if (ap !== bp) return ap > bp ? a : b;
  return (a.matchScore || 0) >= (b.matchScore || 0) ? a : b;
};

// ----------------------- APPLY MODE -----------------------
const runApply = () => {
  const report = tryLoad(REPORT);
  if (!report) {
    console.error('No adjudication report found. Run `match` first, then review it.');
    process.exit(1);
  }
  const data = loadJson(DATA);
  const byId = new Map();
  for (const { beach } of iterBeaches(data)) byId.set(beach.id, beach);

  // Collect explicit decisions, dedup to the strongest claim per beach id.
  const chosen = new Map();
  for (const entry of [...(report.confident || []), ...(report.ambiguous || []), ...(report.noMatch || [])]) {
    if (!Number.isInteger(entry.chosenId)) continue;
    const matchScore = entry.candidates?.[0]?.score ?? (entry.method === 'manual-pin' ? 100 : 0);
    const cur = { seed: entry.seed, matchScore, method: entry.method || 'greeklish-dice+proximity' };
    const prev = chosen.get(entry.chosenId);
    chosen.set(entry.chosenId, prev ? stronger(prev, cur) : cur);
  }

  let applied = 0;
  let cleared = 0;
  const skipped = [];
  for (const { beach } of iterBeaches(data)) {
    if (!beach.metadata) {
      if (chosen.has(beach.id)) skipped.push({ id: beach.id, why: 'no metadata' });
      continue;
    }
    const pick = chosen.get(beach.id);
    if (pick) {
      beach.metadata.paidEntry = buildPaidEntryRecord(pick.seed, pick.matchScore, pick.method);
      applied += 1;
    } else if ('paidEntry' in beach.metadata) {
      const existing = beach.metadata.paidEntry;
      // Idempotent: only clear flags this pipeline wrote (don't touch hand-edits from elsewhere).
      if (existing && (existing.source === SOURCE_MANUAL || existing.source === SOURCE_OSM)) {
        delete beach.metadata.paidEntry;
        cleared += 1;
      }
    }
  }

  writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Applied metadata.paidEntry to ${applied} beach(es). Cleared stale: ${cleared}. Skipped: ${skipped.length}`);
  if (skipped.length) console.log(JSON.stringify(skipped, null, 2));
  console.log('Next: node scripts/buildBeachRegionData.mjs ; then npm run lint && npm run quality:beach-data');
};

const mode = process.argv[2];
if (mode === 'match') runMatch();
else if (mode === 'apply') runApply();
else { console.error('Usage: node scripts/importPaidEntry.mjs <match|apply>'); process.exit(1); }
