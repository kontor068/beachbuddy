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
// 1M/month averages ~33k/day, so the daily lines sit at ~55% and ~76% of that
// average. They replaced the free-tier 5k/7k lines, which sat at 15% and 21% of the
// new budget and would have cried wolf daily until ignored.
//
// ΠΡΟΣΟΧΗ ΣΤΗΝ ΑΡΙΘΜΗΤΙΚΗ (29/08/2026): ΟΥΤΕ η κόκκινη γραμμή εξαντλεί τον μήνα.
// 25.000/ημέρα × 30 = 750.000, δηλαδή 75% του εκατομμυρίου· 18.000 × 30 = 540.000,
// δηλαδή 54%. Η ειδοποίηση έλεγε ως σήμερα «μια τέτοια μέρα ΚΑΘΕ μέρα εξαντλεί τον
// μήνα», και το σχόλιο εδώ έλεγε το ίδιο — και τα δύο λάθος. Είναι το είδος του
// λάθους που σκοτώνει ένα κανάλι ειδοποιήσεων: μια προειδοποίηση που φωνάζει «τέλος»
// ενώ είσαι στο 75% διαβάζεται μία φορά με αγωνία και μετά αγνοείται. Οι γραμμές ΔΕΝ
// αλλάζουν — ως σημεία προσοχής στέκουν μια χαρά· αλλάζει το τι λέει η ειδοποίηση,
// που πλέον τυπώνει τον ΠΡΑΓΜΑΤΙΚΟ μετρητή του κύκλου αντί για ισχυρισμό.
export const MONTHLY_QUOTA = 1_000_000;
export const DAILY_BUDGET = Math.round(MONTHLY_QUOTA / 30); // ~33k
export const DEFAULT_THRESHOLDS = Object.freeze({ amber: 18000, red: 25000 });

/**
 * The quota is MONTHLY, so the only number that can answer "will we blow the plan?"
 * is the running total of the billing cycle — and until 13/08/2026 nothing kept it.
 * The state held one day and zeroed it at UTC midnight, so every day's usage was
 * destroyed the moment it became history. The daily alarms could say "today is big"
 * but nobody, including us, could say how much of the million was gone.
 *
 * Fix: the same blob now carries a per-day ledger of SEALED days. Today's live
 * figure stays in `count` (single writer, unchanged hot path); on rollover the
 * finished day is written into `days` before the counter is zeroed. One blob, one
 * read-modify-write per cache-miss — no extra I/O on the forecast path.
 */
export const HISTORY_DAYS = 70; // two billing cycles plus slack; ~2 KB of blob

/** The day of month the paid plan's billing cycle turns over (subscription began 09/08/2026). */
export const DEFAULT_CYCLE_START_DAY = 9;

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
  /** Sealed history: { 'YYYY-MM-DD': weightedCalls }. Never includes `day` itself. */
  days: {},
});

/** Keep the ledger bounded — oldest days fall off first. */
const trimHistory = (days) => {
  const keys = Object.keys(days).sort();
  if (keys.length <= HISTORY_DAYS) return days;
  const out = {};
  for (const k of keys.slice(-HISTORY_DAYS)) out[k] = days[k];
  return out;
};

/**
 * Return `prev` if it's for today, else a fresh state — sealing the finished day
 * into the ledger on the way. A zero day is recorded as a real zero: the first key
 * in the ledger is how the dashboard knows when honest measurement started, so a
 * silent gap would read as "we counted that day and it was quiet".
 */
export const stateForDay = (prev, dayKey) => {
  if (!prev) return freshState(dayKey);
  if (prev.day === dayKey) {
    return { ...freshState(dayKey), ...prev, day: dayKey, days: { ...(prev.days || {}) } };
  }
  const days = { ...(prev.days || {}) };
  if (prev.day) days[prev.day] = Math.round(Number(prev.count) || 0);
  return { ...freshState(dayKey), days: trimHistory(days) };
};

/**
 * The billing window that contains `now`, as [start, end) UTC day keys.
 * Clamped to day ≤ 28 so a cycle starting on the 31st cannot vanish in February.
 */
export function cycleWindow(now, cycleStartDay = DEFAULT_CYCLE_START_DAY) {
  const anchor = Math.min(28, Math.max(1, Number(cycleStartDay) || DEFAULT_CYCLE_START_DAY));
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const startMonth = now.getUTCDate() >= anchor ? m : m - 1;
  const start = new Date(Date.UTC(y, startMonth, anchor));
  const end = new Date(Date.UTC(y, startMonth + 1, anchor)); // exclusive
  return { start, end, startKey: utcDayKey(start), endKey: utcDayKey(end) };
}

/**
 * Fold the ledger into the running total of the current billing cycle.
 *
 * `used` is deliberately an UNDER-estimate in two ways and both are stated in the
 * UI rather than hidden: concurrent cache-misses can lose an increment, and days
 * before the ledger existed simply are not there. It is a floor, never a ceiling —
 * which is the safe direction for a number whose job is "are we about to blow it?".
 */
export function monthlyUsage(state, options = {}) {
  const now = options.now || new Date();
  const quota = Number(options.quota) || MONTHLY_QUOTA;
  const { start, end, startKey, endKey } = cycleWindow(now, options.cycleStartDay);
  const todayKey = utcDayKey(now);

  const ledger = (state && state.days) || {};
  const perDay = [];
  for (const [k, v] of Object.entries(ledger)) {
    if (k >= startKey && k < endKey && k !== todayKey) perDay.push([k, Math.max(0, Number(v) || 0)]);
  }
  const sealedTotal = perDay.reduce((s, [, v]) => s + v, 0);
  const today = state && state.day === todayKey ? Math.max(0, Number(state.count) || 0) : 0;
  if (todayKey >= startKey && todayKey < endKey) perDay.push([todayKey, today]);
  perDay.sort((a, b) => (a[0] < b[0] ? -1 : 1));

  const used = sealedTotal + today;
  const dayMs = 86400000;
  const cycleDays = Math.round((end - start) / dayMs);
  const dayIndex = Math.round((Date.parse(`${todayKey}T00:00:00Z`) - start) / dayMs) + 1; // 1-based
  const daysLeft = Math.max(0, cycleDays - dayIndex);

  // Average over SEALED days only — today is half-finished and would drag the
  // projection down all morning and up all evening.
  const avgPerDay = perDay.length > 1 ? Math.round(sealedTotal / (perDay.length - 1)) : null;
  const projected = avgPerDay === null ? null : Math.round(avgPerDay * cycleDays);

  return {
    quota,
    used,
    remaining: Math.max(0, quota - used),
    percent: quota ? Math.min(999, Math.round((used / quota) * 100)) : 0,
    today,
    todayPercentOfAverage: DAILY_BUDGET ? Math.round((today / DAILY_BUDGET) * 100) : 0,
    cycleStart: startKey,
    cycleEnd: endKey,
    cycleDays,
    dayIndex: Math.min(cycleDays, Math.max(1, dayIndex)),
    daysLeft,
    /** How many days of this cycle we actually have numbers for (the rest predate the ledger). */
    daysMeasured: perDay.length,
    avgPerDay,
    projected,
    /** True when the current pace would exhaust the plan before the cycle ends. */
    willExceed: projected !== null && projected > quota,
    perDay,
    /** Earliest day we ever measured — everything before it is unknown, not zero. */
    measuringSince: Object.keys(ledger).sort()[0] || (state && state.day) || null,
  };
}

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
/**
 * @param usage Το αποτέλεσμα του monthlyUsage() για την ΙΔΙΑ κατάσταση, όταν υπάρχει.
 *   Χωρίς αυτό η ειδοποίηση μιλάει γενικά· με αυτό λέει πόσο από το εκατομμύριο έχει
 *   πραγματικά φαγωθεί και πού βγάζει ο ρυθμός — η μόνη πληροφορία πάνω στην οποία
 *   μπορεί να δράσει κανείς.
 */
export function formatCapacityAlert(level, count, thresholds = DEFAULT_THRESHOLDS, usage = null) {
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
  const quota = usage?.quota || MONTHLY_QUOTA;
  const el = n => Number(n).toLocaleString('el-GR');

  // Ο κύκλος μέχρι τώρα, από τον πραγματικό μετρητή — όχι από ισχυρισμό.
  const monthLine = usage
    ? `Ο κύκλος μέχρι τώρα: <b>${el(usage.used)}</b> από ${el(quota)} (${usage.percent}%), μέρα ${usage.dayIndex}/${usage.cycleDays}.\n`
    : '';

  // Πού βγάζει ο ρυθμός. Χωρίς σφραγισμένες μέρες δεν προβλέπουμε — και το λέμε.
  const paceLine = usage
    ? (usage.projected === null
      ? 'Δεν υπάρχουν ακόμα αρκετές σφραγισμένες μέρες για πρόβλεψη του κύκλου.\n'
      : `Με τον ρυθμό των μετρημένων ημερών (~${el(usage.avgPerDay)}/ημέρα) ο κύκλος βγάζει ~${el(usage.projected)} — ${
        usage.willExceed ? '<b>πάνω από το όριο</b>' : `${Math.round((usage.projected / quota) * 100)}% του ορίου`
      }.\n`)
    : '';

  // Η οδηγία ακολουθεί την πρόβλεψη αντί να την προκαταλαμβάνει.
  const whatToDo = level === 'red'
    ? (usage?.willExceed
      ? 'Τι να κάνεις: ο ρυθμός ΟΝΤΩΣ ξεπερνά το πακέτο — δες τον μετρητή μήνα στο customer portal και τι ανέβασε την κίνηση.'
      : 'Τι να κάνεις: τίποτα επείγον. Η μέρα τρέχει ψηλά, αλλά ο κουβάς είναι μηνιαίος και ο ρυθμός δεν εξαντλεί το πακέτο. Παρακολούθησε αν επαναληφθεί.')
    : 'Τι να κάνεις: καμία ενέργεια — ενημέρωση ότι η μέρα τρέχει πάνω από τον μέσο όρο. Ο μηνιαίος κουβάς απορροφά αιχμές.';

  return `${tag}\n<b>Χωρητικότητα: ${count} σταθμισμένες κλήσεις στο Open-Meteo σήμερα</b>\n` +
    `Περάσαμε τη γραμμή των ${el(limit)}/ημέρα (πακέτο 1 εκατ./μήνα ≈ ${el(DAILY_BUDGET)}/ημέρα μέσος όρος).\n` +
    monthLine + paceLine + whatToDo;
}
