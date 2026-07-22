// ─────────────────────────────────────────────────────────────────────────────
// TRAFFIC DASHBOARD — the read side of the first-party visitor counter.
//
// Shows REAL unique visitors/day (consent-free, ad-block-proof — see pageview.mjs),
// total pageviews, and where they came from. Private: gated by a secret key so the
// numbers are never public.
//
//   Open:  https://calmbeach.gr/api/traffic?key=YOUR_KEY
//          add &days=30 for the window, &format=json for raw data.
//
// Set TRAFFIC_STATS_KEY in the Netlify env to enable it (unset ⇒ 403, never open).
// Uniqueness is counted by listing the per-visitor blobs pageview.mjs wrote, so the
// per-day unique number is exact; totals/referrers are the best-effort rollup.
// ─────────────────────────────────────────────────────────────────────────────

import { connectLambda, getStore } from '@netlify/blobs';

const TRAFFIC_STORE = 'traffic';

const utcDayKey = (date) => date.toISOString().slice(0, 10);

/** Last `n` UTC day keys, newest first, ending today. */
const recentDays = (n, today) => {
  const out = [];
  const base = new Date(`${utcDayKey(today)}T00:00:00Z`).getTime();
  for (let i = 0; i < n; i++) {
    out.push(utcDayKey(new Date(base - i * 86400000)));
  }
  return out;
};

/** Exact unique-visitor count for a day = number of per-visitor blobs under its prefix. */
const uniqueForDay = async (store, dayKey) => {
  let count = 0;
  // Netlify Blobs paginates list(); walk every page so large days count fully.
  for await (const page of store.list({ prefix: `d/${dayKey}/`, paginate: true })) {
    count += page.blobs.length;
  }
  return count;
};

const html = (rows, totals, days) => {
  const maxU = Math.max(1, ...rows.map((r) => r.unique));
  const bar = (v) => Math.round((v / maxU) * 100);
  const dayRows = rows
    .map(
      (r) => `<tr>
        <td class="d">${r.day}</td>
        <td class="n">${r.unique.toLocaleString('el-GR')}</td>
        <td class="n muted">${(r.hits || 0).toLocaleString('el-GR')}</td>
        <td class="bar"><span style="width:${bar(r.unique)}%"></span></td>
      </tr>`
    )
    .join('');

  const refRows = Object.entries(totals.refs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k, v]) => `<tr><td>${k}</td><td class="n">${v.toLocaleString('el-GR')}</td></tr>`)
    .join('');

  const sumUnique = rows.reduce((s, r) => s + r.unique, 0);
  const sumHits = rows.reduce((s, r) => s + (r.hits || 0), 0);

  return `<!doctype html><html lang="el"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>CalmBeach · Πραγματική κίνηση</title>
<!-- Home-screen shortcut: clean short name + standalone fullscreen. -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Κίνηση">
<meta name="mobile-web-app-capable" content="yes">
<meta name="application-name" content="Κίνηση">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#0ea5e9">
<link rel="apple-touch-icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Crect width='180' height='180' rx='40' fill='%230ea5e9'/%3E%3Ctext x='90' y='125' font-size='110' text-anchor='middle' fill='white' font-family='system-ui'%3E%F0%9F%93%8A%3C/text%3E%3C/svg%3E">
<style>
  :root{color-scheme:light dark}
  *{box-sizing:border-box}
  body{font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#f6f8fa;color:#0f172a}
  @media(prefers-color-scheme:dark){body{background:#0b1220;color:#e2e8f0}}
  .wrap{max-width:760px;margin:0 auto;padding:24px 18px 60px}
  h1{font-size:20px;margin:0 0 4px} .sub{color:#64748b;margin:0 0 20px;font-size:13px}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px}
  @media(prefers-color-scheme:dark){.card{background:#111a2e;border-color:#1e293b}}
  .card .k{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.04em}
  .card .v{font-size:30px;font-weight:700;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:28px}
  th,td{text-align:left;padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:14px}
  @media(prefers-color-scheme:dark){th,td{border-color:#1e293b}}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
  td.n{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
  td.muted{color:#94a3b8;font-weight:400}
  td.d{font-variant-numeric:tabular-nums;color:#475569}
  td.bar{width:34%}
  td.bar span{display:block;height:8px;border-radius:5px;background:#0ea5e9}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin:0 0 8px}
</style></head><body><div class="wrap">
  <h1>Πραγματική κίνηση — CalmBeach</h1>
  <p class="sub">First-party, χωρίς cookies, χωρίς consent gate, δεν το κόβουν τα ad-blockers. Μετράει κάθε πραγματικό επισκέπτη. Τελευταίες ${days} μέρες (UTC).</p>
  <div class="cards">
    <div class="card"><div class="k">Μοναδικοί σήμερα</div><div class="v">${rows[0] ? rows[0].unique.toLocaleString('el-GR') : 0}</div></div>
    <div class="card"><div class="k">Μοναδικοί (${days}ημ.)</div><div class="v">${sumUnique.toLocaleString('el-GR')}</div></div>
  </div>
  <h2>Ανά ημέρα</h2>
  <table><thead><tr><th>Ημέρα</th><th class="n">Μοναδικοί</th><th class="n">Προβολές</th><th></th></tr></thead>
    <tbody>${dayRows}</tbody></table>
  <h2>Πηγές (${days}ημ. · σύνολο ${sumHits.toLocaleString('el-GR')} προβολές)</h2>
  <table><thead><tr><th>Παραπομπή</th><th class="n">Προβολές</th></tr></thead>
    <tbody>${refRows || '<tr><td colspan="2" class="muted">Καμία ακόμη</td></tr>'}</tbody></table>
</div></body></html>`;
};

export const handler = async (event) => {
  const key = process.env.TRAFFIC_STATS_KEY || '';
  const given = (event.queryStringParameters || {}).key || '';
  if (!key || given !== key) {
    return { statusCode: 403, headers: { 'Content-Type': 'text/plain' }, body: 'Forbidden' };
  }

  const params = event.queryStringParameters || {};
  const days = Math.min(90, Math.max(1, Number(params.days) || 30));

  try {
    // Wire the Blobs environment from the Lambda event (see pageview.mjs).
    connectLambda(event);
    const store = getStore(TRAFFIC_STORE);
    const today = new Date();

    const rows = [];
    const mergedRefs = {};
    for (const day of recentDays(days, today)) {
      const unique = await uniqueForDay(store, day);
      const totals = (await store.get(`totals/${day}`, { type: 'json' })) || { hits: 0, refs: {} };
      for (const [k, v] of Object.entries(totals.refs || {})) mergedRefs[k] = (mergedRefs[k] || 0) + v;
      rows.push({ day, unique, hits: totals.hits || 0 });
    }

    if (params.format === 'json') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ days, rows, referrers: mergedRefs }, null, 2),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      body: html(rows, { refs: mergedRefs }, days),
    };
  } catch (error) {
    // Never 502: surface the cause behind the secret key so the operator (and the
    // build) can see exactly what failed (e.g. Blobs not configured on the site).
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      body: `traffic-stats error: ${error && error.name}: ${error && error.message}\n\n${error && error.stack}`,
    };
  }
};
