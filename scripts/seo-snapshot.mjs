/**
 * scripts/seo-snapshot.mjs
 *
 * LOCAL-ONLY Search Console snapshot tool. Not part of the build, never shipped
 * to the site. It fetches Google Search Console data, condenses it into a small
 * summary, and writes two files you can hand to an LLM for analysis:
 *
 *   reports/snapshots/YYYY-MM-DD.json   (the machine summary — upload this)
 *   reports/snapshots/YYYY-MM-DD.md     (a short human digest)
 *
 * This script only fetches + aggregates. It draws NO conclusions.
 *
 * Setup + troubleshooting: reports/README.md
 * Run: npm run seo:snapshot
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const JSON_BUDGET_BYTES = 180 * 1024;
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

// CTR-curve anchoring: a position is trusted only with enough queries AND enough
// total impressions (5 tiny queries are noise). Uplift math targets position 3.
const CTR_CURVE_SAMPLE_MIN = 5;
const CTR_CURVE_IMPR_MIN = 200;
const CTR_CURVE_TARGET_POS = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const r3 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v);
const r1 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : v);
const isoDay = (d) => d.toISOString().slice(0, 10);
const daysAgo = (base, n) => new Date(base.getTime() - n * DAY_MS);
const inclusiveDays = (start, end) => Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS) + 1;

const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
const log = (msg) => console.log(`[seo-snapshot ${stamp()}] ${msg}`);

/** Minimal .env loader (no dependency). Shell env wins over the file. */
async function loadEnv() {
  try {
    const txt = await readFile(path.join(projectRoot, '.env'), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env file is fine when the vars are exported in the shell.
  }
}

// ---------------------------------------------------------------------------
// URL segmentation — mirrors utils/beachUrls.ts
//   Region: {localePrefix}/beaches/{regionSlug}/
//   Detail: {localePrefix}/beaches/{regionSlug}/{beachId}-{nameSlug}/
//   localePrefix: /el (Greek), '' (English), /de /fr /it (others)
// ---------------------------------------------------------------------------

const LOCALE_PREFIX_RE = /^\/(el|de|fr|it)(?=\/|$)/;
const DETAIL_RE = /^\/beaches\/([^/]+)\/(\d+)(?:-[^/]+)?\/?$/;
const REGION_RE = /^\/beaches\/([^/]+)\/?$/;

function parseUrl(pageUrl) {
  let pathname = pageUrl;
  try {
    pathname = new URL(pageUrl).pathname;
  } catch {
    // Already a path (GSC often returns full URLs for domain properties).
  }

  const localeMatch = pathname.match(LOCALE_PREFIX_RE);
  const locale = localeMatch ? localeMatch[1] : 'en'; // empty prefix == English
  const rest = localeMatch ? pathname.slice(localeMatch[0].length) || '/' : pathname;

  let pageType = 'other';
  let region = null;
  let beachId = null;

  if (rest === '/' || rest === '') {
    pageType = 'home';
  } else {
    const detail = rest.match(DETAIL_RE);
    const region_ = rest.match(REGION_RE);
    if (detail) {
      pageType = 'beach';
      region = safeDecode(detail[1]);
      beachId = Number(detail[2]);
    } else if (region_) {
      pageType = 'region';
      region = safeDecode(region_[1]);
    }
  }

  return { locale, pageType, region, beachId };
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// ---------------------------------------------------------------------------
// Metric helpers
// ---------------------------------------------------------------------------

/** Sum a set of GSC rows into one metric bucket (ctr + impression-weighted position). */
function sumRows(rows) {
  let clicks = 0;
  let impressions = 0;
  let posWeighted = 0;
  for (const row of rows || []) {
    clicks += row.clicks || 0;
    impressions += row.impressions || 0;
    posWeighted += (row.position || 0) * (row.impressions || 0);
  }
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? posWeighted / impressions : 0,
  };
}

const metricOut = (m) => ({
  clicks: m.clicks,
  impressions: m.impressions,
  ctr: r3(m.ctr),
  position: r3(m.position),
});

const pct = (cur, prev) => (prev > 0 ? r3((cur - prev) / prev) : null);

/** Full delta block for totals. */
function totalsDelta(cur, prev) {
  if (!cur || !prev) return { clicks: null, clicksPct: null, impressions: null, impressionsPct: null, ctr: null, position: null };
  return {
    clicks: cur.clicks - prev.clicks,
    clicksPct: pct(cur.clicks, prev.clicks),
    impressions: cur.impressions - prev.impressions,
    impressionsPct: pct(cur.impressions, prev.impressions),
    ctr: r3(cur.ctr - prev.ctr),
    position: r3(cur.position - prev.position),
  };
}

/** Compact delta block for segments. */
function segDelta(cur, prev) {
  if (!cur || !prev) return { clicksPct: null, impressionsPct: null };
  return { clicksPct: pct(cur.clicks, prev.clicks), impressionsPct: pct(cur.impressions, prev.impressions) };
}

/** Group rows (single-key dimension) into a Map(key -> metric bucket). */
function mapByKey(rows, keyFn) {
  const buckets = new Map();
  for (const row of rows || []) {
    const key = keyFn(row);
    if (key == null) continue;
    const b = buckets.get(key) || { rows: [] };
    b.rows.push(row);
    buckets.set(key, b);
  }
  const out = new Map();
  for (const [key, b] of buckets) out.set(key, sumRows(b.rows));
  return out;
}

// ---------------------------------------------------------------------------
// Search Console fetching
// ---------------------------------------------------------------------------

async function withBackoff(fn, label, maxRetries = 5) {
  let delay = 1000;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const code = error?.code || error?.response?.status;
      if (code === 429 && attempt < maxRetries) {
        log(`  429 on ${label} — backing off ${delay}ms (retry ${attempt + 1}/${maxRetries})`);
        await sleep(delay);
        delay *= 2;
        continue;
      }
      throw error;
    }
  }
}

/** Paginated searchanalytics.query. Returns all rows across up to 10 pages. */
async function fetchDimension(client, siteUrl, startDate, endDate, dimensions, label) {
  const rowLimit = 25000;
  const maxPages = 10;
  let startRow = 0;
  const all = [];
  const started = Date.now();

  for (let page = 0; page < maxPages; page++) {
    const res = await withBackoff(
      () =>
        client.searchanalytics.query({
          siteUrl,
          requestBody: { startDate, endDate, dimensions, rowLimit, startRow, dataState: 'final' },
        }),
      label,
    );
    const rows = res?.data?.rows || [];
    all.push(...rows);
    if (rows.length < rowLimit) break;
    startRow += rowLimit;
    if (page === maxPages - 1) log(`  ${label}: hit ${maxPages}-page safety cap`);
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  log(`  ${label}: ${all.length} rows in ${secs}s`);
  return all;
}

// ---------------------------------------------------------------------------
// Analyses (each is a pure function; the caller isolates failures)
// ---------------------------------------------------------------------------

function computeTotals(raw) {
  const totalsFor = (period) => {
    const rows = raw[period]?.date ?? raw[period]?.page ?? raw[period]?.query;
    return rows ? sumRows(rows) : null;
  };
  const current = totalsFor('current');
  const previous = totalsFor('previous');
  const lastYear = totalsFor('lastYear');
  const lastYearPrevious = totalsFor('lastYearPrevious');

  // Seasonality adjustment: how much of our YoY-style lift is just "the same
  // thing happened last year at this time" vs. genuinely ours.
  let seasonalityAdjusted = null;
  if (current && previous) {
    const clicksPctVsPrevious = pct(current.clicks, previous.clicks);
    let expectedFromSeasonality = null;
    if (lastYear && lastYearPrevious) {
      expectedFromSeasonality = pct(lastYear.clicks, lastYearPrevious.clicks);
    }
    const excess =
      clicksPctVsPrevious != null && expectedFromSeasonality != null
        ? r3(clicksPctVsPrevious - expectedFromSeasonality)
        : null;
    seasonalityAdjusted = { clicksPctVsPrevious, expectedFromSeasonality, excess };
  }

  return {
    current: current && metricOut(current),
    previous: previous && metricOut(previous),
    lastYear: lastYear && metricOut(lastYear),
    lastYearPrevious: lastYearPrevious && metricOut(lastYearPrevious),
    deltas: {
      vsPrevious: totalsDelta(current, previous),
      vsLastYear: totalsDelta(current, lastYear),
    },
    seasonalityAdjusted,
  };
}

function computeDailySeries(raw) {
  const rows = raw.current?.date;
  if (!rows) return { error: 'missing current date data' };
  return rows
    .map((row) => ({
      date: row.keys?.[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      position: r3(row.position || 0),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function buildSegmentList(keyFn, raw, caps, sortKey = 'impressions') {
  const cur = mapByKey(raw.current?.page, keyFn);
  const prev = mapByKey(raw.previous?.page, keyFn);
  const ly = mapByKey(raw.lastYear?.page, keyFn);

  const out = [];
  for (const [key, m] of cur) {
    out.push({
      key,
      current: metricOut(m),
      deltas: { vsPrevious: segDelta(m, prev.get(key)), vsLastYear: segDelta(m, ly.get(key)) },
      _sort: m[sortKey] || 0,
    });
  }
  out.sort((a, b) => b._sort - a._sort);
  return out.map(({ _sort, ...rest }) => rest);
}

function buildKeyedList(dimName, raw, { normalizeKey = (k) => k } = {}) {
  const keyFn = (row) => normalizeKey(row.keys?.[0]);
  const cur = mapByKey(raw.current?.[dimName], keyFn);
  const prev = mapByKey(raw.previous?.[dimName], keyFn);
  const ly = mapByKey(raw.lastYear?.[dimName], keyFn);

  const out = [];
  for (const [key, m] of cur) {
    out.push({
      key,
      current: metricOut(m),
      deltas: { vsPrevious: segDelta(m, prev.get(key)), vsLastYear: segDelta(m, ly.get(key)) },
      _sort: m.impressions || 0,
    });
  }
  out.sort((a, b) => b._sort - a._sort);
  return out.map(({ _sort, ...rest }) => rest);
}

function computeCtrCurve(raw) {
  const rows = raw.current?.query;
  if (!rows) return { error: 'missing current query data' };

  // Impression-WEIGHTED CTR per integer position: Σclicks / Σimpressions.
  // (A median/mean of per-query CTRs collapses to ~0 because most queries at any
  // position have zero clicks — that was the bug.)
  const byPos = new Map(); // pos -> { clicks, impressions, sampleSize }
  for (const row of rows) {
    const pos = Math.round(row.position || 0);
    if (pos < 1 || pos > 20) continue;
    const b = byPos.get(pos) || { clicks: 0, impressions: 0, sampleSize: 0 };
    b.clicks += row.clicks || 0;
    b.impressions += row.impressions || 0;
    b.sampleSize += 1;
    byPos.set(pos, b);
  }

  // Anchors: positions with enough evidence (>=5 queries AND >=200 impressions).
  const anchors = [];
  for (let pos = 1; pos <= 20; pos++) {
    const b = byPos.get(pos);
    if (!b || b.sampleSize < CTR_CURVE_SAMPLE_MIN || b.impressions < CTR_CURVE_IMPR_MIN) continue;
    anchors.push({ pos, weightedCtr: b.clicks / b.impressions, weight: b.impressions });
  }

  if (!anchors.length) {
    return {
      note: 'no position cleared the sample/impression gate — CTR curve unavailable',
      targetPos: null,
      byPosition: {},
    };
  }

  // Isotonic regression (weighted PAVA), NON-INCREASING in position: CTR must not
  // rise as rank worsens. Pools adjacent violators instead of the cruder cumulative
  // min, so a single noisy anchor does not drag the whole tail down.
  const isotonic = isotonicNonIncreasing(anchors.map((a) => ({ pos: a.pos, value: a.weightedCtr, weight: a.weight })));
  const monoAnchors = anchors.map((a) => ({ pos: a.pos, ctr: isotonic.get(a.pos) }));

  // Continuous 1..20 curve: linear interpolation between monotone anchors, with a
  // flat hold before the first and after the last anchor.
  const smoothedAt = (pos) => {
    const first = monoAnchors[0];
    const last = monoAnchors[monoAnchors.length - 1];
    if (pos <= first.pos) return first.ctr;
    if (pos >= last.pos) return last.ctr;
    for (let i = 0; i < monoAnchors.length - 1; i++) {
      const lo = monoAnchors[i];
      const hi = monoAnchors[i + 1];
      if (pos >= lo.pos && pos <= hi.pos) {
        const t = (pos - lo.pos) / (hi.pos - lo.pos);
        return lo.ctr + t * (hi.ctr - lo.ctr);
      }
    }
    return last.ctr;
  };

  const anchorPositions = new Set(anchors.map((a) => a.pos));
  const byPosition = {};
  for (let pos = 1; pos <= 20; pos++) {
    const b = byPos.get(pos);
    byPosition[pos] = {
      weightedCtr: b && b.impressions ? r3(b.clicks / b.impressions) : null,
      smoothedCtr: r3(smoothedAt(pos)),
      sampleSize: b ? b.sampleSize : 0,
      totalImpressions: b ? b.impressions : 0,
      interpolated: !anchorPositions.has(pos),
    };
  }

  // Uplift target: position 3 if the (continuous) curve has a value there, else the
  // nearest position <= 3 that does — recorded in meta.ctrCurveTargetPos.
  let targetPos = CTR_CURVE_TARGET_POS;
  if (!byPosition[targetPos] || typeof byPosition[targetPos].smoothedCtr !== 'number') {
    targetPos = null;
    for (let p = CTR_CURVE_TARGET_POS; p >= 1; p--) {
      if (byPosition[p] && typeof byPosition[p].smoothedCtr === 'number') { targetPos = p; break; }
    }
  }

  return {
    note:
      `impression-weighted CTR per integer position (Σclicks/Σimpressions); anchored on positions with ` +
      `>=${CTR_CURVE_SAMPLE_MIN} queries AND >=${CTR_CURVE_IMPR_MIN} impressions, isotonic (non-increasing) ` +
      `smoothing, linearly interpolated to a continuous 1..20 curve. Shows raw weightedCtr and smoothedCtr.`,
    targetPos,
    byPosition,
  };
}

// Weighted pool-adjacent-violators: returns Map(pos -> value) enforcing a
// non-increasing sequence over ascending positions (input sorted by pos asc).
function isotonicNonIncreasing(points) {
  const blocks = [];
  for (const p of points) {
    let cur = { value: p.value, weight: p.weight || 1, items: [p.pos] };
    while (blocks.length && blocks[blocks.length - 1].value < cur.value) {
      const prev = blocks.pop();
      const weight = prev.weight + cur.weight;
      cur = {
        value: (prev.value * prev.weight + cur.value * cur.weight) / weight,
        weight,
        items: [...prev.items, ...cur.items],
      };
    }
    blocks.push(cur);
  }
  const out = new Map();
  for (const b of blocks) for (const pos of b.items) out.set(pos, b.value);
  return out;
}

/** Smoothed CTR from the (continuous) curve at a position. */
function curveCtrAt(curve, pos) {
  if (!curve?.byPosition) return null;
  const target = Math.max(1, Math.min(20, Math.round(pos)));
  const entry = curve.byPosition[target];
  if (entry && typeof entry.smoothedCtr === 'number') return entry.smoothedCtr;
  // Safety net for an empty/partial curve: nearest position with a smoothed value.
  for (let d = 1; d <= 20; d++) {
    const lo = curve.byPosition[target - d];
    if (lo && typeof lo.smoothedCtr === 'number') return lo.smoothedCtr;
    const hi = curve.byPosition[target + d];
    if (hi && typeof hi.smoothedCtr === 'number') return hi.smoothedCtr;
  }
  return null;
}

// Volume-adaptive analysis floors.
//
// The CTR-gap and cannibalisation detectors used to carry fixed floors (100
// impressions for a query×page row, 30 per competing URL) sized for a much
// bigger property. On this site they were silently DEAD: the 2026-07-27
// snapshot reported "0 rows >= 100 impr" and 0 cannibalisation, while the data
// held a clean 4-way self-competition on «παραλίες αργολιδασ» (four of our own
// URLs at 15/12/12/9 impressions, all 0 clicks) and a region-hub page type
// earning 0 clicks on 206 impressions. A detector that cannot fire is worse
// than no detector — it reads as "checked, nothing found".
//
// So the floors scale with the property's own current-period impressions, and
// the resulting numbers are recorded in meta.thresholds so a future reader can
// see what the run actually required.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function analysisFloors(totalImpressions) {
  const impressions = Number.isFinite(totalImpressions) ? totalImpressions : 0;
  return {
    // A query×page row worth judging on CTR: ~0.05% of site impressions.
    ctrGapMinImpressions: clamp(Math.round(impressions * 0.0005), 20, 100),
    // A page worth judging in aggregate: ~0.15% of site impressions.
    pageCtrGapMinImpressions: clamp(Math.round(impressions * 0.0015), 50, 300),
    // A query whose impressions are split across our own URLs: ~0.1%.
    cannibalQueryMinImpressions: clamp(Math.round(impressions * 0.001), 10, 200),
    // Per-URL floor stays small and fixed — the point is the SPLIT, not the
    // size of each shard. Below 3 impressions a URL is crawl noise.
    cannibalUrlMinImpressions: 3,
  };
}

function computeStrikingDistance(raw, curve, cap) {
  const rows = raw.current?.query_page;
  if (!rows) return { error: 'missing current query+page data' };
  const targetPos = curve?.targetPos ?? null;
  const targetCtr = targetPos == null ? null : curveCtrAt(curve, targetPos);
  if (targetCtr == null) return { error: 'ctrCurve target position unavailable' };

  const out = [];
  for (const row of rows) {
    const position = row.position || 0;
    const impressions = row.impressions || 0;
    if (position < 4 || position > 15 || impressions < 40) continue;
    const ctr = row.ctr || 0;
    // Uplift is only the POSITIVE headroom to the target-position CTR. A query
    // already outperforming the curve has no room from ranking better -> 0.
    const estClicks = impressions * Math.max(0, targetCtr - ctr);
    out.push({
      query: row.keys?.[0],
      page: toPath(row.keys?.[1]),
      impressions,
      clicks: row.clicks || 0,
      ctr: r3(ctr),
      position: r3(position),
      targetPos,
      targetCtr: r3(targetCtr),
      estClicks: r1(estClicks),
    });
  }
  out.sort((a, b) => b.estClicks - a.estClicks);
  return out.slice(0, cap);
}

function computeCtrGaps(raw, curve, cap, floors) {
  const rows = raw.current?.query_page;
  if (!rows) return { error: 'missing current query+page data' };
  const minImpressions = floors.ctrGapMinImpressions;

  let considered = 0;
  let hadCurve = 0;
  let belowThreshold = 0;
  const out = [];
  for (const row of rows) {
    const impressions = row.impressions || 0;
    if (impressions < minImpressions) continue;
    considered += 1;
    const position = row.position || 0;
    const expectedCtr = curveCtrAt(curve, Math.round(position)); // smoothed CTR at rounded position
    if (expectedCtr == null || expectedCtr <= 0) continue;
    hadCurve += 1;
    const ctr = row.ctr || 0;
    if (ctr >= 0.6 * expectedCtr) continue;
    belowThreshold += 1;
    out.push({
      query: row.keys?.[0],
      page: toPath(row.keys?.[1]),
      impressions,
      clicks: row.clicks || 0,
      ctr: r3(ctr),
      position: r3(position),
      expectedCtr: r3(expectedCtr),
      ctrRatio: expectedCtr ? r3(ctr / expectedCtr) : null,
      _lost: impressions * (expectedCtr - ctr),
    });
  }
  // Diagnostic so an empty result is explainable (not silently "no gaps").
  log(`  ctrGaps: ${considered} rows >=${minImpressions} impr → ${hadCurve} had a curve value → ${belowThreshold} below 0.6× threshold`);
  out.sort((a, b) => b._lost - a._lost);
  return out.slice(0, cap).map(({ _lost, ...rest }) => rest);
}

/**
 * Page-level CTR gaps: the same "below the curve" test, but on a whole PAGE
 * rather than one query×page row.
 *
 * A page can be invisible to the per-row test and still be the biggest loss on
 * the site: the region hubs earned 0 clicks on 206 impressions spread over 66
 * small query×page rows, none of which cleared any per-row floor. Aggregating
 * first is what makes that legible. Position is impression-weighted, so a page
 * that ranks 9th for its big query and 40th for a long tail is judged where its
 * impressions actually are.
 */
function computePageCtrGaps(raw, curve, cap, floors) {
  const rows = raw.current?.query_page;
  if (!rows) return { error: 'missing current query+page data' };
  const minImpressions = floors.pageCtrGapMinImpressions;

  const byPage = new Map();
  for (const row of rows) {
    const page = row.keys?.[1];
    if (!page) continue;
    const impressions = row.impressions || 0;
    const agg = byPage.get(page) || { impressions: 0, clicks: 0, weightedPos: 0, queries: 0 };
    agg.impressions += impressions;
    agg.clicks += row.clicks || 0;
    agg.weightedPos += (row.position || 0) * impressions;
    agg.queries += 1;
    byPage.set(page, agg);
  }

  const out = [];
  for (const [page, agg] of byPage) {
    if (agg.impressions < minImpressions) continue;
    const position = agg.impressions > 0 ? agg.weightedPos / agg.impressions : 0;
    const expectedCtr = curveCtrAt(curve, Math.round(position));
    if (expectedCtr == null || expectedCtr <= 0) continue;
    const ctr = agg.clicks / agg.impressions;
    if (ctr >= 0.6 * expectedCtr) continue;
    const seg = parseUrl(page);
    out.push({
      page: toPath(page),
      pageType: seg.pageType,
      locale: seg.locale,
      queries: agg.queries,
      impressions: agg.impressions,
      clicks: agg.clicks,
      ctr: r3(ctr),
      position: r3(position),
      expectedCtr: r3(expectedCtr),
      ctrRatio: expectedCtr ? r3(ctr / expectedCtr) : null,
      lostClicks: r1(agg.impressions * (expectedCtr - ctr)),
    });
  }
  log(`  pageCtrGaps: ${byPage.size} pages → ${out.length} below 0.6× the curve at >=${minImpressions} impr`);
  out.sort((a, b) => b.lostClicks - a.lostClicks);
  return out.slice(0, cap);
}

function computeZeroClick(raw, cap) {
  const rows = raw.current?.page;
  if (!rows) return { error: 'missing current page data' };

  const out = [];
  for (const row of rows) {
    const impressions = row.impressions || 0;
    if (impressions < 100 || (row.clicks || 0) !== 0) continue;
    const seg = parseUrl(row.keys?.[0]);
    out.push({
      page: toPath(row.keys?.[0]),
      impressions,
      clicks: 0,
      position: r3(row.position || 0),
      locale: seg.locale,
      pageType: seg.pageType,
      region: seg.region,
    });
  }
  out.sort((a, b) => b.impressions - a.impressions);
  return out.slice(0, cap);
}

function computeCannibalization(raw, cap, floors) {
  const rows = raw.current?.query_page;
  if (!rows) return { error: 'missing current query+page data' };
  const urlMin = floors.cannibalUrlMinImpressions;
  const queryMin = floors.cannibalQueryMinImpressions;

  const byQuery = new Map();
  for (const row of rows) {
    const q = row.keys?.[0];
    if (q == null) continue;
    const list = byQuery.get(q) || [];
    list.push(row);
    byQuery.set(q, list);
  }

  const out = [];
  for (const [query, list] of byQuery) {
    // Gate on the QUERY's total impressions, not on each shard: cannibalisation
    // is precisely the case where no single URL is big — four of our own URLs
    // at 15/12/12/9 impressions is the defect, and a per-URL floor of 30 hid it.
    const competing = list.filter((row) => (row.impressions || 0) >= urlMin);
    if (competing.length < 2) continue;
    const queryImpressions = competing.reduce((sum, row) => sum + (row.impressions || 0), 0);
    if (queryImpressions < queryMin) continue;
    const urls = competing
      .map((row) => {
        const seg = parseUrl(row.keys?.[1]);
        return {
          page: toPath(row.keys?.[1]),
          impressions: row.impressions || 0,
          clicks: row.clicks || 0,
          position: r3(row.position || 0),
          _pageType: seg.pageType,
        };
      })
      .sort((a, b) => b.impressions - a.impressions);
    const hasRegion = urls.some((u) => u._pageType === 'region');
    const hasBeach = urls.some((u) => u._pageType === 'beach');
    out.push({
      query,
      urls: urls.map(({ _pageType, ...rest }) => rest),
      urlCount: urls.length,
      regionVsBeachConflict: hasRegion && hasBeach,
      totalImpressions: urls.reduce((sum, u) => sum + u.impressions, 0),
    });
  }
  out.sort((a, b) => b.totalImpressions - a.totalImpressions);
  return out.slice(0, cap);
}

/**
 * seasonalityLikely: did the same move happen last year at this time?
 *   ownDelta  = (cur  - prev)  / max(prev, 1)
 *   yearDelta = (lastY - lastYPrev) / max(lastYPrev, 1)
 *   true  if same sign AND |yearDelta| >= 0.5 * |ownDelta|
 *   null  if there is no last-year data for this key at all
 */
function seasonalityLikely(cur, prev, lyCur, lyPrev, hasLastYear) {
  if (!hasLastYear) return null;
  const ownDelta = (cur - prev) / Math.max(prev, 1);
  const yearDelta = (lyCur - lyPrev) / Math.max(lyPrev, 1);
  const sameSign = (ownDelta > 0 && yearDelta > 0) || (ownDelta < 0 && yearDelta < 0);
  return sameSign && Math.abs(yearDelta) >= 0.5 * Math.abs(ownDelta);
}

function computeRisingDecaying(raw, dimName, cap) {
  const cur = mapByKey(raw.current?.[dimName], (row) => row.keys?.[0]);
  const prev = mapByKey(raw.previous?.[dimName], (row) => row.keys?.[0]);
  const ly = mapByKey(raw.lastYear?.[dimName], (row) => row.keys?.[0]);
  const lyPrev = mapByKey(raw.lastYearPrevious?.[dimName], (row) => row.keys?.[0]);
  if (!raw.current?.[dimName] || !raw.previous?.[dimName]) {
    return { error: `missing current/previous ${dimName} data` };
  }

  const keys = new Set([...cur.keys(), ...prev.keys()]);
  const rows = [];
  for (const key of keys) {
    const curClicks = cur.get(key)?.clicks || 0;
    const prevClicks = prev.get(key)?.clicks || 0;
    const hasLastYear = ly.has(key) || lyPrev.has(key);
    rows.push({
      key,
      clicksCurrent: curClicks,
      clicksPrevious: prevClicks,
      clicksDelta: curClicks - prevClicks,
      seasonalityLikely: seasonalityLikely(
        curClicks,
        prevClicks,
        ly.get(key)?.clicks || 0,
        lyPrev.get(key)?.clicks || 0,
        hasLastYear,
      ),
    });
  }

  const label = dimName === 'query' ? 'query' : 'page';
  const shape = (r) => ({
    [label]: dimName === 'page' ? toPath(r.key) : r.key,
    clicksCurrent: r.clicksCurrent,
    clicksPrevious: r.clicksPrevious,
    clicksDelta: r.clicksDelta,
    seasonalityLikely: r.seasonalityLikely,
  });

  const rising = [...rows].filter((r) => r.clicksDelta > 0).sort((a, b) => b.clicksDelta - a.clicksDelta).slice(0, cap).map(shape);
  const decaying = [...rows].filter((r) => r.clicksDelta < 0).sort((a, b) => a.clicksDelta - b.clicksDelta).slice(0, cap).map(shape);
  return { rising, decaying };
}

function computeNewQueries(raw, cap) {
  if (!raw.current?.query || !raw.previous?.query) return { error: 'missing current/previous query data' };
  const cur = mapByKey(raw.current.query, (row) => row.keys?.[0]);
  const prev = mapByKey(raw.previous.query, (row) => row.keys?.[0]);

  const out = [];
  for (const [key, m] of cur) {
    if ((m.impressions || 0) <= 0) continue;
    const before = prev.get(key);
    if (before && before.impressions > 0) continue; // existed before -> not new
    out.push({
      query: key,
      impressions: m.impressions,
      clicks: m.clicks,
      ctr: r3(m.ctr),
      position: r3(m.position),
    });
  }
  out.sort((a, b) => b.impressions - a.impressions);
  return out.slice(0, cap);
}

// Locale -> "correct" audience country codes (GSC uses lowercase ISO-3).
const LOCALE_COUNTRIES = {
  el: ['grc'],
  de: ['deu'],
  fr: ['fra'],
  it: ['ita'],
  en: ['usa', 'gbr', 'aus', 'can', 'irl', 'nzl'],
};

function computeLocaleCountryMatch(raw, cap) {
  const rows = raw.current?.page_country;
  if (!rows) return { error: 'missing current page+country data' };

  // locale -> Map(country -> impressions)
  const byLocale = new Map();
  for (const row of rows) {
    const locale = parseUrl(row.keys?.[0]).locale;
    const country = row.keys?.[1];
    if (!country) continue;
    const inner = byLocale.get(locale) || new Map();
    inner.set(country, (inner.get(country) || 0) + (row.impressions || 0));
    byLocale.set(locale, inner);
  }

  const out = [];
  for (const [locale, inner] of byLocale) {
    const totalImpressions = [...inner.values()].reduce((s, v) => s + v, 0);
    const ranked = [...inner.entries()].sort((a, b) => b[1] - a[1]);
    const topCountries = ranked.slice(0, cap).map(([country, impressions]) => ({
      country,
      impressions,
      share: totalImpressions ? r3(impressions / totalImpressions) : 0,
    }));
    const matchSet = LOCALE_COUNTRIES[locale] || [];
    const matchedImpr = ranked.filter(([c]) => matchSet.includes(c)).reduce((s, [, v]) => s + v, 0);
    const matchedShare = totalImpressions ? r3(matchedImpr / totalImpressions) : 0;
    let verdict;
    if (totalImpressions < 100) verdict = 'no_traffic';
    else if (matchedShare >= 0.4) verdict = 'working';
    else verdict = 'wrong_audience';
    out.push({ locale, totalImpressions, topCountries, matchedShare, verdict });
  }
  out.sort((a, b) => b.totalImpressions - a.totalImpressions);
  return out;
}

async function computeContentInventory(raw, cap) {
  const beachesDir = path.join(projectRoot, 'public', 'data', 'beaches');
  let entries;
  try {
    entries = await readdir(beachesDir, { withFileTypes: true });
  } catch (error) {
    return { error: `cannot read ${beachesDir}: ${error.message}` };
  }
  const regionFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.json'));

  // Beach ids seen in GSC (any beach page with impressions > 0).
  const seenIds = new Set();
  for (const row of raw.current?.page || []) {
    const seg = parseUrl(row.keys?.[0]);
    if (seg.pageType === 'beach' && (row.impressions || 0) > 0 && seg.beachId != null) {
      seenIds.add(seg.beachId);
    }
  }

  const allIds = new Set();
  const perRegion = [];
  for (const file of regionFiles) {
    let beaches;
    try {
      beaches = JSON.parse(await readFile(path.join(beachesDir, file.name), 'utf8'));
    } catch {
      continue;
    }
    if (!Array.isArray(beaches)) continue;
    const region = file.name.replace(/\.json$/, '');
    let seen = 0;
    for (const beach of beaches) {
      if (beach?.id == null) continue;
      allIds.add(beach.id);
      if (seenIds.has(beach.id)) seen += 1;
    }
    perRegion.push({ region, total: beaches.length, seenInGsc: seen, invisible: beaches.length - seen });
  }

  const totalBeaches = allIds.size;
  const beachesSeenInGsc = [...allIds].filter((id) => seenIds.has(id)).length;
  perRegion.sort((a, b) => b.invisible - a.invisible);

  return {
    totalBeaches,
    // Every beach in the dataset gets a prerendered detail page.
    beachesWithPage: totalBeaches,
    beachesSeenInGsc,
    invisibleBeaches: totalBeaches - beachesSeenInGsc,
    byRegion: perRegion.slice(0, cap),
    note: 'Regions sorted by invisible count desc; beachesWithPage assumes every dataset beach is prerendered.',
  };
}

const toPath = (pageUrl) => {
  if (pageUrl == null) return pageUrl;
  try {
    return new URL(pageUrl).pathname;
  } catch {
    return pageUrl;
  }
};

// ---------------------------------------------------------------------------
// Assembly + token budget
// ---------------------------------------------------------------------------

// Which country each localized page was BUILT for. Greece is called out on its
// own because it is the interesting third case: a German/French/Italian URL
// being served to somebody searching from Greece.
const GREECE = 'grc';
const LOCALIZED_LOCALES = ['de', 'fr', 'it'];

/**
 * Splits every /de/, /fr/ and /it/ page's impressions and clicks three ways —
 * its own country, Greece, everywhere else — and reports the CTR of each.
 *
 * Written 21/08/2026 to settle one question that locale-level data could not.
 * The audit found 88 queries where the SAME beach, in different languages,
 * competes with itself: 1.556 impressions and 6 clicks, a 0,39% CTR and the
 * worst-converting slice of the whole site. `rovinia beach` (an ENGLISH query)
 * returns our Italian page 114 times and gets zero clicks. hreflang is clean
 * (0 errors across 9.539 pages, checked in the build), so the fix depends
 * entirely on WHERE those impressions happen, and the two answers need
 * completely different work:
 *
 *   - mostly in its own country, CTR near zero  → the SERP snippet is the
 *     problem. Title and description work, not routing.
 *   - mostly in Greece                          → Google is picking the wrong
 *     URL out of the hreflang cluster. Nobody in Greece wants an Italian
 *     title, so the clicks were never available. Routing work, not copy.
 *
 * Reports both numbers instead of choosing, because a mixed picture is a real
 * outcome and rounding it to one verdict is how a measurement starts lying.
 */
function computeLocalizedAudience(raw, cap) {
  const rows = raw.current?.page_country;
  if (!rows) return { error: 'missing current page+country data' };

  const emptyBucket = () => ({ impressions: 0, clicks: 0 });
  const withCtr = (b) => ({ ...b, ctr: b.impressions ? r3(b.clicks / b.impressions) : 0 });

  const byLocale = new Map();
  const byPage = new Map();

  for (const row of rows) {
    const pageUrl = row.keys?.[0];
    const country = row.keys?.[1];
    if (!pageUrl || !country) continue;
    const { locale } = parseUrl(pageUrl);
    if (!LOCALIZED_LOCALES.includes(locale)) continue;

    const own = LOCALE_COUNTRIES[locale] || [];
    const bucket = own.includes(country) ? 'own' : country === GREECE ? 'greece' : 'elsewhere';

    for (const [map, key] of [[byLocale, locale], [byPage, pageUrl]]) {
      const entry = map.get(key) || { locale, own: emptyBucket(), greece: emptyBucket(), elsewhere: emptyBucket() };
      entry[bucket].impressions += row.impressions || 0;
      entry[bucket].clicks += row.clicks || 0;
      map.set(key, entry);
    }
  }

  const totalOf = (e) => ({
    impressions: e.own.impressions + e.greece.impressions + e.elsewhere.impressions,
    clicks: e.own.clicks + e.greece.clicks + e.elsewhere.clicks,
  });

  const locales = [...byLocale.entries()]
    .map(([locale, e]) => {
      const total = totalOf(e);
      const greeceShare = total.impressions ? r3(e.greece.impressions / total.impressions) : 0;
      const ownShare = total.impressions ? r3(e.own.impressions / total.impressions) : 0;
      // Deliberately conservative: below 100 impressions nothing is claimed.
      let reading;
      if (total.impressions < 100) reading = 'no_traffic';
      // NOT 'Google picked the wrong URL'. GSC reports the country the searcher is
      // IN, never the language they searched in — and Greece in August is full of
      // Italian, German and French tourists. An Italian page served to somebody
      // sitting in Corfu may be exactly right. This label says WHERE, not WHETHER.
      else if (greeceShare >= 0.4) reading = 'mostly_served_inside_greece';
      else if (e.own.impressions >= 100 && e.own.clicks / e.own.impressions < 0.01) reading = 'low_ctr_in_own_country';
      else reading = 'healthy';
      return {
        locale,
        total: withCtr(total),
        own: withCtr(e.own),
        greece: withCtr(e.greece),
        elsewhere: withCtr(e.elsewhere),
        ownShare,
        greeceShare,
        reading,
      };
    })
    .sort((a, b) => b.total.impressions - a.total.impressions);

  const worstPages = [...byPage.entries()]
    .map(([page, e]) => {
      const total = totalOf(e);
      return {
        page: page.startsWith('http') ? new URL(page).pathname : page,
        locale: e.locale,
        impressions: total.impressions,
        clicks: total.clicks,
        ownShare: total.impressions ? r3(e.own.impressions / total.impressions) : 0,
        greeceShare: total.impressions ? r3(e.greece.impressions / total.impressions) : 0,
        ctr: total.impressions ? r3(total.clicks / total.impressions) : 0,
        own: withCtr(e.own),
        greece: withCtr(e.greece),
      };
    })
    .filter((p) => p.impressions >= 20)
    // Worst first means lowest CTR first, not most impressions first: a page with
    // 150 impressions and 12 clicks is working and must not head a problem list.
    .sort((a, b) => a.ctr - b.ctr || b.impressions - a.impressions)
    .slice(0, cap);

  return {
    note:
      'de/fr/it pages only. own = the country the language targets, greece = the searcher was in Greece. '
      + 'GSC gives country, never language, so "greece" includes foreign tourists already here — read it as WHERE, not as a fault. '
      + 'Compare every CTR against ctrCurve at the same position before calling anything broken: at position 9 the whole site earns 1%.',
    byLocale: locales,
    worstPages,
  };
}

const CAPS_DEFAULT = {
  queries: 200,
  pages: 150,
  perAnalysis: 50,
  strikingDistance: 40,
  ctrGaps: 30,
  pageCtrGaps: 25,
  zeroClick: 30,
  cannibalization: 20,
  risingDecaying: 20,
  newQueries: 30,
  byRegion: 50,
  byCountry: 20,
  localizedAudiencePages: 25,
  contentRegions: 50,
  localeMatchCountries: 5,
};

const CAPS_TIGHT = {
  queries: 120,
  pages: 100,
  perAnalysis: 30,
  strikingDistance: 30,
  ctrGaps: 20,
  pageCtrGaps: 15,
  zeroClick: 20,
  cannibalization: 15,
  risingDecaying: 15,
  newQueries: 20,
  byRegion: 30,
  byCountry: 15,
  contentRegions: 30,
  localeMatchCountries: 5,
};

/** Wrap an analysis: on throw, store {error} instead of aborting the whole run. */
function guard(errors, key, fn) {
  try {
    const value = fn();
    if (value && value.error) errors[key] = value.error;
    return value;
  } catch (error) {
    const message = String(error?.message || error);
    errors[key] = message;
    return { error: message };
  }
}

async function guardAsync(errors, key, fn) {
  try {
    const value = await fn();
    if (value && value.error) errors[key] = value.error;
    return value;
  } catch (error) {
    const message = String(error?.message || error);
    errors[key] = message;
    return { error: message };
  }
}

function sliceIf(value, n) {
  return Array.isArray(value) ? value.slice(0, n) : value;
}

/** Re-slice the fully computed parts to a given cap set. */
function assemble(meta, parts, caps) {
  const rd = parts.risingDecaying;
  const rdPages = parts.risingDecayingPages;
  return {
    meta: { ...meta, caps },
    totals: parts.totals,
    dailySeries: sliceIf(parts.dailySeries, 400),
    bySegment: {
      byLocale: parts.byLocale,
      byPageType: parts.byPageType,
      byRegion: sliceIf(parts.byRegion, caps.byRegion),
      byCountry: sliceIf(parts.byCountry, caps.byCountry),
      byDevice: parts.byDevice,
    },
    localeCountryMatch: Array.isArray(parts.localeCountryMatch)
      ? parts.localeCountryMatch.map((l) => ({ ...l, topCountries: sliceIf(l.topCountries, caps.localeMatchCountries) }))
      : parts.localeCountryMatch,
    localizedAudience: parts.localizedAudience,
    ctrCurve: parts.ctrCurve,
    strikingDistance: sliceIf(parts.strikingDistance, caps.strikingDistance),
    ctrGaps: sliceIf(parts.ctrGaps, caps.ctrGaps),
    pageCtrGaps: sliceIf(parts.pageCtrGaps, caps.pageCtrGaps),
    zeroClick: sliceIf(parts.zeroClick, caps.zeroClick),
    cannibalization: sliceIf(parts.cannibalization, caps.cannibalization),
    risingDecaying: {
      risingQueries: rd?.error ? rd : sliceIf(rd?.rising, caps.risingDecaying),
      decayingQueries: rd?.error ? rd : sliceIf(rd?.decaying, caps.risingDecaying),
      risingPages: rdPages?.error ? rdPages : sliceIf(rdPages?.rising, caps.risingDecaying),
      decayingPages: rdPages?.error ? rdPages : sliceIf(rdPages?.decaying, caps.risingDecaying),
    },
    newQueries: sliceIf(parts.newQueries, caps.newQueries),
    contentInventory: parts.contentInventory,
    errors: parts.errors,
  };
}

// ---------------------------------------------------------------------------
// Markdown digest
// ---------------------------------------------------------------------------

function line(metric) {
  if (!metric) return 'n/a';
  return `${metric.clicks} clicks · ${metric.impressions} impr · ctr ${metric.ctr} · pos ${metric.position}`;
}

function buildDigest(snapshot) {
  const { meta, totals, bySegment, localeCountryMatch, localizedAudience, strikingDistance, ctrGaps, pageCtrGaps, zeroClick, contentInventory, errors } = snapshot;
  const out = [];
  out.push(`# SEO snapshot — ${isoDay(new Date())}`);
  out.push('');
  out.push(`Property: \`${meta.siteUrl}\` (${meta.propertyType})`);
  out.push('');
  out.push('## Periods');
  out.push('| period | start | end | days |');
  out.push('| --- | --- | --- | --- |');
  for (const [name, p] of Object.entries(meta.periods)) out.push(`| ${name} | ${p.start} | ${p.end} | ${p.days} |`);
  out.push('');

  out.push('## Totals');
  out.push(`- current: ${line(totals.current)}`);
  out.push(`- previous: ${line(totals.previous)}`);
  out.push(`- lastYear: ${line(totals.lastYear)}`);
  const sa = totals.seasonalityAdjusted;
  if (sa) {
    out.push(
      `- **seasonality-adjusted excess: ${fmtPct(sa.excess)}** ` +
        `(ours ${fmtPct(sa.clicksPctVsPrevious)} − seasonal ${fmtPct(sa.expectedFromSeasonality)})`,
    );
  }
  // Low-data guard: a window with almost no impressions makes every delta noise.
  for (const [name, m] of Object.entries({
    current: totals.current,
    previous: totals.previous,
    lastYear: totals.lastYear,
    lastYearPrevious: totals.lastYearPrevious,
  })) {
    if (m && m.impressions < 100) {
      out.push(`> ⚠️ Period **${name}** has only ${m.impressions} impressions — ignore comparisons against it.`);
    }
  }
  out.push('');

  if (Array.isArray(bySegment.byLocale)) {
    out.push('## By locale');
    out.push('| locale | clicks | impr | ctr | pos | Δclicks vs prev |');
    out.push('| --- | --- | --- | --- | --- | --- |');
    for (const s of bySegment.byLocale) {
      out.push(`| ${s.key} | ${s.current.clicks} | ${s.current.impressions} | ${s.current.ctr} | ${s.current.position} | ${fmtPct(s.deltas.vsPrevious.clicksPct)} |`);
    }
    out.push('');
  }

  if (Array.isArray(bySegment.byDevice)) {
    out.push('## By device');
    out.push('| device | clicks | impr | ctr | pos | Δclicks vs prev |');
    out.push('| --- | --- | --- | --- | --- | --- |');
    for (const s of bySegment.byDevice) {
      out.push(`| ${s.key} | ${s.current.clicks} | ${s.current.impressions} | ${s.current.ctr} | ${s.current.position} | ${fmtPct(s.deltas.vsPrevious.clicksPct)} |`);
    }
    out.push('');
  }

  if (Array.isArray(localeCountryMatch)) {
    out.push('## Locale ↔ country match (Wave 1)');
    out.push('| locale | impressions | matched share | verdict | top country |');
    out.push('| --- | --- | --- | --- | --- |');
    for (const l of localeCountryMatch) {
      const top = l.topCountries?.[0];
      out.push(`| ${l.locale} | ${l.totalImpressions} | ${l.matchedShare} | ${l.verdict} | ${top ? `${top.country} (${top.share})` : 'n/a'} |`);
    }
    out.push('');
  }

  if (localizedAudience && Array.isArray(localizedAudience.byLocale)) {
    out.push('## Who actually sees the de/fr/it pages');
    out.push('| locale | impr | ctr | in own country | ctr there | in Greece | ctr there | reading |');
    out.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const l of localizedAudience.byLocale) {
      out.push(
        `| ${l.locale} | ${l.total.impressions} | ${l.total.ctr} | ${l.ownShare} | ${l.own.ctr} | ${l.greeceShare} | ${l.greece.ctr} | **${l.reading}** |`,
      );
    }
    out.push('');
    out.push('> `mostly_served_inside_greece` = most impressions happen in Greece. Could be Greek users getting the wrong');
    out.push('> language, or foreign tourists already here getting the right one — GSC reports country, not language.');
    out.push('> `low_ctr_in_own_country` = shown where it should be, still not clicked. Check ctrCurve at the same');
    out.push('> position first: at position 9 the whole site earns 1%, so this is only news if the position is good.');
    out.push('');
    if (localizedAudience.worstPages?.length) {
      out.push('### Localized pages earning the least per impression');
      for (const p of localizedAudience.worstPages.slice(0, 10)) {
        out.push(
          `- ${p.page} · ${p.impressions} impr · ${p.clicks} clicks · own ${p.ownShare} (ctr ${p.own.ctr}) · greece ${p.greeceShare} (ctr ${p.greece.ctr})`,
        );
      }
      out.push('');
    }
  }

  out.push('## Top striking-distance (est. clicks)');
  topRows(out, strikingDistance, (r) => `- \`${r.query}\` → ${r.page} · pos ${r.position} · +${r.estClicks} est`);
  out.push('');
  out.push('## Top CTR gaps');
  topRows(out, ctrGaps, (r) => `- \`${r.query}\` → ${r.page} · ctr ${r.ctr} vs exp ${r.expectedCtr} (ratio ${r.ctrRatio})`);
  out.push('');
  out.push('## Page-level CTR gaps (whole page below the curve)');
  topRows(out, pageCtrGaps, (r) => `- ${r.page} · ${r.impressions} impr · ${r.clicks} clicks · ctr ${r.ctr} vs exp ${r.expectedCtr} · pos ${r.position} · ~${r.lostClicks} clicks lost`);
  out.push('');
  out.push('## Top zero-click pages');
  topRows(out, zeroClick, (r) => `- ${r.page} · ${r.impressions} impr · pos ${r.position}`);
  out.push('');

  if (contentInventory && !contentInventory.error) {
    out.push('## Content inventory');
    out.push(
      `- ${contentInventory.invisibleBeaches} invisible of ${contentInventory.totalBeaches} beaches ` +
        `(${contentInventory.beachesSeenInGsc} seen in GSC)`,
    );
    out.push('');
  }

  const errorKeys = Object.keys(errors || {});
  if (errorKeys.length) {
    out.push('## Errors (isolated — run still completed)');
    for (const key of errorKeys) out.push(`- \`${key}\`: ${errors[key]}`);
    out.push('');
  }

  out.push(`_JSON size: ${(meta.jsonBytes / 1024).toFixed(1)} KB_`);
  return out.join('\n');
}

const fmtPct = (v) => (v == null ? 'n/a' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`);
function topRows(out, list, fmt, n = 5) {
  if (!Array.isArray(list) || !list.length) {
    out.push(list?.error ? `- (error: ${list.error})` : '- (none)');
    return;
  }
  for (const row of list.slice(0, n)) out.push(fmt(row));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await loadEnv();

  const siteUrl = process.env.GSC_SITE_URL?.trim();
  const keyPathRaw = process.env.GSC_SA_KEY_PATH?.trim() || './.secrets/gsc-key.json';
  if (!siteUrl) {
    console.error('\nMissing GSC_SITE_URL. See reports/README.md.');
    console.error('  Set it in .env, e.g. GSC_SITE_URL=sc-domain:calmbeach.gr');
    process.exit(1);
  }
  const keyPath = path.isAbsolute(keyPathRaw) ? keyPathRaw : path.join(projectRoot, keyPathRaw);
  try {
    await readFile(keyPath);
  } catch {
    console.error(`\nCannot read service-account key at: ${keyPath}`);
    console.error('  Set GSC_SA_KEY_PATH in .env and place the JSON key there. See reports/README.md.');
    process.exit(1);
  }

  let google;
  try {
    ({ google } = await import('googleapis'));
  } catch {
    console.error('\nMissing dependency "googleapis". Run: npm install');
    process.exit(1);
  }

  const propertyType = siteUrl.startsWith('sc-domain:') ? 'domain' : 'url-prefix';
  log(`Property: ${siteUrl} (${propertyType})`);

  const auth = new google.auth.GoogleAuth({ keyFile: keyPath, scopes: [SCOPE] });
  const client = google.webmasters({ version: 'v3', auth });

  const now = new Date();
  // All four windows are exactly 28 days (previously current was 29). current ends
  // at the 3-day GSC lag; previous is the contiguous 28 days before it; the last-
  // year pair is the same two windows shifted back 365 days.
  const periods = {
    current: { start: isoDay(daysAgo(now, 30)), end: isoDay(daysAgo(now, 3)) },
    previous: { start: isoDay(daysAgo(now, 58)), end: isoDay(daysAgo(now, 31)) },
    lastYear: { start: isoDay(daysAgo(now, 395)), end: isoDay(daysAgo(now, 368)) },
    lastYearPrevious: { start: isoDay(daysAgo(now, 423)), end: isoDay(daysAgo(now, 396)) },
  };
  for (const p of Object.values(periods)) p.days = inclusiveDays(p.start, p.end);

  // Which dimensions to fetch for each period (only what downstream analyses need).
  const plan = {
    current: ['date', 'query', 'page', 'query_page', 'country', 'device', 'page_country'],
    previous: ['date', 'query', 'page', 'country', 'device'],
    lastYear: ['date', 'query', 'page', 'country', 'device'],
    lastYearPrevious: ['date', 'query', 'page'],
  };
  const DIMENSIONS = {
    date: ['date'],
    query: ['query'],
    page: ['page'],
    query_page: ['query', 'page'],
    country: ['country'],
    device: ['device'],
    page_country: ['page', 'country'],
  };

  const errors = {};
  const raw = {};
  for (const [period, dims] of Object.entries(plan)) {
    raw[period] = {};
    const { start, end } = periods[period];
    log(`Fetching ${period} (${start}..${end})`);
    for (const dim of dims) {
      const label = `${period}/${dim}`;
      try {
        raw[period][dim] = await fetchDimension(client, siteUrl, start, end, DIMENSIONS[dim], label);
      } catch (error) {
        const message = String(error?.message || error);
        errors[`fetch.${label}`] = message;
        raw[period][dim] = null;
        log(`  ${label}: FAILED — ${message}`);
      }
    }
  }

  log('Computing analyses…');
  const curve = guard(errors, 'ctrCurve', () => computeCtrCurve(raw));
  // Floors scale with this property's own volume — see analysisFloors().
  const totalsForFloors = guard(errors, 'totals', () => computeTotals(raw));
  const floors = analysisFloors(totalsForFloors?.current?.impressions);
  log(`  thresholds: ctrGap>=${floors.ctrGapMinImpressions} impr, pageCtrGap>=${floors.pageCtrGapMinImpressions} impr, cannibal query>=${floors.cannibalQueryMinImpressions} impr (URL>=${floors.cannibalUrlMinImpressions})`);
  const parts = {
    totals: totalsForFloors,
    dailySeries: guard(errors, 'dailySeries', () => computeDailySeries(raw)),
    byLocale: guard(errors, 'bySegment.byLocale', () => buildSegmentList((row) => parseUrl(row.keys?.[0]).locale, raw)),
    byPageType: guard(errors, 'bySegment.byPageType', () => buildSegmentList((row) => parseUrl(row.keys?.[0]).pageType, raw)),
    byRegion: guard(errors, 'bySegment.byRegion', () => buildSegmentList((row) => parseUrl(row.keys?.[0]).region, raw)),
    byCountry: guard(errors, 'bySegment.byCountry', () => buildKeyedList('country', raw)),
    byDevice: guard(errors, 'bySegment.byDevice', () => buildKeyedList('device', raw, { normalizeKey: (k) => (k ? String(k).toLowerCase() : k) })),
    localeCountryMatch: guard(errors, 'localeCountryMatch', () => computeLocaleCountryMatch(raw, CAPS_DEFAULT.localeMatchCountries)),
    localizedAudience: guard(errors, 'localizedAudience', () => computeLocalizedAudience(raw, CAPS_DEFAULT.localizedAudiencePages)),
    ctrCurve: curve,
    strikingDistance: guard(errors, 'strikingDistance', () => computeStrikingDistance(raw, curve, CAPS_DEFAULT.strikingDistance)),
    ctrGaps: guard(errors, 'ctrGaps', () => computeCtrGaps(raw, curve, CAPS_DEFAULT.ctrGaps, floors)),
    pageCtrGaps: guard(errors, 'pageCtrGaps', () => computePageCtrGaps(raw, curve, CAPS_DEFAULT.pageCtrGaps, floors)),
    zeroClick: guard(errors, 'zeroClick', () => computeZeroClick(raw, CAPS_DEFAULT.zeroClick)),
    cannibalization: guard(errors, 'cannibalization', () => computeCannibalization(raw, CAPS_DEFAULT.cannibalization, floors)),
    risingDecaying: guard(errors, 'risingDecaying.query', () => computeRisingDecaying(raw, 'query', CAPS_DEFAULT.risingDecaying)),
    risingDecayingPages: guard(errors, 'risingDecaying.page', () => computeRisingDecaying(raw, 'page', CAPS_DEFAULT.risingDecaying)),
    newQueries: guard(errors, 'newQueries', () => computeNewQueries(raw, CAPS_DEFAULT.newQueries)),
    contentInventory: await guardAsync(errors, 'contentInventory', () => computeContentInventory(raw, CAPS_DEFAULT.contentRegions)),
    errors,
  };

  const meta = {
    generatedAt: now.toISOString(),
    siteUrl,
    propertyType,
    timezoneNote: 'GSC data is bucketed in America/Los_Angeles days',
    periods,
    lagDays: 3,
    ctrCurveSampleMin: CTR_CURVE_SAMPLE_MIN,
    ctrCurveImpressionMin: CTR_CURVE_IMPR_MIN,
    ctrCurveTargetPos: curve?.targetPos ?? null,
    // What this run actually required to flag something. Recorded because a
    // detector with an unreachable floor reports "nothing found" either way.
    thresholds: floors,
    jsonBytes: 0,
  };

  // Assemble, then shrink caps if we bust the token budget.
  let caps = CAPS_DEFAULT;
  let snapshot = assemble(meta, parts, caps);
  let json = JSON.stringify(snapshot);
  let bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > JSON_BUDGET_BYTES) {
    log(`JSON ${(bytes / 1024).toFixed(1)} KB > budget — tightening caps`);
    caps = CAPS_TIGHT;
    snapshot = assemble(meta, parts, caps);
    json = JSON.stringify(snapshot);
    bytes = Buffer.byteLength(json, 'utf8');
  }
  snapshot.meta.jsonBytes = bytes;
  json = JSON.stringify(snapshot, null, 2);

  const outDir = path.join(projectRoot, 'reports', 'snapshots');
  await mkdir(outDir, { recursive: true });
  const dayName = isoDay(now);
  const jsonPath = path.join(outDir, `${dayName}.json`);
  const mdPath = path.join(outDir, `${dayName}.md`);
  await writeFile(jsonPath, json, 'utf8');
  await writeFile(mdPath, buildDigest(snapshot), 'utf8');

  log(`Wrote ${path.relative(projectRoot, jsonPath)} (${(bytes / 1024).toFixed(1)} KB)`);
  log(`Wrote ${path.relative(projectRoot, mdPath)}`);
  const errorCount = Object.keys(errors).length;
  if (errorCount) log(`Completed with ${errorCount} isolated error(s) — see the "errors" key.`);
  else log('Completed with no errors.');
}

// Run only when invoked directly (so the pure functions can be imported/tested).
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error('\nseo-snapshot crashed:', error?.stack || error);
    process.exit(1);
  });
}

// Exported for local testing only — not used by the site.
export {
  parseUrl,
  sumRows,
  computeTotals,
  computeDailySeries,
  computeCtrCurve,
  curveCtrAt,
  computeStrikingDistance,
  computeCtrGaps,
  computeZeroClick,
  computeCannibalization,
  computeRisingDecaying,
  computeNewQueries,
  computeLocaleCountryMatch,
  buildSegmentList,
  buildKeyedList,
  seasonalityLikely,
  assemble,
  buildDigest,
};
