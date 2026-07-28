import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const reportPath = path.join(projectRoot, '.tmp', 'analytics-funnel-audit-report.json');

const failures = [];
const warnings = [];
const passed = [];

const sourceFiles = [
  'App.tsx',
  'components/BeachCard.tsx',
  'components/BeachMap.tsx',
  'components/BeachSearcherHome.tsx',
  'components/Forecast.tsx',
  'components/PrivacyConsentBanner.tsx',
  'components/AiBeachAdvisor.tsx',
  'components/planner/TripPlanner.tsx',
  'services/analyticsService.ts',
];

const funnelSteps = [
  {
    id: 'app_loaded',
    label: 'App loaded',
    aliases: ['app_loaded'],
  },
  {
    id: 'page_view',
    label: 'Page viewed',
    aliases: ['page_view'],
  },
  {
    id: 'region_selection',
    label: 'Region/island selected',
    aliases: ['region_changed', 'region_selected'],
  },
  {
    id: 'recommendations_viewed',
    label: 'Recommendations viewed',
    aliases: ['recommendations_viewed'],
  },
  {
    id: 'search',
    label: 'Search used',
    aliases: ['search_used', 'search_performed', 'beach_search'],
  },
  {
    id: 'filters',
    label: 'Filters used',
    aliases: ['filter_applied', 'filter_used'],
  },
  {
    id: 'beach_card',
    label: 'Beach card clicked',
    aliases: ['beach_card_clicked'],
  },
  {
    id: 'beach_detail',
    label: 'Beach detail opened',
    aliases: ['beach_detail_opened', 'beach_details_opened', 'beach_viewed'],
  },
  {
    id: 'map',
    label: 'Map viewed/opened',
    aliases: ['map_viewed', 'map_opened'],
  },
  {
    // The trip planner's REACH. Since the plan became automatic (28/07/2026)
    // this fires for nearly everyone who scrolls to the card, so it is the
    // denominator of the step below — never read it as interest on its own.
    id: 'trip_planner',
    label: 'Trip plan shown (multi-day)',
    aliases: ['trip_planned'],
  },
  {
    // The planner's ONE success metric: a beach taken OUT of the plan.
    id: 'trip_plan_engagement',
    label: 'Beach opened from the trip plan',
    aliases: ['trip_plan_beach_opened'],
  },
  {
    id: 'navigation',
    label: 'Navigation clicked',
    aliases: ['navigation_clicked', 'beach_navigated'],
  },
];

const readText = async relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');

const unique = values => [...new Set(values)].sort();

const extractDeclaredEvents = analyticsSource => {
  // Comments come off BEFORE the union is located, not after. Both of the
  // union's terminators — the closing `;` and the quote pairing — are fooled by
  // ordinary prose: a semicolon inside a doc comment truncated the union at
  // that line (measured 28/07/2026: 53 declared events silently became 30, and
  // the audit then "failed" on events that were declared right there), and an
  // apostrophe in "the page's reach" desyncs the quote scan.
  const withoutComments = analyticsSource.replace(/\/\/[^\n]*/g, '');
  const unionMatch = withoutComments.match(/export type AnalyticsEvent\s*=([\s\S]*?);/);
  if (!unionMatch) return [];
  return unique(Array.from(unionMatch[1].matchAll(/'([^']+)'/g)).map(match => match[1]));
};

const extractEmittedEvents = source => {
  const directEvents = Array.from(source.matchAll(/trackEvent\(\s*'([^']+)'/g)).map(match => match[1]);
  const pageViewEvents = /trackPageView\(/.test(source) ? ['page_view'] : [];
  return [...directEvents, ...pageViewEvents];
};

const main = async () => {
  const analyticsSource = await readText('services/analyticsService.ts');
  const declaredEvents = extractDeclaredEvents(analyticsSource);
  if (declaredEvents.length > 0) passed.push(`Declared analytics events: ${declaredEvents.length}`);
  else failures.push('Could not parse AnalyticsEvent union.');

  const emittedByFile = {};
  const emittedEvents = [];
  for (const file of sourceFiles) {
    const source = await readText(file);
    const events = extractEmittedEvents(source);
    emittedByFile[file] = unique(events);
    emittedEvents.push(...events);
  }
  const emitted = unique(emittedEvents);

  const undeclared = emitted.filter(event => !declaredEvents.includes(event));
  if (undeclared.length > 0) {
    failures.push(`Events emitted but not declared: ${undeclared.join(', ')}`);
  } else {
    passed.push('All emitted events are declared.');
  }

  const missingFunnelSteps = [];
  const funnelCoverage = funnelSteps.map(step => {
    const matchedEvents = step.aliases.filter(event => emitted.includes(event));
    if (matchedEvents.length === 0) missingFunnelSteps.push(step.label);
    return {
      id: step.id,
      label: step.label,
      aliases: step.aliases,
      matchedEvents,
      covered: matchedEvents.length > 0,
    };
  });

  if (missingFunnelSteps.length > 0) {
    failures.push(`Missing emitted events for funnel step(s): ${missingFunnelSteps.join(', ')}`);
  } else {
    passed.push('Core funnel coverage is present.');
  }

  const declaredButUnused = declaredEvents.filter(event => !emitted.includes(event));
  const intentionallyLegacy = new Set([
    'beach_viewed',
    'beach_navigated',
    'beach_favorited',
    'recommendation_feedback_negative',
    'recommendation_feedback_positive',
    'search_performed',
    'region_selected',
    'beach_search',
    'beach_details_opened',
    'map_opened',
    'filter_used',
    'photo_suggestion_clicked',
    'recommendation_feedback',
  ]);
  const unusedNonLegacy = declaredButUnused.filter(event => !intentionallyLegacy.has(event));
  if (unusedNonLegacy.length > 0) {
    warnings.push(`Declared but not currently emitted: ${unusedNonLegacy.join(', ')}`);
  }

  if (/GOOGLE_ANALYTICS_DENYLISTED_METADATA/.test(analyticsSource)
    && /lat/.test(analyticsSource)
    && /longitude/.test(analyticsSource)
    && /email/.test(analyticsSource)
    && /phone/.test(analyticsSource)) {
    passed.push('Analytics metadata denylist is present.');
  } else {
    failures.push('Analytics metadata denylist appears incomplete.');
  }

  if (/getAnalyticsConsent\(\) === 'accepted'/.test(analyticsSource)) {
    passed.push('Analytics tracking remains consent-gated.');
  } else {
    failures.push('Could not confirm analytics is gated by accepted consent.');
  }

  const report = {
    ok: failures.length === 0,
    declaredEvents,
    emittedEvents: emitted,
    emittedByFile,
    funnelCoverage,
    declaredButUnused,
    warnings,
    failures,
    generatedAt: new Date().toISOString(),
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`Analytics funnel audit: ${passed.length} passed, ${warnings.length} warnings, ${failures.length} failures`);
  console.log(`Report: ${path.relative(projectRoot, reportPath).replaceAll(path.sep, '/')}`);
  for (const message of passed) console.log(`PASS: ${message}`);
  for (const message of warnings) console.warn(`WARN: ${message}`);
  for (const message of failures) console.error(`FAIL: ${message}`);

  if (failures.length > 0) process.exitCode = 1;
};

main().catch(error => {
  console.error('Analytics funnel audit crashed.', error);
  process.exitCode = 1;
});
