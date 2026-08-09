// ─────────────────────────────────────────────────────────────────────────────
// Capacity alarm — PURE decision logic (no I/O), so it can be unit-tested.
// The forecast proxy is the single choke point for real upstream Open-Meteo
// calls, so it is where we meter usage against the plan's quota and raise alarms.
//
// Two independent signals:
//   • a per-UTC-day counter → amber/red (advance warning), and
//   • an upstream HTTP 429 → the definitive "we hit the wall" (fires immediately).
// Each alarm fires at most once per day per level (dedup flags live in the state).
//
// Counting is best-effort: concurrent cache-misses can lose an increment, so the
// count is a slight UNDER-estimate — fine for an alarm (it errs toward firing a
// touch late, never early on noise).
// ─────────────────────────────────────────────────────────────────────────────

// The quota these thresholds guard. Since 09/08/2026 the plan is PAID Open-Meteo
// API Standard: 1,000,000 calls per MONTH — a monthly bucket, not a daily wall.
// 1M/month averages ~33k/day, so the daily lines sit at ~55% (heads-up: a normal
// August day should never see this) and ~76% (a day like this every day would
// exhaust the month). They replaced the free-tier 5k/7k lines, which sat at 15%
// and 21% of the new budget and would have cried wolf daily until ignored.
export const MONTHLY_QUOTA = 1_000_000;
export const DAILY_BUDGET = Math.round(MONTHLY_QUOTA / 30); // ~33k
export const DEFAULT_THRESHOLDS = Object.freeze({ amber: 18000, red: 25000 });

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
    // A 429 on the PAID plan is a different animal than on the free tier: the paid
    // hosts have no ~600/minute ceiling, so a refusal means either the monthly
    // 1M bucket is genuinely gone, or the key stopped being accepted upstream
    // (the 401/403 alert in forecast.mjs covers the explicit-rejection case).
    const share = Math.round((count / DAILY_BUDGET) * 100);
    return '🔴 ΚΡΙΣΙΜΟ — δράσε τώρα\n' +
      '<b>Χωρητικότητα: το Open-Meteo αρνήθηκε κλήση (πληρωμένο πακέτο)</b>\n' +
      `Σημερινές σταθμισμένες κλήσεις: <b>${count}</b> (~${share}% του ημερήσιου μέσου ~${DAILY_BUDGET.toLocaleString('el-GR')}).\n` +
      'Στο πληρωμένο πακέτο αυτό σημαίνει είτε ότι εξαντλήθηκε το μηνιαίο 1 εκατ., είτε πρόβλημα με το κλειδί. ' +
      'Δες το customer portal του Open-Meteo (μετρητής μήνα) και τα Netlify function logs.\n' +
      'Τι να κάνεις: κάποιοι επισκέπτες μπορεί αυτή τη στιγμή να βλέπουν την πρόγνωση διάσωσης (ως 12ω παλιά).';
  }
  const tag = level === 'red' ? '🟠 ΠΡΟΣΟΧΗ — παρακολούθησε' : '🔵 ΕΝΗΜΕΡΩΣΗ';
  const limit = level === 'red' ? thresholds.red : thresholds.amber;
  return `${tag}\n<b>Χωρητικότητα: ${count} σταθμισμένες κλήσεις στο Open-Meteo σήμερα</b>\n` +
    `Περάσαμε τη γραμμή των ${limit.toLocaleString('el-GR')}/ημέρα (πακέτο 1 εκατ./μήνα ≈ ${DAILY_BUDGET.toLocaleString('el-GR')}/ημέρα μέσος όρος).\n` +
    (level === 'red'
      ? 'Τι να κάνεις: μια τέτοια μέρα ΚΑΘΕ μέρα εξαντλεί τον μήνα. Μεμονωμένη αιχμή δεν πειράζει — ο κουβάς είναι μηνιαίος. Δες τον μετρητή μήνα στο customer portal.'
      : 'Τι να κάνεις: καμία ενέργεια — ενημέρωση ότι η μέρα τρέχει πάνω από τον μέσο όρο. Ο μηνιαίος κουβάς απορροφά αιχμές.');
}
