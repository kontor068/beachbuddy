// sourceUrl liveness audit (REPORT-ONLY). Checks whether every source URL cited by a beach in
// public/greek_beaches.json is still reachable, and classifies each STRICTLY:
//
//   ALIVE         -> final HTTP status 2xx / 3xx
//   DEAD          -> 404 / 410, or a definitive network failure (DNS not found / connection refused)
//   INCONCLUSIVE  -> 403 / 429 / 5xx / timeout / connection-reset / TLS / other ambiguous
//                    => treated as a *possible* bot-block, NEVER counted as dead.
//
// Reads greek_beaches.json read-only and never writes it. Sends ZERO requests to openstreetmap.org
// (those 1,011 URLs are bucketed separately as "not-checked" to honor the no-OSM rule; a hidden
// --include-osm escape hatch exists but is off by default). Produces, under reports/sourceurl-liveness/:
//   - cache.json   resumable per-URL results (not committed)
//   - report.json  totals, dead-by-domain, DEAD list with referencing beach ids, OSM bucket
//
// Usage:
//   node scripts/auditSourceUrlLiveness.mjs
//   [--refresh] [--no-recheck-inconclusive] [--concurrency 10] [--limit N] [--include-osm]
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resolver } from 'node:dns/promises';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const outDir = path.join(rootDir, 'reports', 'sourceurl-liveness');
const cachePath = path.join(outDir, 'cache.json');
const reportPath = path.join(outDir, 'report.json');

// --- args -------------------------------------------------------------------------------------
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const getArg = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const REFRESH = has('--refresh');
const RECHECK_INCONCLUSIVE = !has('--no-recheck-inconclusive'); // default on
const INCLUDE_OSM = has('--include-osm');                       // default off (escape hatch)
const CONCURRENCY = Math.max(1, Number(getArg('--concurrency', '10')) || 10);
const LIMIT = getArg('--limit') ? Number(getArg('--limit')) : Infinity;

const TIMEOUT_MS = 12000;
const MIN_HOST_GAP_MS = 800; // per-domain politeness gap between same-host requests
const MAX_RETRIES = 2;       // retries for transient outcomes (429 / 5xx / timeout / reset)
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'el-GR,el;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt) => 800 * 2 ** attempt + Math.random() * 250;

// Confirm a host's DNS against PUBLIC resolvers (Google/Cloudflare) directly, bypassing the system
// stub resolver that getaddrinfo/fetch use. Under high fetch concurrency the stub spuriously returns
// ENOTFOUND/EAI_AGAIN for hosts that are perfectly fine; this guards against false "dead". Returns:
//   'resolves'  -> host has an A/AAAA record (the fetch error was transient; NOT dead)
//   'dead'      -> NXDOMAIN / NODATA (no address record at all -> genuinely unreachable)
//   'ambiguous' -> SERVFAIL / timeout / refused (broken-or-temporary nameserver -> NOT dead)
// Positive results are cached; negatives are not, so every error re-confirms from scratch.
const dnsOk = new Set();
const confirmResolver = new Resolver({ timeout: 4000, tries: 2 });
try { confirmResolver.setServers(['8.8.8.8', '1.1.1.1']); } catch { /* keep system servers */ }
const dnsStatus = async (host) => {
  if (dnsOk.has(host)) return 'resolves';
  let sawClean = false; let sawAmbiguous = false;
  for (let i = 0; i < 3; i++) {
    for (const fn of ['resolve4', 'resolve6']) {
      try { if ((await confirmResolver[fn](host)).length) { dnsOk.add(host); return 'resolves'; } }
      catch (e) {
        const c = e?.code || '';
        if (c === 'ENOTFOUND' || c === 'ENODATA') sawClean = true; // domain has no address record
        else sawAmbiguous = true;                                  // ESERVFAIL / ETIMEOUT / EREFUSED ...
      }
    }
    await sleep(400 + i * 400);
  }
  if (sawAmbiguous) return 'ambiguous';
  return sawClean ? 'dead' : 'ambiguous';
};

// --- URL helpers ------------------------------------------------------------------------------
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./i, ''); } catch { return '(invalid)'; } };
const isOsm = (u) => { try { return /(^|\.)openstreetmap\.org$/i.test(new URL(u).hostname); } catch { return false; } };
const osmPathType = (u) => { const m = String(u).match(/openstreetmap\.org\/(\w+)/i); return m ? m[1].toLowerCase() : 'root'; };

// --- collect URLs (read-only) ----------------------------------------------------------------
// Recursively walk the Region->Prefecture->Area->beach[] tree, tracking the current beach id, and
// record every http(s) string under a `sourceUrls` (array) or `sourceUrl` (scalar) key.
const collect = (data) => {
  const urlToBeaches = new Map(); // url -> Set<beachId>
  let totalRefs = 0;
  const isBeach = (o) => o && typeof o === 'object' && Number.isInteger(o.id) && Number.isFinite(Number(o.lat)) && Number.isFinite(Number(o.lon));
  const add = (u, beachId) => {
    if (typeof u !== 'string') return;
    const s = u.trim();
    if (!/^https?:\/\//i.test(s)) return;
    totalRefs++;
    if (!urlToBeaches.has(s)) urlToBeaches.set(s, new Set());
    if (beachId != null) urlToBeaches.get(s).add(beachId);
  };
  const walk = (node, beachId) => {
    if (Array.isArray(node)) { for (const it of node) walk(it, isBeach(it) ? it.id : beachId); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === 'sourceUrls' && Array.isArray(v)) v.forEach((u) => add(u, beachId));
        else if (k === 'sourceUrl') add(v, beachId);
        else walk(v, beachId);
      }
    }
  };
  walk(data, null);
  return { urlToBeaches, totalRefs };
};

// --- cache ------------------------------------------------------------------------------------
const loadCache = () => {
  if (!existsSync(cachePath)) return new Map();
  try { return new Map(Object.entries(JSON.parse(readFileSync(cachePath, 'utf8')))); }
  catch { return new Map(); }
};
const saveJson = (file, obj) => {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2));
  renameSync(tmp, file);
};
const flushCache = (cache) => saveJson(cachePath, Object.fromEntries(cache));

// --- classification ---------------------------------------------------------------------------
const classifyStatus = (status) => {
  if (status >= 200 && status < 400) return 'alive';
  if (status === 404 || status === 410) return 'dead';
  return 'inconclusive'; // 403/429/5xx and any other 4xx -> not definitively dead
};
const isTransientStatus = (status) => status === 429 || status >= 500;
const errCodeOf = (err) => (err && (err.cause?.code || err.code)) || err?.name || 'UNKNOWN';
const DNS_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN']); // stub-resolver DNS failures (verify before dead)

const checkUrl = async (url) => {
  const host = hostOf(url);
  let last = {};
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: BROWSER_HEADERS });
      clearTimeout(timer);
      try { await res.body?.cancel?.(); } catch { /* no body / already consumed */ }
      const status = res.status;
      const category = classifyStatus(status);
      if (category === 'inconclusive' && isTransientStatus(status) && attempt < MAX_RETRIES) {
        last = { httpStatus: status };
        await sleep(backoff(attempt));
        continue;
      }
      return { category, httpStatus: status, finalUrl: res.url || url, attempts: attempt + 1 };
    } catch (err) {
      clearTimeout(timer);
      const code = errCodeOf(err);
      if (DNS_CODES.has(code)) {
        // Could be a real NXDOMAIN or just the stub resolver buckling under load — confirm on public DNS.
        const st = await dnsStatus(host);
        if (st === 'dead') return { category: 'dead', errorCode: 'ENOTFOUND', attempts: attempt + 1 };
        // 'resolves' (transient stub failure) or 'ambiguous' (SERVFAIL/timeout) -> never dead
        last = { errorCode: st === 'resolves' ? `${code} (host resolves; transient)` : `${code} (DNS SERVFAIL/timeout; unconfirmed)` };
        if (attempt < MAX_RETRIES) { await sleep(backoff(attempt)); continue; }
        return { category: 'inconclusive', ...last, attempts: attempt + 1 };
      }
      if (code === 'ECONNREFUSED') { // connection refused: retry, then treat as dead
        last = { errorCode: code };
        if (attempt < MAX_RETRIES) { await sleep(backoff(attempt)); continue; }
        return { category: 'dead', errorCode: code, attempts: attempt + 1 };
      }
      last = { errorCode: code }; // timeout / reset / TLS / other -> inconclusive
      if (attempt < MAX_RETRIES) { await sleep(backoff(attempt)); continue; }
      return { category: 'inconclusive', ...last, attempts: attempt + 1 };
    }
  }
  return { category: 'inconclusive', ...last, attempts: MAX_RETRIES + 1 };
};

// --- per-host scheduler (concurrency + politeness) -------------------------------------------
const runPool = async (tasks, cache, onProgress) => {
  const hostQueues = new Map();
  for (const t of tasks) { if (!hostQueues.has(t.host)) hostQueues.set(t.host, []); hostQueues.get(t.host).push(t); }
  const hostInFlight = new Set();
  const hostNextOk = new Map();
  let done = 0;
  const total = tasks.length;

  const allQueuesEmpty = () => { for (const q of hostQueues.values()) if (q.length) return false; return true; };
  const acquire = async () => {
    while (true) {
      const now = Date.now();
      for (const [host, q] of hostQueues) {
        if (!q.length || hostInFlight.has(host)) continue;
        if (now < (hostNextOk.get(host) || 0)) continue;
        hostInFlight.add(host);
        return q.shift();
      }
      if (allQueuesEmpty()) return null; // remaining tasks all in flight elsewhere
      await sleep(100);
    }
  };

  const worker = async () => {
    while (true) {
      const task = await acquire();
      if (!task) return;
      try {
        const result = { ...(await checkUrl(task.url)), checkedAt: new Date().toISOString() };
        cache.set(task.url, result);
      } finally {
        hostInFlight.delete(task.host);
        hostNextOk.set(task.host, Date.now() + MIN_HOST_GAP_MS);
        done++;
        if (done % 50 === 0) { flushCache(cache); onProgress(done, total); }
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, hostQueues.size)) }, worker));
  flushCache(cache);
  onProgress(done, total);
};

// --- main -------------------------------------------------------------------------------------
const run = async () => {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const data = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const { urlToBeaches, totalRefs } = collect(data);
  const allUrls = [...urlToBeaches.keys()];
  const osmUrls = allUrls.filter(isOsm);
  const nonOsmUrls = allUrls.filter((u) => !isOsm(u));
  const checkUrls = INCLUDE_OSM ? allUrls : nonOsmUrls;

  const cache = REFRESH ? new Map() : loadCache();

  // which URLs still need checking
  const needs = (u) => {
    if (REFRESH) return true;
    const hit = cache.get(u);
    if (!hit) return true;
    if (hit.category === 'inconclusive' && RECHECK_INCONCLUSIVE) return true;
    if (hit.category === 'dead' && hit.errorCode) return true; // re-verify network-based deads (DNS confirmation)
    return false;
  };
  let pending = checkUrls.filter(needs);
  if (Number.isFinite(LIMIT)) pending = pending.slice(0, LIMIT);
  const tasks = pending.map((u) => ({ url: u, host: hostOf(u) }));

  console.error(`URLs: ${allUrls.length} unique (osm ${osmUrls.length} excluded, non-osm ${nonOsmUrls.length}). ` +
    `To check now: ${tasks.length} (concurrency ${CONCURRENCY}, gap ${MIN_HOST_GAP_MS}ms, timeout ${TIMEOUT_MS}ms).`);

  if (tasks.length) {
    const t0 = Date.now();
    await runPool(tasks, cache, (done, total) => {
      const counts = { alive: 0, dead: 0, inconclusive: 0 };
      for (const u of checkUrls) { const c = cache.get(u)?.category; if (c) counts[c]++; }
      const secs = ((Date.now() - t0) / 1000).toFixed(0);
      console.error(`  [${done}/${total} ${secs}s] alive=${counts.alive} dead=${counts.dead} inconclusive=${counts.inconclusive}`);
    });
  }

  // --- assemble report ------------------------------------------------------------------------
  const checkedResults = checkUrls.map((u) => [u, cache.get(u)]).filter(([, r]) => r);
  const totals = { uniqueUrls: allUrls.length, osmExcluded: INCLUDE_OSM ? 0 : osmUrls.length, nonOsmTotal: nonOsmUrls.length, nonOsmChecked: checkedResults.length, alive: 0, dead: 0, inconclusive: 0 };
  const deadByDomain = {}; const inconclusiveByDomain = {}; const dead = [];
  for (const [url, r] of checkedResults) {
    totals[r.category]++;
    const domain = hostOf(url);
    if (r.category === 'dead') {
      deadByDomain[domain] = (deadByDomain[domain] || 0) + 1;
      const ids = [...(urlToBeaches.get(url) || [])].sort((a, b) => a - b);
      dead.push({ url, domain, status: r.httpStatus ?? r.errorCode ?? 'unknown', finalUrl: r.finalUrl && r.finalUrl !== url ? r.finalUrl : undefined, beachCount: ids.length, beachIds: ids });
    } else if (r.category === 'inconclusive') {
      inconclusiveByDomain[domain] = (inconclusiveByDomain[domain] || 0) + 1;
    }
  }
  const sortDesc = (obj) => Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1]));
  dead.sort((a, b) => b.beachCount - a.beachCount || a.domain.localeCompare(b.domain));

  const byPathType = {};
  for (const u of osmUrls) { const t = osmPathType(u); byPathType[t] = (byPathType[t] || 0) + 1; }

  const report = {
    generatedAt: new Date().toISOString(),
    sourceFile: 'public/greek_beaches.json',
    note: 'Report-only liveness audit. INCONCLUSIVE (403/429/5xx/timeout/reset/TLS) is a possible bot-block and is NOT dead. greek_beaches.json was not modified.',
    totalReferences: totalRefs,
    totals,
    deadByDomain: sortDesc(deadByDomain),
    dead,
    inconclusiveByDomain: sortDesc(inconclusiveByDomain),
    osm: INCLUDE_OSM
      ? { total: osmUrls.length, status: 'checked (--include-osm)', byPathType }
      : { total: osmUrls.length, status: 'not-checked (excluded per no-OSM rule)', byPathType },
  };
  saveJson(reportPath, report);

  console.error(`\nDone. unique=${totals.uniqueUrls} checked=${totals.nonOsmChecked} ` +
    `alive=${totals.alive} dead=${totals.dead} inconclusive=${totals.inconclusive}`);
  console.error(`Dead domains (top): ` + Object.entries(report.deadByDomain).slice(0, 12).map(([d, c]) => `${d}:${c}`).join(', '));
  console.error(`Report -> ${path.relative(rootDir, reportPath)}`);
};

process.on('SIGINT', () => { console.error('\nInterrupted; cache is flushed every 50 results and is resumable.'); process.exit(130); });
run().catch((e) => { console.error(e); process.exit(1); });
