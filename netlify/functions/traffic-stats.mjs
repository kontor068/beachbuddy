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

// Greek names for the countries a Greek beach site actually sees; fall back to the code.
const COUNTRY_NAMES = {
  GR: '🇬🇷 Ελλάδα', DE: '🇩🇪 Γερμανία', GB: '🇬🇧 Ην. Βασίλειο', US: '🇺🇸 ΗΠΑ',
  FR: '🇫🇷 Γαλλία', IT: '🇮🇹 Ιταλία', NL: '🇳🇱 Ολλανδία', AT: '🇦🇹 Αυστρία',
  CH: '🇨🇭 Ελβετία', BE: '🇧🇪 Βέλγιο', SE: '🇸🇪 Σουηδία', PL: '🇵🇱 Πολωνία',
  RO: '🇷🇴 Ρουμανία', BG: '🇧🇬 Βουλγαρία', CY: '🇨🇾 Κύπρος', ES: '🇪🇸 Ισπανία',
  CZ: '🇨🇿 Τσεχία', DK: '🇩🇰 Δανία', NO: '🇳🇴 Νορβηγία', FI: '🇫🇮 Φινλανδία',
  IE: '🇮🇪 Ιρλανδία', IL: '🇮🇱 Ισραήλ', TR: '🇹🇷 Τουρκία', RU: '🇷🇺 Ρωσία',
  CA: '🇨🇦 Καναδάς', AU: '🇦🇺 Αυστραλία', HU: '🇭🇺 Ουγγαρία', SK: '🇸🇰 Σλοβακία',
};
const countryLabel = (code) => COUNTRY_NAMES[code] || (code === '??' ? 'Άγνωστη' : code);
const deviceLabel = (d) => ({ mobile: '📱 Κινητό', desktop: '💻 Υπολογιστής', tablet: '📱 Tablet' }[d] || d);

const num = (v) => (v || 0).toLocaleString('el-GR');

/**
 * A compact "label → count" table for a breakdown dictionary, top `limit` by count.
 * If `total` (the exact unique count) is given and exceeds the tagged sum, a muted
 * "Λοιπά / χωρίς στοιχεία" row makes the table always add up to the headline — those
 * are visitors counted in the exact unique total but without this tag (e.g. tagged
 * before the metric shipped, geo unresolved, or a best-effort write lost).
 */
const breakdownTable = (title, obj, labelFn, total, limit = 12) => {
  const all = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
  const entries = all.slice(0, limit);
  let rows = entries.length
    ? entries.map(([k, v]) => `<tr><td>${labelFn ? labelFn(k) : k}</td><td class="n">${num(v)}</td></tr>`).join('')
    : '';

  const tagged = all.reduce((s, [, v]) => s + v, 0);
  const shown = entries.reduce((s, [, v]) => s + v, 0);
  const other = (typeof total === 'number' ? Math.max(0, total - shown) : tagged - shown);
  if (other > 0) {
    rows += `<tr><td class="muted">Λοιπά / χωρίς στοιχεία</td><td class="n muted">${num(other)}</td></tr>`;
  }
  if (!rows) rows = '<tr><td colspan="2" class="muted">Καμία ακόμη</td></tr>';
  return `<h2>${title}</h2><table><tbody>${rows}</tbody></table>`;
};

const html = (rows, totals, days) => {
  const maxU = Math.max(1, ...rows.map((r) => r.unique));
  const bar = (v) => Math.round((v / maxU) * 100);
  const dayRows = rows
    .map(
      (r) => `<tr>
        <td class="d">${r.day}</td>
        <td class="n">${num(r.unique)}</td>
        <td class="n grn">${num(r.newV)}</td>
        <td class="n muted">${num(r.retV)}</td>
        <td class="n muted">${r.unique ? (r.hits / r.unique).toFixed(1) : '—'}</td>
        <td class="bar"><span style="width:${bar(r.unique)}%"></span></td>
      </tr>`
    )
    .join('');

  const sumUnique = rows.reduce((s, r) => s + r.unique, 0);
  const sumNew = rows.reduce((s, r) => s + (r.newV || 0), 0);
  const sumHits = rows.reduce((s, r) => s + (r.hits || 0), 0);

  // Best single "people" number for a day: the truth sits between the tagged count
  // (new+returning — devices whose FIRST ping of the day landed; misses a few lost
  // best-effort writes ⇒ a floor) and the unique hash count (inflated by mobile IP
  // rotation ⇒ a ceiling). The midpoint is the honest point estimate; with no tags
  // yet (e.g. just after midnight) fall back to uniques.
  const peopleEstimate = (r) => {
    const tagged = (r.newV || 0) + (r.retV || 0);
    return tagged ? Math.round((tagged + r.unique) / 2) : r.unique;
  };
  // Best-effort split vs exact unique can drift slightly out of range; clamp to [0,100].
  const retPct = sumUnique ? Math.min(100, Math.max(0, Math.round(((sumUnique - sumNew) / sumUnique) * 100))) : 0;

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
  td.grn{color:#059669}
  @media(prefers-color-scheme:dark){td.grn{color:#34d399}}
  td.d{font-variant-numeric:tabular-nums;color:#475569}
  td.bar{width:28%}
  td.bar span{display:block;height:8px;border-radius:5px;background:#0ea5e9}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin:0 0 8px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}
  @media(max-width:520px){.grid2{grid-template-columns:1fr}}
  .foot{color:#94a3b8;font-size:12px;line-height:1.6;margin-top:8px}
  #optout{appearance:none;border:1px solid #cbd5e1;background:#fff;color:#0f172a;border-radius:999px;
    padding:8px 14px;font:600 13px system-ui,sans-serif;cursor:pointer;margin:0 0 20px}
  @media(prefers-color-scheme:dark){#optout{background:#111a2e;border-color:#334155;color:#e2e8f0}}
  #optout.on{background:#065f46;border-color:#065f46;color:#fff}
</style></head><body><div class="wrap">
  <h1>Πραγματική κίνηση — CalmBeach</h1>
  <p class="sub">First-party, χωρίς cookies, χωρίς consent gate, δεν το κόβουν τα ad-blockers. Μετράει κάθε πραγματικό επισκέπτη. Τελευταίες ${days} μέρες (UTC).</p>
  <button id="optout" type="button">🚫 Μην μετράς αυτή τη συσκευή</button>
  <script>
    (function () {
      var K = 'cb_optout', b = document.getElementById('optout');
      function render() {
        var on = false;
        try { on = localStorage.getItem(K) === '1'; } catch (e) {}
        b.className = on ? 'on' : '';
        b.textContent = on
          ? '✅ Αυτή η συσκευή ΔΕΝ μετριέται — πάτα για επαναφορά'
          : '🚫 Μην μετράς αυτή τη συσκευή';
      }
      b.addEventListener('click', function () {
        try {
          if (localStorage.getItem(K) === '1') localStorage.removeItem(K);
          else localStorage.setItem(K, '1');
        } catch (e) { alert('Ο browser μπλοκάρει την αποθήκευση — δοκίμασε εκτός ιδιωτικής περιήγησης.'); }
        render();
      });
      render();
    })();
  </script>
  <div class="cards">
    <div class="card"><div class="k">≈ Άτομα σήμερα</div><div class="v">~${rows[0] ? num(peopleEstimate(rows[0])) : 0}</div></div>
    <div class="card"><div class="k">Συσκευές/συνδέσεις σήμερα</div><div class="v">${rows[0] ? num(rows[0].unique) : 0}</div></div>
    <div class="card"><div class="k">Νέοι σήμερα</div><div class="v">${rows[0] ? num(rows[0].newV) : 0}</div></div>
    <div class="card"><div class="k">Επιστρέφοντες (${days}ημ.)</div><div class="v">${retPct}%</div></div>
  </div>
  <h2>Ανά ημέρα</h2>
  <table><thead><tr><th>Ημέρα</th><th class="n">Μοναδ.</th><th class="n">Νέοι</th><th class="n">Επιστρ.</th><th class="n">Προβ./άτομο</th><th></th></tr></thead>
    <tbody>${dayRows}</tbody></table>
  <div class="grid2">
    <div>${breakdownTable('Χώρες', totals.countries, countryLabel, sumUnique)}</div>
    <div>${breakdownTable('Συσκευές', totals.devices, deviceLabel, sumUnique)}</div>
    <div>${breakdownTable('Δημοφιλείς περιοχές', totals.sections, null, sumUnique)}</div>
    <div>${breakdownTable('Πηγές', totals.refs, null, sumUnique)}</div>
  </div>
  <p class="foot">Σύνολο προβολών (${days}ημ.): <b>${num(sumHits)}</b> · Μοναδικοί (${days}ημ.): <b>${num(sumUnique)}</b> ·
  «<b>≈ Άτομα</b>» = η καλύτερη εκτίμηση πραγματικών ανθρώπων: ανάμεσα στο σίγουρο ελάχιστο (Νέοι+Επιστρέφοντες) και στις «Συσκευές/συνδέσεις» (ο ίδιος με αλλαγμένη IP μετριέται 2η φορά εκεί).
  Νέοι/επιστρέφοντες, χώρες, συσκευές &amp; περιοχές μετρώνται ανά μοναδικό επισκέπτη και είναι <b>κατά προσέγγιση</b>. Χώρα «Άγνωστη» = δεν εντοπίστηκε geo.</p>
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

    // Admin: wipe one day's data (operator use only — key-gated). Used to clear a
    // contaminated day (e.g. launch-day test traffic) so counting restarts clean.
    // Since visitor hashes are irreversible we cannot delete selectively, so this
    // removes the WHOLE day; real visitors after the reset are counted fresh.
    if (params.reset) {
      const day = /^\d{4}-\d{2}-\d{2}$/.test(params.reset) ? params.reset : null;
      if (!day) {
        return { statusCode: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: 'reset must be YYYY-MM-DD' };
      }
      let deleted = 0;
      for await (const page of store.list({ prefix: `d/${day}/`, paginate: true })) {
        for (const b of page.blobs) {
          await store.delete(b.key);
          deleted += 1;
        }
      }
      await store.delete(`totals/${day}`);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        body: `Reset ${day}: διαγράφηκαν ${deleted} επισκέπτες + το rollup. Μετράει καθαρά από τώρα.`,
      };
    }

    const merged = { refs: {}, sections: {}, devices: {}, countries: {} };
    const mergeInto = (target, src) => {
      for (const [k, v] of Object.entries(src || {})) target[k] = (target[k] || 0) + v;
    };

    const rows = [];
    for (const day of recentDays(days, today)) {
      const unique = await uniqueForDay(store, day);
      const totals = (await store.get(`totals/${day}`, { type: 'json' })) || {};
      mergeInto(merged.refs, totals.refs);
      mergeInto(merged.sections, totals.sections);
      mergeInto(merged.devices, totals.devices);
      mergeInto(merged.countries, totals.countries);
      const kinds = totals.kinds || {};
      rows.push({
        day,
        unique,
        hits: totals.hits || 0,
        newV: kinds.new || 0,
        retV: (kinds.ret || 0) + (kinds.unknown || 0),
      });
    }

    if (params.format === 'json') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ days, rows, breakdowns: merged }, null, 2),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      body: html(rows, merged, days),
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
