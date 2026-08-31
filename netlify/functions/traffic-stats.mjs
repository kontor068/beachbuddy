// ─────────────────────────────────────────────────────────────────────────────
// TRAFFIC CONSOLE — the read side of the first-party visitor counter.
//
// Shows REAL unique visitors (consent-free, ad-block-proof — see pageview.mjs):
// who is on the site right now, where in the world everyone came from, how long
// they stayed, what they opened and what they pressed. Private: gated by a secret
// key so the numbers are never public.
//
//   Open:  https://calmbeach.gr/api/traffic?key=YOUR_KEY
//          &days=30            window (default: everything since counting began)
//          &format=json        raw data
//          &format=live        just the live layer (what the page auto-refreshes)
//          &purge=YYYY-MM-DD&cc=US   remove ONE COUNTRY's visitors from one day
//                                    (preview by default; add &confirm=1 to delete)
//          &reset=YYYY-MM-DD   wipe one contaminated day, all of it
//
// Set TRAFFIC_STATS_KEY in the Netlify env to enable it (unset ⇒ 403, never open).
//
// THE WINDOW STARTS WHEN COUNTING STARTED. The day list is derived from the blob
// store itself, so days before the counter existed are never shown as "0 visitors"
// — a zero we never measured is a lie, and it flattened every chart.
//
// ACCURACY, STATED HONESTLY (each number is labelled in the UI):
//   exact        — unique visitors/day (one blob per visitor, race-free)
//   exact        — pages per visit ≥2 (the client's own counter, not inferred)
//   best-effort  — pageviews, breakdowns, dwell (read-modify-write rollup; a
//                  concurrent write can drop one, so these under-count slightly)
//   estimate     — "≈ people", shown as a range, never as a single hard number
// ─────────────────────────────────────────────────────────────────────────────

import { connectLambda, getStore } from '@netlify/blobs';
import { countryLabel, countryFlag, COUNTRY_NAMES_EL } from './lib/geoLookup.mjs';
import { WORLD_PATH, WORLD_W, WORLD_H, WORLD_LAT_TOP } from './lib/worldPath.mjs';
// The weather bill lives on the same console as the traffic: both answer "is the
// site about to break?", and a quota meter you have to remember to open is a quota
// meter nobody opens. The counting itself happens in the forecast proxy.
import { monthlyUsage, MONTHLY_QUOTA, DAILY_BUDGET, DEFAULT_THRESHOLDS } from './lib/capacityAlarm.mjs';
// ── The moderation queue lives here too, so there is ONE admin page ───────────
// It used to be a second URL behind a second key (/api/ugc-admin), which meant
// remembering that it existed. A console you open every day to watch the traffic
// is the place where "three people sent photos" is actually seen. The decisions
// themselves still go through lib/ugcModeration.mjs — the same function the
// Telegram buttons and the old page call, so there is one implementation and
// three doors, not three copies of the rules.
import {
  beachLabel,
  clearPendingPublish,
  getSupabaseConfig,
  isConfigured as ugcConfigured,
  isKnownKind,
  listPending,
  moderate,
  readPendingPublish,
  signPendingPhoto,
  withBeachLabels,
} from './lib/ugcModeration.mjs';
import {
  HARD_MAX_PER_BEACH,
  listBeachPhotos,
  listBeachesWithPhotos,
  moveBeachPhoto,
  refreshApprovedPhotoIndex,
  setBeachPhotoLimit,
} from './lib/ugcPhotoIndex.mjs';
// Built by scripts/buildQualityLedger.mjs and committed. Imported, not fetched:
// this must NOT be a public file — it is a list of our own weak spots per island.
import LEDGER from './lib/qualityLedger.generated.mjs';
// Shared with quality-digest.mjs so the weekly message can never name a
// different region than the board does.
import {
  agoLabel,
  buildBeachGapRows,
  buildQualityRows,
  daysSince,
} from './lib/qualityPriority.mjs';
// Το κείμενο του εβδομαδιαίου μηνύματος. Στατικό import, όχι δυναμικό: το esbuild
// του Netlify πρέπει να το δει για να το πακετάρει, και ένα `await import()` που δεν
// πακετάρεται σκάει μόνο στην παραγωγή.
import { composeDigest } from './quality-digest.mjs';

const TRAFFIC_STORE = 'traffic';
/** Manual "I checked this region today" entries. Separate store: different lifetime. */
const QUALITY_STORE = 'quality';

/** A visitor counts as "on the site now" if they pinged inside this many minutes. */
const LIVE_MINUTES = 5;
/** Presence keys older than this are swept on every console load. */
const LIVE_KEEP_MINUTES = 90;
/** Never delete more than this per request — a sweep must not stall the page. */
const SWEEP_BUDGET = 400;

const utcDayKey = (date) => date.toISOString().slice(0, 10);

/** Run `fn` over `items` with bounded concurrency (Blobs is fast, but not free). */
const mapLimit = async (items, limit, fn) => {
  const out = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
};

/** Every key under a prefix, across all pages. */
const listKeys = async (store, prefix) => {
  const keys = [];
  for await (const page of store.list({ prefix, paginate: true })) {
    for (const b of page.blobs) keys.push(b.key);
  }
  return keys;
};

// ── formatting ───────────────────────────────────────────────────────────────

const num = (v) => (v || 0).toLocaleString('el-GR');
const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

/** "3λ 12δ" — a duration a person can read at a glance. */
const dur = (sec) => {
  const s = Math.max(0, Math.round(sec || 0));
  if (s < 60) return `${s}δ`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}λ ${String(s % 60).padStart(2, '0')}δ`;
  return `${Math.floor(m / 60)}ω ${String(m % 60).padStart(2, '0')}λ`;
};

const dayLabel = (iso) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};
const weekdayLabel = (iso) =>
  ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ'][new Date(`${iso}T12:00:00Z`).getUTCDay()];

// Greek labels for the low-cardinality dimensions.
const DEVICE_LABEL = { mobile: '📱 Κινητό', desktop: '💻 Υπολογιστής', tablet: '📱 Tablet' };
const CHANNEL_LABEL = {
  google: '🔍 Google', 'search-other': '🔍 Άλλη μηχανή', ai: '🤖 AI βοηθός',
  direct: '↳ Απευθείας', facebook: '📘 Facebook', x: '✖️ X/Twitter',
  'social-other': '💬 Άλλο social', email: '✉️ Email', referral: '🔗 Άλλο site',
};
const ACTION_LABEL = {
  nav: '🧭 Πλοήγηση', share: '🔗 Κοινοποίηση', fav: '⭐ Αγαπημένο',
  out: '↗️ Εξωτ. σύνδεσμος', search: '🔎 Αναζήτηση', filter: '🎚️ Φίλτρο',
};
const LANG_LABEL = {
  el: '🇬🇷 Ελληνικά', en: '🇬🇧 Αγγλικά', de: '🇩🇪 Γερμανικά', fr: '🇫🇷 Γαλλικά',
  it: '🇮🇹 Ιταλικά', nl: '🇳🇱 Ολλανδικά', es: '🇪🇸 Ισπανικά', pl: '🇵🇱 Πολωνικά',
  ru: '🇷🇺 Ρωσικά', ro: '🇷🇴 Ρουμανικά', bg: '🇧🇬 Βουλγαρικά', tr: '🇹🇷 Τουρκικά',
  cs: '🇨🇿 Τσέχικα', sv: '🇸🇪 Σουηδικά', da: '🇩🇰 Δανέζικα', he: '🇮🇱 Εβραϊκά',
};
const BROWSER_LABEL = {
  chrome: 'Chrome', safari: 'Safari', firefox: 'Firefox', edge: 'Edge',
  samsung: 'Samsung Internet', opera: 'Opera', other: 'Άλλος',
};
const OS_LABEL = { ios: 'iOS', android: 'Android', windows: 'Windows', macos: 'macOS', linux: 'Linux', other: 'Άλλο' };
const ACTIVITY_LABEL = {
  beach: '🏖️ Σελίδα παραλίας', region: '🗺️ Περιοχή / νησί', guide: '📖 Οδηγός / άρθρο',
  hub: '📚 Ευρετήριο οδηγών', home: '🏠 Αρχική', landing: '🎯 Σελίδα προορισμού',
  faq: '❓ Συχνές ερωτήσεις', legal: '⚖️ Νομικά', other: '· Άλλο',
};
const cityLabel = (key) => {
  const [cc, ...rest] = String(key).split('/');
  return `${countryFlag(cc)} ${rest.join('/').replace(/_/g, ' ')}`;
};

// ── small SVG builders ───────────────────────────────────────────────────────

/** A 60×18 sparkline for a KPI tile. */
const sparkline = (values, color) => {
  const v = values.slice().reverse(); // rows arrive newest-first
  if (v.length < 2) return '';
  const max = Math.max(1, ...v);
  const step = 60 / (v.length - 1);
  const pts = v.map((n, i) => `${(i * step).toFixed(1)},${(18 - (n / max) * 16).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 60 18" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
};

/**
 * The daily trend: pageviews as a filled area, unique visitors as a line, new
 * visitors as a faint column behind. One picture instead of three tables.
 */
const trendChart = (rows) => {
  const r = rows.slice().reverse(); // oldest → newest, left → right
  if (!r.length) return '<p class="empty">Καμία μέρα ακόμη.</p>';

  const W = 1000;
  const H = 240;
  const PAD_L = 46;
  const PAD_R = 14;
  const PAD_T = 16;
  const PAD_B = 30;
  const iw = W - PAD_L - PAD_R;
  const ih = H - PAD_T - PAD_B;

  const maxHits = Math.max(1, ...r.map((d) => d.hits));
  const maxUniq = Math.max(1, ...r.map((d) => d.unique));
  const x = (i) => PAD_L + (r.length === 1 ? iw / 2 : (i / (r.length - 1)) * iw);
  const yH = (v) => PAD_T + ih - (v / maxHits) * ih;
  const yU = (v) => PAD_T + ih - (v / maxUniq) * ih;

  const areaPts = r.map((d, i) => `${x(i).toFixed(1)},${yH(d.hits).toFixed(1)}`).join(' ');
  const area = `${PAD_L},${PAD_T + ih} ${areaPts} ${(PAD_L + iw).toFixed(1)},${PAD_T + ih}`;
  const line = r.map((d, i) => `${x(i).toFixed(1)},${yU(d.unique).toFixed(1)}`).join(' ');

  // New-visitor columns, scaled against uniques so the two read together.
  const barW = Math.max(2, Math.min(16, (iw / Math.max(1, r.length)) * 0.42));
  const bars = r
    .map(
      (d, i) =>
        `<rect x="${(x(i) - barW / 2).toFixed(1)}" y="${yU(d.newV).toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, PAD_T + ih - yU(d.newV)).toFixed(1)}" rx="1.5" fill="url(#gNew)"/>`
    )
    .join('');

  const dots = r
    .map(
      (d, i) =>
        `<circle class="tdot" cx="${x(i).toFixed(1)}" cy="${yU(d.unique).toFixed(1)}" r="3.2"><title>${d.day} · ${num(d.unique)} μοναδικοί · ${num(d.hits)} προβολές · ${num(d.newV)} νέοι</title></circle>`
    )
    .join('');

  // Roughly 7 x-labels, always including the newest day.
  const stride = Math.max(1, Math.ceil(r.length / 7));
  const xLabels = r
    .map((d, i) =>
      (r.length - 1 - i) % stride === 0
        ? `<text class="ax" x="${x(i).toFixed(1)}" y="${H - 10}" text-anchor="middle">${dayLabel(d.day)}</text>`
        : ''
    )
    .join('');

  const gridLines = [0, 0.5, 1]
    .map((f) => {
      const y = PAD_T + ih - f * ih;
      return `<line class="grid" x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${W - PAD_R}" y2="${y.toFixed(1)}"/>
      <text class="ax" x="${PAD_L - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${num(Math.round(f * maxUniq))}</text>`;
    })
    .join('');

  return `<div class="trendwrap"><svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ημερήσια πορεία">
    <defs>
      <linearGradient id="gHits" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity=".28"/>
        <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#34d399" stop-opacity=".55"/>
        <stop offset="100%" stop-color="#34d399" stop-opacity=".08"/>
      </linearGradient>
    </defs>
    ${gridLines}
    ${bars}
    <polygon points="${area}" fill="url(#gHits)"/>
    <polyline points="${areaPts}" fill="none" stroke="#22d3ee" stroke-width="1.4" stroke-opacity=".7"/>
    <polyline points="${line}" fill="none" stroke="#f0abfc" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    ${xLabels}
    <text class="ax hits" x="${W - PAD_R}" y="${PAD_T + 10}" text-anchor="end">κορυφή προβολών: ${num(maxHits)}</text>
  </svg></div>`;
};

/** 24 cells, Athens time — when people actually look for a beach. */
const hourStrip = (hours) => {
  const vals = Array.from({ length: 24 }, (_, h) => hours[String(h)] || 0);
  const max = Math.max(1, ...vals);
  const peak = vals.indexOf(Math.max(...vals));
  const cells = vals
    .map((v, h) => {
      const f = v / max;
      return `<div class="hcell${v === 0 ? ' z' : ''}" style="--f:${f.toFixed(3)}" title="${String(h).padStart(2, '0')}:00 — ${num(v)} προβολές"><span>${String(h).padStart(2, '0')}</span></div>`;
    })
    .join('');
  const total = vals.reduce((s, v) => s + v, 0);
  return `<div class="hours">${cells}</div>
    <p class="note">${total ? `Αιχμή στις <b>${String(peak).padStart(2, '0')}:00</b> ώρα Ελλάδας.` : 'Δεν υπάρχουν ακόμη αρκετές προβολές.'}</p>`;
};

/**
 * The visitor journey: of everyone who arrived, how many got as far as each step.
 * Counted per PERSON (the collector flags each visitor once), which is why this can
 * answer "does anyone actually open a beach page" — a pageview count cannot.
 */
const funnelPanel = (funnel, actions, visitors) => {
  const f = funnel || {};
  // NOT a funnel: Google drops people straight onto a beach page, so "opened a
  // beach" is routinely larger than "saw a region list". Ranking the middle steps by
  // size keeps it honest — a funnel shape would imply an order that isn't there.
  const middle = [
    { label: 'Άνοιξαν σελίδα παραλίας', v: f.b || 0, c: '#818cf8' },
    { label: 'Διάβασαν οδηγό / άρθρο', v: f.g || 0, c: '#c4b5fd' },
    { label: 'Είδαν λίστα περιοχής / νησιού', v: f.r || 0, c: '#38bdf8' },
  ].sort((a, b) => b.v - a.v);
  const steps = [
    { label: 'Μπήκαν στο site', v: visitors, c: '#22d3ee' },
    ...middle,
    { label: 'Πάτησαν «Οδηγίες» για να πάνε', v: f.n || 0, c: '#34d399' },
  ];
  const base = Math.max(1, visitors);
  const rows = steps
    .map((s) => {
      const pct = Math.min(100, (s.v / base) * 100);
      return `<li class="fstep">
        <span class="fl">${esc(s.label)}</span>
        <span class="fb"><i style="width:${pct.toFixed(1)}%;background:${s.c}"></i></span>
        <span class="fn">${num(s.v)}</span>
        <span class="fp">${Math.round(pct)}%</span>
      </li>`;
    })
    .join('');

  const beach = f.b || 0;
  const nav = f.n || 0;
  const verdict = !visitors
    ? 'Δεν υπάρχουν ακόμη επισκέπτες στο παράθυρο.'
    : `Από <b>${num(visitors)}</b> επισκέπτες, <b>${num(beach)}</b> (${Math.round((beach / base) * 100)}%) άνοιξαν συγκεκριμένη παραλία και <b>${num(nav)}</b> ζήτησαν οδηγίες για να πάνε.` +
      (f.g ? ` <b>${num(f.g)}</b> διάβασαν οδηγό.` : '');

  return `<section class="panel">
    <h2>Τι κάνουν όσοι μπαίνουν<em>ανά επισκέπτη, όχι ανά κλικ · ${esc('κατά προσέγγιση')}</em></h2>
    <ul class="funnel">${rows}</ul>
    <p class="note">${verdict}</p>
  </section>`;
};

/**
 * A breakdown list with proportional bars. `total` is the exact unique count when
 * we have one, so the "Λοιπά / χωρίς στοιχεία" row makes the list add up to the
 * headline instead of quietly disagreeing with it.
 */
const breakdown = (title, obj, labelFn, total, limit = 10, unit = '') => {
  const all = Object.entries(obj || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const entries = all.slice(0, limit);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  const shown = entries.reduce((s, [, v]) => s + v, 0);
  const tagged = all.reduce((s, [, v]) => s + v, 0);
  const other = typeof total === 'number' ? Math.max(0, total - shown) : tagged - shown;
  const denom = typeof total === 'number' && total > 0 ? total : tagged || 1;

  let rows = entries
    .map(([k, v]) => {
      const label = labelFn ? labelFn(k) : k;
      return `<li><span class="bl">${esc(label)}</span>
        <span class="bb"><i style="width:${((v / max) * 100).toFixed(1)}%"></i></span>
        <span class="bn">${num(v)}</span><span class="bp">${Math.round((v / denom) * 100)}%</span></li>`;
    })
    .join('');
  if (other > 0) {
    rows += `<li class="dim"><span class="bl">Λοιπά / χωρίς στοιχεία</span>
      <span class="bb"><i style="width:${((other / max) * 100).toFixed(1)}%"></i></span>
      <span class="bn">${num(other)}</span><span class="bp">${Math.round((other / denom) * 100)}%</span></li>`;
  }
  if (!rows) rows = '<li class="dim"><span class="bl">Καμία ακόμη</span></li>';
  return `<section class="panel"><h2>${esc(title)}${unit ? `<em>${esc(unit)}</em>` : ''}</h2><ul class="bars">${rows}</ul></section>`;
};

// ── the moderation queue, rendered ───────────────────────────────────────────
// Plain <form> posts, no JavaScript. That is not nostalgia: the rest of this page
// is a live map that redraws itself, and a decision that publishes a stranger's
// photo to a crawled page should not depend on any of that still working. A form
// post either happened or it didn't.

const whenEl = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('el-GR', { timeZone: 'Europe/Athens', dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(value).slice(0, 16);
  }
};

/** The two buttons. `key` travels in the body so the decision is never a GET. */
const ugcActions = (kind, id) => `
  <form method="post" action="?key=KEYPLACEHOLDER&amp;tab=photos">
    <input type="hidden" name="key" value="RAWFORMKEY">
    <input type="hidden" name="kind" value="${esc(kind)}">
    <input type="hidden" name="id" value="${esc(id)}">
    <button class="yes" name="action" value="approve">✅ Έγκριση</button>
    <button class="no" name="action" value="reject">🚫 Διαγραφή</button>
  </form>`;

const ugcPhotoCard = (item, signedUrl) => `
  <div class="item">
    ${signedUrl
      ? `<img src="${esc(signedUrl)}" alt="" loading="lazy">`
      : '<div class="noimg">η εικόνα δεν φορτώνει</div>'}
    <div class="body">
      <div class="who">${esc(item.beach_name || `Παραλία #${item.beach_id}`)}</div>
      <div class="facts">${esc(item.region_id || '—')} · ${whenEl(item.created_at)}${
        item.show_credit ? ' · με όνομα' : ''}</div>
      ${item.caption ? `<p class="cap">${esc(item.caption)}</p>` : ''}
      ${ugcActions('photo', item.id)}
    </div>
  </div>`;

const ugcReviewCard = (item) => {
  const stars = Math.max(0, Math.min(5, Number(item.rating) || 0));
  return `
  <div class="item">
    <div class="body">
      <div class="who">${esc(item.beach_name || `Παραλία #${item.beach_id}`)}
        <span class="stars">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</span></div>
      <div class="facts">${esc(item.region_id || '—')} · ${whenEl(item.created_at)}</div>
      <p class="cap">${esc(item.body || '— χωρίς κείμενο —')}</p>
      ${ugcActions('review', item.id)}
    </div>
  </div>`;
};

// ── Putting one beach's photos in order ──────────────────────────────────────
// The screen that answers "which of these three represents this beach". It shows
// EVERY approved photo, including the ones past the cap, dimmed and labelled —
// you cannot decide that the fourth deserves to be first if the console only
// shows you the three that made it.
//
// Arrows and one ⭐, not drag-and-drop. Dragging inside a page that scrolls is
// miserable on a phone, and it would need JavaScript in the one place on this
// page that deliberately has none: a control that publishes a stranger's photo
// must work as a plain form post or not at all.

const ORDER_BTN = 'appearance:none;border:1px solid rgba(148,163,184,.35);border-radius:8px;'
  + 'background:rgba(148,163,184,.12);color:#cbd5e1;font:600 13px system-ui,sans-serif;'
  + 'cursor:pointer;padding:5px 9px;min-width:34px';

const curatingCard = (curating, photo, index, total) => `
  <div class="item" style="${photo.shown ? '' : 'opacity:.55'}">
    <img src="${esc(photo.url)}" alt="" loading="lazy">
    <div class="body">
      <div class="who">${index === 0 ? '⭐ Εξώφυλλο' : `#${photo.position}`}
        ${photo.shown ? '' : '<span class="stars" style="color:#f59e0b">δεν φαίνεται</span>'}</div>
      ${photo.caption ? `<p class="cap">${esc(photo.caption)}</p>` : ''}
      <form method="post" action="?key=KEYPLACEHOLDER&amp;tab=photos&amp;beach=${esc(beachRef(curating.regionId, curating.beachId))}"
            style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        <input type="hidden" name="key" value="RAWFORMKEY">
        <input type="hidden" name="region" value="${esc(curating.regionId)}">
        <input type="hidden" name="beach" value="${esc(curating.beachId)}">
        <input type="hidden" name="photoId" value="${esc(photo.id)}">
        ${index === 0 ? '' : `<button name="action" value="move-first" style="${ORDER_BTN}" title="Κάν' την εξώφυλλο">⭐</button>`}
        ${index === 0 ? '' : `<button name="action" value="move-up" style="${ORDER_BTN}" title="Πιο πάνω">↑</button>`}
        ${index === total - 1 ? '' : `<button name="action" value="move-down" style="${ORDER_BTN}" title="Πιο κάτω">↓</button>`}
      </form>
    </div>
  </div>`;

const curatingPanel = (curating) => {
  if (!curating) return '';
  if (curating.problem) {
    return `<section class="panel"><h2>Σειρά φωτογραφιών</h2>
      <p class="empty">Δεν διαβάστηκε: ${esc(curating.problem)}</p></section>`;
  }
  if (!curating.photos.length) {
    return `<section class="panel"><h2>${esc(curating.name)}<em>σειρά φωτογραφιών</em></h2>
      <p class="empty">Αυτή η παραλία δεν έχει ακόμα εγκεκριμένη φωτογραφία.</p></section>`;
  }

  const total = curating.photos.length;
  const shown = Math.min(curating.maxShown, total);
  const options = Array.from({ length: Math.min(HARD_MAX_PER_BEACH, Math.max(total, curating.maxShown)) }, (_, i) => i + 1)
    .map((n) => `<option value="${n}"${n === curating.maxShown ? ' selected' : ''}>${n}</option>`)
    .join('');

  return `
<section class="panel">
  <h2>${esc(curating.name)}<em>${num(total)} εγκεκριμένες · φαίνονται ${num(shown)}</em></h2>
  <p class="empty" style="margin:0 0 10px">Η πρώτη είναι το εξώφυλλο — αυτή που βλέπει ο κόσμος στην κάρτα
    και στην αναζήτηση. Κάθε αλλαγή είναι ζωντανή αμέσως, χωρίς χτίσιμο.</p>
  <form method="post" action="?key=KEYPLACEHOLDER&amp;tab=photos&amp;beach=${esc(beachRef(curating.regionId, curating.beachId))}"
        style="display:flex;gap:8px;align-items:center;margin:0 0 12px;flex-wrap:wrap">
    <input type="hidden" name="key" value="RAWFORMKEY">
    <input type="hidden" name="region" value="${esc(curating.regionId)}">
    <input type="hidden" name="beach" value="${esc(curating.beachId)}">
    <label style="color:#94a3b8;font:600 13px system-ui,sans-serif">Να δείχνει τις πρώτες</label>
    <select name="n" style="${ORDER_BTN};padding:5px 8px">${options}</select>
    <button name="action" value="limit" style="${ORDER_BTN}">Αποθήκευση</button>
  </form>
  <div class="ugc">${curating.photos.map((photo, i) => curatingCard(curating, photo, i, total)).join('')}</div>
</section>`;
};

/**
 * The beaches you can go and rearrange, as plain links.
 *
 * Beaches with a single photo are listed too but marked, because "1 φωτό" is a
 * beach where there is nothing to order — the link is still there so you can
 * change how many it shows, and so the list is a complete answer to "where have
 * visitor photos actually landed".
 */
const publishedBeachesPanel = (beaches, current) => {
  if (!beaches?.length) return '';
  const row = (beach) => {
    const ref = beachRef(beach.regionId, beach.beachId);
    const active = current && ref === beachRef(current.regionId, current.beachId);
    return `<li class="${active ? '' : 'dim'}">
      <a href="?key=KEYPLACEHOLDER&amp;tab=photos&amp;beach=${esc(ref)}"
         style="color:${active ? '#6ee7b7' : '#cbd5e1'};text-decoration:none">
        ${active ? '▸ ' : ''}${esc(beach.name)}</a>
      <span class="bl">${beach.count === 1 ? '1 φωτό' : `${num(beach.count)} φωτό`}</span></li>`;
  };
  return `<section class="panel">
    <h2>Παραλίες με φωτογραφίες<em>${num(beaches.length)} · πάτα μία για να αλλάξεις σειρά</em></h2>
    <ul class="bars">${beaches.map(row).join('')}</ul>
  </section>`;
};

// Since 12/08/2026 an approval publishes itself — see lib/ugcPhotoIndex.mjs. The
// wording has to keep the two audiences apart, because they are now hours or days
// apart: the photo is on the site immediately, and on the pages Google reads at
// the next build. Saying only the first would imply the SEO side is done too.
const FLASH = {
  approved: ['Εγκρίθηκε — είναι ήδη στη σελίδα της παραλίας (μέσα σε ένα-δυο λεπτά). Στη Google μπαίνει στο επόμενο χτίσιμο.', ''],
  approvedNotLive: ['Εγκρίθηκε, αλλά η ζωντανή λίστα δεν ανανεώθηκε — θα εμφανιστεί στο επόμενο χτίσιμο. Δες τα logs.', 'warn'],
  rejected: ['Απορρίφθηκε, το αρχείο διαγράφηκε οριστικά και έφυγε αμέσως από το site.', ''],
  already: ['Είχε ήδη κριθεί — δεν έγινε τίποτα δεύτερη φορά.', 'warn'],
  built: ['Ξεκίνησε το χτίσιμο. Σε λίγα λεπτά τα εγκεκριμένα θα είναι και στις στατικές σελίδες.', ''],
  refreshed: ['Η ζωντανή λίστα ανανεώθηκε — ό,τι είναι εγκεκριμένο φαίνεται τώρα στο site.', ''],
  reordered: ['Η σειρά άλλαξε και είναι ήδη ζωντανή στο site.', ''],
  reorderedNotLive: ['Η σειρά αποθηκεύτηκε, αλλά δεν πρόλαβε να βγει ζωντανά — δοκίμασε «Ανανέωσε τη ζωντανή λίστα».', 'warn'],
  nomigration: ['Η αλλαγή σειράς δεν είναι ακόμα ενεργή: τρέξε το supabase/migrations/0006_photo_ordering.sql στη Supabase. Μέχρι τότε όλα τα υπόλοιπα δουλεύουν κανονικά.', 'warn'],
  nobuild: ['Δεν υπάρχει build hook ρυθμισμένο (NETLIFY_BUILD_HOOK_URL) — οι φωτογραφίες φαίνονται ήδη στο site, στη Google θα μπουν στο επόμενο ανέβασμα κώδικα.', 'warn'],
  failed: ['Κάτι πήγε στραβά — δες τα logs της συνάρτησης. Τίποτα δεν άλλαξε.', 'warn'],
  checked: ['Καταχωρήθηκε. Η περιοχή μετράει από σήμερα ως ελεγμένη και έπεσε στη σειρά προτεραιότητας.', ''],
  checkfailed: ['Δεν αποθηκεύτηκε ο έλεγχος — δες τα logs. Δοκίμασε ξανά.', 'warn'],
  todoadded: ['Μπήκε στις εκκρεμότητες. Θα το βρεις εδώ και στον επόμενο γύρο.', ''],
  tododone: ['Κλείστηκε. Μένει γραμμένο ως δουλειά που έγινε, δεν σβήνεται.', ''],
  todoempty: ['Δεν έγραψες τίποτα, οπότε δεν αποθηκεύτηκε τίποτα.', 'warn'],
  capsaved: ['Καταχωρήθηκε η ένδειξη του Open-Meteo. Ο πίνακας δείχνει πλέον και τα δύο νούμερα δίπλα-δίπλα.', ''],
  capbad: ['Χρειάζεται τουλάχιστον το συνολικό νούμερο του κύκλου, σαν αριθμός. Δεν αποθηκεύτηκε τίποτα.', 'warn'],
};

// ─────────────────────────────────────────────────────────────────────────────
// ΠΟΙΟΤΗΤΑ — "which island do I re-check next, and why that one"
//
// Two things existed here already and never met: the console knew which regions
// people actually open, and the repo knew when each region was last audited. On
// their own, neither answers the only question worth asking — a stale island
// nobody visits can wait, a busy island nobody has re-read since June cannot.
// This tab is that join, and nothing more: no new measurement, no new claim.
//
// EVERY NUMBER ON THIS TAB IS BACKED BY A FILE. Coverage comes from the beach
// records themselves, dates from the audit reports (netlify/functions/lib/
// qualityLedger.generated.mjs), pageviews from the same rollups the stats tab
// uses, and the "I checked it" entries from Blobs. Nothing is estimated.
// ─────────────────────────────────────────────────────────────────────────────

/** Six dots, one per kind of claim — green when covered, amber/red when not. */
const axisDots = (row) =>
  row.axes
    .map((a) => {
      const level = a.pct >= 95 ? 'ok' : a.pct >= 75 ? 'mid' : a.pct >= 40 ? 'low' : 'bad';
      // Ο άξονας που δεν κλείνει με εντολή κρατάει το νούμερό του αλλά χάνει το
      // χρώμα του συναγερμού: κόκκινο σημαίνει «πιάσε δουλειά», και εδώ δεν υπάρχει
      // δουλειά να πιάσεις — μόνο φωτογραφίες που πρέπει να τραβηχτούν.
      const human = a.sourced === 'human';
      const cls = human ? 'qd human' : `qd ${level}`;
      const why = human ? ' · κλείνει μόνο με δικές μας ή επισκεπτών φωτογραφίες' : '';
      return `<i class="${cls}" title="${esc(a.label)}: ${a.pct}% (${a.ok}/${a.total})${
        a.at ? ` · έλεγχος ${esc(a.at)}` : ''
      }${why}"><b>${a.pct}</b><u>${esc(a.short)}</u></i>`;
    })
    .join('');

/**
 * "Τι κοιτάξαμε" — the trail behind the date.
 *
 * A single "last checked 29/06" is not enough to decide anything: checked for
 * WHAT? Access and photos are different jobs with different rot rates. So every
 * audit that touched this region is listed with its kind, and national sweeps are
 * labelled as such so a machine pass is never mistaken for somebody reading the
 * island. Hand-written entries come first — they are the only ones that mean a
 * person was involved.
 */
const auditTrail = (row) => {
  const manual = (row.manual?.history || []).map((h) => ({
    at: h.at,
    what: h.axes?.length
      ? h.axes.map((k) => LEDGER.axes.find((a) => a.key === k)?.short || k).join(', ')
      : 'γενικός έλεγχος',
    note: h.note || '',
    by: 'εσύ',
  }));
  const automatic = (row.audits || []).map((a) => ({
    at: a.at,
    what: LEDGER.kindLabels[a.kind] || a.kind,
    note: a.findings ? `${num(a.findings)} ευρήματα` : '',
    by: a.scope === 'national' ? 'εθνικό πέρασμα' : 'στοχευμένο',
  }));

  const all = [...manual, ...automatic].slice(0, 9);
  if (!all.length) return '';

  return `
    <details class="qhist">
      <summary>Τι κοιτάξαμε (${all.length})</summary>
      <ul>
        ${all
          .map(
            (e) => `<li><span class="qh-at">${esc(e.at)}</span>
              <span class="qh-what">${esc(e.what)}</span>
              <span class="qh-by${e.by === 'εσύ' ? ' me' : ''}">${esc(e.by)}</span>
              ${e.note ? `<span class="qh-note">${esc(e.note)}</span>` : ''}</li>`
          )
          .join('')}
      </ul>
      ${
        row.lastSweepAt
          ? `<p class="qh-foot">Τελευταίο εθνικό αυτόματο πέρασμα: ${esc(row.lastSweepAt)} (${esc(
              agoLabel(row.lastSweepAt)
            )}).</p>`
          : ''
      }
    </details>`;
};

/**
 * ΤΙ ΔΙΟΡΘΩΘΗΚΕ — the other half of a maintenance board.
 *
 * Read out of the ledger's own history: each build records which axes moved and
 * by how much. A board that only ever lists what is wrong is a board that feels
 * like it never improves, whatever the work behind it.
 */
const progressTrail = (row) => {
  const moved = (row.history || []).filter((h) => h.moved && Object.keys(h.moved).length);
  if (!moved.length) return '';

  const line = (h) => {
    const parts = Object.entries(h.moved)
      .map(([key, [from, to]]) => {
        const axis = LEDGER.axes.find((a) => a.key === key);
        const up = to > from;
        return `<span class="${up ? 'up' : 'down'}">${esc(axis?.short || key)} ${from}%→${to}%</span>`;
      })
      .join(' ');
    return `<li><span class="qh-at">${esc(h.at)}</span>${parts}</li>`;
  };

  return `
    <details class="qhist qprog">
      <summary>Τι διορθώθηκε (${moved.length})</summary>
      <ul>${moved.slice(0, 6).map(line).join('')}</ul>
    </details>`;
};

/**
 * ΤΙ ΜΕΝΕΙ — the hand-written list, per region and optionally per beach.
 *
 * `compact` renders it inside a region card; the full form only appears on the
 * focused panel, because a text input on 110 rows is a page nobody can read.
 */
const todoList = (row, todos, { withForm = false } = {}) => {
  const all = todos?.[row.id] || [];
  const open = all.filter((t) => !t.done);
  const closed = all.filter((t) => t.done);

  const item = (t) => `
    <li class="${t.done ? 'done' : ''}">
      <span class="qt-txt">${t.beachName ? `<b>${esc(t.beachName)}</b> ` : ''}${esc(t.text)}</span>
      <span class="qt-when">${esc(t.done ? `έγινε ${t.doneAt}` : t.at)}</span>
      ${
        t.done
          ? ''
          : `<form method="post" action="?key=KEYPLACEHOLDER&amp;tab=quality">
              <input type="hidden" name="key" value="RAWFORMKEY">
              <input type="hidden" name="region" value="${esc(row.id)}">
              <input type="hidden" name="id" value="${esc(t.id)}">
              <button type="submit" name="action" value="todo-done" title="έγινε">✓</button>
              <button type="submit" name="action" value="todo-drop" class="drop" title="σβήσ' το">✕</button>
            </form>`
      }
    </li>`;

  if (!withForm && !open.length) return '';

  return `
    <div class="qtodo">
      ${
        open.length || closed.length
          ? `<ul>${open.map(item).join('')}${closed.slice(0, 3).map(item).join('')}</ul>`
          : '<p class="empty">Καμία σημείωση ακόμη για αυτή την περιοχή.</p>'
      }
      ${
        withForm
          ? `<form method="post" action="?key=KEYPLACEHOLDER&amp;tab=quality" class="qtadd">
              <input type="hidden" name="key" value="RAWFORMKEY">
              <input type="hidden" name="action" value="todo-add">
              <input type="hidden" name="region" value="${esc(row.id)}">
              <input type="text" name="text" maxlength="200" placeholder="τι μένει να γίνει εδώ">
              <input type="number" name="beachId" min="1" placeholder="# παραλίας (προαιρετικό)">
              <button type="submit">Πρόσθεσε</button>
            </form>`
          : ''
      }
    </div>`;
};

/** The form that writes "I looked at this one today" into Blobs. */
const checkForm = (row) => `
  <details class="qchk">
    <summary>Το τσέκαρα</summary>
    <form method="post" action="?key=KEYPLACEHOLDER&amp;tab=quality">
      <input type="hidden" name="key" value="RAWFORMKEY">
      <input type="hidden" name="action" value="quality-check">
      <input type="hidden" name="region" value="${esc(row.id)}">
      <div class="qaxes">
        ${LEDGER.axes
          .map(
            (a) => `<label><input type="checkbox" name="axis" value="${esc(a.key)}"> ${esc(a.short)}</label>`
          )
          .join('')}
      </div>
      <input type="text" name="note" maxlength="180" placeholder="τι κοίταξες / τι μένει (προαιρετικό)">
      <button type="submit">Καταχώρησέ το</button>
    </form>
  </details>`;

/**
 * "Αναζητήσεις" — what people typed into our own search box.
 *
 * The left table is what they looked for; the right one is the point of the whole
 * feature: terms we answered with an empty list. Those are gaps stated by a
 * visitor in their own words, which is the one thing Search Console structurally
 * cannot tell us — by the time someone types here, Google is out of the picture.
 */
const searchTermsTab = (data) => {
  const stats = data || { top: [], gaps: [], totalSearches: 0, totalMisses: 0, distinctTerms: 0 };
  if (!stats.totalSearches) {
    return `<section class="panel">
      <h2>Τι έψαξαν μέσα στο site<em>δεν έχει μαζευτεί τίποτα ακόμα</em></h2>
      <p class="qempty">Η καταγραφή ξεκινά με το πρώτο deploy μετά τις 16/08/2026. Κάθε αναζήτηση
      καθαρίζεται στη συσκευή πριν φύγει: κρατάμε μόνο γράμματα, το πολύ 48 χαρακτήρες, και
      πετάμε ολόκληρο τον όρο αν μοιάζει με email, σύνδεσμο ή τηλέφωνο.</p>
    </section>`;
  }

  const missRate = stats.totalSearches ? Math.round((100 * stats.totalMisses) / stats.totalSearches) : 0;
  const row = (r) => `
    <tr>
      <td class="qt-name">${esc(r.term)}</td>
      <td class="qt-num">${num(r.searches)}</td>
      <td class="qt-num${r.misses ? ' late' : ''}">${r.misses ? num(r.misses) : '—'}</td>
    </tr>`;

  const table = (title, note, rows) => `
    <section class="panel">
      <h2>${title}<em>${note}</em></h2>
      ${rows.length
        ? `<table class="qt">
             <thead><tr><th>όρος</th><th>φορές</th><th>χωρίς αποτέλεσμα</th></tr></thead>
             <tbody>${rows.map(row).join('')}</tbody>
           </table>`
        : '<p class="qempty">Τίποτα εδώ.</p>'}
    </section>`;

  return `
    <section class="panel">
      <h2>Σύνοψη αναζητήσεων<em>τελευταίες μέρες</em></h2>
      <div class="qgaps">
        <b>${num(stats.totalSearches)}</b> αναζητήσεις ·
        <b>${num(stats.distinctTerms)}</b> διαφορετικοί όροι ·
        <b>${num(stats.totalMisses)}</b> χωρίς κανένα αποτέλεσμα (${missRate}%)
      </div>
    </section>
    ${table(
      '❌ Έψαξαν και δεν βρήκαν',
      'εδώ είναι η δουλειά — το λέει ο ίδιος ο επισκέπτης, με τα λόγια του',
      stats.gaps
    )}
    ${table('🔍 Τι έψαξαν συνολικά', 'οι πιο συχνοί όροι', stats.top)}`;
};

const qualityTab = (rows, beachRows, todos, flashCode, focusId) => {
  const flash = FLASH[flashCode];
  const head = flash ? `<div class="flash ${flash[1]}">${esc(flash[0])}</div>` : '';

  const overdueRows = rows.filter((r) => r.overdue > 0);
  // `?region=` opens ONE region's form and history at the top. The 110-row table
  // used to carry a folded form and a folded history on every row, which is 110
  // copies of the same markup nobody has open — it put the console at 476 KB.
  // Same trade-off, and the same solution, as `?beach=` on the photos tab.
  const focus = focusId ? rows.find((r) => r.id === focusId) : null;
  const ledgerAge = daysSince(LEDGER.generatedAt);

  const totalPct = (key) => {
    const t = LEDGER.totals.byAxis[key] || { ok: 0, total: 0 };
    return t.total ? Math.round((t.ok / t.total) * 100) : 0;
  };

  const priorityCard = (row, rank) => `
    <li class="qrow${row.overdue > 0 ? ' late' : ''}">
      <div class="qhead">
        <span class="qrank">${rank}</span>
        <b class="qname">${esc(row.label)}</b>
        <span class="qmeta">${num(row.beaches)} παραλίες</span>
        <span class="spacer"></span>
        <span class="qviews">${row.views ? `${num(row.views)} προβολές` : 'καμία προβολή'}</span>
      </div>
      <div class="qwhy">
        Τελευταίος έλεγχος <b>${esc(agoLabel(row.lastAt))}</b>${
          row.lastAt ? ` (${esc(row.lastAt)})` : ''
        } · ${esc(row.tier.label)} → κάθε ${row.tier.days} μέρες ·
        ${
          row.overdue > 0
            ? `<span class="late">καθυστερεί ${row.overdue} μέρες</span>`
            : `<span class="fine">μέσα στον χρόνο του</span>`
        }
      </div>
      <div class="qdots">${axisDots(row)}</div>
      ${row.gaps.length ? `<div class="qgaps">${row.gaps.map((g) => esc(g.text)).join(' · ')}</div>` : ''}
      ${
        row.manual
          ? `<div class="qlast">✔ ${esc(row.manual.at)}${
              row.manual.note ? ` — ${esc(row.manual.note)}` : ''
            }</div>`
          : ''
      }
      ${todoList(row, todos)}
      <div class="qacts">${checkForm(row)}${auditTrail(row)}${progressTrail(row)}</div>
    </li>`;

  const tableRow = (row) => `
    <tr${focus && focus.id === row.id ? ' class="on"' : ''}>
      <td class="qt-name">${esc(row.label)}<span>${num(row.beaches)}</span></td>
      <td class="qt-num">${row.views ? num(row.views) : '—'}</td>
      <td class="qt-when${row.overdue > 0 ? ' late' : ''}">${esc(agoLabel(row.lastAt))}</td>
      <td class="qt-dots">${axisDots(row)}</td>
      <td class="qt-act"><a class="qmini" href="?key=KEYPLACEHOLDER&amp;tab=quality&amp;region=${encodeURIComponent(
        row.id
      )}">Άνοιξέ την</a></td>
    </tr>`;

  const focusPanel = focus
    ? `<section class="panel qfocus">
        <h2>${esc(focus.label)}<em>${num(focus.beaches)} παραλίες · ${
          focus.views ? `${num(focus.views)} προβολές στο παράθυρο` : 'καμία προβολή στο παράθυρο'
        } · τελευταίος έλεγχος ${esc(agoLabel(focus.lastAt))}</em>
        <a class="qclose" href="?key=KEYPLACEHOLDER&amp;tab=quality">κλείσε</a></h2>
        <div class="qdots">${axisDots(focus)}</div>
        ${focus.gaps.length ? `<div class="qgaps">${focus.gaps.map((g) => esc(g.text)).join(' · ')}</div>` : ''}
        <div class="qfeat" style="margin-top:9px">
          ${LEDGER.featureList
            .map((f) => {
              const n = focus.features?.[f.key] || 0;
              return `<span${n ? '' : ' class="none"'}><b>${num(n)}</b>${esc(f.label)}</span>`;
            })
            .join('')}
        </div>
        ${
          Object.values(focus.examples || {}).some((v) => v.length)
            ? `<ul class="qex">${LEDGER.axes
                .filter((a) => (focus.examples[a.key] || []).length)
                .map(
                  (a) =>
                    `<li><b>${esc(a.short)}</b> ${esc(focus.examples[a.key].join(', '))}${
                      focus.axes.find((x) => x.key === a.key).missing > 3 ? ' …' : ''
                    }</li>`
                )
                .join('')}</ul>`
            : ''
        }
        <h3 class="qsub">Τι μένει να γίνει εδώ</h3>
        ${todoList(focus, todos, { withForm: true })}
        <div class="qacts">${checkForm(focus)}${auditTrail(focus)}${progressTrail(focus)}</div>
      </section>`
    : '';

  return `${head}${focusPanel}
<section class="panel">
  <h2>Πόσο καλά ξέρουμε τις παραλίες μας<em>σε όλες τις ${num(LEDGER.regions.length)} περιοχές · ${num(
    LEDGER.totals.beaches
  )} παραλίες</em></h2>
  <div class="qtotals">
    ${LEDGER.axes
      .map((a) => {
        const pct = totalPct(a.key);
        const level = pct >= 95 ? 'ok' : pct >= 75 ? 'mid' : pct >= 40 ? 'low' : 'bad';
        return `<div class="qtot ${level}"><span class="k">${esc(a.short)}</span>
          <span class="v">${pct}%</span>
          <span class="s">${num(LEDGER.totals.byAxis[a.key].ok)} από ${num(
            LEDGER.totals.byAxis[a.key].total
          )}</span></div>`;
      })
      .join('')}
  </div>
  <div class="qfeat" style="margin-top:12px">
    ${LEDGER.featureList
      .map((f) => {
        const n = LEDGER.featureTotals[f.key] || 0;
        return `<span${n ? '' : ' class="none"'}><b>${num(n)}</b>${esc(f.label)}</span>`;
      })
      .join('')}
    ${
      LEDGER.needsVerification
        ? `<span style="border-color:rgba(251,191,36,.4);color:#fde68a"><b style="color:#fcd34d">${num(
            LEDGER.needsVerification
          )}</b>σημειωμένες «θέλουν επαλήθευση»</span>`
        : ''
    }
  </div>
  <p class="qnote">
    Η δεύτερη σειρά είναι <b>τι ξέρουμε</b>, όχι τι χρωστάμε: μια παραλία χωρίς ντους δεν είναι
    παραλία που δεν ελέγξαμε. Οι «θέλουν επαλήθευση» όμως είναι — τις σημείωσε προηγούμενο πέρασμα.
  </p>
  <p class="qnote">
    Το ταμπλό χτίστηκε <b>${esc(agoLabel(LEDGER.generatedAt))}</b> (${esc(LEDGER.generatedAt)})${
      ledgerAge !== null && ledgerAge > 21
        ? ' — <b class="late">είναι παλιό</b>, τρέξε ξανά <code>node scripts/buildQualityLedger.mjs</code>'
        : ''
    }.
    Οι ημερομηνίες μετράνε <b>στοχευμένους</b> ελέγχους σε μία περιοχή — τα εθνικά αυτόματα περάσματα
    δεν πιάνονται ως «την ξαναδιαβάσαμε», γιατί αγγίζουν και τις 110 μαζί.
  </p>
</section>

<section class="panel">
  <h2>Τι να ξαναδείς τώρα<em>${
    overdueRows.length ? `${num(overdueRows.length)} περιοχές έχουν καθυστερήσει` : 'καμία δεν έχει καθυστερήσει'
  } · σειρά: κίνηση × παλαιότητα × πόσα λείπουν</em></h2>
  ${
    rows.some((r) => r.views)
      ? ''
      : `<p class="qwarn">Δεν υπάρχει ακόμη μετρημένη κίνηση σε αυτό το παράθυρο, οπότε η σειρά
         βγαίνει μόνο από παλαιότητα και κενά — όχι από το τι βλέπει ο κόσμος.</p>`
  }
  ${
    rows.length
      ? `<ol class="qlist">${rows.slice(0, 10).map((r, i) => priorityCard(r, i + 1)).join('')}</ol>`
      : '<p class="empty">Δεν υπάρχουν δεδομένα ποιότητας ακόμη.</p>'
  }
</section>

${
  beachRows.length
    ? `<section class="panel">
  <h2>Παραλίες που τις βλέπουν και τους λείπει κάτι<em>${num(
    beachRows.length
  )} συγκεκριμένες σελίδες · σειρά: προβολές × πόσα λείπουν</em></h2>
  <ul class="qbl">
    ${beachRows
      .slice(0, 25)
      .map(
        (b) => `<li>
          <span class="qb-v">${num(b.views)}</span>
          <span class="qb-n">${esc(b.name)}<em>${esc(b.region)}</em></span>
          <span class="qb-m">${b.missing
            .map((a) => `<i>${esc(a.short)}</i>`)
            .join('')}<a class="qmini" href="?key=KEYPLACEHOLDER&amp;tab=quality&amp;region=${encodeURIComponent(
              b.regionId
            )}#qtadd" title="σημείωσε τι μένει (#${b.id})">σημείωσε</a></span>
        </li>`
      )
      .join('')}
  </ul>
  <p class="qnote">Οι προβολές είναι του ίδιου παραθύρου με τα στατιστικά.
  «Λείπει» = το ίδιο κριτήριο με τα ποσοστά πιο πάνω. Παραλίες που δεν άνοιξε κανείς
  δεν μπαίνουν εδώ — αυτές τις πιάνει η λίστα περιοχών.</p>
</section>`
    : ''
}

<section class="panel">
  <h2>Όλες οι περιοχές<em>ταξινομημένες με την ίδια σειρά προτεραιότητας</em></h2>
  <div class="qtwrap">
    <table class="qtable">
      <thead><tr>
        <th>Περιοχή</th><th class="qt-num">Προβολές</th><th>Τελ. έλεγχος</th>
        <th>Πινέζα · Πλοήγ. · Πρόσβ. · Παροχές · Φωτό · Κείμ.</th><th></th>
      </tr></thead>
      <tbody>${rows.map(tableRow).join('')}</tbody>
    </table>
  </div>
</section>`;
};

const moderationTab = (queue, flashCode, curating, publishedBeaches) => {
  const flash = FLASH[flashCode];
  const head = flash ? `<div class="flash ${flash[1]}">${esc(flash[0])}</div>` : '';

  if (!queue.configured) {
    return `${head}<section class="panel"><h2>Εγκρίσεις</h2>
      <p class="empty">Η Supabase δεν είναι ρυθμισμένη (λείπουν <code>SUPABASE_URL</code> /
      <code>SUPABASE_SERVICE_ROLE_KEY</code>), οπότε δεν υπάρχει ουρά να διαβαστεί.</p></section>`;
  }

  const waiting = queue.pendingPublish?.count || 0;
  const notLive = waiting
    ? `<div class="flash warn"><b>${num(waiting)}</b> εγκεκριμένα είναι ήδη <b>ορατά στο site</b>.
       Λείπουν μόνο από τις σελίδες που διαβάζει η Google — μπαίνουν <b>δωρεάν</b> στο επόμενο
       ανέβασμα κώδικα, δεν χρειάζεται να κάνεις τίποτα.
       <form method="post" action="?key=KEYPLACEHOLDER&amp;tab=photos" style="margin-top:9px;display:flex;gap:8px;max-width:400px">
         <input type="hidden" name="key" value="RAWFORMKEY">
         <button class="yes" name="action" value="publish"
           style="flex:1;appearance:none;border:1px solid rgba(16,185,129,.45);border-radius:999px;padding:9px 10px;
                  font:650 13px system-ui,sans-serif;cursor:pointer;background:rgba(16,185,129,.18);color:#6ee7b7">
           🚀 Βάλ' τα και στη Google (ξοδεύει ένα χτίσιμο)</button>
         <button name="action" value="refresh-live"
           style="flex:1;appearance:none;border:1px solid rgba(148,163,184,.4);border-radius:999px;padding:9px 10px;
                  font:650 13px system-ui,sans-serif;cursor:pointer;background:rgba(148,163,184,.14);color:#cbd5e1">
           🔄 Ανανέωσε τη ζωντανή λίστα (δωρεάν)</button>
       </form></div>`
    : '';

  return `${head}${notLive}
${curatingPanel(curating)}
<section class="panel">
  <h2>Φωτογραφίες επισκεπτών<em>${queue.photos.length ? `${num(queue.photos.length)} περιμένουν · τίποτα εδώ δεν είναι ορατό στο κοινό` : 'τίποτα σε αναμονή'}</em></h2>
  ${queue.photos.length
    ? `<div class="ugc">${queue.photos.map((item, i) => ugcPhotoCard(item, queue.signed[i])).join('')}</div>`
    : '<p class="empty">Καμία φωτογραφία σε αναμονή.</p>'}
</section>

<section class="panel">
  <h2>Κριτικές<em>${queue.reviews.length ? `${num(queue.reviews.length)} περιμένουν` : 'τίποτα σε αναμονή'}</em></h2>
  ${queue.reviews.length
    ? `<div class="ugc">${queue.reviews.map(ugcReviewCard).join('')}</div>`
    : '<p class="empty">Καμία κριτική σε αναμονή.</p>'}
</section>

${publishedBeachesPanel(publishedBeaches, curating)}

${queue.problem ? `<div class="flash warn">Πρόβλημα ανάγνωσης της ουράς: ${esc(queue.problem)}</div>` : ''}`;
};

// ── the weather bill ─────────────────────────────────────────────────────────

/**
 * "Will we blow the Open-Meteo plan?" — the one question the meter existed to
 * answer and could not, because it only ever held today.
 *
 * The verdict is driven by the PROJECTION (pace × cycle length), not by the raw
 * percentage: 60% of the quota on day 6 is fine, the same 60% on day 25 is fine
 * too, and 40% on day 3 is not. A percentage bar alone would say the opposite of
 * the truth in half those cases, so the bar carries a "where we should be by now"
 * marker and the sentence under it does the actual talking.
 */
/** The day the paid Open-Meteo plan started. Fixed history, not a setting. */
const SUBSCRIPTION_START = '2026-08-09';

/**
 * The provider's own figure, next to ours, and what the two together imply.
 *
 * The point of this block is the RATIO, not either number alone. Their page is authoritative
 * but manual and hours stale; our meter is live but derived. Pair them once and our meter can
 * be corrected into an estimate that tracks the truth between readings — which is as close to
 * "pull it from the source" as the provider's API allows (see PROVIDER_SEED).
 */
const providerBlock = (usage, readings, keyless) => {
  const list = Array.isArray(readings) ? readings : [];
  const latest = list[0] || null;
  // The newest reading that captured BOTH ends. Older pairs still calibrate fine; a reading
  // taken before our meter was trustworthy carries `ours: null` and is skipped on purpose.
  const paired = list.find((r) => Number(r?.ours) > 0 && Number(r?.total) > 0) || null;
  const factor = paired ? Number(paired.total) / Number(paired.ours) : null;
  const corrected = factor && usage && usage.daysMeasured > 0 ? Math.round(usage.used * factor) : null;

  const dayRatio = latest && Number(latest.dayCalls) > 0 && Number(latest.dayRequests) > 0
    ? Number(latest.dayCalls) / Number(latest.dayRequests)
    : null;

  const history = list.slice(0, 6).map((r) => {
    const ratio = Number(r?.ours) > 0 ? `×${(Number(r.total) / Number(r.ours)).toFixed(2)}` : '—';
    return `<li><b>${dayLabel(r.at)}</b> πάροχος <b>${num(r.total)}</b> · εμείς ${
      Number(r?.ours) > 0 ? num(r.ours) : '—'
    } · ${ratio}${r.note ? ` <span class="capnote-i">${esc(r.note)}</span>` : ''}</li>`;
  }).join('');

  return `<div class="capsrc">
  <h3>Τι λέει ο ίδιος ο πάροχος<em>συνδρομή από ${dayLabel(SUBSCRIPTION_START)} · γραμμένο στο χέρι από το dashboard.open-meteo.com</em></h3>
  <div class="capstats capsrcrow">
    <div><span class="cl">Πάροχος (πηγή)</span><span class="cv">${latest ? num(latest.total) : '—'}</span>
      <span class="cf">${latest ? `ανάγνωση ${dayLabel(latest.at)}` : 'καμία ανάγνωση ακόμη'}</span></div>
    <div><span class="cl">Εμείς την ίδια στιγμή</span><span class="cv">${
      latest && Number(latest.ours) > 0 ? num(latest.ours) : '—'}</span>
      <span class="cf">${latest && Number(latest.ours) > 0 ? 'από τον μετρητή μας' : 'δεν είχε αξιόπιστη μέτρηση'}</span></div>
    <div><span class="cl">Συντελεστής</span><span class="cv">${factor ? `×${factor.toFixed(2)}` : '—'}</span>
      <span class="cf">${factor ? 'πόσο υπο-μετράμε' : 'θέλει μία ανάγνωση με τα δύο νούμερα'}</span></div>
    <div><span class="cl">Διορθωμένη εκτίμηση</span><span class="cv">${corrected ? num(corrected) : '—'}</span>
      <span class="cf">${corrected ? 'ο μετρητής μας × συντελεστή' : 'μόλις υπάρξει συντελεστής'}</span></div>
  </div>
  ${dayRatio ? `<p class="capnote">Στις ${dayLabel(latest.day)} ο πάροχος χρέωσε <b>${num(latest.dayCalls)}</b> κλήσεις για <b>${num(latest.dayRequests)}</b> αιτήματα — <b>${dayRatio.toFixed(1)} κλήσεις ανά αίτημα</b>. Αυτό επιβεβαιώνει ότι χρεώνει <b>ανά συντεταγμένη</b>, όχι ανά αίτημα: μία ερώτηση για 32 παραλίες κοστίζει 32.</p>` : ''}
  ${history ? `<ul class="capsrclist">${history}</ul>` : ''}
  ${keyless ? '' : `<form method="post" action="?key=KEYPLACEHOLDER" class="capform">
    <input type="hidden" name="key" value="KEYPLACEHOLDER">
    <input type="hidden" name="action" value="provider-reading">
    <label>Σύνολο κύκλου<input type="text" name="total" inputmode="numeric" placeholder="475.991" required></label>
    <label>Μέρα <span>(προαιρετικά)</span><input type="date" name="day"></label>
    <label>Κλήσεις τη μέρα<input type="text" name="dayCalls" inputmode="numeric" placeholder="29.183"></label>
    <label>Αιτήματα τη μέρα<input type="text" name="dayRequests" inputmode="numeric" placeholder="1.867"></label>
    <label class="wide">Σημείωση <span>(προαιρετικά)</span><input type="text" name="note" maxlength="160" placeholder="π.χ. μετά τη διόρθωση της κοινής μνήμης"></label>
    <button type="submit">Καταχώρησε</button>
  </form>
  <p class="capnote">Το κλειδί του Open-Meteo <b>δεν</b> μπορεί να διαβάσει κατανάλωση — ανοίγει μόνο τα δεδομένα καιρού, και ο πίνακάς τους δεν έχει διεύθυνση για προγραμματιστές. Γράψε εδώ το νούμερο μία φορά την εβδομάδα· ο δικός μας μετρητής κάνει τα υπόλοιπα μόνος του.</p>`}
</div>`;
};

export const capacityPanel = (usage, state, readings) => {
  if (!usage) return '';

  const measured = usage.daysMeasured > 0;
  const partial = measured && usage.measuringSince && usage.measuringSince > usage.cycleStart;

  // Where a perfectly even month would stand today — the honest yardstick for the bar.
  const paceMark = usage.cycleDays ? Math.min(100, Math.round((usage.dayIndex / usage.cycleDays) * 100)) : 0;
  const fill = Math.min(100, usage.percent);

  let tone = 'ok';
  let badge = '🟢 Άνετα';
  let verdict;
  if (usage.remaining === 0) {
    tone = 'bad';
    badge = '🔴 Εξαντλήθηκε';
    verdict = 'Το μηνιαίο πακέτο τελείωσε. Οι επισκέπτες βλέπουν πρόγνωση διάσωσης (ως 12 ώρες παλιά) μέχρι να ανανεωθεί ο κύκλος.';
  } else if (!measured || usage.projected === null) {
    tone = 'unknown';
    badge = '⚪ Χωρίς ρυθμό ακόμη';
    verdict = 'Χρειάζεται μία ολόκληρη μέρα μέτρησης πριν μπορέσουμε να πούμε πού πάει ο μήνας. Μέχρι τότε βλέπεις μόνο το τρέχον σύνολο.';
  } else if (usage.willExceed) {
    tone = 'bad';
    badge = '🔴 Θα σκάσει';
    verdict = `Με τον ρυθμό των τελευταίων ημερών ο κύκλος κλείνει στις <b>~${num(usage.projected)}</b> — <b>${num(usage.projected - usage.quota)} πάνω από το όριο</b>. Θα τελειώσουν οι κλήσεις πριν τις ${dayLabel(usage.cycleEnd)}.`;
  } else if (usage.projected > usage.quota * 0.8) {
    tone = 'warn';
    badge = '🟡 Οριακά';
    verdict = `Με τον ρυθμό των τελευταίων ημερών ο κύκλος κλείνει στις <b>~${num(usage.projected)}</b> από 1.000.000 — χωράει, αλλά χωρίς περιθώριο για μια δυνατή εβδομάδα.`;
  } else {
    verdict = `Με τον ρυθμό των τελευταίων ημερών ο κύκλος κλείνει στις <b>~${num(usage.projected)}</b> από 1.000.000. Περιθώριο <b>×${(usage.quota / Math.max(1, usage.projected)).toFixed(1)}</b> — η κίνηση μπορεί να πολλαπλασιαστεί τόσο πριν μας απασχολήσει.`;
  }

  const todayTone = usage.today >= DEFAULT_THRESHOLDS.red ? ' hi' : usage.today >= DEFAULT_THRESHOLDS.amber ? ' mid' : '';

  // The per-day ledger, newest last, so a spike is visible as a shape.
  const maxDay = Math.max(1, ...usage.perDay.map(([, v]) => v));
  const ledger = usage.perDay
    .map(([d, v]) => {
      const h = Math.max(3, Math.round((v / maxDay) * 100));
      const over = v >= DEFAULT_THRESHOLDS.red ? ' over' : v >= DEFAULT_THRESHOLDS.amber ? ' near' : '';
      return `<span class="cd${over}" title="${dayLabel(d)}: ${num(v)} κλήσεις"><i style="height:${h}%"></i><b>${dayLabel(d)}</b></span>`;
    })
    .join('');

  const refused = state?.rateLimited || 0;

  return `<section class="panel cap ${tone}">
  <h2>Κλήσεις καιρού<em>Open-Meteo · πακέτο 1 εκατ./μήνα · κύκλος ${dayLabel(usage.cycleStart)} → ${dayLabel(usage.cycleEnd)}</em>
    <span class="capbadge">${badge}</span></h2>
  <div class="capgrid">
    <div class="capmain">
      <div class="capbig">${num(usage.used)}<span>/ ${num(usage.quota)}</span></div>
      <div class="capbar"><i style="width:${fill}%"></i><u style="left:${paceMark}%" title="εδώ θα ήμασταν με ομοιόμορφη κατανάλωση"></u></div>
      <div class="capsub">${usage.percent}% του μήνα · μέρα ${usage.dayIndex} από ${usage.cycleDays}${partial ? ` · μετράμε από ${dayLabel(usage.measuringSince)}` : ''}</div>
    </div>
    <div class="capstats">
      <div><span class="cl">Απομένουν</span><span class="cv">${num(usage.remaining)}</span></div>
      <div><span class="cl">Σήμερα</span><span class="cv${todayTone}">${num(usage.today)}</span></div>
      <div><span class="cl">Μέσος όρος/μέρα</span><span class="cv">${usage.avgPerDay === null ? '—' : num(usage.avgPerDay)}</span></div>
      <div><span class="cl">Πρόβλεψη μήνα</span><span class="cv">${usage.projected === null ? '—' : num(usage.projected)}</span></div>
    </div>
  </div>
  <p class="capverdict">${verdict}</p>
  ${ledger ? `<div class="capdays">${ledger}</div>` : ''}
  ${providerBlock(usage, readings)}
  ${refused ? `<p class="capwarn">⚠ Σήμερα το Open-Meteo αρνήθηκε <b>${num(refused)}</b> κλήσεις (429). Αν το ποσοστό του μήνα είναι χαμηλό, χτυπήσαμε όριο ρυθμού — όχι εξάντληση.</p>` : ''}
  ${!measured ? '' : `<p class="capnote">Μετράμε στο σημείο που φεύγει η κλήση προς το Open-Meteo — ό,τι σερβίρεται από την cache δεν χρεώνεται και δεν μετριέται. Ο αριθμός είναι <b>κατώτατο όριο</b>: σε ταυτόχρονες κλήσεις χάνεται καμιά μέτρηση${partial ? ', και οι μέρες του κύκλου πριν τις ' + dayLabel(usage.measuringSince) + ' λείπουν εντελώς' : ''}. Ποτέ δεν φουσκώνει.</p>
  <p class="capnote">⚠ <b>Οι μέρες πριν τις 14/08 δείχνουν περίπου τα μισά απ' όσα ήταν.</b> Ταυτόχρονες κλήσεις έσβηναν η μία τη μέτρηση της άλλης, και όσο πιο μεγάλη η μέρα τόσο περισσότερα χανόταν — στις 09-13/08 ο πίνακας του Open-Meteo έδειχνε ~94.000/ημέρα εκεί που εδώ γράφαμε ~37.700. Από 14/08 η μέτρηση κρατάει. <b>Άρα μια αύξηση στο διάγραμμα μπορεί να είναι απλώς τίμιο πια μέτρημα</b> — σύγκρινε με τον πίνακα του παρόχου (<a href="https://dashboard.open-meteo.com" target="_blank" rel="noopener">dashboard.open-meteo.com</a>) πριν βγάλεις συμπέρασμα.</p>`}
</section>`;
};

// ── the page ─────────────────────────────────────────────────────────────────

const page = (data) => {
  const { rows, totals, days, startDay, live, pulse, todayPoints, earlierPoints, nowMin } = data;
  const queue = data.queue || { configured: false, photos: [], reviews: [], signed: [], pendingPublish: null, problem: '' };
  const queueCount = queue.photos.length + queue.reviews.length;
  // Built once and used twice — the tab badge needs the count before the panel
  // below needs the rows, and computing them apart is how the two drift.
  const qualityRows = buildQualityRows(data.totals?.views, data.qualityChecks);
  const lateRegions = qualityRows.filter((r) => r.overdue > 0).length;
  const beachGapRows = buildBeachGapRows(data.totals?.pages);

  const today = rows[0] || { unique: 0, hits: 0, newV: 0, retV: 0, unkV: 0 };
  const sumUnique = rows.reduce((s, r) => s + r.unique, 0);
  const sumHits = rows.reduce((s, r) => s + r.hits, 0);
  const sumNew = rows.reduce((s, r) => s + r.newV, 0);
  const sumRet = rows.reduce((s, r) => s + r.retV, 0);
  const sumDwell = rows.reduce((s, r) => s + r.dwellSec, 0);
  const sumEngaged = rows.reduce((s, r) => s + r.engaged, 0);
  const sumMulti = rows.reduce((s, r) => s + r.multiPage, 0);

  /**
   * The honest "how many people" band. The floor is the tagged count (devices whose
   * first ping of the day we caught); the ceiling is the unique-hash count, which
   * double-counts a phone that changed IP mid-day. We show both ends, and the
   * midpoint as the working number — never a fake-precise single figure.
   */
  const band = (r) => {
    const tagged = r.newV + r.retV + r.unkV;
    if (!tagged) return { lo: r.unique, hi: r.unique, mid: r.unique };
    const lo = Math.min(tagged, r.unique);
    const hi = Math.max(tagged, r.unique);
    return { lo, hi, mid: Math.round((lo + hi) / 2) };
  };
  const todayBand = band(today);

  // Returning share, computed from the tagged population ONLY. (The previous version
  // divided a tagged number by the exact unique total — two different denominators —
  // which drifted by tens of points on quiet days.)
  const taggedAll = sumNew + sumRet;
  const retPct = taggedAll ? Math.round((sumRet / taggedAll) * 100) : 0;

  const avgDwell = sumEngaged ? sumDwell / sumEngaged : 0;
  const bouncePct = sumUnique ? Math.max(0, Math.min(100, Math.round((1 - Math.min(sumMulti, sumUnique) / sumUnique) * 100))) : 0;
  const perVisit = sumUnique ? sumHits / sumUnique : 0;
  const navActions = totals.actions ? totals.actions.nav || 0 : 0;
  // The journey counters are per PERSON; the action counter is per click. Prefer the
  // per-person one wherever a percentage of visitors is what the label promises.
  const funnel = totals.funnel || {};
  const navPeople = funnel.n || 0;
  const beachPct = sumUnique ? Math.min(100, Math.round(((funnel.b || 0) / sumUnique) * 100)) : 0;

  const uniqSeries = rows.slice(0, 14).map((r) => r.unique);
  const hitsSeries = rows.slice(0, 14).map((r) => r.hits);
  const newSeries = rows.slice(0, 14).map((r) => r.newV);

  const kpi = (k, v, sub, spark, cls = '') =>
    `<div class="kpi ${cls}"><div class="k">${k}</div><div class="v">${v}</div>
      <div class="s">${sub || ''}</div>${spark || ''}</div>`;

  const dayRows = rows
    .map((r) => {
      const b = band(r);
      const bounce = r.unique ? Math.max(0, Math.min(100, Math.round((1 - Math.min(r.multiPage, r.unique) / r.unique) * 100))) : 0;
      const avg = r.engaged ? r.dwellSec / r.engaged : 0;
      return `<tr>
        <td class="d"><b>${dayLabel(r.day)}</b> <span class="wd">${weekdayLabel(r.day)}</span></td>
        <td class="n">${num(r.unique)}</td>
        <td class="n g">${num(r.newV)}</td>
        <td class="n dim">${num(r.retV)}</td>
        <td class="n">${num(r.hits)}</td>
        <td class="n dim">${r.unique ? (r.hits / r.unique).toFixed(1) : '—'}</td>
        <td class="n dim">${r.engaged ? dur(avg) : '—'}</td>
        <td class="n dim">${r.unique ? `${bounce}%` : '—'}</td>
        <td class="bar"><span style="width:${Math.round((r.unique / Math.max(1, ...rows.map((x) => x.unique))) * 100)}%"></span></td>
      </tr>`;
    })
    .join('');

  // The map layers travel to the client as data so the live overlay can be redrawn
  // every few seconds without a page reload — and so a visitor who comes back is
  // never drawn twice (green wins over red by construction).
  // Greek names only for the countries that actually appear, so the payload does
  // not carry a whole atlas the page will never use.
  const seenCodes = new Set([...live, ...todayPoints, ...earlierPoints].map((p) => p.cc));
  const names = {};
  for (const cc of seenCodes) names[cc] = COUNTRY_NAMES_EL[cc] || (cc && cc !== '??' ? cc : 'Άγνωστη');

  const payload = JSON.stringify({
    live,
    pulse,
    names,
    nowMin,
    today: todayPoints,
    earlier: earlierPoints,
    mapDays: data.mapDays,
    latTop: WORLD_LAT_TOP,
    w: WORLD_W,
    h: WORLD_H,
  }).replace(/</g, '\\u003c');

  const windowChip = (d, label) =>
    `<a class="chip${String(days) === String(d) ? ' on' : ''}" href="?key=KEYPLACEHOLDER&days=${d}">${label}</a>`;

  return `<!doctype html><html lang="el"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>CalmBeach · Live κίνηση</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Κίνηση">
<meta name="mobile-web-app-capable" content="yes">
<meta name="application-name" content="Κίνηση">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#060b16">
<link rel="apple-touch-icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Crect width='180' height='180' rx='40' fill='%23060b16'/%3E%3Ccircle cx='90' cy='90' r='34' fill='none' stroke='%2322d3ee' stroke-width='7'/%3E%3Ccircle cx='90' cy='90' r='11' fill='%2334d399'/%3E%3C/svg%3E">
<style>
  :root{
    color-scheme:dark;
    --bg:#060b16; --panel:rgba(255,255,255,.035); --line:rgba(148,163,184,.16);
    --txt:#e6edf7; --mut:#8ba0bd;
    --cy:#22d3ee; --gr:#34d399; --rs:#fb7185; --am:#fbbf24; --vi:#c4b5fd; --pk:#f0abfc;
    --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box}
  html,body{margin:0}
  body{
    background:
      radial-gradient(1200px 600px at 15% -10%, rgba(34,211,238,.10), transparent 60%),
      radial-gradient(900px 500px at 90% 0%, rgba(192,132,252,.09), transparent 55%),
      var(--bg);
    background-attachment:fixed;
    color:var(--txt);
    font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    -webkit-font-smoothing:antialiased;
    padding-bottom:64px;
  }
  .wrap{max-width:1180px;margin:0 auto;padding:22px 16px 0}
  a{color:inherit}

  header.top{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:6px}
  h1{font-size:19px;letter-spacing:-.01em;margin:0;font-weight:650}
  h1 small{display:block;font-weight:400;font-size:12px;color:var(--mut);letter-spacing:0;margin-top:2px}
  .spacer{flex:1}
  .livebadge{display:inline-flex;align-items:center;gap:8px;background:rgba(52,211,153,.10);
    border:1px solid rgba(52,211,153,.32);border-radius:999px;padding:6px 13px;font-weight:650;font-size:13px;color:#6ee7b7}
  .livebadge .dot{width:8px;height:8px;border-radius:50%;background:var(--gr);box-shadow:0 0 0 0 rgba(52,211,153,.7);animation:beat 2s infinite}
  @keyframes beat{0%{box-shadow:0 0 0 0 rgba(52,211,153,.6)}70%{box-shadow:0 0 0 9px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}

  .toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:14px 0 18px}
  .chip{display:inline-block;padding:6px 12px;border-radius:999px;border:1px solid var(--line);
    background:var(--panel);color:var(--mut);font-size:12.5px;font-weight:600;text-decoration:none;cursor:pointer}
  .chip:hover{color:var(--txt);border-color:rgba(34,211,238,.4)}
  .chip.on{background:rgba(34,211,238,.14);border-color:rgba(34,211,238,.5);color:#a5f3fc}
  #optout.on{background:rgba(251,113,133,.14);border-color:rgba(251,113,133,.5);color:#fda4af}

  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
  @media(max-width:900px){.kpis{grid-template-columns:repeat(3,1fr)}}
  @media(max-width:560px){.kpis{grid-template-columns:repeat(2,1fr)}}
  .kpi{position:relative;overflow:hidden;background:var(--panel);border:1px solid var(--line);
    border-radius:14px;padding:12px 13px 10px;backdrop-filter:blur(6px)}
  .kpi .k{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);font-weight:650}
  .kpi .v{font:650 27px/1.15 var(--mono);letter-spacing:-.02em;margin-top:5px;font-variant-numeric:tabular-nums}
  .kpi .s{font-size:11.5px;color:var(--mut);margin-top:3px;min-height:16px}
  .kpi .spark{position:absolute;right:0;bottom:0;width:64px;height:20px;opacity:.55}
  .kpi.hot{border-color:rgba(52,211,153,.36);background:linear-gradient(180deg,rgba(52,211,153,.12),rgba(52,211,153,.02))}
  .kpi.hot .v{color:#6ee7b7}
  .kpi.act{border-color:rgba(251,191,36,.28)}
  .kpi.act .v{color:var(--am)}

  /* Two views, because they answer different questions: the map view is "who is
     out there right now", the stats view is "how is the site doing". */
  .tabs{display:flex;gap:6px;margin:0 0 14px;border-bottom:1px solid var(--line);padding-bottom:0}
  .tab{appearance:none;border:0;background:none;color:var(--mut);cursor:pointer;
    font:650 13.5px system-ui,sans-serif;padding:9px 15px 11px;border-bottom:2px solid transparent;
    margin-bottom:-1px;border-radius:8px 8px 0 0;transition:color .15s,border-color .15s}
  .tab:hover{color:var(--txt)}
  .tab.on{color:#a5f3fc;border-bottom-color:var(--cy);background:rgba(34,211,238,.07)}
  .tab:focus-visible{outline:2px solid var(--cy);outline-offset:2px}
  /* The count rides on the tab itself: the whole point of moving moderation in
     here is that an unopened queue is visible without opening it. */
  .tab .badge{display:inline-block;min-width:18px;padding:1px 6px;margin-left:6px;border-radius:999px;
    background:var(--am);color:#1a1005;font:700 11px/1.5 var(--mono);vertical-align:1px}

  /* ── moderation cards ─────────────────────────────────────────────────────── */
  .ugc{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
  .ugc .item{background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden}
  .ugc .item img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:rgba(148,163,184,.12)}
  .ugc .noimg{display:flex;align-items:center;justify-content:center;aspect-ratio:4/3;
    background:rgba(148,163,184,.10);color:var(--mut);font-size:12.5px}
  .ugc .body{padding:11px 13px 13px}
  .ugc .who{font-size:13.5px;font-weight:650;margin-bottom:3px}
  .ugc .facts{font-size:11.5px;color:var(--mut);font-family:var(--mono);margin-bottom:9px}
  .ugc .cap{font-size:13px;line-height:1.5;margin:0 0 10px;white-space:pre-wrap;
    border-left:2px solid var(--line);padding-left:9px;color:#cbd5e1}
  .ugc .stars{letter-spacing:2px;color:var(--am)}
  .ugc form{display:flex;gap:8px}
  .ugc button{flex:1;appearance:none;border:1px solid transparent;border-radius:999px;padding:9px 10px;
    font:650 13px system-ui,sans-serif;cursor:pointer;color:#fff}
  .ugc .yes{background:rgba(16,185,129,.18);border-color:rgba(16,185,129,.45);color:#6ee7b7}
  .ugc .yes:hover{background:rgba(16,185,129,.3)}
  .ugc .no{background:rgba(244,63,94,.14);border-color:rgba(244,63,94,.4);color:#fda4af}
  .ugc .no:hover{background:rgba(244,63,94,.26)}
  .ugc button:focus-visible{outline:2px solid var(--cy);outline-offset:2px}
  .flash{border:1px solid rgba(52,211,153,.4);background:rgba(52,211,153,.10);color:#a7f3d0;
    border-radius:12px;padding:11px 14px;margin-bottom:14px;font-size:13.5px}
  .flash.warn{border-color:rgba(251,191,36,.42);background:rgba(251,191,36,.10);color:#fde68a}
  .empty{color:var(--mut);font-size:13.5px;padding:6px 0}

  /* ── quality board ────────────────────────────────────────────────────────── */
  /* Four colours and nothing else, on both the totals and the per-region dots, so
     "green means fine" is learned once and holds everywhere on the tab. */
  /* auto-fit, not repeat(6): the axis list grew from six to seven once the
     character fields were added, and a hard column count silently squashes. */
  .qtotals{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:9px}
  @media(max-width:480px){.qtotals{grid-template-columns:repeat(2,1fr)}}
  .qtot{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:12px;padding:9px 10px}
  .qtot .k{display:block;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--mut);font-weight:650}
  .qtot .v{display:block;font:650 22px/1.2 var(--mono);margin-top:3px;font-variant-numeric:tabular-nums}
  .qtot .s{display:block;font-size:10.5px;color:var(--mut);margin-top:1px}
  .qtot.ok .v{color:#6ee7b7} .qtot.mid .v{color:#fcd34d}
  .qtot.low .v{color:#fdba74} .qtot.bad .v{color:#fda4af}
  .qtot.ok{border-color:rgba(52,211,153,.3)} .qtot.bad{border-color:rgba(251,113,133,.34)}
  .qfeat{display:flex;flex-wrap:wrap;gap:7px}
  .qfeat span{font-size:12px;color:var(--mut);border:1px solid var(--line);border-radius:999px;
    padding:4px 11px;background:rgba(255,255,255,.03)}
  .qfeat span b{color:#a5f3fc;font:650 12.5px var(--mono);margin-right:6px;font-variant-numeric:tabular-nums}
  .qfeat span.none{opacity:.5}
  .qnote{margin:12px 0 0;font-size:12px;line-height:1.55;color:var(--mut)}
  .qnote code{font:12px var(--mono);background:rgba(148,163,184,.12);padding:1px 5px;border-radius:5px}
  .late{color:#fda4af} .fine{color:#6ee7b7}

  .qlist{list-style:none;margin:0;padding:0;display:grid;gap:10px}
  .qrow{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:14px;padding:11px 13px 10px}
  .qrow.late{border-color:rgba(251,113,133,.32);background:linear-gradient(180deg,rgba(251,113,133,.06),transparent 70%)}
  .qhead{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
  .qrank{font:700 11px var(--mono);color:var(--mut);min-width:16px}
  .qname{font-size:15px;font-weight:650}
  .qmeta{font-size:11.5px;color:var(--mut)}
  .qviews{font:650 12.5px var(--mono);color:#a5f3fc;font-variant-numeric:tabular-nums}
  .qwhy{font-size:12.5px;color:var(--mut);margin-top:5px}
  .qwhy b{color:var(--txt)}
  .qgaps{font-size:12px;color:#fcd34d;margin-top:6px}
  .qwarn{margin:0 0 12px;font-size:12.5px;line-height:1.5;color:#fde68a;
    border:1px solid rgba(251,191,36,.28);background:rgba(251,191,36,.07);border-radius:11px;padding:9px 12px}
  .qlast{font-size:12px;color:#6ee7b7;margin-top:5px}

  /* The dot row IS the summary: percentage inside, axis name under it. Reading
     left to right always gives the same six answers in the same order. */
  .qdots{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
  .qd{display:inline-flex;flex-direction:column;align-items:center;gap:1px;font-style:normal;
    min-width:46px;padding:4px 6px 3px;border-radius:9px;border:1px solid var(--line);background:rgba(255,255,255,.03)}
  .qd b{font:650 12px var(--mono);font-variant-numeric:tabular-nums}
  .qd u{text-decoration:none;font-size:9px;letter-spacing:.02em;color:var(--mut)}
  .qd.ok{border-color:rgba(52,211,153,.34)} .qd.ok b{color:#6ee7b7}
  .qd.mid{border-color:rgba(251,191,36,.30)} .qd.mid b{color:#fcd34d}
  .qd.low{border-color:rgba(251,146,60,.32)} .qd.low b{color:#fdba74}
  .qd.bad{border-color:rgba(251,113,133,.38)} .qd.bad b{color:#fda4af}
  .qd.human{border-color:rgba(148,163,184,.28);border-style:dashed} .qd.human b{color:var(--mut)}

  /* "Το τσέκαρα" stays folded: it is one press per WEEK, and an open form on 110
     rows would bury the numbers the tab exists to show. */
  .qchk{margin-top:8px}
  .qchk summary{display:inline-block;cursor:pointer;font:650 11.5px system-ui,sans-serif;color:var(--mut);
    border:1px solid var(--line);border-radius:999px;padding:4px 11px;list-style:none}
  .qchk summary::-webkit-details-marker{display:none}
  .qchk summary:hover{color:#a5f3fc;border-color:rgba(34,211,238,.45)}
  .qchk[open] summary{color:#a5f3fc;border-color:rgba(34,211,238,.5)}
  .qchk form{margin-top:8px;display:grid;gap:7px;max-width:520px}
  .qaxes{display:flex;flex-wrap:wrap;gap:5px 12px;font-size:12px;color:var(--mut)}
  .qaxes label{display:inline-flex;align-items:center;gap:5px;cursor:pointer}
  .qchk input[type=text]{background:rgba(6,11,22,.6);border:1px solid var(--line);border-radius:9px;
    padding:7px 10px;color:var(--txt);font:13px system-ui,sans-serif;width:100%}
  .qchk input[type=text]:focus{outline:2px solid var(--cy);outline-offset:1px}
  .qchk button{justify-self:start;appearance:none;border:1px solid rgba(16,185,129,.45);
    background:rgba(16,185,129,.18);color:#6ee7b7;border-radius:999px;padding:7px 16px;
    font:650 12.5px system-ui,sans-serif;cursor:pointer}
  .qchk button:hover{background:rgba(16,185,129,.3)}

  .qacts{display:flex;gap:7px;align-items:flex-start;flex-wrap:wrap;margin-top:8px}
  .qhist summary{display:inline-block;cursor:pointer;font:650 11.5px system-ui,sans-serif;color:var(--mut);
    border:1px solid var(--line);border-radius:999px;padding:4px 11px;list-style:none}
  .qhist summary::-webkit-details-marker{display:none}
  .qhist summary:hover{color:#a5f3fc;border-color:rgba(34,211,238,.45)}
  .qhist[open] summary{color:#a5f3fc;border-color:rgba(34,211,238,.5)}
  .qhist ul{list-style:none;margin:8px 0 0;padding:0;font-size:12px}
  .qhist li{display:flex;gap:9px;align-items:baseline;padding:3px 0;border-bottom:1px solid rgba(148,163,184,.07)}
  .qh-at{font:600 11.5px var(--mono);color:var(--mut);white-space:nowrap}
  .qh-what{color:var(--txt)}
  .qh-by{font-size:10.5px;color:var(--mut);border:1px solid var(--line);border-radius:999px;padding:1px 7px;white-space:nowrap}
  .qh-by.me{color:#6ee7b7;border-color:rgba(52,211,153,.35)}
  .qh-note{font-size:11.5px;color:var(--mut)}
  .qh-foot{margin:8px 0 0;font-size:11.5px;color:var(--mut)}

  .qfocus{border-color:rgba(34,211,238,.34);background:linear-gradient(180deg,rgba(34,211,238,.07),transparent 60%)}
  .qfocus h2{font-size:14px;text-transform:none;letter-spacing:0;color:var(--txt)}
  .qclose{margin-left:auto;font-size:11px;color:var(--mut);text-decoration:none;
    border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-weight:600}
  .qclose:hover{color:#a5f3fc;border-color:rgba(34,211,238,.45)}
  .qex{list-style:none;margin:9px 0 0;padding:0;font-size:12px;color:var(--mut);display:grid;gap:3px}
  .qex b{color:var(--txt);font-weight:650;margin-right:6px}

  /* One line per beach: count, name, what is missing. Nothing else fits on a
     phone and nothing else is needed to decide whether to open it. */
  .qbl{list-style:none;margin:0;padding:0}
  .qbl li{display:grid;grid-template-columns:64px minmax(0,1fr) auto;align-items:center;gap:10px;
    padding:6px 0;border-bottom:1px solid rgba(148,163,184,.08)}
  @media(max-width:560px){.qbl li{grid-template-columns:52px minmax(0,1fr);row-gap:3px}
    .qbl .qb-m{grid-column:2}}
  .qb-v{text-align:right;font:650 13px var(--mono);color:#a5f3fc;font-variant-numeric:tabular-nums}
  .qb-n{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .qb-n em{font-style:normal;font-size:11.5px;color:var(--mut);margin-left:8px}
  .qb-m{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
  .qb-m i{font-style:normal;font-size:10.5px;color:#fda4af;border:1px solid rgba(251,113,133,.3);
    background:rgba(251,113,133,.07);border-radius:999px;padding:2px 8px;white-space:nowrap}

  /* to-do list: one line each, buttons small but still hittable on a phone.
     Closed items stay, greyed — "we did this" is half the point of the list. */
  .qsub{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);
    margin:16px 0 8px;font-weight:700}
  .qtodo ul{list-style:none;margin:0 0 9px;padding:0}
  .qtodo li{display:flex;gap:9px;align-items:baseline;padding:5px 0;font-size:13px;
    border-bottom:1px solid rgba(148,163,184,.07)}
  .qtodo li.done{opacity:.45}
  .qtodo li.done .qt-txt{text-decoration:line-through}
  .qtodo .qt-txt{flex:1;min-width:0}
  .qtodo .qt-txt b{color:#a5f3fc;font-weight:650}
  .qtodo .qt-when{font:11px var(--mono);color:var(--mut);white-space:nowrap}
  .qtodo li form{display:flex;gap:4px}
  .qtodo li button{appearance:none;border:1px solid var(--line);background:rgba(255,255,255,.03);
    color:#6ee7b7;border-radius:8px;padding:2px 9px;font:650 12px system-ui,sans-serif;cursor:pointer}
  .qtodo li button.drop{color:#fda4af}
  .qtodo li button:hover{border-color:rgba(34,211,238,.45)}
  .qtadd{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
  .qtadd input[type=text]{flex:1;min-width:220px;background:rgba(6,11,22,.6);border:1px solid var(--line);
    border-radius:9px;padding:7px 10px;color:var(--txt);font:13px system-ui,sans-serif}
  .qtadd input[type=number]{width:150px;background:rgba(6,11,22,.6);border:1px solid var(--line);
    border-radius:9px;padding:7px 10px;color:var(--txt);font:13px system-ui,sans-serif}
  .qtadd input:focus{outline:2px solid var(--cy);outline-offset:1px}
  .qtadd button{appearance:none;border:1px solid rgba(34,211,238,.45);background:rgba(34,211,238,.14);
    color:#a5f3fc;border-radius:999px;padding:7px 16px;font:650 12.5px system-ui,sans-serif;cursor:pointer}
  .qprog .up{color:#6ee7b7;font:600 11.5px var(--mono);margin-right:9px}
  .qprog .down{color:#fda4af;font:600 11.5px var(--mono);margin-right:9px}

  .qtwrap{overflow-x:auto}
  .qtable{width:100%;border-collapse:collapse;font-size:13px}
  .qtable tr.on{background:rgba(34,211,238,.08)}
  .qmini{font:650 11px system-ui,sans-serif;color:var(--mut);text-decoration:none;
    border:1px solid var(--line);border-radius:999px;padding:3px 10px;white-space:nowrap}
  .qmini:hover{color:#a5f3fc;border-color:rgba(34,211,238,.45)}
  .qtable th{text-align:left;font:650 10px system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase;
    color:var(--mut);padding:0 10px 8px 0;white-space:nowrap;border-bottom:1px solid var(--line)}
  .qtable td{padding:7px 10px 7px 0;border-bottom:1px solid rgba(148,163,184,.08);vertical-align:middle}
  .qt-name{font-weight:600;white-space:nowrap}
  .qt-name span{color:var(--mut);font:11px var(--mono);margin-left:7px}
  .qt-num{text-align:right;font:600 12.5px var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
  .qt-when{font-size:12px;color:var(--mut);white-space:nowrap}
  .qt-when.late{color:#fda4af}
  .qt-dots .qdots{margin-top:0}
  .qt-act{white-space:nowrap}
  .qt-act .qchk{margin-top:0}

  .panel{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 16px 14px;margin-bottom:14px}
  .panel h2{display:flex;align-items:baseline;gap:8px;font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;
    color:var(--mut);margin:0 0 12px;font-weight:700}
  .panel h2 em{font-style:normal;font-size:10.5px;color:#6b819f;letter-spacing:.02em;text-transform:none;font-weight:500}

  /* Open-Meteo quota meter — colour follows the PROJECTION, not the raw percentage */
  .panel.cap{border-color:rgba(34,211,238,.22)}
  .panel.cap.warn{border-color:rgba(251,191,36,.38);background:linear-gradient(180deg,rgba(251,191,36,.07),transparent 60%)}
  .panel.cap.bad{border-color:rgba(251,113,133,.46);background:linear-gradient(180deg,rgba(251,113,133,.10),transparent 60%)}
  .panel.cap h2{margin-bottom:14px}
  .capbadge{margin-left:auto;font-size:11px;font-weight:700;letter-spacing:0;text-transform:none;
    padding:4px 10px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--txt);white-space:nowrap}
  .cap.ok .capbadge{border-color:rgba(52,211,153,.38);color:#6ee7b7}
  .cap.warn .capbadge{border-color:rgba(251,191,36,.45);color:#fcd34d}
  .cap.bad .capbadge{border-color:rgba(251,113,133,.5);color:#fda4af}
  .capgrid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:18px;align-items:start}
  @media(max-width:720px){.capgrid{grid-template-columns:1fr;gap:14px}}
  .capbig{font:650 30px/1.1 var(--mono);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .capbig span{font-size:14px;font-weight:500;color:var(--mut);margin-left:7px;letter-spacing:0}
  .capbar{position:relative;height:12px;border-radius:999px;background:rgba(148,163,184,.14);margin:11px 0 7px;overflow:visible}
  .capbar i{position:absolute;inset:0 auto 0 0;border-radius:999px;background:linear-gradient(90deg,#22d3ee,#34d399);transition:width .4s}
  .cap.warn .capbar i{background:linear-gradient(90deg,#fbbf24,#f59e0b)}
  .cap.bad .capbar i{background:linear-gradient(90deg,#fb7185,#f43f5e)}
  /* where an evenly-spent month would stand today */
  .capbar u{position:absolute;top:-4px;width:2px;height:20px;background:rgba(230,237,247,.55);border-radius:2px}
  .capsub{font-size:11.5px;color:var(--mut)}
  .capstats{display:grid;grid-template-columns:1fr 1fr;gap:9px 12px}
  .capstats div{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:11px;padding:8px 10px}
  .capstats .cl{display:block;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--mut);font-weight:650}
  .capstats .cv{display:block;font:650 17px/1.25 var(--mono);margin-top:3px;font-variant-numeric:tabular-nums}
  .capstats .cv.mid{color:var(--am)}
  .capstats .cv.hi{color:var(--rs)}
  .capverdict{margin:14px 0 0;font-size:13.5px;line-height:1.5;color:var(--txt)}
  .capverdict b{font-variant-numeric:tabular-nums}
  .capdays{display:flex;align-items:flex-end;gap:3px;height:62px;margin-top:14px;overflow-x:auto;padding-bottom:2px}
  .capdays .cd{position:relative;flex:1 0 16px;min-width:16px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px}
  .capdays .cd i{display:block;width:100%;border-radius:3px 3px 0 0;background:rgba(34,211,238,.45)}
  .capdays .cd.near i{background:rgba(251,191,36,.6)}
  .capdays .cd.over i{background:rgba(251,113,133,.65)}
  .capdays .cd b{font-size:8.5px;font-weight:500;color:#5f7a9c;white-space:nowrap}
  .capwarn{margin:12px 0 0;font-size:12.5px;color:#fda4af}
  .capnote{margin:10px 0 0;font-size:11.5px;line-height:1.5;color:var(--mut)}

  /* Ο πάροχος ως πηγή. Ξεχωρίζει οπτικά από τα δικά μας νούμερα επίτηδες: το ένα
     είναι μέτρηση, το άλλο εκτίμηση, και το να μοιάζουν ίδια είναι που οδήγησε στο
     να πιστεύουμε επί μέρες τον λάθος αριθμό. */
  .capsrc{margin-top:16px;padding-top:14px;border-top:1px dashed rgba(148,163,184,.22)}
  .capsrc h3{margin:0 0 10px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;
    font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:#93c5fd;font-weight:700}
  .capsrc h3 em{font-style:normal;font-size:10.5px;color:#6b819f;letter-spacing:.02em;
    text-transform:none;font-weight:500}
  .capsrcrow{grid-template-columns:repeat(auto-fit,minmax(132px,1fr))}
  .capsrcrow .cf{display:block;margin-top:3px;font-size:9.5px;line-height:1.35;color:#5f7a9c}
  .capsrclist{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:5px;
    font-size:11.5px;color:var(--mut);font-variant-numeric:tabular-nums}
  .capsrclist b{color:var(--txt);font-weight:650}
  .capnote-i{color:#5f7a9c;font-style:italic}
  .capform{margin-top:12px;display:grid;gap:8px;
    grid-template-columns:repeat(auto-fit,minmax(140px,1fr));align-items:end}
  .capform label{display:block;font-size:10px;letter-spacing:.05em;text-transform:uppercase;
    color:var(--mut);font-weight:650}
  .capform label span{text-transform:none;letter-spacing:0;font-weight:500;opacity:.7}
  .capform label.wide{grid-column:1/-1}
  .capform input{width:100%;margin-top:4px;padding:7px 9px;border-radius:9px;
    border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--txt);
    font:500 12.5px system-ui,sans-serif}
  .capform button{padding:8px 14px;border-radius:9px;border:1px solid rgba(34,211,238,.35);
    background:rgba(34,211,238,.12);color:#a5f3fc;font:650 12px system-ui,sans-serif;cursor:pointer}
  .capform button:hover{background:rgba(34,211,238,.2)}

  /* world map */
  .mapwrap{position:relative;border-radius:12px;overflow:hidden;background:#050a13;
    border:1px solid rgba(34,211,238,.10)}
  svg.map{display:block;width:100%;height:auto}
  .land{fill:#12203a;stroke:#22406b;stroke-width:.5;vector-effect:non-scaling-stroke}
  .grat{stroke:rgba(34,211,238,.07);stroke-width:.5;vector-effect:non-scaling-stroke;fill:none}
  .pt{transition:opacity .3s}
  /* Four states, four colours, each with its own count in the board above the map:
     online now / new today / returning today / earlier days. */
  .pt-old{fill:#38bdf8;fill-opacity:.30;stroke:#38bdf8;stroke-opacity:.45;stroke-width:.6;vector-effect:non-scaling-stroke}
  .pt-new{fill:#fbbf24;fill-opacity:.72;stroke:#fde68a;stroke-width:.7;vector-effect:non-scaling-stroke}
  .pt-ret{fill:#f472b6;fill-opacity:.72;stroke:#fbcfe8;stroke-width:.7;vector-effect:non-scaling-stroke}
  .pt-unk{fill:#94a3b8;fill-opacity:.6;stroke:#cbd5e1;stroke-width:.7;vector-effect:non-scaling-stroke}
  .pt-live{fill:#34d399;fill-opacity:.92;stroke:#ecfdf5;stroke-width:.7;vector-effect:non-scaling-stroke}
  .pt-approx{fill-opacity:.10;stroke-dasharray:2 1.6}
  /* --z is the current zoom factor (viewBox width / world width): the halo has to
     expand in USER units, otherwise zooming into Greece fills the whole map. */
  #layerLive{--z:1}
  .halo{fill:none;stroke:#34d399;stroke-width:1;vector-effect:non-scaling-stroke;opacity:.7;animation:ping 2.6s ease-out infinite}
  @keyframes ping{0%{r:calc(var(--z) * 3px);opacity:.75}75%,100%{r:calc(var(--z) * 14px);opacity:0}}
  @media(prefers-reduced-motion:reduce){.halo{animation:none;opacity:.25}}
  /* The map's own board. Four big, tappable cells that both EXPLAIN the colours and
     switch each layer off — the legend is the control, so there is nothing to learn. */
  .legend{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}
  @media(max-width:700px){.legend{grid-template-columns:repeat(2,1fr)}}
  .lg{position:relative;text-align:left;cursor:pointer;padding:11px 12px 10px;border-radius:13px;
    border:1px solid var(--line);background:var(--panel);color:var(--txt);font:inherit;
    display:block;transition:border-color .18s,background .18s,opacity .18s}
  .lg:hover{border-color:color-mix(in oklab,var(--c) 55%,transparent)}
  .lg.on{border-color:color-mix(in oklab,var(--c) 50%,transparent);
    background:linear-gradient(180deg,color-mix(in oklab,var(--c) 16%,transparent),transparent)}
  .lg.off{opacity:.38}
  .lg.off .lgdot{background:transparent;box-shadow:inset 0 0 0 2px var(--c)}
  .lgdot{display:inline-block;width:11px;height:11px;border-radius:50%;background:var(--c);
    margin-right:7px;vertical-align:-1px}
  /* NOT called "pulse": that class belongs to the live-pulse chart, whose
     display:flex/height:56px would silently stretch this dot into a tall pill. */
  .lgdot.beating{animation:beat 2s infinite}
  .lgk{font-size:11.5px;font-weight:650;letter-spacing:.02em;color:var(--mut)}
  .lgv{display:block;font:650 30px/1.1 var(--mono);letter-spacing:-.02em;margin-top:4px;
    font-variant-numeric:tabular-nums;color:var(--c)}
  .lgs{display:block;font-size:11.5px;color:var(--mut);margin-top:3px;min-height:16px}
  .lgoff{position:absolute;top:9px;right:11px;font:600 9.5px var(--mono);color:var(--mut);
    text-transform:uppercase;letter-spacing:.05em;opacity:0}
  .lg.off .lgoff{opacity:1}
  .maplegend{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--mut);margin-top:11px;align-items:center}
  .maplegend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:-1px}
  .zooms{position:absolute;top:10px;right:10px;display:flex;gap:6px;z-index:2}
  .zooms button{border:1px solid var(--line);background:rgba(6,11,22,.72);color:var(--mut);
    border-radius:8px;padding:5px 10px;font:600 11.5px system-ui,sans-serif;cursor:pointer;backdrop-filter:blur(4px)}
  .zooms button.on{color:#a5f3fc;border-color:rgba(34,211,238,.5);background:rgba(34,211,238,.14)}
  .zooms button:focus-visible{outline:2px solid var(--cy);outline-offset:2px}

  /* Map view: the stage spans the full page and can go true full-screen. */
  #mapStage{padding-bottom:16px}
  #mapStage:fullscreen{background:var(--bg);padding:18px;overflow:auto;border-radius:0}
  #mapStage:fullscreen .mapwrap{height:calc(100vh - 230px)}
  #mapStage:fullscreen svg.map{width:100%;height:100%}
  .fsbtn{position:absolute;top:10px;left:10px;z-index:2;border:1px solid var(--line);
    background:rgba(6,11,22,.72);color:var(--mut);border-radius:8px;padding:5px 10px;
    font:600 11.5px system-ui,sans-serif;cursor:pointer;backdrop-filter:blur(4px)}
  .fsbtn:hover{color:#a5f3fc;border-color:rgba(34,211,238,.5)}
  .fsbtn:focus-visible{outline:2px solid var(--cy);outline-offset:2px}
  .fslabel{margin-left:5px}
  /* On a phone the label would slide under the zoom presets — keep just the glyph. */
  @media(max-width:640px){.fslabel{display:none}.fsbtn{padding:5px 8px}}

  /* Who is inside, laid out under a full-width map instead of beside it. */
  .whosgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:0 22px}
  @media(max-width:860px){.whosgrid{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:560px){.whosgrid{grid-template-columns:1fr}}

  /* Composition of everyone currently drawn on the map. */
  .compo{display:flex;height:30px;border-radius:9px;overflow:hidden;background:rgba(148,163,184,.10);margin-bottom:10px}
  .compo i{display:flex;align-items:center;justify-content:center;font:700 11.5px var(--mono);
    color:#06121f;min-width:0;transition:flex-grow .35s ease}
  .compokey{display:flex;flex-wrap:wrap;gap:16px;font-size:12.5px;color:var(--mut)}
  .compokey b{color:var(--txt);font-family:var(--mono)}
  .compokey i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:-1px}

  /* Country/city rows that carry their own new-vs-returning split. */
  ul.split{list-style:none;margin:0;padding:0}
  ul.split li{display:grid;grid-template-columns:1fr 96px 44px;align-items:center;gap:9px;padding:5px 0;font-size:13px}
  ul.split .sl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  ul.split .sb{display:flex;height:8px;border-radius:4px;overflow:hidden;background:rgba(148,163,184,.12)}
  ul.split .sb i{display:block;height:100%}
  ul.split .sn{text-align:right;font:600 12.5px var(--mono);font-variant-numeric:tabular-nums}

  .livecols{display:grid;grid-template-columns:1.6fr 1fr;gap:14px;align-items:start}
  @media(max-width:860px){.livecols{grid-template-columns:1fr}}
  .whos{list-style:none;margin:0;padding:0;max-height:340px;overflow:auto}
  .whos li{display:flex;align-items:center;gap:9px;padding:7px 2px;border-bottom:1px solid rgba(148,163,184,.09);font-size:13px}
  .whos li:last-child{border-bottom:0}
  .whos .cc{flex:0 0 auto;font:700 10px var(--mono);letter-spacing:.04em;color:#a5f3fc;
    background:rgba(34,211,238,.12);border:1px solid rgba(34,211,238,.25);border-radius:5px;padding:2px 5px}
  .whos .who{flex:1;min-width:0}
  /* Direct child only: the new/returning chip lives INSIDE this line, and an
     unscoped selector made it display:block and stretch across the whole row. */
  .whos .who > b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .whos .who > span{color:var(--mut);font-size:11.5px}
  .whos .knew,.whos .kret{display:inline-block;font:700 9.5px var(--mono);font-style:normal;
    letter-spacing:.04em;text-transform:uppercase;padding:1px 5px;border-radius:5px;
    vertical-align:1px;margin-left:2px}
  .whos .knew{background:rgba(251,191,36,.16);color:#fbbf24}
  .whos .kret{background:rgba(244,114,182,.15);color:#f472b6}
  .whos .ago{font:600 11px var(--mono);color:var(--gr);white-space:nowrap}
  .whos .ago.cold{color:var(--mut)}

  /* live pulse */
  .pulse{display:flex;align-items:flex-end;gap:2px;height:56px;margin-top:2px}
  .pulse i{flex:1;background:linear-gradient(180deg,#22d3ee,rgba(34,211,238,.15));border-radius:2px 2px 0 0;
    min-height:3px;opacity:.85}
  .pulse i.now{background:linear-gradient(180deg,#34d399,rgba(52,211,153,.2))}
  /* An empty minute still gets a visible tick, so the chart reads as a timeline
     rather than as a chart that failed to load. */
  .pulse i.zero{background:rgba(148,163,184,.16)}
  .pulseax{display:flex;justify-content:space-between;font:11px var(--mono);color:var(--mut);margin-top:6px}

  /* trend — scrolls sideways on a phone rather than shrinking into illegibility */
  .trendwrap{overflow-x:auto}
  svg.trend{width:100%;min-width:620px;height:auto;display:block}
  .trend .grid{stroke:rgba(148,163,184,.13);stroke-width:1}
  .trend .ax{fill:#7b8fab;font:11px var(--mono)}
  /* The area (pageviews) has its own scale — say so instead of letting it borrow
     the left axis, which counts visitors. */
  .trend .hits{fill:#22d3ee;opacity:.7}
  .trend .tdot{fill:#f0abfc;stroke:#0b1220;stroke-width:1.4;cursor:pointer}
  .tlegend{display:flex;gap:16px;font-size:12px;color:var(--mut);margin-top:8px;flex-wrap:wrap}
  .tlegend i{display:inline-block;width:14px;height:3px;border-radius:2px;margin-right:6px;vertical-align:3px}

  /* hours */
  .hours{display:grid;grid-template-columns:repeat(24,1fr);gap:3px}
  .hcell{position:relative;height:44px;border-radius:5px;
    background:rgba(34,211,238,.22); /* fallback where color-mix is missing */
    background:color-mix(in oklab, #22d3ee calc(var(--f) * 88%), rgba(148,163,184,.10));
    display:flex;align-items:flex-end;justify-content:center}
  .hcell.z{background:rgba(148,163,184,.07)}
  .hcell span{font:10px var(--mono);color:rgba(6,11,22,.75);font-weight:700;padding-bottom:2px}
  .hcell.z span{color:var(--mut)}
  @media(max-width:700px){.hcell span{display:none}.hcell{height:34px}}

  /* tables */
  .tablewrap{overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.10);white-space:nowrap}
  th{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);font-weight:650}
  td.n{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums;font-weight:600}
  td.dim,.dim{color:var(--mut);font-weight:500}
  td.g{color:#6ee7b7}
  td.d .wd{color:var(--mut);font-size:11.5px;font-weight:500}
  td.bar{width:22%;min-width:80px}
  td.bar span{display:block;height:6px;border-radius:4px;background:linear-gradient(90deg,#22d3ee,#c4b5fd)}

  /* breakdown bars */
  .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  @media(max-width:980px){.grid3{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:640px){.grid3{grid-template-columns:1fr}}
  ul.bars{list-style:none;margin:0;padding:0}
  ul.bars li{display:grid;grid-template-columns:1fr 74px 52px 38px;align-items:center;gap:8px;
    padding:5px 0;font-size:13px}
  ul.bars .bl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  ul.bars .bb{height:6px;border-radius:4px;background:rgba(148,163,184,.13);overflow:hidden}
  ul.bars .bb i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#22d3ee,#818cf8)}
  ul.bars .bn{text-align:right;font:600 12.5px var(--mono);font-variant-numeric:tabular-nums}
  ul.bars .bp{text-align:right;font:500 11.5px var(--mono);color:var(--mut)}
  ul.bars li.dim .bb i{background:rgba(148,163,184,.3)}

  /* journey */
  ul.funnel{list-style:none;margin:0;padding:0}
  ul.funnel li{display:grid;grid-template-columns:230px 1fr 58px 44px;align-items:center;gap:10px;padding:6px 0;font-size:13.5px}
  ul.funnel .fb{height:14px;border-radius:5px;background:rgba(148,163,184,.10);overflow:hidden}
  ul.funnel .fb i{display:block;height:100%;border-radius:5px;transition:width .4s ease}
  ul.funnel .fn{text-align:right;font:650 14px var(--mono);font-variant-numeric:tabular-nums}
  ul.funnel .fp{text-align:right;font:600 12px var(--mono);color:var(--mut)}
  @media(max-width:620px){ul.funnel li{grid-template-columns:1fr 52px 40px}ul.funnel .fb{grid-column:1/-1;order:2}}
  @media(max-width:420px){ul.bars li{grid-template-columns:1fr 46px 34px}ul.bars .bp{display:none}}
  /* Full-width panel: cap the label column so the bar keeps the flexible space
     instead of being squeezed against the right edge. */
  ul.bars.wide li{grid-template-columns:minmax(0,380px) 1fr 58px 44px}
  @media(max-width:620px){ul.bars.wide li{grid-template-columns:1fr 46px 34px}}

  .note{font-size:11.5px;color:var(--mut);margin:10px 0 0;line-height:1.6}
  .empty{color:var(--mut);font-size:13px;margin:4px 0}
  footer.meth{margin-top:22px;font-size:11.5px;color:#6b819f;line-height:1.75}
  footer.meth b{color:var(--mut)}
  .tag{display:inline-block;font:600 9.5px/1.5 var(--mono);letter-spacing:.05em;text-transform:uppercase;
    padding:1px 6px;border-radius:5px;margin-left:6px;vertical-align:1px}
  .tag.exact{background:rgba(52,211,153,.14);color:#6ee7b7}
  .tag.est{background:rgba(251,191,36,.13);color:var(--am)}
  .tag.best{background:rgba(148,163,184,.14);color:var(--mut)}
</style></head><body><div class="wrap">

<header class="top">
  <h1>Πραγματική κίνηση<small>First-party μέτρηση — χωρίς cookies, χωρίς consent gate, δεν την κόβουν τα ad-blockers.</small></h1>
  <div class="spacer"></div>
  <div class="livebadge"><span class="dot"></span><span id="liveBadge">${num(live.length)} τώρα στο site</span></div>
</header>

<div class="toolbar">
  ${windowChip(7, '7 μέρες')}${windowChip(30, '30 μέρες')}${windowChip(90, 'Όλα')}
  <span class="chip" style="cursor:default">Μετράμε από <b>${dayLabel(startDay)}/${startDay.slice(0, 4)}</b> · ${rows.length} μέρες</span>
  <div class="spacer"></div>
  <button id="optout" class="chip" type="button">🚫 Μην μετράς αυτή τη συσκευή</button>
</div>

<div class="kpis">
  ${kpi('Τώρα στο site', `<span id="liveNum">${num(live.length)}</span>`, `<span id="liveCountries">${new Set(live.map((l) => l.cc)).size}</span> χώρες αυτή τη στιγμή`, '', 'hot')}
  ${kpi('Συσκευές/συνδέσεις σήμερα', num(today.unique), 'ακριβής μέτρηση — ένα κλειδί ανά επισκέπτη', sparkline(uniqSeries, '#22d3ee'))}
  ${kpi(
    '≈ Άτομα σήμερα',
    todayBand.lo === todayBand.hi ? num(todayBand.mid) : `~${num(todayBand.mid)}`,
    todayBand.lo === todayBand.hi
      ? 'οι δύο μετρήσεις συμφωνούν'
      : `μεταξύ ${num(todayBand.lo)} και ${num(todayBand.hi)}`,
    sparkline(uniqSeries, '#f0abfc')
  )}
  ${kpi('Προβολές σήμερα', num(today.hits), `${today.unique ? (today.hits / today.unique).toFixed(1) : '—'} ανά επισκέπτη`, sparkline(hitsSeries, '#22d3ee'))}
  ${kpi('Νέοι σήμερα', num(today.newV), `${num(today.retV)} επιστρέφοντες σήμερα`, sparkline(newSeries, '#34d399'))}
  ${kpi('Επιστρέφοντες', `${retPct}%`, `στις ${rows.length} μέρες του παραθύρου`, '')}
  ${kpi('Μέσος χρόνος', avgDwell ? dur(avgDwell) : '—', `${bouncePct}% έφυγαν από 1 σελίδα`, '')}
  ${kpi('Άνοιξαν παραλία', `${beachPct}%`, navPeople ? `${num(navPeople)} ζήτησαν οδηγίες` : `${num(navActions)} κλικ «Οδηγίες»`, '', 'act')}
</div>

${capacityPanel(data.capacity && data.capacity.usage, data.capacity && data.capacity.state, data.capacity && data.capacity.readings)}

<nav class="tabs" role="tablist">
  <button type="button" class="tab on" data-tab="map" role="tab" aria-selected="true">🌍 Χάρτης</button>
  <button type="button" class="tab" data-tab="stats" role="tab" aria-selected="false">📊 Στατιστικά</button>
  <button type="button" class="tab" data-tab="photos" role="tab" aria-selected="false">📷 Εγκρίσεις${
    queueCount ? `<span class="badge">${num(queueCount)}</span>` : ''}</button>
  <button type="button" class="tab" data-tab="quality" role="tab" aria-selected="false">🔎 Ποιότητα${
    lateRegions ? `<span class="badge">${num(lateRegions)}</span>` : ''}</button>
  <button type="button" class="tab" data-tab="search" role="tab" aria-selected="false">🔍 Αναζητήσεις${
    data.searchTerms?.totalMisses ? `<span class="badge">${num(data.searchTerms.totalMisses)}</span>` : ''}</button>
</nav>

<div id="tabMap" role="tabpanel">
<section class="panel" id="mapStage">
  <h2>Ο κόσμος αυτή τη στιγμή<em>πάτα ένα πλακίδιο για να κρύψεις αυτούς τους ανθρώπους — φεύγουν και από τα στατιστικά πιο κάτω</em></h2>
  <div class="legend">
    <button type="button" class="lg on" data-layer="live" style="--c:#34d399">
      <span class="lgoff">κρυφό</span>
      <span class="lgk"><span class="lgdot beating"></span>ΜΕΣΑ ΤΩΡΑ</span>
      <span class="lgv" id="lgLive">0</span>
      <span class="lgs" id="lgLiveSub">—</span>
    </button>
    <button type="button" class="lg on" data-layer="new" style="--c:#fbbf24">
      <span class="lgoff">κρυφό</span>
      <span class="lgk"><span class="lgdot"></span>ΝΕΟΙ ΠΟΥ ΕΦΥΓΑΝ</span>
      <span class="lgv" id="lgNew">0</span>
      <span class="lgs">πρώτη τους φορά στο site</span>
    </button>
    <button type="button" class="lg on" data-layer="ret" style="--c:#f472b6">
      <span class="lgoff">κρυφό</span>
      <span class="lgk"><span class="lgdot"></span>ΠΑΛΙΟΙ ΠΟΥ ΕΦΥΓΑΝ</span>
      <span class="lgv" id="lgRet">0</span>
      <span class="lgs" id="lgRetSub">είχαν ξανάρθει</span>
    </button>
    <button type="button" class="lg on" data-layer="old" style="--c:#38bdf8">
      <span class="lgoff">κρυφό</span>
      <span class="lgk"><span class="lgdot"></span>ΠΡΟΗΓΟΥΜΕΝΕΣ ΜΕΡΕΣ</span>
      <span class="lgv" id="lgOld">0</span>
      <span class="lgs" id="lgOldSub">πριν από σήμερα</span>
    </button>
  </div>
  <div>
    <div>
      <div class="mapwrap">
        <button type="button" class="fsbtn" id="fsBtn" title="Πλήρης οθόνη" aria-label="Πλήρης οθόνη">⛶<span class="fslabel" id="fsLabel">Πλήρης οθόνη</span></button>
        <div class="zooms">
          <button data-vb="0 0 ${WORLD_W} ${WORLD_H}" class="on">Κόσμος</button>
          <button data-vb="440 40 210 120">Ευρώπη</button>
          <!-- No "Ελλάδα" preset: the coastline is Natural Earth 110m, which carries
               no Greek islands at all — a Greece-only view would be a lie. "Where in
               Greece" is answered by the city breakdown instead. -->
          <button data-vb="478 97 134 53">Μεσόγειος</button>
        </div>
        <svg class="map" id="map" viewBox="0 0 ${WORLD_W} ${WORLD_H}" preserveAspectRatio="xMidYMid meet">
          <g class="grat">
            ${[-120, -60, 0, 60, 120].map((lon) => `<line x1="${((lon + 180) / 360) * WORLD_W}" y1="0" x2="${((lon + 180) / 360) * WORLD_W}" y2="${WORLD_H}"/>`).join('')}
            ${[60, 30, 0, -30].map((lat) => `<line x1="0" y1="${((WORLD_LAT_TOP - lat) / 360) * WORLD_W}" x2="${WORLD_W}" y2="${((WORLD_LAT_TOP - lat) / 360) * WORLD_W}"/>`).join('')}
          </g>
          <path class="land" d="${WORLD_PATH}"/>
          <g id="layerOld"></g>
          <g id="layerRet"></g>
          <g id="layerNew"></g>
          <g id="layerLive"></g>
        </svg>
      </div>
      <div class="maplegend">
        <span class="dim">Κούφιος κύκλος = ξέρουμε μόνο τη χώρα, όχι την πόλη ·
        γκρι = ο browser τους μπλοκάρει την αποθήκευση, δεν ξέρουμε αν είναι νέοι ή παλιοί</span>
      </div>
    </div>
  </div>
</section>

<section class="panel">
  <h2>Ποιοι είναι μέσα αυτή τη στιγμή<em>τελευταία ${LIVE_MINUTES} λεπτά</em></h2>
  <ul class="whos whosgrid" id="whos"></ul>
</section>

<section class="panel">
  <h2>Στατιστικά αυτών που φαίνονται στον χάρτη<em id="cohortScope">—</em></h2>
  <div class="compo" id="compo"></div>
  <div class="compokey" id="compoKey"></div>
  <div class="grid3" style="margin-top:16px">
    <div><h2>Χώρες</h2><ul class="split" id="cohortCountries"></ul></div>
    <div><h2>Πόλεις</h2><ul class="split" id="cohortCities"></ul></div>
    <div><h2>Συσκευές</h2><ul class="split" id="cohortDevices"></ul></div>
  </div>
  <p class="note">Κάθε μπάρα σπάει σε <b style="color:#34d399">μέσα τώρα</b> ·
  <b style="color:#fbbf24">νέους</b> · <b style="color:#f472b6">παλιούς</b> ·
  <b style="color:#94a3b8">άγνωστους</b>. Μετράνε άνθρωποι, όχι κουκκίδες — σε μια πόλη μπορεί να πέφτουν πολλοί.</p>
</section>

<section class="panel">
  <h2>Παλμός τελευταίας ώρας<em>μοναδικοί ενεργοί ανά λεπτό</em></h2>
  <div class="pulse" id="pulse"></div>
  <div class="pulseax"><span>−60 λ.</span><span>−30 λ.</span><span>τώρα</span></div>
</section>
</div>

<div id="tabStats" role="tabpanel" hidden>

${funnelPanel(totals.funnel, totals.actions, sumUnique)}

<section class="panel">
  <h2>Ημερήσια πορεία<em>από την πρώτη μέρα μέτρησης — καμία μέρα χωρίς μέτρηση δεν εμφανίζεται</em></h2>
  ${trendChart(rows)}
  <div class="tlegend">
    <span><i style="background:#f0abfc"></i>Μοναδικοί επισκέπτες</span>
    <span><i style="background:#22d3ee"></i>Προβολές σελίδων</span>
    <span><i style="background:#34d399"></i>Νέοι επισκέπτες</span>
  </div>
</section>

<section class="panel">
  <h2>Ώρες αιχμής<em>ώρα Ελλάδας · προβολές στο παράθυρο</em></h2>
  ${hourStrip(totals.hours || {})}
</section>

<section class="panel">
  <h2>Ανά ημέρα</h2>
  <div class="tablewrap"><table>
    <thead><tr><th>Ημέρα</th><th class="n">Μοναδ.</th><th class="n">Νέοι</th><th class="n">Επιστρ.</th>
      <th class="n">Προβολές</th><th class="n">/άτομο</th><th class="n">Χρόνος</th><th class="n">Bounce</th><th></th></tr></thead>
    <tbody>${dayRows || '<tr><td colspan="9" class="dim">Καμία μέρα ακόμη.</td></tr>'}</tbody>
  </table></div>
</section>

<div class="grid3">
  ${breakdown('Χώρες', totals.countries, countryLabel, sumUnique)}
  ${breakdown('Πόλεις', totals.cities, cityLabel, sumUnique)}
  ${breakdown('Κανάλι εισόδου', totals.channels, (k) => CHANNEL_LABEL[k] || k, sumUnique)}
  ${breakdown('Πηγές (site)', totals.refs, null, sumUnique)}
  ${breakdown('Συσκευές', totals.devices, (k) => DEVICE_LABEL[k] || k, sumUnique)}
  ${breakdown('Πλάτος οθόνης', totals.viewports, (k) => `${k} px`, sumUnique)}
  ${breakdown('Γλώσσα browser', totals.langs, (k) => LANG_LABEL[k] || k, sumUnique)}
  ${breakdown('Browser', totals.browsers, (k) => BROWSER_LABEL[k] || k, sumUnique)}
  ${breakdown('Λειτουργικό', totals.os, (k) => OS_LABEL[k] || k, sumUnique)}
  ${breakdown('Είδος σελίδας', totals.activity, (k) => ACTIVITY_LABEL[k] || k, null, 10, 'σε προβολές')}
  ${breakdown('Πύλη εισόδου', totals.sections, null, sumUnique, 10, 'πού προσγειώθηκαν')}
  ${breakdown('Δημοφιλείς περιοχές', totals.views, null, null, 10, 'σε όλες τις προβολές')}
  ${breakdown('Ενέργειες', totals.actions, (k) => ACTION_LABEL[k] || k, null, 10, 'κλικ, όχι επισκέπτες')}
</div>

<section class="panel">
  <h2>Δημοφιλέστερες σελίδες<em>μονοπάτι · προβολές στο παράθυρο</em></h2>
  <ul class="bars wide">
    ${(() => {
      const all = Object.entries(totals.pages || {}).sort((a, b) => b[1] - a[1]).slice(0, 15);
      if (!all.length) return '<li class="dim"><span class="bl">Καμία ακόμη</span></li>';
      const max = Math.max(1, ...all.map(([, v]) => v));
      return all
        .map(
          ([p, v]) =>
            `<li><span class="bl">${esc(p)}</span><span class="bb"><i style="width:${((v / max) * 100).toFixed(1)}%"></i></span>
             <span class="bn">${num(v)}</span><span class="bp">${sumHits ? Math.round((v / sumHits) * 100) : 0}%</span></li>`
        )
        .join('');
    })()}
  </ul>
</section>
</div>

<div id="tabPhotos" role="tabpanel" hidden>
${moderationTab(queue, data.flash, data.curating, data.publishedBeaches)}
</div>

<div id="tabQuality" role="tabpanel" hidden>
${qualityTab(qualityRows, beachGapRows, data.qualityTodos, data.flash, data.qualityFocus)}
</div>

<div id="tabSearch" role="tabpanel" hidden>
${searchTermsTab(data.searchTerms)}
</div>

<footer class="meth">
  <b>Πώς διαβάζονται οι αριθμοί.</b>
  <span class="tag exact">ακριβές</span> Μοναδικοί επισκέπτες ανά μέρα και «σελίδες ≥2» — μετρώνται χωρίς race, ένας επισκέπτης = ένα κλειδί.
  <span class="tag best">κατά προσέγγιση</span> Προβολές, χώρες, συσκευές, χρόνος: γράφονται με read-modify-write, άρα σε ταυτόχρονες επισκέψεις χάνεται καμιά — υποεκτιμούν ελαφρώς, ποτέ δεν φουσκώνουν.
  <span class="tag est">εκτίμηση</span> «≈ Άτομα»: το κάτω άκρο είναι όσοι πιάστηκαν με ετικέτα νέος/επιστρέφων, το πάνω οι μοναδικές συσκευές/συνδέσεις (το ίδιο κινητό με αλλαγμένη IP μετριέται 2 φορές). Δείχνουμε και τα δύο άκρα.<br>
  «Νέοι» + «Επιστρ.» μπορεί να μη βγάζουν το σύνολο των μοναδικών: όποιος έχει μπλοκαρισμένη αποθήκευση στον browser δεν μπορεί να πει αν ξαναήρθε, και δεν τον χρεώνουμε σε καμία από τις δύο στήλες.
  Ο «χρόνος» μετράει μόνο όσο η καρτέλα είναι <b>ορατή</b> και σταματά μετά από 5 λεπτά σιωπής — δεν φουσκώνει από ξεχασμένες καρτέλες. «Bounce» = επισκέπτες που είδαν μία μόνο σελίδα.
  Ο χάρτης δείχνει την πόλη που δίνει το δίκτυο· όπου δεν υπάρχει πόλη, βάζουμε το κέντρο της χώρας και το σχεδιάζουμε <b>κούφιο</b>.
  Καμία IP, κανένα cookie, κανένα προσωπικό δεδομένο δεν αποθηκεύεται — μόνο ένα μη-αναστρέψιμο ημερήσιο hash. Η σελίδα ανανεώνεται μόνη της κάθε 20 δευτ.
</footer>
</div>

<script id="pl" type="application/json">${payload}</script>
<script>
(function () {
  var D = JSON.parse(document.getElementById('pl').textContent);
  var map = document.getElementById('map');
  var LO = document.getElementById('layerOld'), LR = document.getElementById('layerRet'),
      LN = document.getElementById('layerNew'), LL = document.getElementById('layerLive');
  var NS = 'http://www.w3.org/2000/svg';
  var zoom = 1; // viewBox width / world width — dots must not grow when we zoom in
  // Which layers the board has switched on. Toggling is view-only: nothing is
  // recounted, so the numbers on the cells never move when you hide a layer.
  var show = { live: true, new: true, ret: true, old: true };
  // hash → 'new' | 'ret' | 'unk' and hash → device, rebuilt on every render from
  // today's map data. Lets the live records — which carry neither — be described
  // as new-or-returning and by device without a second round trip.
  var kindOf = {};
  var devOf = {};

  function px(lon){ return (lon + 180) / 360 * D.w; }
  function py(lat){ return (D.latTop - lat) / 360 * D.w; }

  // Several visitors from one city land on one pixel — merge them and size the dot
  // by how many, so a busy city reads as busy instead of as one anonymous point.
  function cluster(points) {
    var m = {};
    points.forEach(function (p) {
      if (p.lat == null || p.lon == null) return;
      var k = p.lat + '|' + p.lon + '|' + (p.approx ? 'a' : 'p');
      if (!m[k]) m[k] = { lat: p.lat, lon: p.lon, approx: p.approx, n: 0, names: {} };
      m[k].n++;
      var nm = (p.city ? p.city.replace(/_/g, ' ') : '') || p.cc;
      m[k].names[nm] = (m[k].names[nm] || 0) + 1;
    });
    return Object.keys(m).map(function (k) { return m[k]; });
  }

  function draw(layer, points, cls, halo, on) {
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    if (on === false) return;
    drawInto(layer, points, cls, halo);
  }

  /** Append a set of dots to a layer without clearing what is already there. */
  function drawInto(layer, points, cls, halo) {
    cluster(points).forEach(function (c) {
      var r = (2 + Math.min(7, Math.sqrt(c.n) * 1.7)) * zoom;
      var x = px(c.lon), y = py(c.lat);
      if (halo) {
        var h = document.createElementNS(NS, 'circle');
        h.setAttribute('cx', x); h.setAttribute('cy', y);
        h.setAttribute('class', 'halo'); h.setAttribute('r', (3 * zoom).toFixed(2));
        layer.appendChild(h);
      }
      var el = document.createElementNS(NS, 'circle');
      el.setAttribute('cx', x); el.setAttribute('cy', y); el.setAttribute('r', r.toFixed(2));
      el.setAttribute('class', 'pt ' + cls + (c.approx ? ' pt-approx' : ''));
      var names = Object.keys(c.names).sort(function (a, b) { return c.names[b] - c.names[a]; }).slice(0, 4).join(', ');
      var t = document.createElementNS(NS, 'title');
      t.textContent = names + ' — ' + c.n + (c.n === 1 ? ' επισκέπτης' : ' επισκέπτες') + (c.approx ? ' (μόνο χώρα)' : '');
      el.appendChild(t);
      layer.appendChild(el);
    });
  }

  /**
   * Split today's visitors into the three states the board names. Green wins by
   * construction: anyone currently online is never ALSO drawn as "left", so the
   * four counts add up to the people we saw and nobody is double-drawn.
   */
  function split() {
    var liveKeys = {};
    D.live.forEach(function (l) { liveKeys[l.h] = 1; });
    var gone = D.today.filter(function (p) { return !liveKeys[p.h]; });
    return {
      live: D.live,
      liveKeys: liveKeys,
      fresh: gone.filter(function (p) { return p.k === 'new'; }),
      // 'unk' = the browser blocks storage, so we genuinely cannot tell new from
      // returning. It rides in this layer but is drawn grey and counted separately,
      // rather than being silently filed as a returning visitor.
      back: gone.filter(function (p) { return p.k !== 'new'; }),
      unknown: gone.filter(function (p) { return p.k === 'unk'; }).length,
      old: D.earlier,
    };
  }

  function renderMap() {
    var s = split();
    draw(LO, s.old, 'pt-old', false, show.old);
    draw(LR, s.back.filter(function (p) { return p.k === 'ret'; }), 'pt-ret', false, show.ret);
    // Unknown-kind visitors share the layer but keep their own colour.
    if (show.ret) {
      var unk = s.back.filter(function (p) { return p.k === 'unk'; });
      if (unk.length) drawInto(LR, unk, 'pt-unk');
    }
    draw(LN, s.fresh, 'pt-new', false, show.new);
    draw(LL, s.live, 'pt-live', true, show.live);
  }

  function renderWho() {
    var ul = document.getElementById('whos');
    if (!D.live.length) { ul.innerHTML = '<li class="dim">Κανείς αυτή τη στιγμή. Ανανεώνεται κάθε 20 δευτ.</li>'; return; }
    ul.innerHTML = D.live
      .slice()
      .sort(function (a, b) { return b.m - a.m; })
      .slice(0, 40)
      .map(function (l) {
        var ago = Math.max(0, D.nowMin - l.m);
        var city = l.city ? l.city.replace(/_/g, ' ') : '';
        // City when we have one, country otherwise — never both the flag and the
        // country name, which used to read as "us ΗΠΑ".
        var where = city || l.name || l.cc;
        // New or returning, joined from today's map data by the same daily hash.
        var k = kindOf[l.h];
        var tag = k === 'new' ? '<i class="knew">νέος</i>' : k === 'ret' ? '<i class="kret">ξαναήρθε</i>' : '';
        var sub = (city ? l.name + ' · ' : '') + (l.section || '—');
        return '<li><span class="cc">' + esc(l.cc) + '</span>' +
          '<span class="who"><b>' + esc(where) + ' ' + tag + '</b><span>' + esc(sub) + '</span></span>' +
          '<span class="ago' + (ago > 1 ? ' cold' : '') + '">' + (ago <= 0 ? 'τώρα' : ago + 'λ') + '</span></li>';
      })
      .join('');
  }

  // ── statistics for exactly the people drawn on the map ─────────────────────
  // Not the window rollup: this counts the dots that are actually on screen, so
  // hiding a layer removes those people from the tables below too. That is what
  // "the visitors you can see" has to mean for the numbers to be trusted.

  var STATE_COLOR = { live: '#34d399', new: '#fbbf24', ret: '#f472b6', unk: '#94a3b8' };
  var STATE_NAME = { live: 'μέσα τώρα', new: 'νέοι', ret: 'παλιοί', unk: 'άγνωστοι' };
  var DEVICE_NAME = { mobile: '📱 Κινητό', desktop: '💻 Υπολογιστής', tablet: '📱 Tablet' };

  /** Every visitor currently rendered, tagged with the state that drew them. */
  function visible() {
    var s = split();
    var out = [];
    var push = function (arr, state) {
      arr.forEach(function (p) {
        out.push({
          state: state,
          cc: p.cc,
          city: p.city,
          name: p.name || D.names[p.cc] || p.cc,
          dev: p.d || devOf[p.h] || '',
        });
      });
    };
    if (show.live) {
      s.live.forEach(function (l) {
        out.push({ state: 'live', cc: l.cc, city: l.city, name: l.name, dev: devOf[l.h] || '' });
      });
    }
    if (show.new) push(s.fresh, 'new');
    if (show.ret) {
      push(s.back.filter(function (p) { return p.k === 'ret'; }), 'ret');
      push(s.back.filter(function (p) { return p.k === 'unk'; }), 'unk');
    }
    if (show.old) {
      // Earlier days keep their own new/returning label rather than collapsing
      // into one grey "old" bucket — that split is the whole question.
      ['new', 'ret', 'unk'].forEach(function (k) {
        push(s.old.filter(function (p) { return p.k === k; }), k === 'unk' ? 'unk' : k);
      });
    }
    return out;
  }

  /** Group by a key and count each state inside it, biggest group first. */
  function tally(rows, keyFn, labelFn) {
    var m = {};
    rows.forEach(function (r) {
      var k = keyFn(r);
      if (k === '' || k == null) return;
      if (!m[k]) m[k] = { label: labelFn(r, k), n: 0, live: 0, new: 0, ret: 0, unk: 0 };
      m[k].n++;
      m[k][r.state]++;
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.n - a.n; });
  }

  function splitRows(box, groups, limit) {
    if (!groups.length) { box.innerHTML = '<li class="dim">Κανείς ορατός</li>'; return; }
    var max = groups[0].n;
    box.innerHTML = groups.slice(0, limit).map(function (g) {
      var seg = ['live', 'new', 'ret', 'unk'].map(function (s) {
        return g[s] ? '<i style="width:' + ((g[s] / g.n) * 100).toFixed(1) + '%;background:' + STATE_COLOR[s] + '" title="' + g[s] + ' ' + STATE_NAME[s] + '"></i>' : '';
      }).join('');
      return '<li><span class="sl">' + esc(g.label) + '</span>' +
        '<span class="sb" style="width:' + Math.max(18, (g.n / max) * 100).toFixed(1) + '%">' + seg + '</span>' +
        '<span class="sn">' + g.n.toLocaleString('el-GR') + '</span></li>';
    }).join('');
  }

  function renderCohort() {
    var rows = visible();
    var total = rows.length;
    var counts = { live: 0, new: 0, ret: 0, unk: 0 };
    rows.forEach(function (r) { counts[r.state]++; });

    var scope = [];
    if (show.live) scope.push('μέσα τώρα');
    if (show.new) scope.push('νέοι');
    if (show.ret) scope.push('παλιοί');
    if (show.old) scope.push('προηγούμενες μέρες');
    document.getElementById('cohortScope').textContent =
      total + (total === 1 ? ' άνθρωπος' : ' άνθρωποι') + ' · ' +
      (scope.length === 4 ? 'όλα όσα δείχνει ο χάρτης' : scope.join(' + ') || 'τίποτα επιλεγμένο');

    var bar = document.getElementById('compo');
    bar.innerHTML = total
      ? ['live', 'new', 'ret', 'unk'].map(function (s) {
          if (!counts[s]) return '';
          var pct = (counts[s] / total) * 100;
          return '<i style="flex:' + counts[s] + ';background:' + STATE_COLOR[s] + '" title="' +
            counts[s] + ' ' + STATE_NAME[s] + '">' + (pct >= 9 ? Math.round(pct) + '%' : '') + '</i>';
        }).join('')
      : '';
    document.getElementById('compoKey').innerHTML = total
      ? ['live', 'new', 'ret', 'unk'].filter(function (s) { return counts[s]; }).map(function (s) {
          return '<span><i style="background:' + STATE_COLOR[s] + '"></i>' + STATE_NAME[s] +
            ' <b>' + counts[s].toLocaleString('el-GR') + '</b></span>';
        }).join('')
      : '<span class="dim">Δεν φαίνεται κανείς — άναψε ξανά ένα πλακίδιο.</span>';

    splitRows(document.getElementById('cohortCountries'),
      tally(rows, function (r) { return r.cc; }, function (r) { return r.cc + ' · ' + r.name; }), 12);
    splitRows(document.getElementById('cohortCities'),
      tally(rows, function (r) { return r.city; },
        function (r, k) { return k.replace(/_/g, ' ') + ' (' + r.cc + ')'; }), 12);
    splitRows(document.getElementById('cohortDevices'),
      tally(rows, function (r) { return r.dev; }, function (r, k) { return DEVICE_NAME[k] || k; }), 5);
  }

  function renderPulse() {
    var box = document.getElementById('pulse');
    var max = 1;
    D.pulse.forEach(function (v) { if (v > max) max = v; });
    box.innerHTML = D.pulse
      .map(function (v, i) {
        var h = Math.round((v / max) * 100);
        var cls = v === 0 ? 'zero' : i >= D.pulse.length - 2 ? 'now' : '';
        var ago = D.pulse.length - 1 - i;
        return '<i class="' + cls + '" style="height:' + (v === 0 ? 4 : Math.max(6, h)) + '%" title="' +
          (ago === 0 ? 'τώρα' : 'πριν ' + ago + ' λ.') + ' — ' + v + ' ενεργοί"></i>';
      })
      .join('');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function renderAll() {
    var n = D.live.length.toLocaleString('el-GR');
    document.getElementById('liveNum').textContent = n;
    document.getElementById('liveBadge').textContent = n + ' τώρα στο site';
    var cc = {};
    D.live.forEach(function (l) { cc[l.cc] = 1; });
    document.getElementById('liveCountries').textContent = Object.keys(cc).length;

    // The board: each cell states how many PEOPLE its layer stands for. (The dot
    // count is lower — several visitors from one city merge into one dot.)
    var s = split();
    kindOf = {};
    devOf = {};
    D.today.forEach(function (p) { kindOf[p.h] = p.k; devOf[p.h] = p.d; });
    var liveNew = D.live.filter(function (l) { return kindOf[l.h] === 'new'; }).length;
    var liveRet = D.live.filter(function (l) { return kindOf[l.h] === 'ret'; }).length;
    // Anyone whose browser blocks storage stays in their own bucket rather than
    // being counted as a returning visitor we never actually recognised.
    var liveUnk = D.live.length - liveNew - liveRet;

    set('lgLive', s.live.length);
    set('lgNew', s.fresh.length);
    set('lgRet', s.back.length);
    set('lgOld', s.old.length);
    document.getElementById('lgLiveSub').textContent = s.live.length
      ? liveNew + (liveNew === 1 ? ' νέος' : ' νέοι') + ' · ' + liveRet + ' ξαναήρθαν' +
        (liveUnk ? ' · ' + liveUnk + ' άγνωστο' : '')
      : 'κανείς αυτή τη στιγμή';
    document.getElementById('lgRetSub').textContent = s.unknown
      ? 'είχαν ξανάρθει — ' + s.unknown + ' χωρίς ένδειξη'
      : 'είχαν ξανάρθει';
    document.getElementById('lgOldSub').textContent = 'πριν από σήμερα, σε ' + D.mapDays + ' μέρες';

    renderMap(); renderWho(); renderPulse(); renderCohort();
  }

  function set(id, v) {
    document.getElementById(id).textContent = Number(v).toLocaleString('el-GR');
  }

  // The board doubles as the layer switch: tap a cell, that colour leaves the map.
  Array.prototype.forEach.call(document.querySelectorAll('.lg'), function (cell) {
    cell.addEventListener('click', function () {
      var key = cell.dataset.layer;
      show[key] = !show[key];
      cell.className = 'lg ' + (show[key] ? 'on' : 'off');
      cell.setAttribute('aria-pressed', String(show[key]));
      renderMap();
      renderCohort(); // the tables below describe the dots, so they move together
    });
  });

  // Tabs. The map view is the default — it answers "what is happening right now",
  // which is the reason to open this page at all. The choice is remembered.
  var TAB_KEY = 'cb_traffic_tab';
  var TABS = { map: 'tabMap', stats: 'tabStats', photos: 'tabPhotos', quality: 'tabQuality', search: 'tabSearch' };
  function showTab(name) {
    if (!TABS[name]) name = 'map';
    Object.keys(TABS).forEach(function (k) {
      document.getElementById(TABS[k]).hidden = k !== name;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      var on = t.dataset.tab === name;
      t.className = 'tab' + (on ? ' on' : '');
      t.setAttribute('aria-selected', String(on));
    });
    try { localStorage.setItem(TAB_KEY, name); } catch (e) {}
  }
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.addEventListener('click', function () { showTab(t.dataset.tab); });
  });
  // ?tab=photos wins over the remembered tab — that link is what the Telegram
  // alert points at, and "someone sent a photo" must land ON the photo, not on
  // whichever tab happened to be open last time.
  var wanted = (location.search.match(/[?&]tab=([a-z]+)/) || [])[1];
  if (!wanted) { try { wanted = localStorage.getItem(TAB_KEY); } catch (e) {} }
  showTab(TABS[wanted] ? wanted : 'map');

  // True full screen for the map stage — board and map together, so the numbers
  // stay readable instead of leaving a pretty but unlabelled globe.
  var stage = document.getElementById('mapStage');
  var fsBtn = document.getElementById('fsBtn');
  if (!stage.requestFullscreen) fsBtn.hidden = true;
  fsBtn.addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.requestFullscreen().catch(function () {});
  });
  document.addEventListener('fullscreenchange', function () {
    // Only the label — replacing the button's whole text would drop the glyph the
    // phone layout relies on.
    document.getElementById('fsLabel').textContent = document.fullscreenElement ? 'Έξοδος' : 'Πλήρης οθόνη';
  });

  // Zoom presets. Dot radii are recomputed against the new viewBox so a zoomed-in
  // map shows the same visual dot size, not a screenful of blobs.
  Array.prototype.forEach.call(document.querySelectorAll('.zooms button'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.zooms button'), function (o) { o.className = ''; });
      b.className = 'on';
      map.setAttribute('viewBox', b.dataset.vb);
      zoom = parseFloat(b.dataset.vb.split(' ')[2]) / D.w;
      LL.style.setProperty('--z', zoom);
      renderMap();
    });
  });

  // Auto-refresh only the live layer — the rest of the page is a daily rollup and
  // does not change second to second.
  function refresh() {
    var q = new URLSearchParams(location.search);
    q.set('format', 'live');
    fetch(location.pathname + '?' + q.toString(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        D.live = j.live; D.pulse = j.pulse; D.nowMin = j.nowMin;
        if (j.today) D.today = j.today;
        if (j.names) for (var c in j.names) D.names[c] = j.names[c];
        renderAll();
      })
      .catch(function () {});
  }

  renderAll();
  setInterval(refresh, 20000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });

  // Per-device opt-out, same as before: keeps the operator's own visits out.
  var K = 'cb_optout', btn = document.getElementById('optout');
  function paint() {
    var on = false;
    try { on = localStorage.getItem(K) === '1'; } catch (e) {}
    btn.className = 'chip' + (on ? ' on' : '');
    btn.textContent = on ? '✅ Αυτή η συσκευή ΔΕΝ μετριέται' : '🚫 Μην μετράς αυτή τη συσκευή';
  }
  btn.addEventListener('click', function () {
    try {
      if (localStorage.getItem(K) === '1') localStorage.removeItem(K); else localStorage.setItem(K, '1');
    } catch (e) { alert('Ο browser μπλοκάρει την αποθήκευση.'); }
    paint();
  });
  paint();
})();
</script>
</body></html>`;
};

// ── data collection ──────────────────────────────────────────────────────────

/** Every UTC day the counter actually has visitor data for, oldest first. */
const countedDays = async (store) => {
  const days = new Set();
  for await (const page of store.list({ prefix: 'd/', directories: true, paginate: true })) {
    for (const dir of page.directories || []) {
      const m = dir.match(/(\d{4}-\d{2}-\d{2})/);
      if (m) days.add(m[1]);
    }
    // Some Blobs versions return the blobs alongside; harvest the day from those too.
    for (const b of page.blobs || []) {
      const m = b.key.match(/^d\/(\d{4}-\d{2}-\d{2})\//);
      if (m) days.add(m[1]);
    }
  }
  return [...days].sort();
};

/** Read the presence keys: who is online, the per-minute pulse, and what to sweep. */
const readPresence = async (store, nowMin) => {
  const latest = new Map(); // hash → newest presence record
  const perMinute = new Map(); // minute → Set(hash)
  const stale = [];

  for await (const page of store.list({ prefix: 'live/', paginate: true })) {
    for (const b of page.blobs) {
      const m = b.key.match(/^live\/(\d+)\/(.*)$/);
      if (!m) continue;
      const minute = Number(m[1]);
      if (minute < nowMin - LIVE_KEEP_MINUTES) {
        if (stale.length < SWEEP_BUDGET) stale.push(b.key);
        continue;
      }
      const [hash, cc, lat, lon, city, section, approx] = m[2].split('~');
      if (minute > nowMin - 60) {
        if (!perMinute.has(minute)) perMinute.set(minute, new Set());
        perMinute.get(minute).add(hash);
      }
      if (minute >= nowMin - (LIVE_MINUTES - 1)) {
        const prev = latest.get(hash);
        if (!prev || prev.m < minute) {
          latest.set(hash, {
            h: hash,
            m: minute,
            cc: cc || '??',
            // Plain name, no flag emoji: the list already shows a country badge, and
            // Windows renders flag emoji as the bare letter pair anyway.
            name: COUNTRY_NAMES_EL[cc] || (cc && cc !== '??' ? cc : 'Άγνωστη χώρα'),
            city: city || '',
            section: section || '',
            lat: lat === '' || lat === undefined ? null : Number(lat),
            lon: lon === '' || lon === undefined ? null : Number(lon),
            approx: approx === 'a',
          });
        }
      }
    }
  }

  // 60 buckets, oldest → newest, so the bar chart reads left-to-right as time.
  const pulse = [];
  for (let i = 59; i >= 0; i--) {
    const set = perMinute.get(nowMin - i);
    pulse.push(set ? set.size : 0);
  }

  return { live: [...latest.values()], pulse, stale };
};

/** Map points for one day, straight out of the geo key names — zero blob reads. */
const readDayPoints = async (store, day) => {
  const seen = new Set();
  const out = [];
  for (const key of await listKeys(store, `geo/${day}/`)) {
    const rest = key.slice(`geo/${day}/`.length);
    const [hash, cc, lat, lon, city, device, kind, approx] = rest.split('~');
    if (seen.has(hash)) continue;
    seen.add(hash);
    if (lat === '' || lat === undefined) continue;
    out.push({
      h: hash,
      cc: cc || '??',
      lat: Number(lat),
      lon: Number(lon),
      city: city || '',
      // 'new' first ever visit, 'ret' been here before, 'unknown' storage blocked.
      // The map keeps the three apart instead of quietly filing unknown as returning.
      k: kind === 'new' ? 'new' : kind === 'ret' ? 'ret' : 'unk',
      d: device || '',
      approx: approx === 'a',
    });
  }
  return out;
};

/**
 * What visitors typed into OUR search box, across a range of days.
 *
 * Like the map above, everything is read out of the key names — one list() per
 * day, zero blob reads. Key shape (written by pageview.mjs):
 *   q/<day>/<term>~<1|0 found>~<daily visitor hash>
 *
 * The hash is only a de-duplicator inside the key; it is dropped here and never
 * leaves this function, so a term can never be traced back to a person or joined
 * to their other keys. What comes out is a word and two counts.
 *
 * `misses` is the column that earns this feature: a term people search and we
 * answer with an empty list is a gap in the product, stated by a visitor in their
 * own words. Search Console can never show it — by the time someone is typing in
 * our box, Google is already out of the picture.
 */
const readSearchTerms = async (store, days) => {
  const byTerm = new Map();
  for (const day of days) {
    const prefix = `q/${day}/`;
    for (const key of await listKeys(store, prefix)) {
      const rest = key.slice(prefix.length);
      // rsplit on '~': the term itself may legitimately contain no '~' (the
      // sanitiser strips it) but splitting from the right is still the safe read.
      const parts = rest.split('~');
      if (parts.length < 3) continue;
      parts.pop(); // visitor hash — deliberately discarded
      const found = parts.pop() === '1';
      const term = parts.join('~').replace(/_/g, ' ').trim();
      if (!term) continue;
      const row = byTerm.get(term) || { term, searches: 0, misses: 0 };
      row.searches += 1;
      if (!found) row.misses += 1;
      byTerm.set(term, row);
    }
  }
  const all = [...byTerm.values()];
  return {
    top: all.slice().sort((a, b) => b.searches - a.searches || a.term.localeCompare(b.term)).slice(0, 60),
    // Terms that mostly or always came back empty, busiest first. Anything with a
    // single search is noise at our volume, so it needs two before it is listed.
    gaps: all
      .filter(row => row.misses >= 2 && row.misses / row.searches >= 0.5)
      .sort((a, b) => b.misses - a.misses || a.term.localeCompare(b.term))
      .slice(0, 60),
    totalSearches: all.reduce((sum, row) => sum + row.searches, 0),
    totalMisses: all.reduce((sum, row) => sum + row.misses, 0),
    distinctTerms: all.length,
  };
};

// ── The moderation POST ──────────────────────────────────────────────────────
// Post/Redirect/Get: the decision is a POST, the answer is a redirect, so the
// browser's own refresh button can never approve the same photo twice. The flash
// travels back as a fixed code (`done=approved`), never as text — a message that
// came from a URL and gets printed into the page is how you build an XSS hole in
// your own admin console.
const moderationPost = async (event, key) => {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');
  const form = Object.fromEntries(new URLSearchParams(raw));

  // The key rides in the body as well as the query so a decision cannot be
  // triggered by a link someone was tricked into clicking.
  if (form.key !== key) {
    return { statusCode: 403, headers: { 'Content-Type': 'text/plain' }, body: 'Forbidden' };
  }

  // `beach` keeps the ordering panel open across the redirect, so pressing ↑ four
  // times is four presses rather than four presses and four navigations back.
  const back = (code, beach = '', tab = 'photos') => ({
    statusCode: 303,
    headers: {
      Location: `/api/traffic?key=${encodeURIComponent(key)}&tab=${tab}${
        beach ? `&beach=${encodeURIComponent(beach)}` : ''}&done=${code}`,
      'Cache-Control': 'no-store',
    },
    body: '',
  });

  // ── Τι λέει ο ΠΑΡΟΧΟΣ: δύο νούμερα από τη σελίδα του, στο χέρι ──────────────
  // See PROVIDER_SEED for why this is typed rather than fetched. Our own total is read
  // here, at submit time, so the pair describes one instant and the ratio between them
  // means something.
  if (form.action === 'provider-reading') {
    const backHome = (code) => ({
      statusCode: 303,
      headers: {
        Location: `/api/traffic?key=${encodeURIComponent(key)}&done=${code}`,
        'Cache-Control': 'no-store',
      },
      body: '',
    });

    // Greek keyboards and copy-paste from the dashboard both produce thousands
    // separators; "475.991" must not become 475.
    const digits = (value) => {
      const cleaned = String(value ?? '').replace(/[^\d]/g, '');
      return cleaned ? Number(cleaned) : null;
    };
    const total = digits(form.total);
    if (!total || total < 0) return backHome('capbad');

    const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

    try {
      const store = getStore('capacity');
      const saved = await store.get(PROVIDER_READINGS_KEY, { type: 'json' }).catch(() => null);
      const list = Array.isArray(saved?.readings) ? saved.readings : [];

      // Our number for the SAME moment. Read from the live meter, never typed — the
      // whole value of the pair is that nobody chose the two ends independently.
      let ours = null;
      try {
        const state = await store.get('open-meteo-day', { type: 'json' });
        const usage = monthlyUsage(state, {
          now: new Date(),
          cycleStartDay: Number(process.env.CAPACITY_CYCLE_START_DAY) || undefined,
          quota: MONTHLY_QUOTA,
        });
        ours = usage && usage.daysMeasured > 0 ? usage.used : null;
      } catch { /* a missing meter costs the ratio, not the reading */ }

      list.unshift({
        at: utcDayKey(new Date()),
        total,
        ours,
        day: isDay(form.day) ? String(form.day) : '',
        dayCalls: digits(form.dayCalls),
        dayRequests: digits(form.dayRequests),
        note: String(form.note || '').slice(0, 160).replace(/[\r\n]+/g, ' ').trim(),
      });

      await store.setJSON(PROVIDER_READINGS_KEY, { readings: list.slice(0, MAX_PROVIDER_READINGS) });
      return backHome('capsaved');
    } catch (error) {
      console.error('Could not store the provider reading.', error && error.message);
      return backHome('capbad');
    }
  }

  // ── Εκκρεμότητες: γράψ' το, κλείσ' το, σβήσ' το ─────────────────────────────
  if (form.action === 'todo-add' || form.action === 'todo-done' || form.action === 'todo-drop') {
    const regionId = String(form.region || '');
    const backTo = (code) => ({
      statusCode: 303,
      headers: {
        Location: `/api/traffic?key=${encodeURIComponent(key)}&tab=quality${
          regionId ? `&region=${encodeURIComponent(regionId)}` : ''
        }&done=${code}`,
        'Cache-Control': 'no-store',
      },
      body: '',
    });
    if (!LEDGER.regions.some((r) => r.id === regionId)) return backTo('checkfailed');

    try {
      const store = getStore(QUALITY_STORE);
      const all = (await store.get('todos', { type: 'json' }).catch(() => null)) || {};
      const list = Array.isArray(all[regionId]) ? all[regionId] : [];

      if (form.action === 'todo-add') {
        const text = String(form.text || '').slice(0, 200).replace(/[\r\n]+/g, ' ').trim();
        if (!text) return backTo('todoempty');
        // The beach is optional: some work is "this whole island needs photos"
        // and forcing it onto one beach would be a lie about where it belongs.
        const beachId = Number(form.beachId) || 0;
        const beach = beachId ? LEDGER.beachGaps.find((b) => b[0] === beachId) : null;
        list.unshift({
          id: `${Date.now().toString(36)}${list.length}`,
          text,
          at: utcDayKey(new Date()),
          beachId: beach ? beachId : 0,
          beachName: beach ? beach[1] : '',
          done: false,
        });
        // 60 per region is far past useful; past that it is a backlog nobody reads.
        all[regionId] = list.slice(0, 60);
      } else {
        const id = String(form.id || '');
        const index = list.findIndex((t) => t.id === id);
        if (index < 0) return backTo('checkfailed');
        if (form.action === 'todo-done') {
          // Closed, not deleted: "we did this on 14/08" is the record of work.
          list[index] = { ...list[index], done: true, doneAt: utcDayKey(new Date()) };
        } else {
          list.splice(index, 1); // typed it wrong — no point keeping it
        }
        all[regionId] = list;
      }

      await store.setJSON('todos', all);
      return backTo(form.action === 'todo-done' ? 'tododone' : 'todoadded');
    } catch (error) {
      console.error('Could not store a to-do.', error && error.message);
      return backTo('checkfailed');
    }
  }

  // ── "Το τσέκαρα" ───────────────────────────────────────────────────────────
  // The one thing on the quality tab that no script can derive: a person opened
  // this island and went through it. Everything else there is computed from
  // files; this is the entry that says a human was involved, so it is stored
  // separately from the traffic rollups and never expires.
  if (form.action === 'quality-check') {
    const regionId = String(form.region || '');
    // Land back on the region you just judged, with its history one line longer —
    // the same reason approving a photo lands on that beach's ordering screen.
    const backToRegion = (code) => ({
      statusCode: 303,
      headers: {
        Location: `/api/traffic?key=${encodeURIComponent(key)}&tab=quality&region=${encodeURIComponent(
          regionId
        )}&done=${code}`,
        'Cache-Control': 'no-store',
      },
      body: '',
    });
    if (!LEDGER.regions.some((r) => r.id === regionId)) return back('checkfailed', '', 'quality');

    // Only the six known axis keys survive, so nothing from a form can reach the
    // page as markup later — this text is rendered back on the board.
    const known = new Set(LEDGER.axes.map((a) => a.key));
    const params = new URLSearchParams(raw);
    const axesChecked = params.getAll('axis').filter((a) => known.has(a));
    const note = String(form.note || '').slice(0, 180).replace(/[\r\n]+/g, ' ').trim();

    try {
      const store = getStore(QUALITY_STORE);
      const existing = (await store.get('checks', { type: 'json' }).catch(() => null)) || {};
      const at = utcDayKey(new Date());
      // History is kept — five entries per region, newest first. "Last checked"
      // answers today's question; the trail answers "were we here in June too?".
      const previous = existing[regionId]?.history || [];
      existing[regionId] = {
        at,
        axes: axesChecked,
        note,
        history: [{ at, axes: axesChecked, note }, ...previous].slice(0, 5),
      };
      await store.setJSON('checks', existing);
      return backToRegion('checked');
    } catch (error) {
      console.error('Could not store a quality check.', error && error.message);
      return backToRegion('checkfailed');
    }
  }

  // ── Reordering one beach ───────────────────────────────────────────────────
  // Every one of these ends with the live index republished, because an order
  // that is only true in the database is not an order anybody can see.
  const MOVES = { 'move-up': 'up', 'move-down': 'down', 'move-first': 'first' };
  if (MOVES[form.action] || form.action === 'limit') {
    const regionId = form.region || '';
    const beachId = Number(form.beach);
    const ref = regionId && Number.isInteger(beachId) ? beachRef(regionId, beachId) : '';
    if (!ref) return back('failed');

    try {
      if (form.action === 'limit') {
        await setBeachPhotoLimit(getSupabaseConfig(), { regionId, beachId, maxShown: form.n });
      } else {
        await moveBeachPhoto(getSupabaseConfig(), {
          regionId, beachId, photoId: form.photoId, direction: MOVES[form.action],
        });
      }
      const live = await refreshApprovedPhotoIndex(getSupabaseConfig());
      return back(live.ok ? 'reordered' : 'reorderedNotLive', ref);
    } catch (error) {
      console.error('Reordering failed.', error && error.message);
      // The one failure with an obvious, actionable cause deserves its own words.
      // "Κάτι πήγε στραβά" for a migration nobody has run yet is an hour lost in
      // the function logs for something a single sentence answers.
      const text = String(error?.message || '');
      const needsMigration = /42703|42P01/.test(text)
        || (/does not exist/i.test(text) && /sort_order|beach_photo_settings/.test(text));
      return back(needsMigration ? 'nomigration' : 'failed', ref);
    }
  }

  // Rebuild the live index by hand — free, and the repair for anything approved
  // before 12/08/2026 or whose index upload failed. It only ever rewrites the file
  // from the approved rows, so pressing it twice does nothing the first press did
  // not already do.
  if (form.action === 'refresh-live') {
    const result = await refreshApprovedPhotoIndex(getSupabaseConfig());
    return back(result.ok ? 'refreshed' : 'failed');
  }

  // "Publish now" spends one Netlify build on purpose, and buys ONLY the static
  // pages — approvals are already live by the time this button is visible. See
  // ugc-admin.mjs for why there is no cron here.
  if (form.action === 'publish') {
    const hook = process.env.NETLIFY_BUILD_HOOK_URL || '';
    if (!hook) return back('nobuild');
    try {
      const response = await fetch(hook, { method: 'POST', body: '{}' });
      if (!response.ok) return back('failed');
      await clearPendingPublish(event);
      return back('built');
    } catch (error) {
      console.error('Build trigger failed.', error && error.message);
      return back('failed');
    }
  }

  const { kind, id, action } = form;
  if (!isKnownKind(kind) || !id || (action !== 'approve' && action !== 'reject')) {
    return back('failed');
  }

  try {
    const result = await moderate({ kind, id, action, event });
    if (result.alreadyDone) return back('already');

    // APPROVING A PHOTO LANDS YOU ON THAT BEACH'S ORDER, with the new photo in it.
    // This is the whole difference between "you can reorder photos" and "you do":
    // the moment you have just looked at a photo and judged it is the only moment
    // you know where it belongs among the others. A separate screen you have to
    // remember to open is a screen nobody opens.
    const item = result.item || {};
    const landing = kind === 'photo' && result.status === 'approved' && item.region_id
      ? beachRef(item.region_id, item.beach_id)
      : '';

    if (result.status !== 'approved') return back('rejected', landing);
    // Say which of the two publications happened. A photo whose live index upload
    // failed IS approved and WILL appear — at the next build — and telling you it
    // is on the site now would be the one wrong thing to say.
    return back(kind === 'photo' && !result.live?.ok ? 'approvedNotLive' : 'approved', landing);
  } catch (error) {
    console.error('Moderation failed.', error && error.message);
    return back('failed');
  }
};

/**
 * The pending queue, shaped for the page. Never throws: the traffic console must
 * still render every number it was opened for even when Supabase is unreachable.
 */
const readQueue = async (event) => {
  const empty = { configured: false, photos: [], reviews: [], signed: [], pendingPublish: null, problem: '' };
  if (!ugcConfigured()) return empty;

  try {
    const [photos, reviews, pendingPublish] = await Promise.all([
      listPending('photo'),
      listPending('review'),
      readPendingPublish(event).catch(() => null),
    ]);
    const [labelledPhotos, labelledReviews] = await Promise.all([
      withBeachLabels(photos),
      withBeachLabels(reviews),
    ]);
    // One signed URL per pending photo, minted server-side. The bucket stays
    // private; these links live in this page only and expire in an hour.
    const signed = await Promise.all(labelledPhotos.map((item) => (
      item.storage_path ? signPendingPhoto(item.storage_path, 3600).catch(() => '') : Promise.resolve('')
    )));
    return { configured: true, photos: labelledPhotos, reviews: labelledReviews, signed, pendingPublish, problem: '' };
  } catch (error) {
    console.error('Could not read the moderation queue.', error && error.message);
    return { ...empty, configured: true, problem: error.message || 'άγνωστο σφάλμα' };
  }
};

// ── The beach being curated ──────────────────────────────────────────────────
// `?beach=<regionId>:<beachId>` opens one beach's photo order above the queue.
// It is a QUERY PARAMETER rather than a stored "current beach" because that is
// what makes the approval flow work: approving a photo redirects here with that
// photo's own beach already selected, so the ordering screen is where you land
// rather than somewhere you have to remember to go.

/** `"lesvos:1352"` → `{ regionId, beachId }`, or null for anything else. */
const parseBeachRef = (raw) => {
  const value = String(raw || '');
  const at = value.lastIndexOf(':');
  if (at < 1) return null;
  const regionId = value.slice(0, at);
  const beachId = Number(value.slice(at + 1));
  if (!regionId || !Number.isInteger(beachId)) return null;
  return { regionId, beachId };
};

const beachRef = (regionId, beachId) => `${regionId}:${beachId}`;

const readCurating = async (raw) => {
  const ref = parseBeachRef(raw);
  if (!ref || !ugcConfigured()) return null;
  try {
    const [{ photos, maxShown }, name] = await Promise.all([
      listBeachPhotos(getSupabaseConfig(), ref.regionId, ref.beachId),
      beachLabel(ref.regionId, ref.beachId),
    ]);
    return { ...ref, photos, maxShown, name };
  } catch (error) {
    console.error('Could not read a beach photo order.', error && error.message);
    return { ...ref, photos: [], maxShown: 0, name: `Παραλία #${ref.beachId}`, problem: error.message || 'άγνωστο σφάλμα' };
  }
};

/**
 * The beaches you could go and rearrange. Best-effort: this is a convenience list,
 * and failing to build it must not cost you the moderation queue underneath it.
 */
const readPublishedBeaches = async () => {
  if (!ugcConfigured()) return [];
  try {
    const beaches = await listBeachesWithPhotos(getSupabaseConfig());
    return await Promise.all(beaches.map(async (beach) => ({
      ...beach,
      name: await beachLabel(beach.regionId, beach.beachId),
    })));
  } catch (error) {
    console.error('Could not list beaches with photos.', error && error.message);
    return [];
  }
};

/** Only ever a known code, so it can never carry markup into the page. */
const flashCode = (value) => (Object.prototype.hasOwnProperty.call(FLASH, value) ? value : '');

/**
 * The ONLY way this page reaches a browser — because the key has to be written
 * into it TWICE, in two different encodings, and doing that at each call site is
 * how the moderation buttons shipped broken on 11/08/2026:
 *
 *   KEYPLACEHOLDER — inside hrefs and form actions, so it must be URL-encoded.
 *   RAWFORMKEY     — a form input VALUE, which the browser URL-encodes on submit.
 *                    Encoding it here as well sends a double-encoded key that
 *                    matches nothing, and every decision comes back "Forbidden".
 *
 * One of the two call sites did the first substitution and not the second, so
 * the buttons posted the literal string "RAWFORMKEY" as the key. Both paths go
 * through here now; a new render path cannot forget half the job.
 */
const renderPage = (data, given) => page(data)
  .replace(/KEYPLACEHOLDER/g, encodeURIComponent(given))
  .replace(/RAWFORMKEY/g, esc(given));

/**
 * Read the forecast proxy's Open-Meteo meter and fold it into the billing cycle.
 *
 * Never throws and never blocks: a missing or malformed capacity blob must not take
 * down the console that shows the traffic. An unreadable meter reports as "not
 * measured yet", which is the truth, rather than as a zero — which would read as
 * "we have spent nothing" on exactly the screen where that lie is most expensive.
 *
 * The cycle anchor is env-tunable because the plan's billing day is the provider's
 * to decide, not ours: CAPACITY_CYCLE_START_DAY=1 turns this into a calendar month.
 */
const readCapacity = async () => {
  const cycleStartDay = Number(process.env.CAPACITY_CYCLE_START_DAY) || undefined;
  const now = new Date();
  const readings = await readProviderReadings();
  try {
    const state = await getStore('capacity').get('open-meteo-day', { type: 'json' });
    return { state, readings, usage: monthlyUsage(state, { now, cycleStartDay, quota: MONTHLY_QUOTA }) };
  } catch {
    return { state: null, readings, usage: monthlyUsage(null, { now, cycleStartDay, quota: MONTHLY_QUOTA }) };
  }
};

// ── What the PROVIDER says, typed in by hand — 14/08/2026 ─────────────────────
//
// Asked for directly: "connect the API key so the console pulls the real number instead of
// guessing". It cannot. The Open-Meteo key authenticates weather requests and nothing else;
// their usage page is a logged-in web app with no documented endpoint behind it, and they say
// themselves the usage portal is still being built. Driving it with stored credentials would
// be a scraper that breaks the first time they touch their markup — worse than honest.
//
// So the source of truth gets in the only way it can: he reads two numbers off their page and
// types them here. That is enough, because the useful thing was never the provider's number on
// its own — it is the RATIO between theirs and ours. Once a pair is recorded, our own meter
// (which updates every minute, for free) can be corrected by that factor and stops guessing.
// One reading a week keeps the correction honest.
//
// Our side of the pair is captured automatically at submit time, so the two numbers always
// describe the same instant. A pair assembled from a number read yesterday and a meter read
// today would produce a ratio that means nothing.
const PROVIDER_READINGS_KEY = 'open-meteo-provider';
const MAX_PROVIDER_READINGS = 40;

// The first reading, from the provider's own dashboard on 14/08/2026 — the day the gap was
// found. Seeded in code rather than left blank so the panel is useful on its very first paint,
// and because these three figures are the evidence the whole capacity investigation rests on.
// `ours: null` is deliberate and honest: our meter was still losing increments on those days,
// so there is no comparable figure to pair them with. The first real pair is the one HE enters.
const PROVIDER_SEED = [
  {
    at: '2026-08-14',
    total: 475991,
    ours: null,
    day: '2026-08-09',
    dayCalls: 29183,
    dayRequests: 1867,
    note: 'Πρώτη ανάγνωση — η μέρα που ξεκίνησε η συνδρομή.',
  },
];

const readProviderReadings = async () => {
  try {
    const saved = await getStore('capacity').get(PROVIDER_READINGS_KEY, { type: 'json' });
    const list = Array.isArray(saved?.readings) ? saved.readings : [];
    // Seed only while nothing has been entered — the moment he records one, his data owns
    // the panel and a constant in the source must not keep injecting itself into it.
    return list.length ? list : PROVIDER_SEED;
  } catch {
    return PROVIDER_SEED;
  }
};

/**
 * The hand-entered checks. Best-effort on purpose: the quality board is still
 * worth reading from the reports alone, so a Blobs hiccup must cost the manual
 * dates, not the whole tab.
 */
const readQualityChecks = async () => {
  try {
    return (await getStore(QUALITY_STORE).get('checks', { type: 'json' })) || {};
  } catch (error) {
    console.error('Could not read the quality checks.', error && error.message);
    return {};
  }
};

/**
 * The to-do list. Same store, separate key, because the two answer different
 * questions and have different lifetimes: a check is a dated event that never
 * changes, a to-do is open until somebody closes it.
 *
 * This is the part no script can produce. "47 beaches have no photo" is derived;
 * "the pin at Λιβάδι is 200m off, I saw it, fix it next round" is knowledge that
 * exists nowhere else and used to evaporate the moment a session ended.
 */
const readQualityTodos = async () => {
  try {
    return (await getStore(QUALITY_STORE).get('todos', { type: 'json' })) || {};
  } catch (error) {
    console.error('Could not read the quality to-dos.', error && error.message);
    return {};
  }
};

export const handler = async (event) => {
  const key = process.env.TRAFFIC_STATS_KEY || '';
  const params = event.queryStringParameters || {};
  const given = params.key || '';
  if (!key || given !== key) {
    return { statusCode: 403, headers: { 'Content-Type': 'text/plain' }, body: 'Forbidden' };
  }

  try {
    // Wire the Blobs environment from the Lambda event (see pageview.mjs).
    connectLambda(event);

    // Approve / reject / publish. Handled before anything is read, so a decision
    // never waits for a full day-scan of the traffic store.
    if (event.httpMethod === 'POST') return await moderationPost(event, key);

    // ?digest=1 — δες το εβδομαδιαίο μήνυμα ΤΩΡΑ, χωρίς να σταλεί σε κανέναν.
    //
    // Ζει εδώ και όχι στην ίδια τη quality-digest.mjs επειδή το Netlify απαντά 403
    // σε κάθε HTTP κλήση προς προγραμματισμένη συνάρτηση — δική μας ή ξένη. Χωρίς
    // αυτή τη γραμμή, το πρώτο μήνυμα που θα διαβάζαμε ποτέ θα ήταν το πρώτο που
    // στάλθηκε κιόλας. Ίδιο κλειδί, ίδια πύλη, καμία νέα πόρτα.
    if (params.digest) {
      const store = getStore(TRAFFIC_STORE);
      const days = Array.from({ length: 30 }, (_, i) => utcDayKey(new Date(Date.now() - i * 86400000)));
      const totals = await Promise.all(
        days.map((d) => store.get(`totals/${d}`, { type: 'json' }).catch(() => null))
      );
      const views = {};
      const pages = {};
      let measured = 0;
      for (const day of totals) {
        if (!day) continue;
        measured += 1;
        for (const [k, v] of Object.entries(day.views || {})) views[k] = (views[k] || 0) + v;
        for (const [k, v] of Object.entries(day.pages || {})) pages[k] = (pages[k] || 0) + v;
      }
      const [checks, todos] = await Promise.all([readQualityChecks(), readQualityTodos()]);
      const rows = buildQualityRows(views, checks);
      const beachRows = buildBeachGapRows(pages);
      const late = rows.filter((r) => r.overdue > 0).length;
      const openTodos = Object.values(todos || {}).flat().filter((t) => t && !t.done).length;
      const text = composeDigest({
        rows,
        beachRows,
        todos,
        measured,
        consoleUrl: `https://calmbeach.gr/api/traffic?key=${encodeURIComponent(key)}&tab=quality`,
      });
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow, noarchive',
        },
        body:
          `Αυτό θα σταλεί τη Δευτέρα: ${
            late > 0 || beachRows.length > 0 || openTodos > 0 ? 'ΝΑΙ' : 'ΟΧΙ — ήσυχη βδομάδα'
          }\n(καθυστερούν ${late} · σελίδες με κενό ${beachRows.length} · ανοιχτές σημειώσεις ${openTodos})\n\n` +
          `${text.replace(/<[^>]+>/g, '')}`,
      };
    }

    // ?capacity=1 — how close today is to the Open-Meteo free quota.
    //
    // This blob has been written on every proxy cache-miss since the edge proxy went
    // live, and until now NOTHING could read it: forecast.mjs was both the only
    // writer and the only reader. So when the 429 alarm fired on 29/07/2026 there was
    // no way to ask "how close were we?" — not even after the fact. One counter with
    // no dial is not monitoring. Lives here rather than in a new function because the
    // key gate, the Blobs wiring and the deploy already exist.
    if (event.queryStringParameters?.capacity) {
      const capacity = await readCapacity();
      const usage = capacity.usage;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({
          day: capacity.state?.day || utcDayKey(new Date()),
          // Points, not requests: one batched call can carry up to 32 coordinates and
          // the provider charges the work, not the HTTP request. Marine points are
          // weighted ×2.1 because the provider prices variables, not requests.
          pointsToday: usage.today,
          refusedToday: capacity.state?.rateLimited || 0,
          // The bucket that actually matters: the plan is 1,000,000 per MONTH.
          monthlyQuota: usage.quota,
          usedThisCycle: usage.used,
          remainingThisCycle: usage.remaining,
          percentOfMonthlyQuota: usage.percent,
          cycle: { start: usage.cycleStart, end: usage.cycleEnd, day: usage.dayIndex, of: usage.cycleDays },
          avgPerDay: usage.avgPerDay,
          projectedEndOfCycle: usage.projected,
          willExceed: usage.willExceed,
          // Days of this cycle we have real numbers for. Anything before
          // `measuringSince` predates the ledger and is UNKNOWN, not zero.
          daysMeasured: usage.daysMeasured,
          measuringSince: usage.measuringSince,
          dailyAverageBudget: DAILY_BUDGET,
          dailyThresholds: DEFAULT_THRESHOLDS,
          alerted: {
            amber: Boolean(capacity.state?.alertedAmber),
            red: Boolean(capacity.state?.alertedRed),
            rateLimited: Boolean(capacity.state?.alerted429),
          },
          perDay: usage.perDay,
          // Reminder for whoever reads this at 3am: the monthly bucket is rarely what
          // bites first. Open-Meteo also enforces short-window rate limits.
          note: 'A 429 with a low percentOfMonthlyQuota means a burst hit a rate limit, not exhaustion. `usedThisCycle` is a floor: lost increments and pre-ledger days are missing, never invented.',
        }, null, 2),
      };
    }

    const store = getStore(TRAFFIC_STORE);
    const now = new Date();
    const nowMin = Math.floor(now.getTime() / 60000);
    const todayKey = utcDayKey(now);

    // Admin: remove ONE COUNTRY's visitors from one day, instead of wiping the day.
    // Written 02/08/2026 after a bot flood filed ~4.000 fake "unique visitors" under
    // US on 01/08 (the counter said 6.937 uniques; GA4 said 82 real users the same
    // day). `reset` below would have thrown away that day's real visitors too.
    //
    // WHY THIS CAN BE EXACT: the map key carries the country, city, device and
    // new/returning flag in the key itself (`geo/<day>/<hash>~cc~lat~lon~city~…`),
    // so we can find exactly which visitor blobs to delete and subtract exactly the
    // right amount from those four breakdowns in the day rollup.
    //
    // WHAT IT CANNOT FIX, and the report says so out loud: pageviews (`hits`), the
    // referrer/channel/browser/OS/language/viewport breakdowns and dwell are stored
    // only as day-level sums with nothing tying a count back to a visitor. Those
    // stay inflated for the purged day. The unique count, the map and the four
    // breakdowns above become correct.
    //
    // Safe by default: without `&confirm=1` this only REPORTS what it would remove.
    //   /api/traffic?key=…&purge=2026-08-01&cc=US            → preview
    //   /api/traffic?key=…&purge=2026-08-01&cc=US&confirm=1  → actually delete
    if (params.purge) {
      const day = /^\d{4}-\d{2}-\d{2}$/.test(params.purge) ? params.purge : null;
      if (!day) {
        return { statusCode: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: 'purge must be YYYY-MM-DD' };
      }
      const wanted = new Set(
        String(params.cc || '')
          .split(',')
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean)
      );
      if (!wanted.size) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          body: 'Λείπει το &cc= (π.χ. &cc=US ή &cc=US,CA). Χωρίς αυτό δεν σβήνω τίποτα.',
        };
      }

      // One pass over the day's map keys: decide who goes, and remember exactly what
      // each of them contributed to the breakdowns we can correct.
      const geoKeys = await listKeys(store, `geo/${day}/`);
      const doomed = new Map(); // hash → { cc, city, device, kind, keys: [] }
      for (const key of geoKeys) {
        const rest = key.slice(`geo/${day}/`.length);
        const [hash, cc, , , city, device, kind] = rest.split('~');
        if (!wanted.has(String(cc || '').toUpperCase())) continue;
        const prev = doomed.get(hash);
        if (prev) {
          prev.keys.push(key);
          continue;
        }
        doomed.set(hash, { cc, city: city || '', device: device || '', kind, keys: [key] });
      }

      const totalUnique = (await listKeys(store, `d/${day}/`)).length;
      const summary =
        `Ημέρα ${day} · χώρες ${[...wanted].join(', ')}\n` +
        `Θα αφαιρεθούν ${doomed.size} από ${totalUnique} μοναδικούς επισκέπτες` +
        ` (μένουν ${totalUnique - doomed.size}).\n`;

      if (params.confirm !== '1') {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
          body:
            `ΠΡΟΕΠΙΣΚΟΠΗΣΗ — δεν σβήστηκε τίποτα.\n\n${summary}\n` +
            `Για να γίνει στ' αλήθεια, ξαναφόρτωσε με &confirm=1 στο τέλος.\n` +
            `Δεν διορθώνονται: προβολές σελίδων, πηγές, browser, γλώσσα, χρόνος — μένουν φουσκωμένα γι' αυτή τη μέρα.`,
        };
      }

      let deleted = 0;
      for (const [hash, info] of doomed) {
        for (const k of info.keys) {
          await store.delete(k);
          deleted += 1;
        }
        await store.delete(`d/${day}/${hash}`);
        deleted += 1;
      }

      // Subtract exactly what the purged visitors added to the breakdowns that the
      // map key lets us attribute. Never let a counter go negative — a stored total
      // can predate a metric, and a negative would render as a nonsense bar.
      const drop = (obj, k, by = 1) => {
        if (!obj || !k || !obj[k]) return;
        obj[k] = Math.max(0, obj[k] - by);
        if (!obj[k]) delete obj[k];
      };
      const totals = (await store.get(`totals/${day}`, { type: 'json' })) || null;
      if (totals) {
        for (const info of doomed.values()) {
          drop(totals.countries, info.cc);
          if (info.city) drop(totals.cities, `${info.cc}/${info.city}`);
          drop(totals.devices, info.device);
          drop(totals.kinds, info.kind === 'new' ? 'new' : info.kind === 'ret' ? 'ret' : 'unknown');
        }
        totals.purged = (totals.purged || 0) + doomed.size;
        await store.setJSON(`totals/${day}`, totals);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        body:
          `ΕΓΙΝΕ.\n\n${summary}` +
          `Διαγράφηκαν ${deleted} εγγραφές. Διορθώθηκαν: μοναδικοί, χάρτης, χώρες, πόλεις, συσκευές, νέοι/παλιοί.\n` +
          `ΔΕΝ διορθώθηκαν (δεν αποθηκεύονται ανά επισκέπτη): προβολές σελίδων, πηγές, κανάλι, browser, λειτουργικό, γλώσσα, οθόνη, χρόνος.`,
      };
    }

    // Admin: wipe one day's data (operator use only — key-gated). Used to clear a
    // contaminated day (e.g. launch-day test traffic) so counting restarts clean.
    // Since visitor hashes are irreversible we cannot delete selectively, so this
    // removes the WHOLE day; real visitors after the reset are counted fresh.
    // Prefer `&purge=` above when only one country is contaminated.
    if (params.reset) {
      const day = /^\d{4}-\d{2}-\d{2}$/.test(params.reset) ? params.reset : null;
      if (!day) {
        return { statusCode: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: 'reset must be YYYY-MM-DD' };
      }
      let deleted = 0;
      for (const prefix of [`d/${day}/`, `geo/${day}/`]) {
        for (const k of await listKeys(store, prefix)) {
          await store.delete(k);
          deleted += 1;
        }
      }
      await store.delete(`totals/${day}`);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        body: `Reset ${day}: διαγράφηκαν ${deleted} εγγραφές + το rollup. Μετράει καθαρά από τώρα.`,
      };
    }

    const presence = await readPresence(store, nowMin);

    // The auto-refresh path: live layer only, no day scan.
    if (params.format === 'live') {
      // Sweep stale presence keys here too — this runs far more often than a full load.
      await mapLimit(presence.stale.slice(0, 120), 8, (k) => store.delete(k).catch(() => {}));
      const todayPoints = await readDayPoints(store, todayKey);
      // Names travel with the refresh too: a country that only turns up after the
      // page loaded would otherwise be labelled with its bare two-letter code.
      const names = {};
      for (const p of [...presence.live, ...todayPoints]) {
        names[p.cc] = COUNTRY_NAMES_EL[p.cc] || (p.cc && p.cc !== '??' ? p.cc : 'Άγνωστη');
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ live: presence.live, pulse: presence.pulse, nowMin, today: todayPoints, names }),
      };
    }

    // ── the window: only days we actually counted ──────────────────────────────
    const counted = await countedDays(store);
    if (!counted.length) {
      return {
        statusCode: 200,
        headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        // The page now carries un-approved photos of other people's holidays. The
        // <meta robots> tag was enough for a page of numbers; a header is what a
        // crawler that never parses the HTML obeys.
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
        body: renderPage({
          rows: [], totals: {}, days: 0, startDay: todayKey,
          live: presence.live, pulse: presence.pulse, todayPoints: [], earlierPoints: [], mapDays: 0, nowMin,
          queue: await readQueue(event), flash: flashCode(params.done),
          curating: await readCurating(params.beach),
          publishedBeaches: await readPublishedBeaches(),
          // Zero visitors does not mean zero weather calls — the prerendered pages and
          // the CDN keep the proxy busy, so the quota still belongs on an empty console.
          capacity: await readCapacity(),
          // The quality board does not depend on anyone having visited: with no
          // traffic every region simply falls into the slowest re-check tier.
          qualityChecks: await readQualityChecks(),
          qualityFocus: params.region || '',
          qualityTodos: await readQualityTodos(),
        }, given),
      };
    }

    const startDay = counted[0];
    // Every day from the first counted one to today — INCLUDING days with nobody on
    // them. A zero after counting started is a real zero and belongs on the chart;
    // only the days before the counter existed are omitted (that is the whole point
    // of deriving startDay from the store instead of subtracting 30 from today).
    const allDays = [];
    const lastMs = Date.parse(`${todayKey}T00:00:00Z`);
    for (let t = Date.parse(`${startDay}T00:00:00Z`); t <= lastMs && allDays.length < 400; t += 86400000) {
      allDays.push(utcDayKey(new Date(t)));
    }
    const requested = Number(params.days);
    const limit = Math.min(90, Math.max(1, Number.isFinite(requested) && requested > 0 ? requested : 90));
    const windowDays = allDays.slice(-limit).reverse(); // newest first

    const merged = {
      refs: {}, channels: {}, sections: {}, views: {}, pages: {}, devices: {},
      browsers: {}, os: {}, countries: {}, cities: {}, langs: {}, viewports: {},
      hours: {}, types: {}, actions: {}, activity: {}, funnel: {},
    };
    const mergeInto = (target, src) => {
      for (const [k, v] of Object.entries(src || {})) target[k] = (target[k] || 0) + v;
    };

    // Map points cost one list() per day, so only the freshest slice feeds the map —
    // older dots would just pile onto the same cities anyway.
    const MAP_DAYS = 10;
    const mapDays = windowDays.slice(0, MAP_DAYS);

    const perDay = await mapLimit(windowDays, 6, async (day) => {
      const [visitorKeys, dayTotals, points] = await Promise.all([
        listKeys(store, `d/${day}/`),
        store.get(`totals/${day}`, { type: 'json' }).catch(() => null),
        mapDays.includes(day) ? readDayPoints(store, day) : Promise.resolve(null),
      ]);
      return { day, unique: visitorKeys.length, totals: dayTotals || {}, points };
    });

    const rows = [];
    let todayPoints = [];
    const earlierPoints = [];
    for (const d of perDay) {
      const t = d.totals;
      mergeInto(merged.refs, t.refs);
      mergeInto(merged.channels, t.channels);
      mergeInto(merged.sections, t.sections);
      mergeInto(merged.views, t.views);
      mergeInto(merged.pages, t.pages);
      mergeInto(merged.devices, t.devices);
      mergeInto(merged.browsers, t.browsers);
      mergeInto(merged.os, t.os);
      mergeInto(merged.countries, t.countries);
      mergeInto(merged.cities, t.cities);
      mergeInto(merged.langs, t.langs);
      mergeInto(merged.viewports, t.viewports);
      mergeInto(merged.hours, t.hours);
      mergeInto(merged.types, t.types);
      mergeInto(merged.actions, t.actions);
      mergeInto(merged.activity, t.activity);
      mergeInto(merged.funnel, t.funnel);

      const kinds = t.kinds || {};
      rows.push({
        day: d.day,
        unique: d.unique,
        hits: t.hits || 0,
        newV: kinds.new || 0,
        retV: kinds.ret || 0,
        // Storage-blocked visitors are their own bucket now: lumping them into
        // "returning" (as this used to) invented returning visitors out of nothing.
        unkV: kinds.unknown || 0,
        dwellSec: t.dwellSec || 0,
        engaged: t.engaged || 0,
        multiPage: t.multiPage || 0,
      });

      if (d.points) {
        if (d.day === todayKey) todayPoints = d.points;
        else earlierPoints.push(...d.points);
      }
    }

    // Housekeeping while we are here: drop presence keys nobody will ever read.
    await mapLimit(presence.stale, 8, (k) => store.delete(k).catch(() => {}));

    if (params.format === 'json') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify(
          { startDay, days: windowDays.length, rows, breakdowns: merged, live: presence.live, pulse: presence.pulse },
          null,
          2
        ),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        // The page now carries un-approved photos of other people's holidays. The
        // <meta robots> tag was enough for a page of numbers; a header is what a
        // crawler that never parses the HTML obeys.
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
      body: renderPage({
        rows,
        totals: merged,
        days: limit,
        startDay,
        live: presence.live,
        pulse: presence.pulse,
        todayPoints,
        earlierPoints,
        mapDays: Math.max(0, mapDays.length - 1),
        nowMin,
        queue: await readQueue(event),
        flash: flashCode(params.done),
        curating: await readCurating(params.beach),
        publishedBeaches: await readPublishedBeaches(),
        capacity: await readCapacity(),
        qualityChecks: await readQualityChecks(),
        qualityFocus: params.region || '',
        qualityTodos: await readQualityTodos(),
        // Read over the same day window as everything else on the page, so the
        // search numbers and the visitor numbers always describe one period.
        searchTerms: await readSearchTerms(store, windowDays).catch(() => null),
      }, given),
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
