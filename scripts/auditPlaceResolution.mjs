/**
 * Consolidated place-resolution audit for the most touristic regions.
 *
 * The app opens Google Maps for most beaches via a NAME query ("Παραλία X, Naxos,
 * Greece"). When that name does not exist as a searchable place (e.g. Naxos "Μελινό",
 * an OSM-only micro-bay), Google Maps lands on unrelated results — the user can't
 * verify the beach. This audit re-uses the proven OSM lookup + scoring in
 * scripts/lib/placeResolution.mjs to ask, per beach: does the built query resolve to
 * the right beach / right island, or somewhere wrong?
 *
 * It rolls every in-scope beach in a curated touristic tier into ONE report with a
 * PASS / REVIEW / FAIL verdict and a recommended navigation fix:
 *   - PASS    : name resolves near the pin on the right island. No action.
 *   - REVIEW  : a candidate exists but is far / weak-name / ambiguous island. Human look.
 *   - FAIL    : name does not resolve, or resolves to the wrong island. The Melino bucket.
 *               -> if the pin is OSM-corroborated (a beach within PIN_OK_M), recommend
 *                  routing by COORDINATES (status verified, mode coordinates);
 *               -> otherwise recommend NEEDS-REVIEW (UI degrades to a locate badge).
 *
 * Outputs to reports/place-resolution/:
 *   - place-resolution-<date>.json  full per-beach rows
 *   - place-resolution.md           consolidated per-region counts + non-PASS table
 *   - place-resolution.csv          same rows for triage
 *   - verified-place-queries.json   gate ledger: ids checked PASS (place-routed & resolvable)
 *
 * Read-only on beach data. Respects Nominatim >=1 req/s. Network is only touched here;
 * the quality gate reads the ledger offline.
 *
 * Usage:
 *   node scripts/auditPlaceResolution.mjs                       (full tier)
 *   node scripts/auditPlaceResolution.mjs --island=naxos        (one island)
 *   node scripts/auditPlaceResolution.mjs --region=south-aegean-naxos
 *   node scripts/auditPlaceResolution.mjs --island=naxos --limit=40 --dry-run
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getBeachName, getCoordinate, buildPlaceQuery, usesPlaceQuery, resolveBeachName, openPlaceCache,
} from './lib/placeResolution.mjs';
import { TOURISTIC_TIER } from './lib/touristicTier.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const indexPath = path.join(publicDir, 'data', 'beaches', 'index.json');
const outDir = path.join(rootDir, 'reports', 'place-resolution');
const cachePath = path.join(rootDir, '.tmp', 'place-resolution-cache.json'); // gitignored geocoder cache

// The "most touristic" tier (region ids) lives in scripts/lib/touristicTier.mjs and is
// shared with the offline quality-gate guard. Verified against the index at runtime; a
// missing id is a hard error so a renamed region can't silently drop out of coverage.

// A FAIL beach can still route by coordinate safely if an OSM beach corroborates the
// pin within this distance (even when the NAME didn't match it).
const PIN_OK_M = 350;

const parseArgs = () => {
  const args = { islands: [], regions: [], limit: undefined, dryRun: false, sleepMs: 1200, radiusMeters: 3000, maxNameQueries: 2, includeCoordRouted: false, anyRegion: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    // Audit regions OUTSIDE the touristic tier (ad-hoc sweeps). Without it a --region for a
    // non-tier id silently intersects to zero beaches and reports "0 audited" (14/08).
    else if (arg === '--any-region') args.anyRegion = true;
    // Re-evaluate beaches already routed by coordinate too. Use after changing the query
    // builder: a beach we previously sent to coordinates (because the OLD prefixed query
    // failed) may now resolve via the bare name, so it can go back to richer place-routing.
    else if (arg === '--include-coordinate-routed') args.includeCoordRouted = true;
    else if (arg.startsWith('--island=')) args.islands.push(arg.slice('--island='.length).trim().toLowerCase());
    else if (arg.startsWith('--region=')) args.regions.push(arg.slice('--region='.length).trim().toLowerCase());
    else if (arg.startsWith('--limit=')) args.limit = Number.parseInt(arg.slice('--limit='.length), 10);
    else if (arg.startsWith('--sleep-ms=')) args.sleepMs = Number.parseInt(arg.slice('--sleep-ms='.length), 10);
    else if (arg.startsWith('--radius-meters=')) args.radiusMeters = Number.parseInt(arg.slice('--radius-meters='.length), 10);
    else if (arg.startsWith('--max-name-queries=')) args.maxNameQueries = Number.parseInt(arg.slice('--max-name-queries='.length), 10);
  }
  return args;
};

// ---- combine the signals -> consolidated verdict + recommended nav fix -----------
// The verdict turns on the EXACT query the app sends (`Παραλία <name>, <island>`): the
// user's bug is that THIS string mis-resolves on Maps. The looser ladder forms only tell
// us whether the beach is findable at all (PASS vs FAIL nuance), not whether the app's
// own link works. So:
//   appQueryResolved = the app query (ladder form 1) itself returned a 'verified' hit.
// name : best hit across the ladder | pin : nearest OSM beach to the coordinate.
const recommendFor = (pinCorroborated) => (pinCorroborated ? 'coordinates' : 'needs-review');

const classify = ({ name, pin, nameError, appQueryResolved }) => {
  // LOOKUP_ERROR: a name query errored (rate-limit/network) and we got no hit. Not a real
  // signal — never let a throttled run masquerade as a FAIL. Re-run to get a verdict.
  if (nameError && !name) return { verdict: 'LOOKUP_ERROR', recommend: 'rerun' };

  const nameStatus = name?.evaluation.status; // 'verified' | 'needs_review' | 'rejected' | undefined
  const pinCorroborated = Number.isFinite(pin?.evaluation.distanceMeters) && pin.evaluation.distanceMeters <= PIN_OK_M;

  // PASS: the app's OWN query resolves to the right beach. The user's link works as-is.
  if (appQueryResolved) return { verdict: 'PASS', recommend: 'none' };

  // The app query does NOT resolve cleanly. Whether or not a looser form finds the beach,
  // the shipped link is broken, so recommend the coordinate fix (pin solid) / locate.
  //   REVIEW: a looser form resolves it -> findable, lower urgency, still route by pin.
  //   FAIL  : nothing resolves at all (the Melino-grade "lands nowhere") -> same safe fix.
  if (nameStatus === 'verified' || nameStatus === 'needs_review') {
    return { verdict: 'REVIEW', recommend: recommendFor(pinCorroborated) };
  }
  return { verdict: 'FAIL', recommend: recommendFor(pinCorroborated) };
};

const toBest = (hit) => hit ? {
  source: hit.place.source, name: hit.place.displayName?.text,
  distanceMeters: hit.evaluation.distanceMeters, nameScore: hit.evaluation.nameScore,
  islandScore: hit.evaluation.islandScore, status: hit.evaluation.status, flags: hit.evaluation.flags,
} : null;

// ---- data loading (resolve the tier against the index) ---------------------------
const loadRegions = async (args) => {
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const byId = new Map(index.regions.map(r => [r.id, r]));

  // Hard-fail if any configured tier id is missing from the index.
  const missing = TOURISTIC_TIER.filter(id => !byId.has(id));
  if (missing.length) {
    throw new Error(`touristic tier references region ids not in index.json: ${missing.join(', ')} (rename in scripts/auditPlaceResolution.mjs or check index.json)`);
  }

  let ids = args.anyRegion ? index.regions.map(r => r.id) : TOURISTIC_TIER;
  if (args.regions.length) ids = ids.filter(id => args.regions.includes(id.toLowerCase()));
  if (args.islands.length) {
    ids = ids.filter(id => {
      const r = byId.get(id);
      return args.islands.some(isl => id.toLowerCase().includes(isl) || String(r.prefecture || '').toLowerCase() === isl);
    });
  }
  return ids.map(id => byId.get(id));
};

const loadRecords = async (args) => {
  const regions = await loadRegions(args);
  const records = [];
  for (const region of regions) {
    // Read the APP data file (island.beaches[]): it carries the structured {gr,en} name the
    // query ladder needs (the built region file flattens name to a single string, which would
    // collapse the ladder to the app query only) plus metadata.googleMapsNavigation for scope.
    const dataPath = path.join(publicDir, (region.appDataPath || region.dataPath).replace(/^\//, ''));
    let data;
    try { data = JSON.parse(await readFile(dataPath, 'utf8')); } catch { continue; }
    const beaches = Array.isArray(data) ? data : (data?.island?.beaches || []);
    for (const beach of beaches) {
      const nav = beach?.metadata?.googleMapsNavigation;
      // Re-evaluate coordinate-routed beaches too when asked (so a now-resolvable bare name
      // can earn back richer place-routing); otherwise only name-routed beaches are at risk.
      const coordRouted = args.includeCoordRouted && nav?.status === 'verified' && nav?.mode === 'coordinates' && !nav?.query;
      if (!usesPlaceQuery(beach) && !coordRouted) continue;
      records.push({ region, beach });
    }
  }
  return Number.isInteger(args.limit) && args.limit > 0 ? records.slice(0, args.limit) : records;
};

// ---- audit one beach -------------------------------------------------------------
const auditBeach = async ({ args, region, beach, cache }) => {
  const currentMode = beach?.metadata?.googleMapsNavigation?.mode || 'place';
  const baseRow = {
    id: beach.id, name: getBeachName(beach), regionId: region.id, island: region.prefecture,
    coordinate: getCoordinate(beach), query: buildPlaceQuery(beach, region), currentMode,
  };
  if (args.dryRun) return { ...baseRow, verdict: 'DRY_RUN', recommend: 'none', best: null, pinBest: null };

  const { name, pin, nameQuery, nameError, overpassFailed, coordinate, query } = await resolveBeachName({
    beach, region, radiusMeters: args.radiusMeters, sleepMs: args.sleepMs, maxNameQueries: args.maxNameQueries, cache,
  });

  // PASS requires the app's OWN query (ladder form 1 === the built place query) to resolve
  // verified — not merely some looser form. nameQuery is the form that produced the best hit.
  const appQueryResolved = name?.evaluation.status === 'verified' && nameQuery === query;
  const { verdict, recommend } = classify({ name, pin, nameError, appQueryResolved });
  return {
    ...baseRow, coordinate, query, verdict, recommend, overpassFailed, nameError,
    nameQuery,             // the ladder form that resolved (or null)
    best: toBest(name),    // name signal (what the report headlines)
    pinBest: toBest(pin),  // pin corroboration signal
  };
};

// ---- report writers --------------------------------------------------------------
const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const writeReports = async (rows, args) => {
  await mkdir(outDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const generatedAt = new Date().toISOString();

  // per-region tallies
  const byRegion = new Map();
  for (const r of rows) {
    const t = byRegion.get(r.regionId) || { PASS: 0, REVIEW: 0, FAIL: 0, LOOKUP_ERROR: 0, total: 0, island: r.island };
    t[r.verdict] = (t[r.verdict] ?? 0) + 1;
    t.total += 1;
    byRegion.set(r.regionId, t);
  }
  const totals = rows.reduce((acc, r) => { acc[r.verdict] = (acc[r.verdict] ?? 0) + 1; return acc; }, {});

  // A scoped run covers a fraction of the tier, so it must never write over the canonical
  // report: on 14/08 a 6-region run left place-resolution.md reading "0 beaches audited" and
  // emptied nav-fixes.json, erasing a 596-beach audit. Scoped runs get their own -partial files.
  const isFullRun = !args.dryRun && !args.anyRegion && args.islands.length === 0 && args.regions.length === 0 && !Number.isInteger(args.limit);
  const tag = isFullRun ? '' : '-partial';

  // full JSON
  const jsonPath = path.join(outDir, `place-resolution-${date}${tag}.json`);
  await writeFile(jsonPath, JSON.stringify({ generatedAt, scope: { islands: args.islands, regions: args.regions }, totals, rows }, null, 1), 'utf8');

  // CSV — name signal (Nominatim, the verdict driver) + pin signal (Overpass) side by side
  const csvPath = path.join(outDir, `place-resolution${tag}.csv`);
  const header = ['id', 'name', 'regionId', 'island', 'verdict', 'recommend', 'query',
    'nameStatus', 'nameQuery', 'nameHit', 'nameDistM', 'nameScore', 'pinHit', 'pinDistM', 'flags', 'lat', 'lon'];
  const csv = [header.join(',')];
  for (const r of rows) {
    csv.push([
      r.id, r.name, r.regionId, r.island, r.verdict, r.recommend, r.query,
      r.best?.status ?? 'no_result', r.nameQuery ?? '', r.best?.name ?? '', r.best?.distanceMeters ?? '', r.best?.nameScore ?? '',
      r.pinBest?.name ?? '', r.pinBest?.distanceMeters ?? '',
      (r.best?.flags || []).join('|'), r.coordinate?.lat ?? '', r.coordinate?.lon ?? '',
    ].map(csvCell).join(','));
  }
  await writeFile(csvPath, csv.join('\n'), 'utf8');

  // consolidated Markdown
  const mdPath = path.join(outDir, `place-resolution${tag}.md`);
  const lines = [];
  lines.push(isFullRun ? '# Place-resolution audit — touristic tier'
    : `# Place-resolution audit — scoped run (${[...args.regions, ...args.islands].join(', ') || 'filtered'})`);
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push('');
  const errCount = totals.LOOKUP_ERROR ?? 0;
  lines.push(`**Totals:** PASS ${totals.PASS ?? 0} · REVIEW ${totals.REVIEW ?? 0} · FAIL ${totals.FAIL ?? 0}${errCount ? ` · LOOKUP_ERROR ${errCount}` : ''} · (${rows.length} name-routed beaches audited)`);
  lines.push('');
  lines.push('Does the name the app sends to Google Maps resolve to the right beach on the right island? FAIL = it does not (Melino class).');
  lines.push('');
  lines.push('_Two signals per beach: **name** = Nominatim free-text geocode of the app query (≈ what Google resolves); **pin** = nearest OSM `natural=beach` (is the coordinate a real beach?). FAIL + corroborated pin → route by coordinates. LOOKUP_ERROR = geocoder was rate-limited/unreachable for that beach — re-run, not a real failure._');
  lines.push('');
  lines.push('## Per-region');
  lines.push('');
  lines.push('| Region | Island | PASS | REVIEW | FAIL | Err | Total |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: |');
  for (const [id, t] of [...byRegion.entries()].sort((a, b) => (b[1].FAIL - a[1].FAIL) || (b[1].REVIEW - a[1].REVIEW))) {
    lines.push(`| ${id} | ${t.island ?? ''} | ${t.PASS} | ${t.REVIEW} | ${t.FAIL} | ${t.LOOKUP_ERROR ?? 0} | ${t.total} |`);
  }
  lines.push('');

  const nonPass = rows.filter(r => r.verdict === 'FAIL' || r.verdict === 'REVIEW')
    .sort((a, b) => (a.verdict === b.verdict ? 0 : a.verdict === 'FAIL' ? -1 : 1));
  lines.push(`## Needs attention (${nonPass.length})`);
  lines.push('');
  if (nonPass.length === 0) {
    lines.push('_None — every name-routed beach in the tier resolves correctly._');
  } else {
    lines.push('| Verdict | id | Name | Island | Built query | Name geocode (Nominatim) | Pin (OSM beach) | Recommended fix |');
    lines.push('| --- | ---: | --- | --- | --- | --- | --- | --- |');
    for (const r of nonPass) {
      const via = r.nameQuery && r.nameQuery !== r.query ? ` (via "${r.nameQuery}")` : '';
      const nameStr = r.best ? `${r.best.name || '(unnamed)'} · ${r.best.distanceMeters ?? '?'} m · ${r.best.status}${via}` : '✗ no hit';
      const pinStr = r.pinBest ? `${r.pinBest.name || '(unnamed)'} · ${r.pinBest.distanceMeters ?? '?'} m` : '✗ none';
      const fix = r.recommend === 'coordinates' ? 'route by **coordinates** (pin OSM-corroborated)'
        : r.recommend === 'needs-review' ? 'mark **needs-review** (no good name or pin)'
        : 'human review';
      lines.push(`| ${r.verdict} | ${r.id} | ${r.name} | ${r.island ?? ''} | ${r.query ?? ''} | ${nameStr} | ${pinStr} | ${fix} |`);
    }
  }
  lines.push('');
  await writeFile(mdPath, lines.join('\n'), 'utf8');

  // gate ledger: ids that PASS (place-routed AND resolvable). The quality gate fails
  // any tier beach that is verified+place-mode but absent here. Only written on a full
  // (non-filtered, non-limited) run so a partial run can't shrink the ledger.
  let ledgerPath = null;
  if (isFullRun) {
    ledgerPath = path.join(outDir, 'verified-place-queries.json');
    const passIds = rows.filter(r => r.verdict === 'PASS').map(r => r.id).sort((a, b) => a - b);
    await writeFile(ledgerPath, JSON.stringify({
      generatedAt, tier: TOURISTIC_TIER,
      note: 'ids whose app place-query resolved on OSM near the pin (PASS). The quality gate flags any tier beach that is googleMapsNavigation.status=verified, mode=place but not listed here.',
      passIds,
    }, null, 2), 'utf8');
  }

  // Nav-fix proposal in the row shape scripts/applyNavigationAudit.mjs --apply-status consumes
  // ({ id, name, lat, lon, navMode, status, why }). The applier identity-guards by id+coords,
  // dry-runs first, and only flips nav routing; it never touches the beach name or claims.
  //   - APP QUERY broken (FAIL/REVIEW → recommend coordinates/needs-review): route by pin/locate.
  //   - PASS but currently coordinate-routed: flip BACK to place so the user gets the rich Google
  //     beach card (the prefix-free query now resolves; coordinate routing only shows a bare pin).
  // PASS already place-routed needs no change; LOOKUP_ERROR must be re-run.
  const fixesPath = path.join(outDir, `nav-fixes${tag}.json`);
  const fixRows = [];
  for (const r of rows) {
    if (r.recommend === 'coordinates' || r.recommend === 'needs-review') {
      fixRows.push({
        id: r.id, name: r.name, lat: r.coordinate?.lat, lon: r.coordinate?.lon,
        navMode: r.recommend === 'coordinates' ? 'coordinates' : 'place',
        status: r.recommend === 'coordinates' ? 'verified' : 'needs-review',
        why: r.recommend === 'coordinates'
          ? `Place-resolution audit ${date}: the app place query "${r.query}" did not resolve to this beach on a general geocoder, but the pin is an OSM beach within ${PIN_OK_M} m, so navigation routes by coordinates.`
          : `Place-resolution audit ${date}: the app place query "${r.query}" did not resolve and no nearby OSM beach corroborates the pin; navigation downgraded to locate.`,
      });
    } else if (r.verdict === 'PASS' && r.currentMode === 'coordinates') {
      fixRows.push({
        id: r.id, name: r.name, lat: r.coordinate?.lat, lon: r.coordinate?.lon,
        navMode: 'place', status: 'verified',
        why: `Place-resolution audit ${date}: the app place query "${r.query}" now resolves to this beach on a general geocoder, so navigation routes by place (richer Google beach card) instead of bare coordinates.`,
      });
    }
  }
  await writeFile(fixesPath, JSON.stringify(fixRows, null, 1), 'utf8');

  return { jsonPath, csvPath, mdPath, ledgerPath, fixesPath, totals, nonPass };
};

const run = async () => {
  const args = parseArgs();
  const records = await loadRecords(args);
  console.log(`${args.anyRegion ? 'Name-routed' : 'Touristic-tier name-routed'} beaches in scope: ${records.length}`);

  if (args.dryRun) {
    for (const { region, beach } of records) {
      const r = await auditBeach({ args, region, beach });
      console.log(`#${r.id} ${r.name} (${r.regionId}) -> "${r.query}"`);
    }
    console.log(`\nDry run: ${records.length} beaches would be looked up. (no API calls)`);
    return;
  }

  // Geocoder cache: makes re-runs near-instant and lets a throttled run resume without
  // re-hitting the network for beaches it already resolved. Flushed every 10 beaches and
  // at the end so a Ctrl-C mid-run still banks progress.
  const cache = openPlaceCache(cachePath);
  if (cache.size() > 0) console.log(`Geocoder cache: ${cache.size()} entries (reusing prior lookups).`);

  const rows = [];
  let done = 0;
  for (const { region, beach } of records) {
    rows.push(await auditBeach({ args, region, beach, cache }));
    if (++done % 10 === 0) { cache.flush(); process.stderr.write(`...${done}/${records.length}\n`); }
  }
  cache.flush();

  const { jsonPath, csvPath, mdPath, ledgerPath, fixesPath, totals, nonPass } = await writeReports(rows, args);
  const errN = totals.LOOKUP_ERROR ?? 0;
  console.log(`\nVerdicts: PASS=${totals.PASS ?? 0} REVIEW=${totals.REVIEW ?? 0} FAIL=${totals.FAIL ?? 0}${errN ? ` LOOKUP_ERROR=${errN} (re-run to resolve)` : ''}`);
  console.log(`Needs attention: ${nonPass.length}`);
  console.log(`Report: ${path.relative(rootDir, mdPath)}`);
  console.log(`CSV:    ${path.relative(rootDir, csvPath)}`);
  console.log(`JSON:   ${path.relative(rootDir, jsonPath)}`);
  console.log(`Fixes:  ${path.relative(rootDir, fixesPath)} (apply with scripts/applyNavigationAudit.mjs --apply-status --audit ${path.relative(rootDir, fixesPath).replace(/\\/g, '/')})`);
  if (ledgerPath) console.log(`Ledger: ${path.relative(rootDir, ledgerPath)}`);
};

run().catch(err => { console.error(err); process.exit(1); });
