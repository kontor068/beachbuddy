/**
 * Stage 0 + Stage 1a of the geometry-classifier review (2026-07-13).
 *
 * PROBLEM: computeDirectionalExposure (utils/geospatialExposureModel.ts) combines fetch and
 * blockedRayRatio as `openness = saturation + (1-saturation) * (1-blockedRayRatio)`. When a
 * sector's rays are fully blocked (blockedRayRatio=1) and fetchKm is below the 8km ramp start,
 * openness collapses to 0 and the fetch term drops out of the intensity formula entirely:
 * intensity = 60 * onshoreFactor, independent of fetchKm. A sector with 0.04 km fetch and one
 * with 7.9 km fetch (both fully "blocked" per the 5-ray fan) score identically.
 *
 * STAGE 0 measures how often this collapse happens and splits it by how much fetch is actually
 * being discarded (most collapses are beaches with genuinely ~0 fetch, where there is nothing to
 * discard — the harmful subset is collapses where a MEANINGFUL fetch, one that would classify
 * differently if honoured, gets thrown away).
 *
 * STAGE 1a is an internal oracle: for the same stored raw inputs, compute a wave height via the
 * SMB fetch-limited model already used elsewhere in the app (utils/waveModel.ts,
 * estimateFetchLimitedWaveHeightM) at representative wind speeds, and classify it into the app's
 * own existing wave-height vocabulary (utils/waveScale.ts calm/amber/rough breakpoints: 0.3 / 0.8 m
 * — the same numbers already shown to users). Where the intensity classifier and the SMB-derived
 * classification disagree, especially in the collapse zone, that is a measurable, reproducible
 * signal for the eventual redesign — NOT a redesign itself. This script changes nothing; it only
 * measures, against the exact functions the app ships (no formula duplication/drift).
 *
 * Run via wrapper: node scripts/auditFetchIntensityDivergence.mjs [--json <out>]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { computeDirectionalExposure } from '../utils/geospatialExposureModel';
import { estimateFetchLimitedWaveHeightM } from '../utils/waveModel';

const parseArgValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};
const jsonOutPath = parseArgValue('--json') || '.tmp/geospatial/fetch-intensity-divergence.json';
// Full (untruncated) harmful-collapse set — consumed by Stage 1b (auditFetchIntensityLiveOracle)
// to sample real beaches for a live marine-data comparison.
const harmfulOutPath = parseArgValue('--harmful-json') || '.tmp/geospatial/harmful-collapse-full.json';

const exposureDir = path.join(process.cwd(), 'public', 'data', 'geospatial', 'exposure');

// Same 8/12 km boundary as the runtime classifier (utils/windExposureEngine.ts
// GEOMETRY_EXPOSURE_ESCALATION_FETCH_KM / geospatialExposureModel.ts OPENNESS_RAMP_START_KM):
// a sector's blockage discount is fully in force below this fetch.
const COLLAPSE_FETCH_CEILING_KM = 8;
// A collapse only matters if the discarded fetch was long enough to plausibly change the
// classification once honoured — short fetch has ~nothing to discard regardless.
const MEANINGFUL_FETCH_FLOOR_KM = 4;
// Onshore component threshold: only a wind blowing meaningfully toward the beach (not
// along-shore or offshore) can turn discarded fetch into a real wave at the shore. Matches the
// same onshoreFactor gate the intensity formula itself already applies.
const MEANINGFUL_ONSHORE_FLOOR = 0.2;

// Representative reference winds, one per Beaufort — km/h midpoints of the app's own
// getBeaufortLevel buckets (utils/weatherUtils.ts). The stored sector intensity is wind-speed
// independent (geometry only), so the SMB comparison is run at all three to see whether the
// disagreement is a strength-invariant geometry problem (present at every wind) or only shows up
// once the wind is already strong enough that it barely matters.
const REFERENCE_WINDS_KMH: Record<string, number> = { bft4: 24, bft5: 33, bft6: 44 };

// The app's OWN existing user-facing wave-height vocabulary (utils/waveScale.ts bucketFor +
// utils/seaConditions.ts measuredWaveScore breakpoints), reused here instead of inventing new
// thresholds: <0.3 m reads "calm/ankle", 0.3-0.8 m "amber/knee", >=0.8 m "amber/waist"+.
type WaveLevel = 'protected' | 'partial' | 'exposed';
const waveLevelOf = (hsM: number): WaveLevel => (hsM >= 0.8 ? 'exposed' : hsM >= 0.3 ? 'partial' : 'protected');
const LEVEL_RANK: Record<WaveLevel, number> = { protected: 0, partial: 1, exposed: 2 };
// A disagreement is only "under-warn" (the dangerous direction — a beach reads calmer than the
// physical estimate) when the STORED level is LESS severe than the SMB level. The reverse
// ("over-caution", stored MORE severe than SMB — a beach reads rougher than physically expected)
// is the safe direction and must be reported separately: conflating the two would hide which
// one actually matters for the review's conclusion.
type Direction = 'under_warn' | 'over_caution' | 'mixed_across_winds';
const disagreementDirection = (storedLevel: WaveLevel, smbByWind: Record<string, { level: WaveLevel }>): Direction | undefined => {
  const smbLevels = Object.values(smbByWind).map(v => v.level);
  if (smbLevels.length === 0) return undefined;
  const storedRank = LEVEL_RANK[storedLevel];
  const allUnderWarn = smbLevels.every(l => storedRank < LEVEL_RANK[l]);
  const allOverCaution = smbLevels.every(l => storedRank > LEVEL_RANK[l]);
  if (allUnderWarn) return 'under_warn';
  if (allOverCaution) return 'over_caution';
  return 'mixed_across_winds';
};

// SMB itself has no "angle of approach" term (it assumes the wind blows straight down the fetch
// axis onto the point of interest), so a beach's exposure to a fetch-limited sea also depends on
// how obliquely the wind hits the shore — a physical effect this audit approximates but does not
// know the true shape of, so BOTH plausible scalings are computed and reported side by side
// rather than picking one and presenting it as settled:
//  - 'raw': no attenuation beyond the app's own onshore>0 gate (wind blows meaningfully toward
//    the beach at all -> full fetch-limited Hs). Upper bound.
//  - 'onshoreScaled': Hs * onshore (0 at grazing incidence, 1 at dead-on). Lower bound.
// A v1 pass using only 'raw' produced an under-warn signal concentrated entirely at onshore<=0.1
// (near-grazing, not really "onshore") — an artifact of missing this attenuation, not a finding
// about the app. The gap between 'raw' and 'onshoreScaled' below IS the finding: this internal
// oracle is too sensitive to an unresolved physical assumption to settle the direction question
// alone, which is exactly why Stage 1b (live marine data) is needed as a tiebreaker.
type SmbVariant = 'raw' | 'onshoreScaled';
const SMB_VARIANTS: SmbVariant[] = ['raw', 'onshoreScaled'];

interface SectorRow {
  regionId: string;
  beachId: number;
  name: string;
  lat?: number;
  lon?: number;
  sector: string;
  fetchKm: number;
  blockedRayRatio: number;
  onshore: number;
  storedIntensity: number;
  storedLevel: WaveLevel;
  recomputedIntensity: number;
  recomputedLevel: WaveLevel;
  parityOk: boolean;
  collapsed: boolean;
  smb: Record<SmbVariant, Record<string, { hsM: number; level: WaveLevel }>>;
  disagreesAtAllWinds: Record<SmbVariant, boolean>;
  direction: Record<SmbVariant, Direction | undefined>;
}

let beaches = 0;
let facingSet = 0;
let facingNull = 0;
let intensitySectors = 0;
let parityMismatches = 0;
let blocked1 = 0;
let collapsed = 0;
const collapseByFetchBand: Record<string, number> = { '<1': 0, '1-2': 0, '2-4': 0, '4-6': 0, '6-8': 0 };

const harmfulRows: SectorRow[] = []; // collapsed & fetch >= MEANINGFUL_FETCH_FLOOR_KM & onshore >= MEANINGFUL_ONSHORE_FLOOR
const allDisagreeRows: Record<SmbVariant, SectorRow[]> = { raw: [], onshoreScaled: [] };
const underWarnRows: Record<SmbVariant, SectorRow[]> = { raw: [], onshoreScaled: [] };
const overCautionRows: Record<SmbVariant, SectorRow[]> = { raw: [], onshoreScaled: [] };

for (const file of readdirSync(exposureDir).sort()) {
  if (!file.endsWith('.json') || file === 'index.json') continue;
  const regionId = file.replace(/\.json$/, '');
  const payload = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')) as {
    profiles?: Record<string, {
      beachId: number;
      name?: string | { en?: string; gr?: string };
      coordinates?: { lat?: number; lon?: number };
      facingDeg?: number | null;
      sectors?: Record<string, { level: WaveLevel; fetchKm: number; blockedRayRatio: number; onshore?: number; intensity?: number }>;
    }>;
  };

  for (const profile of Object.values(payload.profiles || {})) {
    beaches += 1;
    if (profile.facingDeg === null || profile.facingDeg === undefined) facingNull += 1;
    else facingSet += 1;
    const name = typeof profile.name === 'string' ? profile.name : (profile.name?.en || profile.name?.gr || '');

    for (const [sector, s] of Object.entries(profile.sectors || {})) {
      if (typeof s.onshore !== 'number' || typeof s.intensity !== 'number') continue; // fallback path, no intensity — out of scope
      intensitySectors += 1;

      const recomputed = computeDirectionalExposure({ fetchKm: s.fetchKm, blockedRayRatio: s.blockedRayRatio, onshore: s.onshore });
      const parityOk = Math.abs(recomputed.intensity - s.intensity) < 0.15 && recomputed.level === s.level;
      if (!parityOk) parityMismatches += 1;

      if (s.blockedRayRatio >= 1) blocked1 += 1;
      const isCollapsed = s.blockedRayRatio >= 1 && s.fetchKm < COLLAPSE_FETCH_CEILING_KM;
      if (isCollapsed) {
        collapsed += 1;
        if (s.fetchKm < 1) collapseByFetchBand['<1'] += 1;
        else if (s.fetchKm < 2) collapseByFetchBand['1-2'] += 1;
        else if (s.fetchKm < 4) collapseByFetchBand['2-4'] += 1;
        else if (s.fetchKm < 6) collapseByFetchBand['4-6'] += 1;
        else collapseByFetchBand['6-8'] += 1;
      }

      // SMB comparison only makes physical sense for a meaningfully onshore wind — an offshore
      // or along-shore wind keeps the swimming area flat regardless of fetch, which is a design
      // choice this audit is not questioning (see review §-onshore-gate).
      const smb: SectorRow['smb'] = { raw: {}, onshoreScaled: {} };
      const disagreeCount: Record<SmbVariant, number> = { raw: 0, onshoreScaled: 0 };
      let windCount = 0;
      if (s.onshore > 0) {
        for (const [key, windKmh] of Object.entries(REFERENCE_WINDS_KMH)) {
          const hsRawM = estimateFetchLimitedWaveHeightM({ windSpeedKmh: windKmh, fetchKm: s.fetchKm });
          windCount += 1;
          for (const variant of SMB_VARIANTS) {
            const hsM = variant === 'raw' ? hsRawM : Number((hsRawM * Math.max(0, s.onshore)).toFixed(2));
            const level = waveLevelOf(hsM);
            smb[variant][key] = { hsM, level };
            if (level !== s.level) disagreeCount[variant] += 1;
          }
        }
      }

      const row: SectorRow = {
        regionId, beachId: profile.beachId, name,
        lat: profile.coordinates?.lat, lon: profile.coordinates?.lon,
        sector,
        fetchKm: s.fetchKm, blockedRayRatio: s.blockedRayRatio, onshore: s.onshore,
        storedIntensity: s.intensity, storedLevel: s.level,
        recomputedIntensity: recomputed.intensity, recomputedLevel: recomputed.level, parityOk,
        collapsed: isCollapsed,
        smb,
        disagreesAtAllWinds: {
          raw: windCount > 0 && disagreeCount.raw === windCount,
          onshoreScaled: windCount > 0 && disagreeCount.onshoreScaled === windCount,
        },
        direction: { raw: undefined, onshoreScaled: undefined },
      };
      for (const variant of SMB_VARIANTS) {
        row.direction[variant] = disagreementDirection(row.storedLevel, row.smb[variant]);
      }

      if (isCollapsed && s.fetchKm >= MEANINGFUL_FETCH_FLOOR_KM && s.onshore >= MEANINGFUL_ONSHORE_FLOOR) {
        harmfulRows.push(row);
      }
      for (const variant of SMB_VARIANTS) {
        if (!row.disagreesAtAllWinds[variant]) continue;
        allDisagreeRows[variant].push(row);
        if (row.direction[variant] === 'under_warn') underWarnRows[variant].push(row);
        else if (row.direction[variant] === 'over_caution') overCautionRows[variant].push(row);
      }
    }
  }
}

const pct = (n: number, d: number): string => (d === 0 ? '0.0%' : `${(100 * n / d).toFixed(1)}%`);

const report = {
  generatedAt: new Date().toISOString(),
  purpose: 'Stage 0 (collapse measurement) + Stage 1a (internal SMB oracle) for the geometry-classifier review — measurement only, no model change.',
  inventory: { beaches, facingSet, facingNull, facingNullPct: pct(facingNull, beaches) },
  parity: {
    intensitySectors,
    parityMismatches,
    note: 'parityMismatches must be 0 — it means the stored data no longer matches computeDirectionalExposure (stale rebuild).',
  },
  stage0_collapse: {
    blocked1, blocked1Pct: pct(blocked1, intensitySectors),
    collapsed, collapsedPct: pct(collapsed, intensitySectors),
    collapseByFetchBand,
    harmfulCount: harmfulRows.length,
    harmfulPct: pct(harmfulRows.length, intensitySectors),
    harmfulDefinition: `blockedRayRatio>=1 AND fetchKm<${COLLAPSE_FETCH_CEILING_KM} AND fetchKm>=${MEANINGFUL_FETCH_FLOOR_KM} AND onshore>=${MEANINGFUL_ONSHORE_FLOOR}`,
  },
  stage1a_smb_oracle: {
    referenceWindsKmh: REFERENCE_WINDS_KMH,
    waveLevelThresholdsM: { protectedBelow: 0.3, exposedAtOrAbove: 0.8 },
    // Two variants bracket the unresolved "angle of approach" attenuation (see SMB_VARIANTS
    // comment above): 'raw' is the upper bound (no attenuation beyond onshore>0 gate),anything
    // 'onshoreScaled' is the lower bound (Hs * onshore). Direction matters within each variant:
    // under_warn is the dangerous one (stored reads calmer than the physical estimate). The GAP
    // between the two variants' verdicts is itself the finding — this internal oracle alone
    // cannot settle the direction question, which motivates Stage 1b (live marine data).
    variants: Object.fromEntries(SMB_VARIANTS.map(variant => [variant, {
      disagreesAtAllWindsCount: allDisagreeRows[variant].length,
      disagreesAtAllWindsPct: pct(allDisagreeRows[variant].length, intensitySectors),
      underWarnCount: underWarnRows[variant].length,
      underWarnPct: pct(underWarnRows[variant].length, intensitySectors),
      overCautionCount: overCautionRows[variant].length,
      overCautionPct: pct(overCautionRows[variant].length, intensitySectors),
      harmfulAndUnderWarn: harmfulRows.filter(r => r.direction[variant] === 'under_warn').length,
    }])),
    note: 'disagreesAtAllWinds = the intensity classifier and the SMB height classifier disagree at every one of the 4/5/6 Bft reference winds (strength-invariant disagreement, not a borderline single-wind artifact). under_warn/over_caution split by whether the stored level is less/more severe than the SMB level.',
  },
  harmfulExamples: harmfulRows.slice(0, 30),
  underWarnExamples: {
    raw: underWarnRows.raw.slice(0, 20),
    onshoreScaled: underWarnRows.onshoreScaled.slice(0, 20),
  },
  overCautionExamples: {
    raw: overCautionRows.raw.slice(0, 10),
    onshoreScaled: overCautionRows.onshoreScaled.slice(0, 10),
  },
};

writeFileSync(jsonOutPath, `${JSON.stringify(report, null, 1)}\n`, 'utf8');
writeFileSync(harmfulOutPath, `${JSON.stringify(harmfulRows.map(r => ({
  regionId: r.regionId, beachId: r.beachId, name: r.name, lat: r.lat, lon: r.lon, sector: r.sector,
  fetchKm: r.fetchKm, blockedRayRatio: r.blockedRayRatio, onshore: r.onshore,
  storedIntensity: r.storedIntensity, storedLevel: r.storedLevel,
})), null, 1)}\n`, 'utf8');

console.log(`beaches=${beaches} facingSet=${facingSet} facingNull=${facingNull} (${report.inventory.facingNullPct})`);
console.log(`intensitySectors=${intensitySectors} parityMismatches=${parityMismatches}`);
console.log(`blocked1=${blocked1} (${report.stage0_collapse.blocked1Pct})  collapsed=${collapsed} (${report.stage0_collapse.collapsedPct})`);
console.log(`collapseByFetchBand=${JSON.stringify(collapseByFetchBand)}`);
console.log(`harmful (collapsed, fetch>=${MEANINGFUL_FETCH_FLOOR_KM}km, onshore>=${MEANINGFUL_ONSHORE_FLOOR})=${harmfulRows.length} (${report.stage0_collapse.harmfulPct})`);
for (const variant of SMB_VARIANTS) {
  const v = report.stage1a_smb_oracle.variants[variant];
  console.log(`SMB[${variant}] disagrees at ALL winds=${allDisagreeRows[variant].length} (${v.disagreesAtAllWindsPct})`);
  console.log(`  under_warn (DANGEROUS)=${underWarnRows[variant].length} (${v.underWarnPct}), harmful-collapse overlap=${v.harmfulAndUnderWarn}`);
  console.log(`  over_caution (safe)=${overCautionRows[variant].length} (${v.overCautionPct})`);
}
console.log(`Report written: ${jsonOutPath}`);

if (parityMismatches > 0) {
  console.error(`WARNING: ${parityMismatches} stored sectors do not match a live recompute of computeDirectionalExposure — the committed data may be stale relative to the current formula.`);
  process.exitCode = 1;
}
