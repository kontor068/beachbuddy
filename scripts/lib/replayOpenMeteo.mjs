/**
 * RUN A MEASUREMENT SCRIPT AGAINST A DAY THAT HAS ALREADY HAPPENED.
 *
 * WHY THIS EXISTS. Every calibration number in this project was measured on whatever weather
 * happened to be outside on the day someone ran the script. PORISMA-KAIROS-2026-08 says so in
 * its own words, repeatedly: the spike witness fired «0 φορές σε 9.024 ώρες» — «μετρήθηκε σε ΜΙΑ
 * ήρεμη μέρα και δεν οριοθετεί τίποτα για καταιγίδα»; the `×1,20` boost was killed as «overfit
 * στο παράθυρο βαθμονόμησης»; the shore-wave `0,30` is parked pending «μέτρηση σε δεύτερο
 * παράθυρο». That is one single defect wearing three costumes, and it is exactly why the
 * calibration score sits at 72% while the safety score sits at 96%.
 *
 * The Professional plan (bought 21/08/2026) unlocked `historical-forecast-api.open-meteo.com`:
 * the archive of the forecasts THEMSELVES, back to ~2022. That turns "wait for a meltemi" into
 * "pick 30 meltemi days and run".
 *
 * ⚠️ WHY IT IS A FETCH PATCH AND NOT A FLAG ON EACH SCRIPT. Same reasoning as
 * lib/paidOpenMeteo.mjs, which this module extends rather than duplicates: a measurement must
 * keep running THE CODE THAT SHIPS, not a date-aware copy of it. Roughly forty scripts build
 * their own Open-Meteo URL with `forecast_days=N`; teaching each one about replay would fork
 * forty call sites and guarantee that some of them drift. Rewriting the request in flight
 * touches none of them.
 *
 * WHAT IT REWRITES
 *   api.open-meteo.com/v1/forecast   → historical-forecast-api.open-meteo.com/v1/forecast
 *   marine-api…/v1/marine            → unchanged host (it serves its own archive on start_date)
 *   air-quality-api…/v1/air-quality  → unchanged host (same)
 *   forecast_days=N / past_days=M    → start_date / end_date covering the same span
 *
 * A request that ALREADY carries start_date/end_date is left alone apart from the host swap —
 * scripts like auditWindAgainstStations.mjs accept a window of their own, and this module must
 * not overrule it. The host swap alone is worth a lot there: the live forecast host only reaches
 * ~3 months back, the historical one reaches years.
 *
 * USAGE — importing it is NOT the switch (unlike paidOpenMeteo). It does nothing at all without
 * OPEN_METEO_REPLAY in the environment, so a script can import it unconditionally:
 *
 *     OPEN_METEO_API_KEY=… OPEN_METEO_REPLAY=2025-07-22 node scripts/measureX.mjs
 *     OPEN_METEO_API_KEY=… OPEN_METEO_REPLAY=2025-07-22:2025-07-28 node scripts/measureX.mjs
 *
 * ── SCRIPTS THAT ASK "WHAT IS HAPPENING RIGHT NOW" ──────────────────────────────────────────
 * Data alone is not enough for those: they compare the returned timestamps against the clock and
 * find nothing in range. There are two ways to bridge that, and ONE OF THEM IS A TRAP.
 *
 * ✅ OPEN_METEO_REPLAY_SHIFT=1 — MOVE THE DATA, KEEP THE CLOCK (use this one).
 * Rewrites every timestamp in the RESPONSE forward by a whole number of days, so the replayed day
 * lands on today while every value stays exactly what it was. The clock stays real, so the
 * shipped code's own defences keep working.
 *
 * ⛔ OPEN_METEO_REPLAY_CLOCK=1 — MOVE THE CLOCK (measured 21/08/2026: it BREAKS the run).
 * utils/athensTime.ts compares Date.now() against the origin's `Date` response header and, past
 * 90 minutes of disagreement, decides the DEVICE is broken and starts "correcting" every
 * displayed time (syncClockFromTrustedInstant, athensTime.ts:59). Replaying 2022 under a frozen
 * clock reports `skewMinutes: -2081188` and every region returns empty. The flag is kept only
 * because a script that touches no forecast response can still want it — but for anything that
 * fetches, USE SHIFT. Never set either one in a script that WRITES production data.
 */

const spec = (process.env.OPEN_METEO_REPLAY || '').trim();

/** Free/paid live host → the host that serves the same path from the archive. */
const REPLAY_HOST = {
  'api.open-meteo.com': 'historical-forecast-api.open-meteo.com',
  'customer-api.open-meteo.com': 'customer-historical-forecast-api.open-meteo.com',
};

/** Parameters that mean "relative to today" and therefore cannot survive a replay. */
const RELATIVE_PARAMS = ['forecast_days', 'past_days', 'forecast_hours', 'past_hours'];
/** Parameters the archive has no concept of. Dropping them is louder than a 400. */
const NOW_PARAMS = ['current', 'current_weather', 'minutely_15'];

const DAY_MS = 86400000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

const parseSpec = (raw) => {
  const [from, to] = raw.split(':');
  const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
  if (!ok(from) || (to !== undefined && !ok(to))) return null;
  return { from, to: to || null };
};

let enabled = false;
let warnedNowParam = false;

// ── SHIFT: move the replayed day onto today, without touching the clock ──────────────────────
const SHIFT = process.env.OPEN_METEO_REPLAY_SHIFT === '1';
/** Whole days between two YYYY-MM-DD, computed at noon UTC so DST can never round it to ±1. */
const wholeDaysBetween = (fromDay, toDay) => Math.round(
  (Date.parse(`${toDay}T12:00:00Z`) - Date.parse(`${fromDay}T12:00:00Z`)) / DAY_MS,
);
/** Greek UTC offset on a given day — a shift across a DST boundary silently moves every hour. */
const athensOffsetMinutes = (day) => {
  const probe = new Date(`${day}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Athens', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(probe);
  return (Number(parts.find((p) => p.type === 'hour').value) - 12) * 60;
};
/** '2022-09-06T14:00' + N days → '2026-08-21T14:00'. Hour-of-day is preserved verbatim. */
const shiftStamp = (stamp, days) => {
  if (typeof stamp !== 'string' || stamp.length < 10) return stamp;
  const shifted = new Date(`${stamp.slice(0, 10)}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10) + stamp.slice(10);
};
/** Every block Open-Meteo can return carries its own `time`; miss one and the series desync. */
const shiftBody = (node, days) => {
  if (Array.isArray(node)) return node.map((n) => shiftBody(n, days));
  if (!node || typeof node !== 'object') return node;
  for (const block of ['hourly', 'daily', 'minutely_15', 'current', 'current_weather']) {
    const b = node[block];
    if (!b) continue;
    if (Array.isArray(b.time)) b.time = b.time.map((t) => shiftStamp(t, days));
    else if (typeof b.time === 'string') b.time = shiftStamp(b.time, days);
  }
  return node;
};

export const replayWindow = () => (enabled ? parseSpec(spec) : null);
export const isReplaying = () => enabled;

/**
 * Returns true when the patch is active. Safe to call more than once.
 */
export const enableReplayOpenMeteo = ({ quiet = false } = {}) => {
  if (enabled) return true;
  if (!spec) return false;

  const window = parseSpec(spec);
  if (!window) {
    console.error(`  ⛔ OPEN_METEO_REPLAY="${spec}" is not a date or a date:date range. Ignored.`);
    return false;
  }

  const nativeFetch = globalThis.fetch;
  if (typeof nativeFetch !== 'function') return false;

  // Computed once, from the REAL clock — the whole point of SHIFT is that the clock stays real.
  const todayAthens = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const shiftDays = SHIFT ? wholeDaysBetween(window.from, todayAthens) : 0;

  globalThis.fetch = (input, init) => {
    try {
      const raw = typeof input === 'string' ? input : input?.url;
      if (typeof raw === 'string' && raw.includes('open-meteo.com')) {
        const url = new URL(raw);
        const archiveHost = REPLAY_HOST[url.hostname];
        if (archiveHost) url.hostname = archiveHost;

        const q = url.searchParams;
        for (const p of NOW_PARAMS) {
          if (q.has(p)) {
            if (!warnedNowParam && !quiet) {
              console.warn(`  ⚠️  replay: dropped "${p}" — the archive has no "now". Hourly values still arrive.`);
              warnedNowParam = true;
            }
            q.delete(p);
          }
        }

        // A window the caller chose beats the one the environment chose. Only the host moves.
        if (!q.has('start_date') && !q.has('end_date')) {
          const forecastDays = Number(q.get('forecast_days') || 0);
          const pastDays = Number(q.get('past_days') || 0);
          const startMs = Date.parse(`${window.from}T00:00:00Z`) - pastDays * DAY_MS;
          const endMs = window.to
            ? Date.parse(`${window.to}T00:00:00Z`)
            : Date.parse(`${window.from}T00:00:00Z`) + Math.max(0, forecastDays - 1) * DAY_MS;
          q.set('start_date', isoDay(startMs));
          q.set('end_date', isoDay(Math.max(endMs, startMs)));
        }
        for (const p of RELATIVE_PARAMS) q.delete(p);

        if (!SHIFT) return nativeFetch(url.toString(), init);
        // Rebuild the response with the timestamps moved onto today. The headers are copied
        // verbatim — especially `Date`, which utils/athensTime.ts reads as the trusted instant.
        return nativeFetch(url.toString(), init).then(async (res) => {
          if (!res.ok) return res;
          try {
            const body = shiftBody(await res.json(), shiftDays);
            return new Response(JSON.stringify(body), {
              status: res.status, statusText: res.statusText, headers: res.headers,
            });
          } catch {
            return res; // a body we cannot parse is a body we do not touch
          }
        });
      }
    } catch {
      // A URL we cannot parse is a URL we do not touch.
    }
    return nativeFetch(input, init);
  };

  // ── The clock, only if explicitly asked for ────────────────────────────────
  if (process.env.OPEN_METEO_REPLAY_CLOCK === '1') {
    const frozen = Date.parse(`${window.from}T09:00:00+03:00`);
    const RealDate = Date;
    class ReplayDate extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [frozen]));
      }
      static now() { return frozen; }
    }
    globalThis.Date = ReplayDate;
    if (!quiet) {
      console.log(`  ⏱️  replay CLOCK: the process believes it is ${window.from} 09:00 Greek time.`);
      console.log('      Nothing that writes production data may run under this flag.');
    }
  }

  enabled = true;
  if (!quiet) {
    console.log(`  🕰️  Open-Meteo REPLAY: ${window.from}${window.to ? ` → ${window.to}` : ''} (archive hosts).`);
    if (SHIFT) {
      console.log(`      SHIFT: οι σφραγίδες μετακινούνται +${shiftDays} μέρες → ${todayAthens}. Το ρολόι ΔΕΝ πειράχτηκε.`);
      console.log('      ⚠️  Τα δεδομένα είναι του παρελθόντος με σημερινή ημερομηνία. Ό,τι γράψει το εργαλείο πρέπει να το λέει.');
      if (athensOffsetMinutes(window.from) !== athensOffsetMinutes(todayAthens)) {
        console.warn('      ⛔ ΑΛΛΑΓΗ ΩΡΑΣ ΑΝΑΜΕΣΑ ΣΤΙΣ ΔΥΟ ΗΜΕΡΟΜΗΝΙΕΣ: κάθε ώρα μετατοπίζεται κατά 60′.');
        console.warn('         Διάλεξε μέρα στην ίδια εποχή του χρόνου, αλλιώς η μεσημβρινή κορυφή πέφτει λάθος.');
      }
    }
  }
  return true;
};

// Importing this module is the switch — but only when OPEN_METEO_REPLAY is set, so an
// unconditional import stays a no-op on a normal live run.
enableReplayOpenMeteo();
