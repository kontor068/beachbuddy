/**
 * EVERY GATE ASKS THE BEACH'S OWN SHORE — a wiring + behaviour gate.
 *
 * On 01/08/2026 the map stopped painting from one wind per region. Four decisions did not move
 * with it, and they are heavier than a colour, because they change WHICH beaches a person is
 * shown at all. Measured nationally on 02/08 over 8.550 beach-hours (scripts/measureRegionWindGating.mjs):
 *
 *   the region number is >= 1 Bft away from the beach's own shore   3.073 beach-hours (35,9%)
 *   >= 2 Bft away                                                     543 beach-hours (6,4%)
 *   distinct beaches on the wrong side of a gate at least once      1.171 of 2.850
 *   podium: could reach #1 while its own water blew >= 5 Bft           150 (1,8%)
 *   podium: pushed down for a wind not blowing there                    47 (0,5%, all Heraklion)
 *   recommendations: excluded though its own shore was calm            889 (10,4%)
 *   recommendations: kept with no wind evidence while it blew          574 (6,7%)
 *   list filter switched off while shores blew 4+                      360 (4,2%)
 *   boat-only still offered while its own water blew >= 5 Bft            2 (Karpathos, on a calm day)
 *
 * This gate holds the fix in place from both ends:
 *
 *   WIRING   — every call site that decides something about ONE beach must pass that beach's
 *              own wind. A revert to the region number fails here, in the file it happens in.
 *   BEHAVIOUR — the ranking functions are driven with real fixtures and must (a) leave a
 *              calm-shore beach alone while the region blows, (b) still demote a beach whose
 *              own shore blows even when the region reads calm, and (c) behave EXACTLY as
 *              before when no per-beach readings exist (the trip planner, the prerender, the
 *              first paint) — that fallback is what keeps 2.850 beaches ranked at all.
 *
 * It does not fetch anything. The truth gate (scripts/validateColourAgainstRealWind.mjs) is the
 * one that leaves the building; this one proves the wiring that gate cannot see.
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
      jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const {
  getWindPriorityTopPickPool,
  prioritizeProtectedRecommendations,
  beachOwnBeaufort,
  MEANINGFUL_WIND_TOP_PICK_BEAUFORT,
  PROTECTED_FIRST_BEAUFORT,
} = require('../services/topPickRanking.ts');

const failures = [];
const fail = (rule, detail) => failures.push({ rule, detail });

const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

// ---------------------------------------------------------------------------
// WIRING — read the call sites, not a summary of them.
// ---------------------------------------------------------------------------

/**
 * Every call of `fnName` in `source`, with its full argument list, found by matching balanced
 * parentheses. Lines that are comments are skipped: this file's own prose names these
 * functions, and so does App.tsx's.
 */
const callSites = (source, fnName) => {
  const sites = [];
  const needle = `${fnName}(`;
  let cursor = 0;

  while (true) {
    const start = source.indexOf(needle, cursor);
    if (start === -1) break;

    const previous = source[start - 1];
    if (previous && /[A-Za-z0-9_$.]/.test(previous)) {
      cursor = start + needle.length;
      continue;
    }

    const lineStart = source.lastIndexOf('\n', start) + 1;
    const line = source.slice(lineStart, source.indexOf('\n', start));
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) {
      cursor = start + needle.length;
      continue;
    }

    let depth = 0;
    let end = start + fnName.length;
    for (; end < source.length; end += 1) {
      if (source[end] === '(') depth += 1;
      else if (source[end] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    sites.push({
      line: source.slice(0, start).split('\n').length,
      text: source.slice(start, end + 1),
    });
    cursor = end + 1;
  }

  return sites;
};

const appSource = read('App.tsx');
const homeSource = read('components/BeachSearcherHome.tsx');
const rankingSource = read('services/topPickRanking.ts');

const requireInEveryCall = (file, source, fnName, mustContain, why) => {
  const sites = callSites(source, fnName);
  if (sites.length === 0) {
    fail(
      `${file}: ${fnName} has no call sites`,
      'The gate can only hold a wire that exists. If the call moved, move this rule with it.'
    );
    return;
  }
  sites.forEach(site => {
    if (!site.text.includes(mustContain)) {
      fail(
        `${file}:${site.line} ${fnName} is still deciding from the region wind`,
        `${why} Expected the call to pass \`${mustContain}\`.`
      );
    }
  });
};

requireInEveryCall(
  'App.tsx',
  appSource,
  'isTrustedTopRecommendationCandidate',
  'beaufortAtBeach(',
  'Whether a beach needs proven wind evidence depends on whether the wind is reaching THAT beach: 889 beach-hours were thrown out of the recommendations though their own shore was calm, and 574 were kept with no evidence while it blew.'
);

['getWindPriorityTopPickPool', 'prioritizeProtectedRecommendations'].forEach(fnName => {
  requireInEveryCall(
    'App.tsx',
    appSource,
    fnName,
    'perBeachMapWind',
    'The podium must rank each beach by the wind on its own shore; without this map it ranks all of them by the wind at the region\'s centre.'
  );
});

// The helper itself must read the per-beach map. A stub returning the region number would
// satisfy every rule above while restoring the whole defect.
const helperMatch = appSource.match(/const beaufortAtBeach = [\s\S]{0,600}?\n  \}, \[[^\]]*\]\);/);
if (!helperMatch) {
  fail('App.tsx: beaufortAtBeach is missing', 'Every per-beach gate resolves its wind through it.');
} else {
  const helper = helperMatch[0];
  if (!/perBeachMapWind\.get\(id\)\?\.beaufort/.test(helper)) {
    fail(
      'App.tsx: beaufortAtBeach no longer reads the per-beach wind',
      'It must resolve from perBeachMapWind, falling back to the region wind only when a beach has no reading of its own.'
    );
  }
  if (!/currentBeaufort/.test(helper)) {
    fail(
      'App.tsx: beaufortAtBeach lost its region fallback',
      'A beach with no local reading (first paint, no geometry, failed fetch) must still be ranked, not dropped.'
    );
  }
}

const normalized = (source) => source.replace(/\s+/g, ' ');

if (!normalized(appSource).includes('hasBoatOnlyAccess(item.beach) && beaufortAtBeach(item) >= PROTECTED_FIRST_BEAUFORT')) {
  fail(
    'App.tsx: the boat-only removal is back on the region wind',
    'Whether the boat sails is decided by the water it sails on. Measured on Karpathos: the region read 3 Bft while Αλιμούντα and Παλάτια had 5 Bft on their own shore and stayed on offer.'
  );
}

if (!normalized(homeSource).includes('perBeachMapWind?.get(beach.id)?.beaufort')) {
  fail(
    'components/BeachSearcherHome.tsx: the boat-only fallback list is back on the region wind',
    'This is the list that gets numbered like top picks when nothing is suitable — the exact place a boat-only beach must not appear as "#1" in strong wind.'
  );
}

if (!normalized(appSource).includes('const gatingBeaufort = Math.max(selectedBeaufort, windiestShoreBeaufort);')) {
  fail(
    'App.tsx: the list filter switches off on the region wind again',
    'Below 4 Bft the "recommended" filter turns itself off. The region centre said calm while 360 measured beach-hours of the same region blew 4+.'
  );
}

['getWindPriorityTopPickPool', 'bestShelteredRecommendationGroup', 'prioritizeProtectedRecommendations'].forEach(fnName => {
  const declaration = rankingSource.match(new RegExp(`export const ${fnName} = \\(([\\s\\S]*?)\\)[:=]`));
  if (!declaration || !/perBeachWind\?: PerBeachWindLookup/.test(declaration[1])) {
    fail(
      `services/topPickRanking.ts: ${fnName} no longer accepts the per-beach wind`,
      'Optional on purpose — the trip planner and the prerender pass nothing and keep the region wind — but the surfaces that HAVE the readings must be able to hand them over.'
    );
  }
});

// ---------------------------------------------------------------------------
// THE SINGLE REGION NUMBER IS OFF THE SCREEN (02/08/2026).
//
// The last item. Every layer underneath had moved to per-beach readings, and the biggest number
// on the map was still the wind at the region's geometric centre — so a correct map read as a
// broken one twice in one day: Χανιά showing «2 μποφ.» over red northern pins, and Γιαλισκάρι's
// pin yellow at 08:00 over 4 Bft while the widget said 2. The pins were right both times.
//
// What replaced it is a range measured on the shores in view, not a deletion: the wind DIRECTION
// stays, because that is a genuinely regional fact and it is what explains which side of an
// island is sheltered.
// ---------------------------------------------------------------------------

const mapSource = read('components/BeachMap.tsx');

if (!/const shoreBeaufortRange = React\.useMemo/.test(mapSource)) {
  fail(
    'components/BeachMap.tsx: the shore range is gone',
    'The compass widget falls back to the region centre\'s single Beaufort, which is the figure that made a correct map look broken.'
  );
}
if (!/\$\{shoreBeaufortRange\.min\}–\$\{shoreBeaufortRange\.max\} \$\{copy\.beaufortUnit\} \$\{copy\.onShores\}/.test(mapSource)) {
  fail(
    'components/BeachMap.tsx: the widget no longer prints the range',
    'One number for a whole coastline was never true. The range is, and it is what makes a mixed map read as correct.'
  );
}
// Presence is not wiring. The two rules above are satisfied by a range that is computed, printed
// into a string, and then never reached — which is exactly what a one-word sabotage produced and
// this gate waved through on the first attempt. So assert the ORDER too: the shore range is what
// the widget shows, and the region figure is only what it falls back to.
if (!/const speed = shoreLabel\s*\n\s*\?\?\s*\(windSpeedKmh !== undefined/.test(mapSource)) {
  fail(
    'components/BeachMap.tsx: the shore range is computed but not shown',
    'The widget must print the range and fall back to the region figure only when there are too few readings — not the other way round, and not with the range stranded in a dead branch.'
  );
}
if (/formatSliderHour\(activeHourItem\.dt\)\}\s*·\s*\{getBeaufortLevel/.test(mapSource)) {
  fail(
    'components/BeachMap.tsx: the hour slider prints the region Beaufort again',
    'The thumb is already coloured from the pins\' own tally, so the severity is on screen without a number that belongs to nowhere in particular.'
  );
}
if (/\$\{sentenceDay\}[^`]*\$\{beaufort\}/.test(appSource)) {
  fail(
    'App.tsx: the general conditions sentence states the region Beaufort again',
    'It sits above the recommendations and reads as a fact about every beach below it. The tier decision may still use the figure; the sentence may not print it.'
  );
}
if (/(lightWindDayTitle|calmWindBadge)[\s\S]{0,400}?\$\{beaufort\}/.test(appSource)) {
  fail(
    'App.tsx: a calm-day badge states the region Beaufort again',
    'These render beside «όλες οι παραλίες είναι κατάλληλες» — the one place a region-wide number is least entitled to speak for every beach.'
  );
}

// ---------------------------------------------------------------------------
// BEHAVIOUR — drive the real ranking functions.
// ---------------------------------------------------------------------------

const beachFixture = (id) => ({
  id,
  name: { gr: `Παραλία ${id}`, en: `Beach ${id}` },
  accessibility: 'easy',
  amenities: { organized: true, sunbeds: true, parking: true },
  environment: { familyFriendly: true, remote: false },
  metadata: {
    organized: true,
    access: { type: 'asphalt_road' },
    environment: { remote: false },
  },
});

const itemFixture = ({ id, score, exposureLevel }) => ({
  beachId: id,
  beach: beachFixture(id),
  name: `Beach ${id}`,
  score,
  explanation: '',
  isExposed: exposureLevel !== 'protected',
  exposureLevel,
  canClaimWindProtection: exposureLevel === 'protected',
});

const windMap = (entries) => new Map(entries.map(([id, beaufort]) => [id, { beaufort }]));
const idsOf = (items) => items.map(item => item.beachId);

const expectOrder = (label, actual, expected, why) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(label, `${why} Expected order ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
};

// 1 — With no per-beach readings, nothing may change. This is the path the trip planner, the
//     prerender and the first paint take, and it covers 2.850 beaches when a fetch fails.
const exposedHighScore = itemFixture({ id: 1, score: 90, exposureLevel: 'exposed' });
const protectedLowScore = itemFixture({ id: 2, score: 70, exposureLevel: 'protected' });

expectOrder(
  'topPickRanking: the region-wind fallback changed at strong wind',
  idsOf(prioritizeProtectedRecommendations([exposedHighScore, protectedLowScore], 6)),
  [2],
  'At 6 Bft with no per-beach readings, the exposed beach must still be dropped from the podium group exactly as before, whatever its score.'
);
expectOrder(
  'topPickRanking: the region-wind fallback changed on a calm day',
  idsOf(prioritizeProtectedRecommendations([protectedLowScore, exposedHighScore], 1)),
  [1, 2],
  'At 1 Bft with no per-beach readings, the better score must still win.'
);
expectOrder(
  'topPickRanking: an all-region wind map is not the same as the region wind',
  idsOf(prioritizeProtectedRecommendations([exposedHighScore, protectedLowScore], 6, windMap([[1, 6], [2, 6]]))),
  [2],
  'When every beach reads the same wind as the region, the result must be identical to the region-wind path.'
);

// 2 — A beach whose own shore is calm must not be demoted for a wind that is not reaching it.
//     This is the 47 Heraklion beach-hours.
expectOrder(
  'topPickRanking: a calm shore is still demoted by the region wind',
  idsOf(prioritizeProtectedRecommendations([exposedHighScore, protectedLowScore], 6, windMap([[1, 1], [2, 6]]))),
  [1, 2],
  'Beach 1 is exposed on paper but only 1 Bft is blowing there — it must be judged on merit, not on the region\'s 6 Bft.'
);

// 3 — And the reverse: a beach whose own shore blows must be demoted even when the region reads
//     calm. This is the 150 beach-hours that could reach #1 over 5 Bft of their own water.
expectOrder(
  'topPickRanking: a blown-out shore still reaches the podium',
  idsOf(prioritizeProtectedRecommendations([exposedHighScore, protectedLowScore], 1, windMap([[1, 6], [2, 1]]))),
  [2],
  'Beach 1 has 6 Bft on its own shore while the region reads 1. On the region wind alone this pool was not even treated as windy and beach 1 took first place on its score.'
);

// 4 — The candidate pool must not throw out a calm-shore beach for failing to be sheltered.
const pool = getWindPriorityTopPickPool(
  [exposedHighScore, protectedLowScore],
  5,
  windMap([[1, 1], [2, 5]])
);
if (!idsOf(pool).includes(1)) {
  fail(
    'topPickRanking: the wind-priority pool drops calm-shore beaches',
    'At 5 Bft in the region but 1 Bft at beach 1, that beach has nothing to be sheltered from and must stay a candidate.'
  );
}
const regionOnlyPool = getWindPriorityTopPickPool([exposedHighScore, protectedLowScore], 5);
if (idsOf(regionOnlyPool).includes(1)) {
  fail(
    'topPickRanking: the wind-priority pool stopped filtering on the region wind',
    'With no per-beach readings the old rule must survive intact: at 5 Bft only the less-exposed beaches stay.'
  );
}

// 5 — The ordering must not depend on the order the beaches arrive in. The per-beach ranks are
//     computed per item precisely so the comparator stays a single-scalar decision; a rule that
//     switched per PAIR would make the sort depend on the input permutation.
const mixedPool = [
  itemFixture({ id: 11, score: 88, exposureLevel: 'exposed' }),
  itemFixture({ id: 12, score: 84, exposureLevel: 'protected' }),
  itemFixture({ id: 13, score: 80, exposureLevel: 'partial' }),
  itemFixture({ id: 14, score: 76, exposureLevel: 'exposed' }),
  itemFixture({ id: 15, score: 72, exposureLevel: 'protected' }),
  itemFixture({ id: 16, score: 68, exposureLevel: 'partial' }),
];
const mixedWind = windMap([[11, 1], [12, 6], [13, 2], [14, 6], [15, 5], [16, 1]]);
const baseline = idsOf(prioritizeProtectedRecommendations(mixedPool, 5, mixedWind));
[1, 2, 3, 4].forEach(shift => {
  const rotated = [...mixedPool.slice(shift), ...mixedPool.slice(0, shift)];
  const rotatedOrder = idsOf(prioritizeProtectedRecommendations(rotated, 5, mixedWind));
  if (JSON.stringify(rotatedOrder) !== JSON.stringify(baseline)) {
    fail(
      'topPickRanking: the podium depends on the order the beaches arrive in',
      `Rotating the input by ${shift} gave ${JSON.stringify(rotatedOrder)} instead of ${JSON.stringify(baseline)}. The wind-aware ranks must be per-item, never per-pair.`
    );
  }
});

// 6 — The resolver itself: a beach with no reading of its own keeps the region wind.
if (beachOwnBeaufort({ beachId: 99 }, 4, windMap([[1, 6]])) !== 4) {
  fail(
    'topPickRanking: beachOwnBeaufort lost its region fallback',
    'A beach with no cluster reading must fall back to the region wind, not to zero — zero would silently mark every unread beach calm.'
  );
}
if (beachOwnBeaufort({ beach: { id: 1 } }, 4, windMap([[1, 6]])) !== 6) {
  fail(
    'topPickRanking: beachOwnBeaufort does not read the map',
    'It must resolve a beach by `beach.id` as well as by `beachId` — the two shapes both exist in the call sites.'
  );
}

// ---------------------------------------------------------------------------

const thresholds = `thresholds in use: meaningful wind ${MEANINGFUL_WIND_TOP_PICK_BEAUFORT} Bft, shelter-first ${PROTECTED_FIRST_BEAUFORT} Bft`;

if (failures.length > 0) {
  console.error(`FAILED: ${failures.length} per-beach wind gate(s) broken — ${thresholds}.\n`);
  failures.forEach(({ rule, detail }) => {
    console.error(`  x ${rule}`);
    console.error(`    ${detail}\n`);
  });
  process.exit(1);
}

console.log(`PASSED: every wind gate asks the beach's own shore — 10 wiring rules, 9 behaviour checks, ${thresholds}.`);
