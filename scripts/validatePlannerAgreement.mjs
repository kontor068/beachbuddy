/**
 * validatePlannerAgreement.mjs — the trip planner's safety net.
 *
 * Runs planTrip over real region JSON with 6-day ROTATING-wind forecasts and
 * asserts the plan (a) never contradicts the homepage's safety gate, (b) never
 * claims shelter it cannot back, (c) is per-beach (not per-region), and
 * (d) is deterministic — not "whichever beach is first in the file".
 *
 * Written BEFORE the trust-phase implementation, so several checks are
 * CANARIES: they document today's defects and are EXPECTED to fail until the
 * corresponding step lands. A canary that fails prints as CANARY (expected);
 * a canary that PASSES prints as PASS (fixed). Non-canary failures are hard
 * failures at all times.
 *
 * Modes:
 *   node scripts/validatePlannerAgreement.mjs            # assertions; exit 1 on non-canary failure
 *   node scripts/validatePlannerAgreement.mjs --strict   # canaries count as failures too (post-implementation)
 *   node scripts/validatePlannerAgreement.mjs --report   # deterministic JSON dump of the plans, no assertions.
 *                                                        # Byte-diff this around the App.tsx extraction (step 4).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount = function () { return 0; };\nexports.trackEvent = function () {};\n', filename);
    return;
  }

  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const tripPlannerService = require('../services/tripPlannerService.ts');
const { planTrip } = tripPlannerService;
const recommendationService = require('../services/recommendationService.ts');
const {
  calculateBeachScore,
  filterBeachesByUserPreferences,
  hasHourlyRainRisk,
  isFalseProtectedTopPick,
} = recommendationService;
// The REAL thresholds and gate — imported, not mirrored, so the net can never
// drift from what the podium actually applies.
const {
  MAX_TOP_RECOMMENDATION_BEAUFORT,
  MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE,
  passesTopPickSeaGate,
} = require('../services/topPickRanking.ts');
const { calculateSeaConditionScore } = require('../utils/seaConditions.ts');
const { getBeaufortLevel } = require('../utils/weatherUtils.ts');
const { isNaturistBeach } = require('../utils/naturistBeaches.ts');

// ─── Scenarios: 6-day rotating winds ────────────────────────────────────────
// Beaufort → m/s midpoints; waves matched to the wind day (open-water values —
// per-beach shelter is exactly what the engine is supposed to apply on top).
const D = (deg, ms, gust, wave) => ({
  windDirectionDeg: deg, windSpeedMs: ms, windGustMs: gust, waveHeightM: wave, waveDirectionDeg: deg,
});

/**
 * A day whose wind CHANGES through the hours. Every other fixture here is flat
 * — one wind speed repeated at 08:00 and at 18:00 — which is fine for the
 * shelter assertions but makes the best-time window untestable: with no rise,
 * calculateBestBeachTime correctly returns nothing, so a "window is backed"
 * check over flat days passes without ever running. Measured: 0 of 18 picks
 * across the three rotating-meltemi scenarios carried a window.
 *
 * `ms(hour)` is the real Aegean shape — quiet morning, meltemi filling in after
 * lunch — which is exactly the case the feature exists for.
 */
const DH = (deg, msFn, wave) => ({
  windDirectionDeg: deg, windSpeedMs: msFn(13), windGustMs: msFn(13) * 1.35,
  waveHeightM: wave, waveDirectionDeg: deg, hourlyWindMs: msFn,
});
const MELTEMI_WEEK = [
  D(0, 9.5, 13.0, 1.4),   // N 5 Bft
  D(0, 12.5, 17.0, 2.0),  // N 6 Bft
  D(45, 6.5, 9.0, 0.7),   // NE 4 Bft
  D(180, 4.5, 6.5, 0.3),  // S 3 Bft
  D(225, 6.5, 9.0, 0.6),  // SW 4 Bft
  D(0, 9.5, 13.0, 1.4),   // N 5 Bft
];

const scenarios = {
  Halkidiki_ROTATING_MELTEMI: {
    targetRegionId: 'central-macedonia-halkidiki-mainland',
    days: MELTEMI_WEEK,
    // The big-region pool test: 133 beaches, unrated coves outside the top-40.
    highWind: true,
  },
  Naxos_ROTATING_MELTEMI: {
    targetRegionId: 'south-aegean-naxos',
    days: MELTEMI_WEEK,
    // The side-flip test: the sheltered side swings N → S mid-trip.
    highWind: true,
  },
  Corfu_W_4BFT: {
    targetRegionId: 'ionian-islands-corfu',
    days: Array.from({ length: 6 }, () => D(270, 6.5, 9.0, 0.6)),
    // The healthy mixed case: plenty of Tier A candidates.
    highWind: false,
  },
  Naxos_SEVERE_7BFT: {
    targetRegionId: 'south-aegean-naxos',
    days: Array.from({ length: 6 }, () => D(0, 15.5, 21.0, 2.8)),
    // Ceiling test: above MAX_TOP_RECOMMENDATION_BEAUFORT the podium shows
    // nothing, so the planner must answer "no beach day" too.
    highWind: true,
  },
  // THE 6 BFT HOLE (added 2026-07-28). The podium's ceiling is 6, but the
  // caution tier used to stop at 5 — so at exactly 6 Bft the normal bar was the
  // only bar and a whole meltemi week could come back blank. This scenario sits
  // squarely in that band and exists to keep the two limits equal for good.
  Naxos_SUSTAINED_6BFT: {
    targetRegionId: 'south-aegean-naxos',
    days: Array.from({ length: 6 }, () => D(0, 12.5, 17.0, 2.0)),
    highWind: true,
  },
  // THE INTRADAY BUILD (added 2026-07-29 with the best-time window). Quiet
  // morning, meltemi filling in after lunch — the only shape in this file where
  // the hour of the visit actually matters, and therefore the only one that can
  // exercise the window at all.
  Naxos_AFTERNOON_BUILD: {
    targetRegionId: 'south-aegean-naxos',
    days: Array.from({ length: 6 }, () => DH(0, hour => (hour <= 12 ? 3.2 : 9.0), 0.5)),
    highWind: false,
    expectsBestTimeWindow: true,
  },
};

// ─── Forecast construction (mirrors utils/weatherFixtures.ts shapes) ────────
const toDateKey = date => date.toISOString().slice(0, 10);
const swellOf = wave => Number(Math.max(0.2, wave * 0.35).toFixed(2));

const createForecastItem = (date, hour, day) => {
  const itemDate = new Date(date);
  itemDate.setHours(hour, 0, 0, 0);
  return {
    dt: Math.floor(itemDate.getTime() / 1000),
    main: { temp: hour < 10 || hour > 18 ? 23 : 26, temp_min: 22, temp_max: 26, pressure: 1014, sea_level: 1014, grnd_level: 1014, humidity: 58, temp_kf: 0 },
    weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
    clouds: { all: 5 },
    // Per-hour wind when the fixture defines a shape (see DH); flat otherwise.
    wind: {
      speed: day.hourlyWindMs ? day.hourlyWindMs(hour) : day.windSpeedMs,
      deg: day.windDirectionDeg,
      gust: (day.hourlyWindMs ? day.hourlyWindMs(hour) : day.windSpeedMs) * 1.35,
    },
    visibility: 10000,
    pop: 0,
    sys: { pod: 'd' },
    dt_txt: `${toDateKey(itemDate)} ${String(hour).padStart(2, '0')}:00:00`,
    marine: {
      waveHeightM: day.waveHeightM,
      waveDirectionDeg: day.waveDirectionDeg,
      wavePeriodS: day.waveHeightM >= 1 ? 5 : 4,
      swellWaveHeightM: swellOf(day.waveHeightM),
      swellWaveDirectionDeg: day.waveDirectionDeg,
      seaSurfaceTemperatureC: 23,
      source: 'open-meteo-marine',
    },
  };
};

const createDailyForecast = (dayOffset, day) => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(12, 0, 0, 0);
  const hourly = [8, 10, 12, 14, 16, 18, 20].map(hour => createForecastItem(date, hour, day));
  return {
    date,
    wind: { speed: day.windSpeedMs, deg: day.windDirectionDeg, gust: day.windGustMs },
    weather: { main: 'Clear', description: 'clear sky', icon: '01d' },
    temp_min: 22,
    temp_max: 26,
    hourly,
    marine: {
      waveHeightM: day.waveHeightM,
      waveDirectionDeg: day.waveDirectionDeg,
      wavePeriodS: day.waveHeightM >= 1 ? 5 : 4,
      swellWaveHeightM: swellOf(day.waveHeightM),
      swellWaveDirectionDeg: day.waveDirectionDeg,
      seaSurfaceTemperatureC: 23,
      source: 'open-meteo-marine',
    },
  };
};

const windSectors = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const isUsableGeneratedProfile = profile => {
  const levels = windSectors.map(sector => profile.sectors?.[sector]?.level);
  if (levels.some(level => !level)) return false;
  const allProtected = levels.every(level => level === 'protected');
  if (allProtected && (profile.facingDeg === null || profile.facingDeg === undefined)) return false;
  return true;
};

const loadGeospatialProfiles = regionId => {
  const dataPath = path.join(root, 'public', 'data', 'geospatial', 'exposure', `${regionId}.json`);
  const payload = JSON.parse(readFileSync(dataPath, 'utf8'));
  return Object.values(payload.profiles || {}).reduce((lookup, profile) => {
    if (!profile.beachId || !profile.sectors || !isUsableGeneratedProfile(profile)) return lookup;
    lookup[profile.beachId] = {
      beachId: profile.beachId,
      facingDeg: profile.facingDeg ?? null,
      sectors: profile.sectors,
      confidence: profile.confidence,
      source: profile.confidence === 'high' ? 'high-res-coastline' : 'natural-earth-baseline',
    };
    return lookup;
  }, {});
};

const loadRegionBeaches = regionId => {
  const dataPath = path.join(root, 'public', 'data', 'beaches', 'app', `${regionId}.json`);
  return JSON.parse(readFileSync(dataPath, 'utf8')).island.beaches;
};

// ─── The homepage's gates, per beach per day ────────────────────────────────
// The contract has TWO tiers, mirroring what the homepage itself does:
//
//   normal pick  -> must clear the podium's calm bar (passesTopPickSeaGate,
//                   not avoid_swimming, not false-protected).
//   caution pick -> allowed to FAIL that bar. When nothing is swimmable the
//                   homepage does not go silent either: it falls back to the
//                   least-exposed options (isNoIdealFallbackCandidate) under
//                   an honest heading, and the planner renders these with the
//                   "choppy" badge. Requiring the calm bar here blanked real
//                   days (Naxos, 4 Bft north, 0.82 m wave -> every beach on
//                   the island reads avoid_swimming).
//
// Both tiers still refuse the official do-not-swim override, wind-sport spots,
// exposed shores and anything above the podium's Beaufort ceiling.
const gateVerdict = (beach, dayForecast, geospatialProfiles) => {
  const windSpeedKmph = dayForecast.wind.speed * 3.6;
  const beaufort = getBeaufortLevel(windSpeedKmph);
  if (beaufort > MAX_TOP_RECOMMENDATION_BEAUFORT) return { calm: false, fallback: false };

  const score = calculateBeachScore(beach, dayForecast, undefined, undefined, {
    weatherSource: 'island-fallback',
    hourlyForecast: dayForecast.hourly,
    geospatialProfile: geospatialProfiles?.[beach.id],
  });
  if (score.score === 0) return { calm: false, fallback: false };
  if (isFalseProtectedTopPick(score, dayForecast.wind.deg, beaufort)) return { calm: false, fallback: false };

  const isExposed = score.exposureLevel ? score.exposureLevel !== 'protected' : true;
  // Decision value + period, mirroring the app. A reference built from the display height with no
  // period compares the app against a model it no longer runs, so the guard would pass on a
  // disagreement instead of catching one.
  const waveHeightM = score.seaStateWaveM ?? score.waveHeightM ?? dayForecast.marine?.waveHeightM;
  const wavePeriodS = score.seaStatePeriodS ?? dayForecast.marine?.wavePeriodS;
  const item = {
    isExposed,
    exposureLevel: score.exposureLevel,
    waveHeightM,
    seaStateWaveM: score.seaStateWaveM,
    seaStatePeriodS: score.seaStatePeriodS,
    hourlySeaScore: score.hourlySeaScore,
  };

  const hasHardExclusion = score.warnings?.some(w =>
    w.type === 'wind_sport_spot' || (w.type === 'exposed_to_wind' && score.exposureLevel === 'exposed'));
  const seaScore = calculateSeaConditionScore(isExposed, windSpeedKmph, score.exposureLevel, waveHeightM, false, wavePeriodS);
  const fallback = score.exposureLevel !== 'exposed'
    && seaScore >= MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE
    && !hasHardExclusion;

  const calm = score.swimmingComfort !== 'avoid_swimming'
    && passesTopPickSeaGate(item, windSpeedKmph, dayForecast.marine?.waveHeightM);

  return { calm, fallback };
};

// ─── Harness ────────────────────────────────────────────────────────────────
const results = [];
/** CANARY = documented defect, expected to fail until its step lands. */
const check = (scenarioId, name, ok, detail, { canary = false } = {}) => {
  results.push({ scenarioId, name, ok: Boolean(ok), canary, detail: ok ? undefined : detail });
};

const beachLabel = beach => beach?.name?.gr || beach?.name?.en || String(beach?.id);

const runScenario = (scenarioId, scenario) => {
  const beaches = loadRegionBeaches(scenario.targetRegionId);
  const geospatialProfiles = loadGeospatialProfiles(scenario.targetRegionId);
  const forecast = scenario.days.map((day, index) => createDailyForecast(index, day));

  const plan = planTrip({ beaches, forecast, days: forecast.length, language: 'gr', geospatialProfiles });
  const picks = plan.filter(entry => entry.status === 'beach' && entry.pick);

  // 1. Podium agreement, per tier: a normal pick must clear the calm bar; a
  //    caution pick must at least clear the homepage's own fallback bar.
  {
    const violations = [];
    for (const entry of plan) {
      const day = forecast[entry.dayIndex];
      for (const [role, pick] of [['pick', entry.pick], ['alternative', entry.alternative]]) {
        if (!pick) continue;
        const verdict = gateVerdict(pick.beach, day, geospatialProfiles);
        const ok = pick.caution ? verdict.fallback : verdict.calm;
        if (!ok) {
          violations.push(`day ${entry.dayIndex} ${role} ${beachLabel(pick.beach)}${pick.caution ? ' [caution]' : ''}`);
        }
      }
    }
    check(scenarioId, 'podium-agreement', violations.length === 0,
      `outside the gate for its tier: ${violations.join('; ')}`, { canary: true });
  }

  // 2. Claims need evidence: shelter whyKeys require earned protection.
  {
    const missingFields = picks.some(entry => entry.pick.whyKey === undefined || entry.pick.windBeaufort === undefined);
    if (missingFields) {
      check(scenarioId, 'claims-need-evidence', false,
        'TripPick lacks whyKey/windBeaufort — the "why" contract (step 6) has not landed', { canary: true });
    } else {
      const { hasTrustedWindEvidence } = recommendationService;
      const violations = picks.filter(entry => {
        const pick = entry.pick;
        if (pick.caution && pick.whyKey !== 'best_available') return true;
        if (pick.whyKey === 'sheltered' || pick.whyKey === 'cove_refuge') {
          if (!pick.canClaimWindProtection) return true;
          if (pick.windBeaufort < 3) return true;
          if (typeof hasTrustedWindEvidence === 'function' && !hasTrustedWindEvidence(pick, pick.windBeaufort)) return true;
        }
        return false;
      }).map(entry => `day ${entry.dayIndex} ${beachLabel(entry.pick.beach)} (${entry.pick.whyKey})`);
      check(scenarioId, 'claims-need-evidence', violations.length === 0,
        `unbacked shelter claims: ${violations.join('; ')}`);
    }
  }

  // 3. Per-beach STORY, not per-region (D1 canary; high-wind scenarios only).
  // NOTE the planner deliberately scores every beach with the REGION wind
  // (same decision as the homepage: per-beach cluster forecasts feed local
  // notes, never the headline — App.tsx:3667). The per-beach truth the UI
  // must show is therefore the EXPOSURE/WHY layer: on a windy rotating week
  // the picks must not all tell one identical story.
  if (scenario.highWind && picks.length >= 2) {
    const exposureLevels = new Set(picks.map(entry => entry.pick.exposureLevel).filter(Boolean));
    const hasShelterStory = picks.some(entry =>
      ['sheltered', 'cove_refuge', 'partial_shelter'].includes(entry.pick.whyKey));
    check(scenarioId, 'per-beach-story', exposureLevels.size >= 2 || hasShelterStory,
      `picks carry no per-beach exposure story (levels: ${[...exposureLevels].join(',') || 'none'}; whyKeys: ${picks.map(entry => entry.pick.whyKey).join(',')})`,
      { canary: true });
  }

  // 4. No duplicate assignment.
  {
    const pickIds = picks.filter(entry => !entry.isRepeat).map(entry => entry.pick.beach.id);
    const duplicatePicks = pickIds.length !== new Set(pickIds).size;
    const altViolations = plan.filter(entry => entry.alternative
      && picks.some(other => other.dayIndex !== entry.dayIndex && other.pick.beach.id === entry.alternative.beach.id))
      .map(entry => `day ${entry.dayIndex} alt ${beachLabel(entry.alternative.beach)}`);
    check(scenarioId, 'no-duplicate-assignment', !duplicatePicks && altViolations.length === 0,
      `${duplicatePicks ? 'duplicate non-repeat picks; ' : ''}alternatives already assigned elsewhere: ${altViolations.join('; ')}`,
      { canary: true });
  }

  // 5. Determinism: shuffling the input order must not change the plan (D12 canary).
  {
    const reversedPlan = planTrip({
      beaches: [...beaches].reverse(), forecast, days: forecast.length, language: 'gr', geospatialProfiles,
    });
    const key = entries => entries.map(entry => `${entry.dayIndex}:${entry.status}:${entry.pick?.beach.id ?? '-'}`).join('|');
    check(scenarioId, 'order-invariance', key(plan) === key(reversedPlan),
      `plan depends on input file order:\n  forward:  ${key(plan)}\n  reversed: ${key(reversedPlan)}`, { canary: true });
  }

  // 8. Policy: naturist beaches never appear (D13 canary).
  {
    const violations = plan.flatMap(entry => [entry.pick, entry.alternative]
      .filter(pick => pick && isNaturistBeach(pick.beach))
      .map(pick => `day ${entry.dayIndex} ${beachLabel(pick.beach)}`));
    check(scenarioId, 'no-naturist-beaches', violations.length === 0,
      `naturist beaches surfaced: ${violations.join('; ')}`, { canary: true });
  }

  // 9c. THE OFFSHORE-DRIFT LINE IS REACHABLE AND NEVER PREMATURE (29/07/2026).
  //
  // A shelter recommendation creates one hazard instead of avoiding it: the
  // cove's water is flat BECAUSE the wind comes over the land, and an offshore
  // wind carries floats out. ISO 20712-2 / ILS LPS-14 give that condition its
  // own signal (the orange windsock, "no inflatables"); the beach page has
  // warned about it since the cove card shipped, the planner did not until now.
  //
  // Two assertions, and the first one matters most: a safety line that quietly
  // stops firing is worse than one that was never written, because the docs
  // still claim it is there.
  {
    const beaufortOf = dayIndex => getBeaufortLevel((forecast[dayIndex].wind.speed ?? 0) * 3.6);
    const premature = picks
      .filter(entry => entry.pick.offshoreDrift && entry.pick.windBeaufort < 5)
      .map(entry => `day ${entry.dayIndex} ${beachLabel(entry.pick.beach)} at ${entry.pick.windBeaufort} Bft`);
    check(scenarioId, 'offshore-drift-never-below-5bft', premature.length === 0,
      `drift note on a light-wind day: ${premature.join('; ')}`);

    // Reachability, asserted only where it MUST fire: a sustained 6 Bft week
    // whose picks are protected beaches is the definition of the case.
    const strongDays = plan.filter(entry => entry.status === 'beach' && entry.pick && beaufortOf(entry.dayIndex) >= 6);
    if (strongDays.length >= 3) {
      const withNote = strongDays.filter(entry => entry.pick.offshoreDrift).length;
      check(scenarioId, 'offshore-drift-reachable', withNote > 0,
        `${strongDays.length} picks on 6+ Bft days and not one carries the drift note — the warning has stopped working`);
    }
  }

  // 8c. The best-time window is a CLAIM about the day, so it must be backed.
  {
    const bad = [];
    for (const entry of picks) {
      const { bestTimeStart, bestTimeEnd } = entry.pick;
      if (!bestTimeStart && !bestTimeEnd) continue;
      const label = `day ${entry.dayIndex} ${beachLabel(entry.pick.beach)}`;
      // Never half a window — a start with no end is not a claim, it is a bug.
      if (!bestTimeStart || !bestTimeEnd) { bad.push(`${label}: half a window (${bestTimeStart}-${bestTimeEnd})`); continue; }
      const toMinutes = value => {
        const match = /^(\d{1,2}):(\d{2})$/.exec(value);
        return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
      };
      const start = toMinutes(bestTimeStart);
      const end = toMinutes(bestTimeEnd);
      if (!Number.isFinite(start) || !Number.isFinite(end)) { bad.push(`${label}: unparseable ${bestTimeStart}-${bestTimeEnd}`); continue; }
      // The helper's own contract: inside the 10:00-18:00 beach day, and at
      // least two hours wide. A one-hour "best time" would be noise dressed up
      // as advice.
      if (start < 10 * 60 || end > 18 * 60) bad.push(`${label}: ${bestTimeStart}-${bestTimeEnd} outside the beach day`);
      else if (end - start < 120) bad.push(`${label}: ${bestTimeStart}-${bestTimeEnd} is under 2h`);
    }
    check(scenarioId, 'best-time-window-is-backed', bad.length === 0,
      `unbacked best-time windows: ${bad.join('; ')}`);

    // Reachability. Without this the check above is DECORATION: every other
    // fixture here holds one wind speed all day, so no window is ever produced
    // and "no bad windows" passes vacuously. Asserted only on the scenario
    // built to produce one.
    if (scenario.expectsBestTimeWindow) {
      const withWindow = picks.filter(entry => entry.pick.bestTimeStart).length;
      check(scenarioId, 'best-time-window-reachable', withWindow > 0,
        `${picks.length} picks on a morning-calm / afternoon-meltemi week and not one carries a window — the feature has stopped working`);
    }
  }

  // 9. Hard preference filters hold on every tier (D14 canary).
  {
    const preferences = { blueFlag2026: true };
    const filteredPlan = planTrip({ beaches, forecast, days: forecast.length, language: 'gr', preferences, geospatialProfiles });
    const violations = filteredPlan.flatMap(entry => [entry.pick, entry.alternative]
      .filter(pick => pick && filterBeachesByUserPreferences([pick.beach], preferences).length === 0)
      .map(pick => `day ${entry.dayIndex} ${beachLabel(pick.beach)}`));
    check(scenarioId, 'preferences-hold-on-caution-days', violations.length === 0,
      `picks violating the blueFlag2026 hard filter: ${violations.join('; ')}`, { canary: true });
  }

  return { plan, forecast, beaches };
};

// 6. Pool premise: the candidate pool must be able to contain unrated beaches.
const checkPoolPremise = () => {
  const { buildTripPool } = tripPlannerService;
  if (typeof buildTripPool !== 'function') {
    check('Halkidiki_ROTATING_MELTEMI', 'pool-contains-unrated', false,
      'buildTripPool is not exported yet (step 5) — the popularity-only top-40 cannot be inspected or fixed', { canary: true });
    return;
  }
  const beaches = loadRegionBeaches('central-macedonia-halkidiki-mainland');
  const geospatialProfiles = loadGeospatialProfiles('central-macedonia-halkidiki-mainland');
  const forecast = MELTEMI_WEEK.map((day, index) => createDailyForecast(index, day));
  const pool = buildTripPool(beaches, forecast, forecast.length, geospatialProfiles);
  const hasUnrated = pool.some(beach => typeof (beach.metadata?.popularity?.rating ?? beach.popularity?.rating) !== 'number');
  check('Halkidiki_ROTATING_MELTEMI', 'pool-contains-unrated', hasUnrated,
    'the pool holds no unrated beach — the unknown sheltered cove can still never surface');
};

// 7. Ceiling: above 6 Bft every day is a no-beach day.
const checkCeiling = severeResult => {
  const badDays = severeResult.plan.filter(entry => entry.status !== 'no_beach_day')
    .map(entry => `day ${entry.dayIndex}: ${beachLabel(entry.pick?.beach)}`);
  check('Naxos_SEVERE_7BFT', 'beaufort-ceiling', badDays.length === 0,
    `beach named above ${MAX_TOP_RECOMMENDATION_BEAUFORT} Bft (the podium shows nothing there): ${badDays.join('; ')}`,
    { canary: true });
};

// ─── Entry ──────────────────────────────────────────────────────────────────
const args = new Set(process.argv.slice(2));
const reportMode = args.has('--report');
const strict = args.has('--strict');

const scenarioResults = {};
for (const [scenarioId, scenario] of Object.entries(scenarios)) {
  scenarioResults[scenarioId] = runScenario(scenarioId, scenario);
}
checkPoolPremise();
checkCeiling(scenarioResults.Naxos_SEVERE_7BFT);

if (reportMode) {
  // Deterministic dump for byte-diffing around refactors: no dates, no scores
  // that could legitimately drift — just the decisions.
  const report = Object.fromEntries(Object.entries(scenarioResults).map(([scenarioId, { plan }]) => [
    scenarioId,
    plan.map(entry => ({
      dayIndex: entry.dayIndex,
      status: entry.status,
      reason: entry.reason,
      confidence: entry.confidence,
      isRepeat: entry.isRepeat,
      pick: entry.pick ? entry.pick.beach.id : null,
      // The safety-relevant flags travel with the decision. `pick` is a bare id,
      // so anything read off `pick.<field>` in an ad-hoc measurement silently
      // returns undefined — which is exactly how an offshore-drift count of
      // "0" was believed for a while on 29/07 before the flag was measured
      // against real TripPick objects instead.
      pickOffshoreDrift: entry.pick ? Boolean(entry.pick.offshoreDrift) : null,
      pickCaution: entry.pick ? Boolean(entry.pick.caution) : null,
      alternative: entry.alternative ? entry.alternative.beach.id : null,
    })),
  ]));
  console.log(JSON.stringify(report, null, 2));
} else {
  let hardFailures = 0;
  let expectedFailures = 0;
  for (const { scenarioId, name, ok, canary, detail } of results) {
    if (ok) {
      console.log(`PASS   ${scenarioId} :: ${name}`);
    } else if (canary && !strict) {
      expectedFailures += 1;
      console.warn(`CANARY ${scenarioId} :: ${name} — ${detail}`);
    } else {
      hardFailures += 1;
      console.error(`FAIL   ${scenarioId} :: ${name} — ${detail}`);
    }
  }
  const passed = results.filter(result => result.ok).length;
  console.log(`\nPlanner agreement: ${passed}/${results.length} passed, ${expectedFailures} expected failures (canaries), ${hardFailures} hard failures${strict ? ' [strict]' : ''}`);
  if (hardFailures > 0) process.exitCode = 1;
}
