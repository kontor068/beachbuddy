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

  const byPos = new Map(); // integer position -> array of ctr values
  for (const row of rows) {
    const pos = Math.round(row.position || 0);
    if (pos < 1 || pos > 20) continue;
    const arr = byPos.get(pos) || [];
    arr.push(row.ctr || 0);
    byPos.set(pos, arr);
  }

  const byPosition = {};
  for (let pos = 1; pos <= 20; pos++) {
    const arr = byPos.get(pos);
    if (!arr || arr.length < 5) continue; // require >= 5 query samples
    byPosition[pos] = { medianCtr: r3(median(arr)), sampleSize: arr.length };
  }
  return {
    note: 'median CTR per integer position, positions with >=5 query samples only',
    byPosition,
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** CTR from the curve at a position, falling back to the nearest available <= pos. */
function curveCtrAt(curve, pos) {
  if (!curve?.byPosition) return null;
  const target = Math.max(1, Math.min(20, Math.round(pos)));
  for (let p = target; p >= 1; p--) {
    if (curve.byPosition[p]) return curve.byPosition[p].medianCtr;
  }
  for (let p = target + 1; p <= 20; p++) {
    if (curve.byPosition[p]) return curve.byPosition[p].medianCtr;
  }
  return null;
}

function computeStrikingDistance(raw, curve, cap) {
  const rows = raw.current?.query_page;
  if (!rows) return { error: 'missing current query+page data' };
  const ctrAtPos3 = curveCtrAt(curve, 3);
  if (ctrAtPos3 == null) return { error: 'ctrCurve position 3 unavailable' };

  const out = [];
  for (const row of rows) {
    const position = row.position || 0;
    const impressions = row.impressions || 0;
    if (position < 4 || position > 15 || impressions < 40) continue;
    const ctr = row.ctr || 0;
    const estClicks = impressions * (ctrAtPos3 - ctr);
    out.push({
      query: row.keys?.[0],
      page: toPath(row.keys?.[1]),
      impressions,
      clicks: row.clicks || 0,
      ctr: r3(ctr),
      position: r3(position),
      ctrAtPos3: r3(ctrAtPos3),
      estClicks: r1(estClicks),
    });
  }
  out.sort((a, b) => b.estClicks - a.estClicks);
  return out.slice(0, cap);
}

function computeCtrGaps(raw, curve, cap) {
  const rows = raw.current?.query_page;
  if (!rows) return { error: 'missing current query+page data' };

  const out = [];
  for (const row of rows) {
    const impressions = row.impressions || 0;
    if (impressions < 100) continue;
    const position = row.position || 0;
    const expectedCtr = curveCtrAt(curve, position);
    if (expectedCtr == null || expectedCtr <= 0) continue;
    const ctr = row.ctr || 0;
    if (ctr >= 0.6 * expectedCtr) continue;
    out.push({
      query: row.keys?.[0],
      page: toPath(row.keys?.[1]),
      impressions,
      clicks: row.clicks || 0,
      ctr: r3(ctr),
      position: r3(position),
      expectedCtr: r3(expectedCtr),
      ctrRatio: r3(ctr / expectedCtr),
      _lost: impressions * (expectedCtr - ctr),
    });
  }
  out.sort((a, b) => b._lost - a._lost);
  return out.slice(0, cap).map(({ _lost, ...rest }) => rest);
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

function computeCannibalization(raw, cap) {
  const rows = raw.current?.query_page;
  if (!rows) return { error: 'missing current query+page data' };

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
    const competing = list.filter((row) => (row.impressions || 0) >= 30);
    if (competing.length < 2) continue;
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

const CAPS_DEFAULT = {
  queries: 200,
  pages: 150,
  perAnalysis: 50,
  strikingDistance: 40,
  ctrGaps: 30,
  zeroClick: 30,
  cannibalization: 20,
  risingDecaying: 20,
  newQueries: 30,
  byRegion: 50,
  byCountry: 20,
  contentRegions: 50,
  localeMatchCountries: 5,
};

const CAPS_TIGHT = {
  queries: 120,
  pages: 100,
  perAnalysis: 30,
  strikingDistance: 30,
  ctrGaps: 20,
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
    ctrCurve: parts.ctrCurve,
    strikingDistance: sliceIf(parts.strikingDistance, caps.strikingDistance),
    ctrGaps: sliceIf(parts.ctrGaps, caps.ctrGaps),
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
  const { meta, totals, bySegment, localeCountryMatch, strikingDistance, ctrGaps, zeroClick, contentInventory, errors } = snapshot;
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

  out.push('## Top striking-distance (est. clicks)');
  topRows(out, strikingDistance, (r) => `- \`${r.query}\` → ${r.page} · pos ${r.position} · +${r.estClicks} est`);
  out.push('');
  out.push('## Top CTR gaps');
  topRows(out, ctrGaps, (r) => `- \`${r.query}\` → ${r.page} · ctr ${r.ctr} vs exp ${r.expectedCtr} (ratio ${r.ctrRatio})`);
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
  const periods = {
    current: { start: isoDay(daysAgo(now, 31)), end: isoDay(daysAgo(now, 3)) },
    previous: { start: isoDay(daysAgo(now, 59)), end: isoDay(daysAgo(now, 32)) },
    lastYear: { start: isoDay(daysAgo(now, 396)), end: isoDay(daysAgo(now, 368)) },
    lastYearPrevious: { start: isoDay(daysAgo(now, 424)), end: isoDay(daysAgo(now, 397)) },
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
  const parts = {
    totals: guard(errors, 'totals', () => computeTotals(raw)),
    dailySeries: guard(errors, 'dailySeries', () => computeDailySeries(raw)),
    byLocale: guard(errors, 'bySegment.byLocale', () => buildSegmentList((row) => parseUrl(row.keys?.[0]).locale, raw)),
    byPageType: guard(errors, 'bySegment.byPageType', () => buildSegmentList((row) => parseUrl(row.keys?.[0]).pageType, raw)),
    byRegion: guard(errors, 'bySegment.byRegion', () => buildSegmentList((row) => parseUrl(row.keys?.[0]).region, raw)),
    byCountry: guard(errors, 'bySegment.byCountry', () => buildKeyedList('country', raw)),
    byDevice: guard(errors, 'bySegment.byDevice', () => buildKeyedList('device', raw, { normalizeKey: (k) => (k ? String(k).toLowerCase() : k) })),
    localeCountryMatch: guard(errors, 'localeCountryMatch', () => computeLocaleCountryMatch(raw, CAPS_DEFAULT.localeMatchCountries)),
    ctrCurve: curve,
    strikingDistance: guard(errors, 'strikingDistance', () => computeStrikingDistance(raw, curve, CAPS_DEFAULT.strikingDistance)),
    ctrGaps: guard(errors, 'ctrGaps', () => computeCtrGaps(raw, curve, CAPS_DEFAULT.ctrGaps)),
    zeroClick: guard(errors, 'zeroClick', () => computeZeroClick(raw, CAPS_DEFAULT.zeroClick)),
    cannibalization: guard(errors, 'cannibalization', () => computeCannibalization(raw, CAPS_DEFAULT.cannibalization)),
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
    ctrCurveSampleMin: 5,
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
