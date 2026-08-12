/**
 * scripts/traffic-snapshot.mjs
 *
 * LOCAL-ONLY "how much traffic did we really get" tool. Not part of the build,
 * never shipped to the site. It puts every traffic source we own side by side
 * and writes two files:
 *
 *   reports/netlify/YYYY-MM-DD.json   (machine summary)
 *   reports/netlify/YYYY-MM-DD.md     (short human digest)
 *
 * Four independent sources. Any one can be missing without failing the run, and
 * a source that did not answer is reported as MISSING — never as a zero. That
 * rule is the whole point of this script: a silent zero reads as "no traffic"
 * when it actually means "no data", and that is how you talk yourself into
 * believing a bad number.
 *
 *   1. OWN COUNTER  — /api/traffic?format=json, our first-party beacon. The
 *      best human number we have: same-origin, no consent gate, ad-blockers do
 *      not recognise it. Needs TRAFFIC_STATS_KEY in .env. Misses no-JS clients,
 *      which is mostly what keeps its bot count down.
 *   2. NETLIFY HEALTH — deploys, build durations, failures, functions, account
 *      usage. Free on every Netlify plan.
 *   3. NETLIFY ANALYTICS — server-log pageviews, top pages, sources, 404s.
 *      Requires the paid add-on ($9/mo/site). Counts EVERY request including
 *      bots, so it is a ceiling, not a human count. The API is private and
 *      undocumented, so each endpoint is probed and a miss is reported.
 *   4. GSC — read from the newest reports/snapshots/*.json already on disk (no
 *      extra API call). Google search clicks only, but they are real clicks.
 *
 * GA4 is deliberately NOT collected here: it is consent-gated and ad-blocked,
 * so it undercounts by roughly half and would only muddy the comparison. Use it
 * for behaviour, not for volume.
 *
 * This script only fetches + aggregates. It draws NO conclusions.
 *
 * Setup: NETLIFY_AUTH_TOKEN=... in .env (https://app.netlify.com/user/applications)
 *        TRAFFIC_STATS_KEY=... in .env (same value as the Netlify env var)
 *        Site id comes from .netlify/state.json, override with NETLIFY_SITE_ID.
 * Run:   npm run stats:snapshot [-- --days 30]
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

const API = 'https://api.netlify.com/api/v1';
const ANALYTICS = 'https://analytics.netlify.com/api/v2';
const DAY_MS = 86_400_000;

const r1 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : v);
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

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

async function resolveSiteId() {
  const fromEnv = process.env.NETLIFY_SITE_ID?.trim();
  if (fromEnv) return fromEnv;
  try {
    const state = JSON.parse(await readFile(path.join(projectRoot, '.netlify', 'state.json'), 'utf8'));
    if (state.siteId) return state.siteId;
  } catch {
    // fall through to the error below
  }
  return null;
}

function parseArgs(argv) {
  const days = Number(argv[argv.indexOf('--days') + 1]);
  return { days: Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 30 };
}

/** Athens UTC offset as "+03:00" — Netlify Analytics wants a fixed offset. */
function athensOffset(at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Athens',
    timeZoneName: 'longOffset',
  }).formatToParts(at);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+02:00';
  return name.replace('GMT', '') || '+02:00';
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const notes = [];

/**
 * One authenticated GET. Never throws: returns { ok, status, data, error } so a
 * single dead endpoint cannot take down the whole snapshot.
 */
async function get(url, token) {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      return { ok: false, status: res.status, data, error: (data?.message || text || '').slice(0, 200) };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: String(err?.message || err).slice(0, 200) };
  }
}

// ---------------------------------------------------------------------------
// Half 1 — site health (free on every plan)
// ---------------------------------------------------------------------------

async function collectSite(token, siteId) {
  const res = await get(`${API}/sites/${siteId}`, token);
  if (!res.ok) {
    notes.push(`site: HTTP ${res.status} — ${res.error}`);
    return null;
  }
  const s = res.data;
  return {
    name: s.name,
    url: s.ssl_url || s.url,
    customDomain: s.custom_domain ?? null,
    accountSlug: s.account_slug ?? null,
    accountName: s.account_name ?? null,
    buildImage: s.build_image ?? null,
    publishedAt: s.published_deploy?.published_at ?? null,
    publishedBranch: s.published_deploy?.branch ?? null,
    capabilities: Object.keys(s.capabilities ?? {}),
  };
}

async function collectDeploys(token, siteId, days) {
  const since = Date.now() - days * DAY_MS;
  const all = [];
  // Netlify pages at 100; two pages covers a month of this project's cadence.
  for (const page of [1, 2]) {
    const res = await get(`${API}/sites/${siteId}/deploys?per_page=100&page=${page}`, token);
    if (!res.ok) {
      notes.push(`deploys: HTTP ${res.status} — ${res.error}`);
      break;
    }
    if (!Array.isArray(res.data) || res.data.length === 0) break;
    all.push(...res.data);
    if (res.data.length < 100) break;
    // Stop early once the page is entirely older than the window.
    const oldest = res.data[res.data.length - 1]?.created_at;
    if (oldest && new Date(oldest).getTime() < since) break;
  }
  if (all.length === 0) return null;

  const inWindow = all.filter((d) => new Date(d.created_at).getTime() >= since);
  const production = inWindow.filter((d) => d.context === 'production');

  // Netlify reports "no content change" cancellations with state 'error'. They are
  // a deliberate skip, not a broken build — counting them as failures would cry
  // wolf on every rebuild that produced identical output.
  const isNoOpSkip = (d) => /no content change/i.test(d.error_message || '');
  const errored = inWindow.filter((d) => d.state === 'error');
  const skipped = errored.filter(isNoOpSkip);
  const failed = errored.filter((d) => !isNoOpSkip(d));
  const durations = inWindow
    .map((d) => d.deploy_time)
    .filter((t) => typeof t === 'number' && t > 0)
    .sort((a, b) => a - b);

  const median = durations.length ? durations[Math.floor(durations.length / 2)] : null;

  return {
    windowDays: days,
    total: inWindow.length,
    production: production.length,
    failed: failed.length,
    skippedNoChange: skipped.length,
    failureRatePct: pct(failed.length, inWindow.length),
    buildSeconds: {
      median,
      slowest: durations.length ? durations[durations.length - 1] : null,
      fastest: durations.length ? durations[0] : null,
    },
    lastFailures: failed.slice(0, 5).map((d) => ({
      at: d.created_at,
      branch: d.branch,
      title: (d.title || '').slice(0, 90),
      error: (d.error_message || '').slice(0, 160),
    })),
    latest: inWindow[0]
      ? {
          at: inWindow[0].created_at,
          state: inWindow[0].state,
          branch: inWindow[0].branch,
          seconds: inWindow[0].deploy_time ?? null,
        }
      : null,
  };
}

async function collectFunctions(token, siteId) {
  const res = await get(`${API}/sites/${siteId}/functions`, token);
  if (!res.ok) {
    notes.push(`functions: HTTP ${res.status} — ${res.error}`);
    return null;
  }
  const list = res.data?.functions ?? res.data;
  if (!Array.isArray(list)) return null;
  return list.map((f) => ({ name: f.n ?? f.name, runtime: f.runtime ?? null })).filter((f) => f.name);
}

async function collectAccountUsage(token, accountSlug) {
  if (!accountSlug) return null;
  const out = {};
  const bandwidth = await get(`${API}/accounts/${accountSlug}/bandwidth`, token);
  if (bandwidth.ok && bandwidth.data) {
    out.bandwidth = {
      usedBytes: bandwidth.data.used ?? null,
      includedBytes: bandwidth.data.included ?? null,
      usedGB: bandwidth.data.used != null ? r1(bandwidth.data.used / 1e9) : null,
      periodEndsAt: bandwidth.data.period_end_date ?? null,
    };
  } else {
    notes.push(`bandwidth: HTTP ${bandwidth.status} — ${bandwidth.error}`);
  }
  const builds = await get(`${API}/${accountSlug}/builds/status`, token);
  if (builds.ok && builds.data) {
    out.buildMinutes = {
      used: builds.data.minutes?.current ?? null,
      included: builds.data.minutes?.included ?? null,
      periodEndsAt: builds.data.minutes?.period_end_date ?? null,
    };
  } else {
    notes.push(`build minutes: HTTP ${builds.status} — ${builds.error}`);
  }
  return Object.keys(out).length ? out : null;
}

// ---------------------------------------------------------------------------
// Half 2 — traffic (paid Netlify Analytics add-on)
//
// The traffic API is private and undocumented. Each metric is probed against
// the paths Netlify's own dashboard uses; the first one that answers wins. A
// 402/404 across the board means the add-on is simply not enabled — that is
// reported as a miss, never as zero traffic.
// ---------------------------------------------------------------------------

const TRAFFIC_METRICS = [
  { key: 'pageviews', paths: ['pageviews'] },
  { key: 'topPages', paths: ['ranking/pages', 'pages'] },
  { key: 'sources', paths: ['ranking/sources', 'sources'] },
  { key: 'notFound', paths: ['ranking/not_found', 'not_found'] },
  { key: 'countries', paths: ['ranking/countries', 'countries'] },
  { key: 'bandwidth', paths: ['bandwidth'] },
];

async function collectTraffic(token, siteId, days) {
  const to = Date.now();
  const from = to - days * DAY_MS;
  const tz = encodeURIComponent(athensOffset());
  const qs = `from=${from}&to=${to}&timezone=${tz}&resolution=day&limit=25`;

  // Cheap gate: probe ONE endpoint first. With the add-on off every path 404s,
  // and firing all twelve just to learn that is twelve wasted round-trips on
  // every run. Probing rather than trusting site.capabilities is deliberate —
  // if Netlify renames the capability we would silently stop looking.
  const gate = await get(`${ANALYTICS}/sites/${siteId}/pageviews?${qs}`, token);
  if (!gate.ok) {
    notes.push(
      `traffic: Netlify Analytics not answering (HTTP ${gate.status}) — the paid ` +
        `add-on is off for this site. Skipped the remaining probes.`,
    );
    return { enabled: false, reason: `HTTP ${gate.status}` };
  }

  const out = { pageviews: summariseTraffic('pageviews', gate.data) };

  for (const metric of TRAFFIC_METRICS.filter((m) => m.key !== 'pageviews')) {
    for (const p of metric.paths) {
      const res = await get(`${ANALYTICS}/sites/${siteId}/${p}?${qs}`, token);
      if (res.ok && res.data != null) {
        out[metric.key] = summariseTraffic(metric.key, res.data);
        break;
      }
    }
  }

  return { enabled: true, windowDays: days, ...out };
}

/** Netlify returns either {data:[[ts,value]...]} series or {data:[{path,count}]}. */
function summariseTraffic(key, raw) {
  const rows = raw?.data ?? raw;
  if (!Array.isArray(rows)) return raw;

  // Time series: array of [timestamp, value] pairs.
  if (Array.isArray(rows[0])) {
    const total = rows.reduce((sum, [, v]) => sum + (Number(v) || 0), 0);
    return {
      total,
      perDayAvg: rows.length ? Math.round(total / rows.length) : 0,
      days: rows.length,
      last7: rows.slice(-7).map(([ts, v]) => [new Date(ts).toISOString().slice(0, 10), v]),
    };
  }

  // Ranking list: array of objects with a label and a count.
  return rows.slice(0, 25).map((row) => ({
    label: row.path ?? row.resource ?? row.source ?? row.country ?? row.name ?? null,
    count: row.count ?? row.value ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Source 1 — our own first-party beacon (/api/traffic?format=json)
// ---------------------------------------------------------------------------

async function collectOwnCounter(days) {
  const key = process.env.TRAFFIC_STATS_KEY?.trim();
  if (!key) {
    notes.push('own counter: TRAFFIC_STATS_KEY not set in .env — skipped.');
    return { available: false, reason: 'no TRAFFIC_STATS_KEY in .env' };
  }
  const base = process.env.TRAFFIC_STATS_ORIGIN?.trim() || 'https://calmbeach.gr';
  const url = `${base}/api/traffic?key=${encodeURIComponent(key)}&format=json&days=${days}`;

  // This is the most important number in the report, and the endpoint is a
  // Netlify function reading blob storage — a cold start can drop the first
  // connection. One blip must not blank the row, so try three times.
  let res = null;
  let lastDetail = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } });
      break;
    } catch (err) {
      // node's fetch collapses every transport failure into "fetch failed"; the
      // real reason (DNS, TLS, timeout, reset) only lives on err.cause.
      const cause = err?.cause?.code || err?.cause?.message || '';
      lastDetail = `${String(err?.message || err)}${cause ? ` — ${cause}` : ''}`.slice(0, 160);
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  if (!res) {
    notes.push(`own counter: request failed after 3 tries — ${lastDetail}`);
    return { available: false, reason: lastDetail };
  }
  if (!res.ok) {
    notes.push(`own counter: HTTP ${res.status} (403 = wrong TRAFFIC_STATS_KEY).`);
    return { available: false, reason: `HTTP ${res.status}` };
  }

  let data;
  try {
    data = JSON.parse(await res.text());
  } catch {
    notes.push('own counter: response was not JSON.');
    return { available: false, reason: 'bad JSON' };
  }

  const rows = Array.isArray(data.rows) ? data.rows : [];
  if (!rows.length) return { available: false, reason: 'no rows returned' };

  const sum = (f) => rows.reduce((t, r) => t + (Number(r[f]) || 0), 0);
  const hits = sum('hits');
  const uniques = sum('unique');

  return {
    available: true,
    windowDays: rows.length,
    startDay: data.startDay ?? null,
    pageviews: hits,
    uniqueVisitors: uniques,
    perDayAvg: Math.round(hits / rows.length),
    newVisitors: sum('newV'),
    returningVisitors: sum('retV'),
    unknownVisitors: sum('unkV'),
    engaged: sum('engaged'),
    multiPage: sum('multiPage'),
    liveNow: data.live ?? null,
    last7: rows.slice(-7).map((r) => [r.day, r.hits]),
  };
}

// ---------------------------------------------------------------------------
// Source 4 — GSC, read from the newest snapshot already on disk
// ---------------------------------------------------------------------------

async function readLatestGsc() {
  const dir = path.join(projectRoot, 'reports', 'snapshots');
  let files;
  try {
    const { readdir } = await import('node:fs/promises');
    files = (await readdir(dir)).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort();
  } catch {
    notes.push('gsc: reports/snapshots not readable — skipped.');
    return { available: false, reason: 'no snapshots directory' };
  }
  const newest = files[files.length - 1];
  if (!newest) {
    notes.push('gsc: no snapshot on disk — run `npm run seo:snapshot` first.');
    return { available: false, reason: 'no snapshot on disk' };
  }

  let snap;
  try {
    snap = JSON.parse(await readFile(path.join(dir, newest), 'utf8'));
  } catch {
    notes.push(`gsc: could not parse ${newest}.`);
    return { available: false, reason: 'unparseable snapshot' };
  }

  const cur = snap.totals?.current;
  if (!cur) return { available: false, reason: 'snapshot has no totals' };

  const snapshotDate = newest.replace('.json', '');
  const ageDays = Math.round((Date.now() - new Date(snapshotDate).getTime()) / DAY_MS);

  return {
    available: true,
    snapshotDate,
    ageDays,
    stale: ageDays > 10,
    windowDays: snap.meta?.windowDays ?? snap.meta?.days ?? null,
    clicks: cur.clicks,
    impressions: cur.impressions,
    ctr: cur.ctr,
    position: cur.position,
  };
}

// ---------------------------------------------------------------------------
// Digest
// ---------------------------------------------------------------------------

function renderMarkdown(snap) {
  const L = [];
  const s = snap.site;
  L.push(`# Netlify snapshot — ${snap.date}`);
  L.push('');
  L.push(`Site: **${s?.name ?? 'unknown'}** (${s?.url ?? '—'}) · window: ${snap.windowDays} days`);
  L.push('');

  // ── Πόση κίνηση όντως είχαμε ──────────────────────────────────────────────
  // Deliberately the first section: the numbers disagree by design, and each one
  // gets its window and its blind spot printed next to it so nobody quotes the
  // biggest one as "the" traffic.
  L.push('## Πόση κίνηση όντως είχαμε');
  L.push('');
  L.push('| Πηγή | Νούμερο | Περίοδος | Τι δεν πιάνει |');
  L.push('|---|---|---|---|');

  const own = snap.ownCounter;
  L.push(
    own?.available
      ? `| **Δικός μας μετρητής** | **${own.pageviews}** προβολές / ${own.uniqueVisitors} μοναδικοί | ${own.windowDays} μέρες | επισκέπτες χωρίς JavaScript |`
      : `| Δικός μας μετρητής | ΔΕΝ ΗΡΘΕ (${own?.reason ?? '—'}) | — | — |`,
  );

  const g = snap.gsc;
  L.push(
    g?.available
      ? `| Google Search Console | ${g.clicks} κλικ (${g.impressions} εμφανίσεις) | snapshot ${g.snapshotDate}${g.stale ? ` — **${g.ageDays} ημερών, παλιό**` : ''} | ό,τι δεν ήρθε από αναζήτηση Google |`
      : `| Google Search Console | ΔΕΝ ΗΡΘΕ (${g?.reason ?? '—'}) | — | — |`,
  );

  const t0 = snap.traffic;
  L.push(
    t0?.enabled && t0.pageviews?.total != null
      ? `| Netlify Analytics | ${t0.pageviews.total} προβολές | ${t0.windowDays} μέρες | τίποτα — μετράει και ΚΑΘΕ bot |`
      : `| Netlify Analytics | ΚΛΕΙΣΤΟ (${t0?.reason ?? 'add-on off'}) | — | — |`,
  );
  L.push('');
  L.push(
    '> Τα νούμερα **δεν** πρέπει να συμφωνούν. Ο δικός μας μετρητής είναι η καλύτερη ' +
      'μέτρηση ανθρώπων· το GSC μετράει μόνο αναζήτηση Google· το Netlify Analytics ' +
      'θα έδινε το μεγαλύτερο νούμερο επειδή μετράει και τα ρομπότ. Το GA4 λείπει ' +
      'επίτηδες: υπομετράει περίπου στο μισό.',
  );
  L.push('');

  L.push('## Υγεία (deploys)');
  const d = snap.deploys;
  if (!d) {
    L.push('_Δεν ήρθαν δεδομένα deploy._');
  } else {
    L.push(`- Deploys: **${d.total}** (${d.production} production) · αποτυχίες: **${d.failed}** (${d.failureRatePct ?? 0}%)`);
    if (d.skippedNoChange) L.push(`- Παραλείφθηκαν χωρίς αλλαγή περιεχομένου: ${d.skippedNoChange} (δεν είναι σφάλματα)`);
    L.push(`- Χρόνος build: διάμεσος **${d.buildSeconds.median ?? '—'}s** · χειρότερος ${d.buildSeconds.slowest ?? '—'}s`);
    if (d.latest) L.push(`- Τελευταίο: ${d.latest.state} στο \`${d.latest.branch}\` — ${d.latest.at}`);
    if (d.lastFailures.length) {
      L.push('');
      L.push('Τελευταίες αποτυχίες:');
      for (const f of d.lastFailures) L.push(`  - ${f.at} \`${f.branch}\` — ${f.error || f.title}`);
    }
  }
  L.push('');

  if (snap.functions?.length) {
    L.push(`## Functions (${snap.functions.length})`);
    L.push(snap.functions.map((f) => `\`${f.name}\``).join(', '));
    L.push('');
  }

  if (snap.accountUsage) {
    L.push('## Κατανάλωση λογαριασμού');
    const b = snap.accountUsage.bandwidth;
    const m = snap.accountUsage.buildMinutes;
    if (b) L.push(`- Bandwidth: **${b.usedGB ?? '—'} GB** από ${b.includedBytes ? r1(b.includedBytes / 1e9) + ' GB' : '—'}`);
    if (m) L.push(`- Build minutes: **${m.used ?? '—'}** από ${m.included ?? '—'}`);
    L.push('');
  }

  L.push('## Επισκεψιμότητα (Netlify Analytics)');
  const t = snap.traffic;
  if (!t?.enabled) {
    L.push(`_Μη διαθέσιμη — ${t?.reason ?? 'unknown'}. Το πληρωμένο add-on φαίνεται κλειστό για αυτό το site._`);
  } else {
    if (t.pageviews?.total != null) L.push(`- Pageviews: **${t.pageviews.total}** (~${t.pageviews.perDayAvg}/μέρα)`);
    for (const [key, title] of [['topPages', 'Top σελίδες'], ['sources', 'Πηγές'], ['notFound', '404'], ['countries', 'Χώρες']]) {
      const rows = t[key];
      if (!Array.isArray(rows) || !rows.length) continue;
      L.push('');
      L.push(`### ${title}`);
      for (const r of rows.slice(0, 10)) L.push(`  - ${r.count ?? '—'} · ${r.label ?? '—'}`);
    }
  }
  L.push('');

  if (snap.notes.length) {
    L.push('## Σημειώσεις εκτέλεσης');
    for (const n of snap.notes) L.push(`- ${n}`);
    L.push('');
  }
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await loadEnv();
  const { days } = parseArgs(process.argv);

  const token = process.env.NETLIFY_AUTH_TOKEN?.trim();
  if (!token) {
    console.error('\nMissing NETLIFY_AUTH_TOKEN.');
    console.error('  1. https://app.netlify.com/user/applications → Personal access tokens → New access token');
    console.error('  2. Add to .env:  NETLIFY_AUTH_TOKEN=nfp_xxxxxxxx');
    process.exit(1);
  }

  const siteId = await resolveSiteId();
  if (!siteId) {
    console.error('\nNo site id. Set NETLIFY_SITE_ID in .env, or run `netlify link` to create .netlify/state.json.');
    process.exit(1);
  }

  console.log(`Netlify snapshot — site ${siteId}, last ${days} days`);

  const site = await collectSite(token, siteId);
  if (!site) {
    console.error('\nCould not read the site. Is the token valid and does it belong to this site\'s account?');
    for (const n of notes) console.error(`  ${n}`);
    process.exit(1);
  }
  console.log(`  site: ${site.name} (${site.url})`);

  const [deploys, functions, accountUsage, traffic, ownCounter, gsc] = await Promise.all([
    collectDeploys(token, siteId, days),
    collectFunctions(token, siteId),
    collectAccountUsage(token, site.accountSlug),
    collectTraffic(token, siteId, days),
    collectOwnCounter(days),
    readLatestGsc(),
  ]);

  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens' }).format(new Date());
  const snapshot = {
    date,
    siteId,
    windowDays: days,
    site,
    ownCounter,
    gsc,
    traffic,
    deploys,
    functions,
    accountUsage,
    notes,
  };

  const outDir = path.join(projectRoot, 'reports', 'netlify');
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `${date}.json`);
  const mdPath = path.join(outDir, `${date}.md`);
  await writeFile(jsonPath, JSON.stringify(snapshot, null, 2), 'utf8');
  await writeFile(mdPath, renderMarkdown(snapshot), 'utf8');

  console.log(`  own counter: ${ownCounter?.available ? `${ownCounter.pageviews} views / ${ownCounter.uniqueVisitors} unique` : `n/a (${ownCounter?.reason})`}`);
  console.log(`  gsc: ${gsc?.available ? `${gsc.clicks} clicks (snapshot ${gsc.snapshotDate})` : `n/a (${gsc?.reason})`}`);
  console.log(`  netlify analytics: ${traffic?.enabled ? 'available' : 'not available (add-on off?)'}`);
  console.log(`  deploys: ${deploys ? `${deploys.total} (${deploys.failed} failed)` : 'n/a'}`);
  console.log(`  functions: ${functions?.length ?? 'n/a'}`);
  for (const n of notes) console.log(`  note: ${n}`);
  console.log(`\nWrote ${path.relative(projectRoot, jsonPath)} and ${path.relative(projectRoot, mdPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
