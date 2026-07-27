// ─────────────────────────────────────────────────────────────────────────────
// Smoke test for the edge forecast proxy on a deploy preview (or production).
//
//   node scripts/smokeTestForecastProxy.mjs https://deploy-preview-42--your-site.netlify.app
//
// Verifies the proxy is healthy BEFORE flipping it on in production:
//   1. forecast + marine endpoints return 200 with real JSON,
//   2. a repeated request is served from the Netlify CDN (shared cache working),
//   3. the allow-list still rejects malicious/unknown requests (not an open proxy).
// Exit 1 on any hard failure. Makes a handful of real Open-Meteo calls — that's fine.
// ─────────────────────────────────────────────────────────────────────────────

const base = (process.argv[2] || '').replace(/\/$/, '');
if (!base || !/^https?:\/\//.test(base)) {
  console.error('Usage: node scripts/smokeTestForecastProxy.mjs <base-url>');
  console.error('Example: node scripts/smokeTestForecastProxy.mjs https://deploy-preview-1--calmbeach.netlify.app');
  process.exit(2);
}

let pass = 0, fail = 0;
const ok = (cond, msg, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}${detail ? `  — ${detail}` : ''}`); }
};

const get = async (path) => {
  const res = await fetch(`${base}${path}`, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
};

// A header that indicates the response came from (or is cacheable at) the CDN edge.
const cacheSignal = (headers) => {
  const cacheStatus = headers.get('cache-status') || headers.get('netlify-cache') || '';
  const age = headers.get('age');
  return { cacheStatus, age };
};

const forecastPath = (lat, lon) =>
  `/api/forecast/open-meteo/v1/forecast?latitude=${lat}&longitude=${lon}` +
  `&current=temperature_2m,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=auto`;
const batchForecastPath = () =>
  '/api/forecast/open-meteo/v1/forecast?latitude=39.62,38.72&longitude=19.60,20.45' +
  '&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=Europe%2FAthens';
const marinePath = (lat, lon) =>
  `/api/forecast/open-meteo-marine/v1/marine?latitude=${lat}&longitude=${lon}` +
  `&hourly=wave_height&timezone=auto&forecast_days=2&cell_selection=sea`;

console.log(`\n🔎 Forecast proxy smoke test → ${base}\n`);

try {
  // 1. Forecast endpoint returns real data
  const f = await get(forecastPath(36.9, 25.13));
  ok(f.status === 200, 'forecast endpoint returns 200', `got ${f.status}`);
  let parsed = null;
  try { parsed = JSON.parse(f.text); } catch { /* handled below */ }
  ok(parsed && parsed.current && typeof parsed.current.wind_speed_10m === 'number',
    'forecast payload has current.wind_speed_10m');

  // 2. Marine endpoint returns real data
  const m = await get(marinePath(36.9, 25.13));
  ok(m.status === 200, 'marine endpoint returns 200', `got ${m.status}`);
  let marineParsed = null;
  try { marineParsed = JSON.parse(m.text); } catch { /* handled below */ }
  ok(marineParsed && marineParsed.hourly && Array.isArray(marineParsed.hourly.time),
    'marine payload has hourly.time[]');

  // 2b. National conditions use Open-Meteo's batch coordinate shape.
  const batch = await get(batchForecastPath());
  ok(batch.status === 200, 'batch forecast endpoint returns 200', `got ${batch.status}`);
  let batchParsed = null;
  try { batchParsed = JSON.parse(batch.text); } catch { /* handled below */ }
  ok(Array.isArray(batchParsed) && batchParsed.length === 2,
    'batch forecast payload has one entry per coordinate');

  // 3. Shared CDN cache: same URL twice → second should show a cache hit / age
  const c1 = await get(forecastPath(37.44, 25.33));
  const c2 = await get(forecastPath(37.44, 25.33));
  const sig = cacheSignal(c2.headers);
  const cached = /hit/i.test(sig.cacheStatus) || (sig.age !== null && Number(sig.age) >= 0);
  ok(c1.status === 200 && c2.status === 200, 'repeated request both 200');
  // Not a hard failure (header names vary by CDN config) — report loudly if absent.
  if (cached) { pass++; console.log(`  ✅ CDN cache signal present on repeat (cache-status="${sig.cacheStatus}", age=${sig.age})`); }
  else { console.log(`  ⚠️  no explicit CDN cache header on repeat (cache-status="${sig.cacheStatus}", age=${sig.age}) — verify caching in Netlify logs`); }

  // 4. Allow-list holds (not an open proxy)
  const badProvider = await get('/api/forecast/evil-host/v1/forecast?latitude=36&longitude=25');
  ok(badProvider.status === 400, 'unknown provider rejected (400)', `got ${badProvider.status}`);

  const badPath = await get('/api/forecast/open-meteo/v1/elevation?latitude=36&longitude=25');
  ok(badPath.status === 400, 'disallowed upstream path rejected (400)', `got ${badPath.status}`);

  const inject = await get('/api/forecast/open-meteo/v1/forecast?latitude=36&longitude=25&current=x%26key%3D1');
  ok(inject.status === 400, 'param injection rejected (400)', `got ${inject.status}`);

  const badLat = await get('/api/forecast/open-meteo/v1/forecast?latitude=999&longitude=25&current=temperature_2m');
  ok(badLat.status === 400, 'out-of-range latitude rejected (400)', `got ${badLat.status}`);
} catch (error) {
  fail++;
  console.log(`  ❌ smoke test threw: ${error instanceof Error ? error.message : String(error)}`);
}

console.log(`\n${fail ? `❌ ${fail} failed` : `✅ all ${pass} checks passed`} (${pass} ok, ${fail} failed)\n`);
process.exit(fail ? 1 : 0);
