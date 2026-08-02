// ─────────────────────────────────────────────────────────────────────────────
// Capacity alarm — PURE decision logic (no I/O), so it can be unit-tested.
// The forecast proxy is the single choke point for real upstream Open-Meteo
// calls, so it is where we meter usage against the free quota and raise alarms.
//
// Two independent signals:
//   • a per-UTC-day counter → amber at ~5k, red at ~7k (advance warning), and
//   • an upstream HTTP 429 → the definitive "we hit the wall" (fires immediately).
// Each alarm fires at most once per day per level (dedup flags live in the state).
//
// Counting is best-effort: concurrent cache-misses can lose an increment, so the
// count is a slight UNDER-estimate — fine for an alarm (it errs toward firing a
// touch late, never early on noise).
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_THRESHOLDS = Object.freeze({ amber: 5000, red: 7000 });

/** UTC day key, e.g. "2026-07-20". Pass the date in (keeps this module pure/testable). */
export const utcDayKey = (date) => date.toISOString().slice(0, 10);

/** A fresh, zeroed state for a given day. */
const freshState = (dayKey) => ({
  day: dayKey,
  count: 0,
  /** Of `count`, how much was refused with a 429 rather than served. */
  rateLimited: 0,
  alertedAmber: false,
  alertedRed: false,
  alerted429: false,
});

/** Return `prev` if it's for today, else a fresh state (handles day rollover). */
export const stateForDay = (prev, dayKey) =>
  prev && prev.day === dayKey ? { ...freshState(dayKey), ...prev, day: dayKey } : freshState(dayKey);

/**
 * Fold `increment` real upstream calls into the day's state and detect a newly
 * crossed threshold. Returns { next, crossed } where crossed ∈ {null,'amber','red'}.
 */
export function recordCalls(prev, dayKey, increment, thresholds = DEFAULT_THRESHOLDS) {
  const next = stateForDay(prev, dayKey);
  next.count += Math.max(0, increment | 0);

  let crossed = null;
  if (!next.alertedRed && next.count >= thresholds.red) {
    crossed = 'red';
    next.alertedRed = true;
    next.alertedAmber = true; // red implies amber already covered
  } else if (!next.alertedAmber && next.count >= thresholds.amber) {
    crossed = 'amber';
    next.alertedAmber = true;
  }
  return { next, crossed };
}

/**
 * Mark that upstream returned 429 (rate limited). Fires once per day.
 * Returns { next, fire }.
 *
 * `increment` is the number of points that call carried, so a refusal still moves
 * the counter. It used to only raise a flag, which made the alarm unanswerable:
 * the message could not say WHERE we were when the wall arrived, and no endpoint
 * read the blob afterwards either. On 29/07/2026 that produced a "quota exhausted"
 * alert while the daily bucket sat at roughly a quarter — the number would have
 * said so immediately. Also tracked separately in `rateLimited`, because a refused
 * call and a served call are not the same event even though both cost us.
 */
export function recordRateLimited(prev, dayKey, increment = 1) {
  const next = stateForDay(prev, dayKey);
  const points = Math.max(1, increment | 0);
  next.count += points;
  next.rateLimited = (next.rateLimited || 0) + points;
  if (next.alerted429) return { next, fire: false };
  next.alerted429 = true;
  return { next, fire: true };
}

/** Telegram message body for a threshold/429 alarm — Greek, severity-tagged, with a "what to do" line. */
export function formatCapacityAlert(level, count, thresholds = DEFAULT_THRESHOLDS) {
  if (level === 'rate_limited') {
    // Deliberately no longer says "the free quota is exhausted". That was our own
    // wording, not the provider's, and on 29/07/2026 it was wrong: Open-Meteo also
    // enforces per-minute (~600) and per-hour (~5,000) limits, so a burst refuses
    // calls with the daily bucket barely touched. The count now travels with the
    // message so the first question — how close were we? — is already answered.
    const share = Math.round((count / 10000) * 100);
    return '🔴 ΚΡΙΣΙΜΟ — δράσε τώρα\n' +
      '<b>Χωρητικότητα: το Open-Meteo αρνήθηκε κλήση</b>\n' +
      `Σημερινές μετρημένες κλήσεις: <b>${count}</b> (~${share}% του ~10.000/ημέρα δωρεάν ορίου).\n` +
      (share < 50
        ? 'Είμαστε μακριά από το ημερήσιο όριο, άρα πιθανότατα χτυπήσαμε το όριο ανά λεπτό ' +
          '(~600) ή ανά ώρα (~5.000) — μια ξαφνική αιχμή, όχι εξάντληση. Δες τι προκάλεσε το μπαράζ.'
        : 'Είμαστε επίσης κοντά στο ημερήσιο όριο — μπορεί να είναι πραγματική εξάντληση.') +
      '\nΤι να κάνεις: κάποιοι επισκέπτες μπορεί αυτή τη στιγμή να μη βλέπουν πρόγνωση. Έλεγξε τα Netlify function logs για αιχμή κίνησης.';
  }
  const tag = level === 'red' ? '🟠 ΠΡΟΣΟΧΗ — παρακολούθησε' : '🔵 ΕΝΗΜΕΡΩΣΗ';
  const limit = level === 'red' ? thresholds.red : thresholds.amber;
  return `${tag}\n<b>Χωρητικότητα: ${count} κλήσεις στο Open-Meteo σήμερα</b>\n` +
    `Περάσαμε τη γραμμή παρακολούθησης των ${limit}/ημέρα (δωρεάν όριο ~10.000/ημέρα).\n` +
    (level === 'red'
      ? 'Τι να κάνεις: όχι ακόμα πρόβλημα, αλλά ρίξε μια ματιά στην κίνηση στην πρωινή αιχμή — αν συνεχίσει έτσι, θα φτάσουμε το όριο σήμερα.'
      : 'Τι να κάνεις: καμία ενέργεια τώρα — απλή ενημέρωση ότι η κίνηση ανεβαίνει.');
}
