#!/usr/bin/env node
/**
 * Guard for the Open-Meteo quota meter.
 *
 * The meter answers one question — "will we blow the 1,000,000/month plan?" — and
 * for that it must survive the two events that used to destroy it: UTC midnight
 * (which zeroed the only counter that existed) and the start of a billing cycle.
 *
 * These are pure-logic checks over netlify/functions/lib/capacityAlarm.mjs. They need
 * no network, no Blobs and no deploy, so they can run in CI next to the other guards.
 *
 *   node scripts/validateCapacityLedger.mjs
 */

import {
  stateForDay,
  recordCalls,
  recordRateLimited,
  monthlyUsage,
  cycleWindow,
  utcDayKey,
  MONTHLY_QUOTA,
  HISTORY_DAYS,
  DEFAULT_THRESHOLDS,
} from '../netlify/functions/lib/capacityAlarm.mjs';

let failures = 0;
const check = (name, condition, detail = '') => {
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const at = (iso) => new Date(`${iso}T12:00:00Z`);

console.log('\nΜετρητής Open-Meteo — έλεγχος λογικής\n');

// ── 1. A finished day survives midnight ──────────────────────────────────────
{
  let state = stateForDay(null, '2026-08-10');
  state = recordCalls(state, '2026-08-10', 20000).next;
  const rolled = stateForDay(state, '2026-08-11');

  check('η χθεσινή μέρα σφραγίζεται στο ιστορικό', rolled.days['2026-08-10'] === 20000,
    `βρέθηκε ${rolled.days['2026-08-10']}`);
  check('ο ημερήσιος μετρητής μηδενίζει στη νέα μέρα', rolled.count === 0, `βρέθηκε ${rolled.count}`);
  check('οι ημερήσιοι συναγερμοί ξαναοπλίζουν', rolled.alertedAmber === false && rolled.alertedRed === false);
  check('το ιστορικό ΔΕΝ περιέχει τη σημερινή μέρα', rolled.days['2026-08-11'] === undefined);
}

// ── 2. A zero day is a recorded zero, not a gap ──────────────────────────────
{
  const quiet = stateForDay({ day: '2026-08-10', count: 0, days: {} }, '2026-08-11');
  check('μέρα με μηδέν κλήσεις καταγράφεται ως πραγματικό μηδέν', quiet.days['2026-08-10'] === 0,
    'αλλιώς ένα κενό στο ιστορικό διαβάζεται ως "ήσυχη μέρα"');
}

// ── 3. Same-day writes never lose the ledger ─────────────────────────────────
{
  const prev = { day: '2026-08-11', count: 5, days: { '2026-08-10': 20000 } };
  const same = stateForDay(prev, '2026-08-11');
  check('γράψιμο μέσα στην ίδια μέρα κρατάει το ιστορικό', same.days['2026-08-10'] === 20000);
  const after = recordCalls(same, '2026-08-11', 7).next;
  check('το increment προσθέτει στη σημερινή, όχι στο ιστορικό', after.count === 12 && after.days['2026-08-10'] === 20000,
    `count=${after.count}`);
}

// ── 4. The ledger stays bounded ──────────────────────────────────────────────
{
  const days = {};
  for (let i = 0; i < HISTORY_DAYS + 30; i += 1) {
    days[utcDayKey(new Date(Date.UTC(2026, 0, 1 + i)))] = 100 + i;
  }
  const trimmed = stateForDay({ day: '2026-12-01', count: 1, days }, '2026-12-02');
  check(`το ιστορικό κόβεται στις ${HISTORY_DAYS} μέρες`,
    Object.keys(trimmed.days).length <= HISTORY_DAYS + 1,
    `βρέθηκαν ${Object.keys(trimmed.days).length}`);
  const kept = Object.keys(trimmed.days).sort();
  check('κρατιούνται οι ΠΡΟΣΦΑΤΕΣ μέρες, όχι οι παλιότερες', kept[kept.length - 1] === '2026-12-01');
}

// ── 5. The billing window ────────────────────────────────────────────────────
{
  const w = cycleWindow(at('2026-08-13'), 9);
  check('κύκλος 9→9: στις 13/08 τρέχει ο κύκλος 09/08→09/09',
    w.startKey === '2026-08-09' && w.endKey === '2026-09-09', `${w.startKey}→${w.endKey}`);

  const before = cycleWindow(at('2026-08-03'), 9);
  check('στις 03/08 τρέχει ακόμη ο προηγούμενος κύκλος (09/07→09/08)',
    before.startKey === '2026-07-09' && before.endKey === '2026-08-09', `${before.startKey}→${before.endKey}`);

  const cal = cycleWindow(at('2026-08-13'), 1);
  check('με CAPACITY_CYCLE_START_DAY=1 γίνεται ημερολογιακός μήνας',
    cal.startKey === '2026-08-01' && cal.endKey === '2026-09-01', `${cal.startKey}→${cal.endKey}`);

  const feb = cycleWindow(at('2027-03-05'), 31);
  check('ημέρα κύκλου >28 δεν εξαφανίζει τον Φεβρουάριο', feb.startKey === '2027-02-28', feb.startKey);
}

// ── 6. The monthly total is what the console shows ───────────────────────────
{
  const state = {
    day: '2026-08-13',
    count: 12000,
    days: {
      '2026-08-07': 999999, // previous cycle — MUST NOT be counted
      '2026-08-10': 20000,
      '2026-08-11': 24000,
      '2026-08-12': 16000,
    },
  };
  const u = monthlyUsage(state, { now: at('2026-08-13'), cycleStartDay: 9 });

  check('το σύνολο κύκλου = σφραγισμένες μέρες + σήμερα', u.used === 72000, `βρέθηκε ${u.used}`);
  check('μέρα εκτός κύκλου δεν προσμετράται', u.used < 999999);
  check('τα υπόλοιπα βγαίνουν από το 1 εκατ.', u.remaining === MONTHLY_QUOTA - 72000, `βρέθηκε ${u.remaining}`);
  check('το ποσοστό είναι σωστό', u.percent === 7, `βρέθηκε ${u.percent}`);
  check('η σημερινή δεν διπλομετριέται', u.today === 12000);
  check('ο μέσος όρος αγνοεί τη μισοτελειωμένη σημερινή', u.avgPerDay === 20000, `βρέθηκε ${u.avgPerDay}`);
  check('η πρόβλεψη = μέσος όρος × μέρες κύκλου', u.projected === 20000 * 31, `βρέθηκε ${u.projected}`);
  check('με αυτόν τον ρυθμό ΔΕΝ σκάει', u.willExceed === false);
  check('ξέρει από πότε μετράμε', u.measuringSince === '2026-08-07');
  check('η μπάρα ημερών περιέχει και τη σημερινή', u.perDay.some(([d]) => d === '2026-08-13'));
}

// ── 7. The case the whole thing exists for: a pace that exhausts the plan ────
{
  const days = {};
  for (let i = 9; i <= 20; i += 1) days[`2026-08-${String(i).padStart(2, '0')}`] = 40000;
  const u = monthlyUsage({ day: '2026-08-21', count: 10000, days }, { now: at('2026-08-21'), cycleStartDay: 9 });
  check('ρυθμός που εξαντλεί τον μήνα σημαίνεται ως υπέρβαση', u.willExceed === true,
    `πρόβλεψη ${u.projected} vs ${MONTHLY_QUOTA}`);
  check('η πρόβλεψη ξεπερνά το όριο', u.projected > MONTHLY_QUOTA, `βρέθηκε ${u.projected}`);
}

// ── 8. Empty / unreadable meter degrades honestly ────────────────────────────
{
  const u = monthlyUsage(null, { now: at('2026-08-13'), cycleStartDay: 9 });
  check('χωρίς δεδομένα δεν εφευρίσκεται ρυθμός', u.avgPerDay === null && u.projected === null);
  check('χωρίς δεδομένα το σύνολο είναι 0 και όχι NaN', u.used === 0 && Number.isFinite(u.remaining));
  check('χωρίς δεδομένα δεν δηλώνεται υπέρβαση', u.willExceed === false);
}

// ── 9. A 429 still moves the monthly total ───────────────────────────────────
{
  let s = stateForDay(null, '2026-08-13');
  s = recordCalls(s, '2026-08-13', 100).next;
  const r = recordRateLimited(s, '2026-08-13', 21);
  check('μια άρνηση 429 χρεώνεται κανονικά στον μήνα', r.next.count === 121, `βρέθηκε ${r.next.count}`);
  check('η άρνηση καταγράφεται και ξεχωριστά', r.next.rateLimited === 21);
  const again = recordRateLimited(r.next, '2026-08-13', 21);
  check('ο συναγερμός 429 χτυπάει μία φορά την ημέρα', again.fire === false);
}

// ── 10. Daily thresholds still sit inside the monthly budget ─────────────────
{
  check('η κόκκινη ημερήσια γραμμή είναι κάτω από τον μηνιαίο μέσο όρο',
    DEFAULT_THRESHOLDS.red < MONTHLY_QUOTA / 30,
    `${DEFAULT_THRESHOLDS.red} vs ${Math.round(MONTHLY_QUOTA / 30)}`);
}

console.log(`\n${failures ? `❌ ${failures} έλεγχοι απέτυχαν` : '✅ Όλοι οι έλεγχοι πέρασαν'}\n`);
process.exit(failures ? 1 : 0);
