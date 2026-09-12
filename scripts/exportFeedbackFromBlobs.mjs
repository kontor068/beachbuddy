#!/usr/bin/env node
/**
 * ΤΑ ΣΧΟΛΙΑ ΤΩΝ ΕΠΙΣΚΕΠΤΩΝ ΔΙΑΒΑΖΟΝΤΑΙ ΕΠΙΤΕΛΟΥΣ (12/09/2026).
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Το `netlify/functions/feedback-export.mjs` γράφει από τις 30/07/2026 στην
 * αποθήκη `feedback-log`, αλλά το κλειδί του (`FEEDBACK_EXPORT_KEY`) δεν ορίστηκε ΠΟΤΕ σε κανένα
 * context του Netlify — άρα το `/api/feedback-export` απαντούσε πάντα 403 και κανείς δεν διάβασε
 * ούτε μία εγγραφή για 44 μέρες (βίβλος §Γ81, 16-community-feedback «ΤΟ ΜΕΓΑΛΟ ΑΝΟΙΧΤΟ»).
 * Είναι ο φθηνότερος κριτής της ετυμηγορίας που έχουμε, και ο ΜΟΝΟΣ πάνω στην άμμο.
 *
 * ΤΙ ΚΑΝΕΙ. Διαβάζει την ίδια αποθήκη από τη γραμμή εντολών του Netlify (το site είναι ήδη
 * linked στο κύριο μηχάνημα — `.netlify/state.json`), χωρίς κλειδί εξαγωγής, και γράφει:
 *   .tmp/feedback-export.json          — οι εγγραφές `f/` (σχόλια συνθηκών), η είσοδος του
 *                                        scripts/calibrateFromFeedback.mjs
 *   .tmp/feedback-ratings-export.json  — οι εγγραφές `r/` (βαθμολογίες 1-10 της εφαρμογής)
 * Ο φάκελος `.tmp/` είναι gitignored: τα ωμά σχόλια ΔΕΝ μπαίνουν ποτέ στο δημόσιο repo.
 * Στην έξοδο τυπώνει μόνο πλήθη — ποτέ κείμενο επισκέπτη.
 *
 * Run: node scripts/exportFeedbackFromBlobs.mjs [--since=YYYY-MM-DD] [--concurrency=4]
 *      (από τον φάκελο του linked site)
 */
import { exec as execCb } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execCb);
const STORE = 'feedback-log';
const args = process.argv.slice(2);
const arg = (name) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const SINCE = /^\d{4}-\d{2}-\d{2}$/.test(arg('since') || '') ? arg('since') : null;
const CONCURRENCY = Math.max(1, Number(arg('concurrency') || 4));
const OUT_DIR = path.resolve('.tmp');
const OUT_FEEDBACK = path.join(OUT_DIR, 'feedback-export.json');
const OUT_RATINGS = path.join(OUT_DIR, 'feedback-ratings-export.json');

const cli = async (cmd) => {
  const { stdout } = await exec(`npx --no-install netlify-cli ${cmd}`, { maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  return stdout;
};

const listKeys = async () => {
  const raw = await cli(`blobs:list ${STORE} --json`);
  const parsed = JSON.parse(raw);
  const blobs = Array.isArray(parsed) ? parsed : (parsed.blobs || []);
  return blobs.map(b => (typeof b === 'string' ? b : b.key)).filter(Boolean);
};

const getJson = async (key) => {
  const raw = await cli(`blobs:get ${STORE} "${key}"`);
  const text = raw.trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { _unparsed: true, key }; }
};

const mapLimit = async (items, limit, fn) => {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
};

const dayOf = (key) => key.slice(2, 12);

const main = async () => {
  const keys = await listKeys();
  const wanted = keys.filter(k => (k.startsWith('f/') || k.startsWith('r/')) && (!SINCE || dayOf(k) >= SINCE));
  console.log(`store ${STORE}: ${keys.length} keys, ${wanted.length} in window${SINCE ? ` (since ${SINCE})` : ''}`);

  const records = await mapLimit(wanted, CONCURRENCY, async (key, i) => {
    const rec = await getJson(key);
    if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${wanted.length}\n`);
    return rec ? { key, rec } : null;
  });

  const feedback = [];
  const ratings = [];
  let unparsed = 0;
  for (const item of records) {
    if (!item) continue;
    if (item.rec._unparsed) { unparsed++; continue; }
    (item.key.startsWith('r/') ? ratings : feedback).push(item.rec);
  }
  feedback.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  ratings.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FEEDBACK, JSON.stringify(feedback, null, 2), 'utf8');
  writeFileSync(OUT_RATINGS, JSON.stringify(ratings, null, 2), 'utf8');

  // Μόνο πλήθη στην οθόνη — ποτέ κείμενο επισκέπτη.
  const count = (arr, pick) => {
    const m = new Map();
    for (const r of arr) { const k = pick(r) ?? '(none)'; m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' · ');
  };
  console.log(`\nfeedback (f/): ${feedback.length}  |  ratings (r/): ${ratings.length}  |  unparsed: ${unparsed}`);
  console.log(`  verdict:   ${count(feedback, r => r.feedback)}`);
  console.log(`  exposure:  ${count(feedback, r => r.conditions?.exposureLevel)}`);
  console.log(`  live flag: ${count(feedback, r => String(r.conditions?.live))}`);
  console.log(`  month:     ${count(feedback, r => String(r.timestamp).slice(0, 7))}`);
  console.log(`  beaufort:  ${count(feedback, r => r.conditions?.beaufort)}`);
  if (ratings.length) {
    const avg = (k) => (ratings.reduce((s, r) => s + (Number(r.ratings?.[k]) || 0), 0) / ratings.length).toFixed(1);
    console.log(`  ratings:   easeOfUse avg ${avg('easeOfUse')} · accuracy avg ${avg('accuracy')} · ${count(ratings, r => r.language)}`);
  }
  console.log(`\n→ ${path.relative(process.cwd(), OUT_FEEDBACK)}\n→ ${path.relative(process.cwd(), OUT_RATINGS)}`);
};

main().catch((err) => { console.error(err?.message || err); process.exit(1); });
