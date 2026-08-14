// ─────────────────────────────────────────────────────────────────────────────
// QUALITY PRIORITY — the one place that decides which region needs attention.
//
// Lives in its own file because TWO things ask the question now: the console tab
// a person opens, and the weekly Telegram digest that arrives whether or not
// anyone opens anything. Two copies of this arithmetic would drift within a
// month, and a message that names a different island than the board is worse
// than no message — we have made exactly that mistake before ("Δες 6" showing
// zero results, because the button judged by a different rule than the list).
//
// Pure functions, no rendering, no Blobs: given the numbers, it returns the
// order. Everything visual stays in traffic-stats.mjs.
// ─────────────────────────────────────────────────────────────────────────────
import LEDGER from './qualityLedger.generated.mjs';

export const DAY_MS = 86400000;

/** Whole days between an ISO day and today; null when there is no date at all. */
export const daysSince = (isoDay) => {
  if (!isoDay) return null;
  const then = Date.parse(`${isoDay}T00:00:00Z`);
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / DAY_MS));
};

/** "πριν 51 μέρες" / "σήμερα" — the only date format worth reading on a board. */
export const agoLabel = (isoDay) => {
  const d = daysSince(isoDay);
  if (d === null) return 'ποτέ';
  if (d === 0) return 'σήμερα';
  if (d === 1) return 'χθες';
  if (d < 60) return `πριν ${d} μέρες`;
  const months = Math.round(d / 30);
  return months < 24 ? `πριν ${months} μήνες` : `πριν ${Math.round(d / 365)} χρόνια`;
};

/**
 * How often a region deserves a fresh look, derived from where its traffic sits
 * rather than from a number somebody picked.
 *
 * Half of all pageviews land on a handful of islands; those get re-checked four
 * times as often as the tail. Fixed intervals ("every 90 days for everyone")
 * would have us re-reading an island with 3 visitors a month at the same rate as
 * one with 3.000 — which is how a maintenance list becomes something nobody opens.
 */
export const DUE_TIERS = [
  { key: 'hot', days: 60, label: 'πολλή κίνηση' },
  { key: 'warm', days: 120, label: 'μεσαία κίνηση' },
  { key: 'cool', days: 240, label: 'λίγη κίνηση' },
  { key: 'cold', days: 365, label: 'σχεδόν καθόλου' },
];

/**
 * The board's rows. Everything that decides an order is computed here so the
 * markup below stays a description of the answer rather than part of it.
 */
export const buildQualityRows = (views, checks) => {
  // services/pageviewBeacon.ts trims the section to 32 characters before sending
  // it, so twelve of the longest region ids (Χαλκιδική, Καβάλα, Έβρος…) arrive
  // truncated. Matching on the exact id alone silently reported "καμία προβολή"
  // for exactly the mainland regions that get the most summer traffic. No id
  // collides at 32 characters, so the trimmed key is safe to accept as the same
  // region.
  //
  // 14/08/2026: the id was never the key. `sectionFromPath` takes segment 1 of
  // /beaches/<slug>/…, so what actually lands in the rollup is "chania", not
  // "crete-crete-chania" — and every one of the 110 regions read as "καμία προβολή",
  // which quietly removed traffic from the ranking below and left it deciding on gaps
  // alone. The ledger now carries the same `slug` the app puts in the URL; the id and
  // the truncated id stay as fallbacks so older rollups still count.
  const viewsOf = (region) => {
    const keys = [region.slug, region.id, region.id.slice(0, 32)].filter(Boolean);
    for (const k of keys) if (views?.[k] != null) return Number(views[k]) || 0;
    return 0;
  };
  const totalViews = LEDGER.regions.reduce((sum, r) => sum + viewsOf(r), 0);

  // Tier by CUMULATIVE share, so the split follows the actual shape of the
  // traffic instead of a percentile that assumes it is evenly spread.
  const ranked = [...LEDGER.regions].sort((a, b) => viewsOf(b) - viewsOf(a));
  const tierOf = new Map();
  let running = 0;
  for (const region of ranked) {
    const v = viewsOf(region);
    if (!v) {
      tierOf.set(region.id, DUE_TIERS[3]);
      continue;
    }
    const before = totalViews ? running / totalViews : 1;
    running += v;
    tierOf.set(region.id, before < 0.5 ? DUE_TIERS[0] : before < 0.9 ? DUE_TIERS[1] : DUE_TIERS[2]);
  }

  return LEDGER.regions
    .map((region) => {
      const manual = checks?.[region.id] || null;
      // A hand-written "I checked it" outranks any report date: it is the only
      // entry that means a person looked, and it is the reason the button exists.
      const lastAt = [region.lastTargetedAt, manual?.at].reduce(
        (acc, d) => (!acc || (d && d > acc) ? d || acc : acc),
        ''
      );
      const age = daysSince(lastAt);
      const tier = tierOf.get(region.id) || DUE_TIERS[3];
      // Never checked = as overdue as the interval itself, not infinitely overdue:
      // otherwise 30 empty islands bury the busy one that is two weeks late.
      const overdue = age === null ? tier.days : age - tier.days;

      const axes = LEDGER.axes.map((axis) => {
        const a = region.axes[axis.key] || { ok: 0, total: 0, at: '' };
        return { ...axis, ...a, pct: a.total ? Math.round((a.ok / a.total) * 100) : 0, missing: a.total - a.ok };
      });
      const covered = axes.reduce((sum, a) => sum + a.pct, 0) / (axes.length || 1);

      // ── the order of the list ───────────────────────────────────────────────
      // The first version ranked by "days overdue" alone, and because almost
      // nothing was overdue it ranked everything at zero and fell back to
      // alphabetical — a list headed by Αγαθονήσι, which nobody visits. Useless.
      //
      // The second version fixed that but ranked Ερείκουσα (2 beaches, 1 without
      // a photo) above Εύβοια (86 without a photo), because a percentage says
      // nothing about how much work is actually sitting there. So volume counts
      // too. Four factors multiplied, none of them ever zero:
      //   ripeness — how far through its own re-check interval this region is
      //   traffic  — log-scaled, so 2.000 views weighs ~3× a hundred, not 20×
      //   gapShare — what fraction of this region we still do not know
      //   volume   — how many beaches that actually is, log-scaled
      // A region with no visitors keeps a small floor instead of disappearing:
      // it should sink, not vanish, or nothing quiet ever gets fixed.
      const ripeness = age === null ? 1.2 : Math.min(2.5, age / tier.days);
      const traffic = Math.log10(1 + viewsOf(region));
      const gapWeight = (100 - covered) / 100;
      const missingBeaches = axes.reduce((sum, a) => sum + a.missing, 0);
      const volume = Math.log10(1 + missingBeaches);

      return {
        ...region,
        views: viewsOf(region),
        share: totalViews ? viewsOf(region) / totalViews : 0,
        tier,
        lastAt,
        age,
        manual,
        overdue,
        axes,
        covered: Math.round(covered),
        missingBeaches,
        priority: (0.3 + traffic) * (0.25 + ripeness) * (0.4 + gapWeight) * (0.5 + volume),
      };
    })
    .sort((a, b) => b.priority - a.priority);
};

/**
 * ΟΙ ΠΑΡΑΛΙΕΣ ΠΟΥ ΤΙΣ ΒΛΕΠΟΥΝ ΚΑΙ ΤΟΥΣ ΛΕΙΠΕΙ ΚΑΤΙ
 *
 * The region board says which island to open next. This says which BEACH, and it
 * is the sharper of the two: an island average hides the one page with 300 views
 * and no photograph. Same join, one level down.
 *
 * The beach id is read out of the recorded path. Detail URLs are built as
 * `/[locale]/beaches/<regionSlug>/<id>-<slug>/` (utils/beachUrls.ts), and the
 * beacon trims paths to 64 characters — the id always survives, because it sits
 * before the long half. Ids are unique nationally, so the region slug in the
 * middle is not needed and the Greek/German/French variants of the same page all
 * fold onto the same beach instead of splitting its count four ways.
 */
export const BEACH_PATH = /\/beaches\/[^/]+\/(\d+)-/;

export const buildBeachGapRows = (pages) => {
  if (!pages) return [];

  const viewsById = new Map();
  for (const [path, count] of Object.entries(pages)) {
    const m = BEACH_PATH.exec(path);
    if (!m) continue;
    const id = Number(m[1]);
    viewsById.set(id, (viewsById.get(id) || 0) + Number(count || 0));
  }
  if (!viewsById.size) return [];

  const rows = [];
  for (const [id, name, regionIndex, mask] of LEDGER.beachGaps) {
    const views = viewsById.get(id);
    if (!views) continue; // nobody opened it — it belongs to the region board, not here
    rows.push({
      id,
      name,
      region: LEDGER.regions[regionIndex]?.label || '',
      regionId: LEDGER.regions[regionIndex]?.id || '',
      views,
      missing: LEDGER.axes.filter((a) => mask & LEDGER.axisBits[a.key]),
    });
  }

  // Views first, then how much is missing: the top of this list is where a fix
  // buys the most, and that is views × gaps, not either one alone.
  return rows.sort((a, b) => b.views * (1 + b.missing.length) - a.views * (1 + a.missing.length));
};
