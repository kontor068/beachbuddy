#!/usr/bin/env node
/**
 * ΟΤΑΝ ΛΕΜΕ «ΛΑΔΙ», ΤΙ ΛΕΕΙ ΤΟ ΟΡΓΑΝΟ; — Η ΔΙΟΡΘΩΣΗ ΤΟΥ ΜΕΣΟΥ ΣΤΟΝ ΑΣΘΕΝΗ ΑΝΕΜΟ.
 *
 * ΑΦΟΡΜΗ: §Γ34 της βίβλου (20/08/2026). Εκεί μετρήθηκε ότι στις ώρες όπου το μοντέλο λέει
 * «≤2 Μποφόρ με λόγο ριπής ≥3» ο μέσος μας είναι 4,6 ενώ το ανεμόμετρο λέει 7,6 — και ότι
 * η ΡΙΠΗ σε αυτές τις ώρες είναι μυθοπλασία (18,1 έναντι 7,7 μετρημένα). Το §Γ34 άφησε ρητά
 * δύο χρέη πριν γραφτεί γραμμή κώδικα: (α) δεν έχει μετρηθεί η ακτίνα έκρηξης, (β) δεν έχει
 * επιλεγεί το σχήμα της διόρθωσης. Αυτό το σενάριο κλείνει και τα δύο. ΔΕΝ αλλάζει τίποτα.
 *
 * Η ΠΑΓΙΔΑ ΠΟΥ ΟΡΙΖΕΙ ΤΗ ΜΕΘΟΔΟ: το §Γ34 διάλεξε τις ώρες με κριτήριο ΤΗ ΔΙΚΗ ΜΑΣ τιμή
 * («εκεί που ΕΜΕΙΣ λέμε ≤2»). Όταν διαλέγεις με τη δική σου μεταβλητή, η αλήθεια βγαίνει
 * ψηλότερη ΑΚΟΜΑ ΚΑΙ ΣΕ ΤΕΛΕΙΟ ΜΟΝΤΕΛΟ ΜΕ ΘΟΡΥΒΟ — παλινδρόμηση προς τη μέση τιμή. Άρα:
 *
 *   1. τυπώνονται ΚΑΙ ΟΙ ΔΥΟ δεσμεύσεις (ανά δικό μας κάδο ΚΑΙ ανά κάδο οργάνου),
 *   2. κάθε υποψήφια διόρθωση κρίνεται σε ΑΛΛΟ ΠΑΡΑΘΥΡΟ ημερών από αυτό που τη γέννησε,
 *   3. και σε ΑΛΛΟΥΣ ΣΤΑΘΜΟΥΣ (ζυγά αεροδρόμια βαθμονόμηση, μονά κριτής) — γιατί η βίβλος
 *      έχει ήδη πληρώσει το μάθημα ότι ένα κατώφλι μπορεί να στέκει σε 4 παράθυρα και σε
 *      2 μόνο γεωγραφίες,
 *   4. και το τελικό κριτήριο ΔΕΝ είναι τα χλμ/ώ αλλά το ΧΡΩΜΑ (utils/suitabilityTone), με
 *      τον κανόνα των 3 Μποφόρ του §Γ32 μέσα — εκεί ακριβώς προσγειώνονται οι ώρες που
 *      σπρώχνει η διόρθωση.
 *
 * ΒΑΣΗ ΣΥΓΚΡΙΣΗΣ = Η ΠΑΡΑΓΩΓΗ ΣΗΜΕΡΑ, δηλαδή ΜΕΤΑ τον δάπεδο ριπής (utils/windGustFloor).
 * Αλλιώς θα χρεωνόταν στη νέα διόρθωση ό,τι διορθώνει ήδη ο δάπεδος.
 *
 *   node scripts/measureWeakWindLift.mjs [YYYY-MM-DD:YYYY-MM-DD ...]
 *
 * Γράφει reports/weather/weak-wind-lift-<παράθυρο>.json για κάθε παράθυρο.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { applyGustFloor } = require(path.join(root, 'utils/windGustFloor.ts'));

const STATIONS = [
  ['LGIR', 'Ηράκλειο', 35.3397, 25.1803], ['LGSA', 'Χανιά', 35.5317, 24.1497],
  ['LGST', 'Σητεία', 35.2161, 26.1013], ['LGRP', 'Ρόδος', 36.4054, 28.0862],
  ['LGKO', 'Κως', 36.7933, 27.0917], ['LGMK', 'Μύκονος', 37.4351, 25.3481],
  ['LGSR', 'Σαντορίνη', 36.3992, 25.4793], ['LGNX', 'Νάξος', 37.0811, 25.3681],
  ['LGPA', 'Πάρος', 37.0103, 25.1281], ['LGSK', 'Σκιάθος', 39.1771, 23.5037],
  ['LGKR', 'Κέρκυρα', 39.6019, 19.9117], ['LGZA', 'Ζάκυνθος', 37.7509, 20.8843],
  ['LGKF', 'Κεφαλονιά', 38.1201, 20.5005], ['LGPZ', 'Άκτιο', 38.9255, 20.7653],
  ['LGLM', 'Λήμνος', 39.9217, 25.2364], ['LGMT', 'Μυτιλήνη', 39.0567, 26.5983],
  ['LGSM', 'Σάμος', 37.6900, 26.9117], ['LGHI', 'Χίος', 38.3432, 26.1406],
  ['LGKL', 'Καλαμάτα', 37.0683, 22.0255], ['LGAL', 'Αλεξανδρούπολη', 40.8559, 25.9563],
  ['LGKV', 'Καβάλα', 40.9133, 24.6192], ['LGTS', 'Θεσσαλονίκη', 40.5197, 22.9709],
  ['LGKC', 'Κύθηρα', 36.2743, 23.0170], ['LGML', 'Μήλος', 36.6969, 24.4769],
  ['LGLE', 'Λέρος', 37.1849, 26.8003], ['LGKP', 'Κάρπαθος', 35.4214, 27.1460],
  ['LGIK', 'Ικαρία', 37.6827, 26.3470], ['LGSY', 'Σκύρος', 38.9676, 24.4872],
  ['LGBL', 'Ν. Αγχίαλος', 39.2196, 22.7943], ['LGRX', 'Άραξος', 38.1511, 21.4256],
];
const KT_TO_KMH = 1.852;
const WINDOWS = (process.argv.slice(2).length ? process.argv.slice(2) : ['2026-08-04:2026-08-18'])
  .map(w => w.split(':'));

const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : 0);
const fmt = v => (v === null || Number.isNaN(v) ? 'n/a' : (v >= 0 ? '+' : '') + v.toFixed(2));
const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const fetchJson = async (url, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
};

/**
 * ΤΟ ΚΛΕΙΔΙ ΕΙΝΑΙ ΠΡΟΑΙΡΕΤΙΚΟ ΕΔΩ. Το πληρωμένο κλειδί ζει στα Netlify env vars και το τραβάει
 * το προσωπικό token του `.env`. Αν το token έχει λήξει (401), η μέτρηση ΔΕΝ σταματάει: πέφτει
 * στο δωρεάν endpoint, που επιστρέφει τα ΙΔΙΑ νούμερα του ίδιου μοντέλου — αλλάζει μόνο η
 * χρέωση. Μια offline μέτρηση δεν έχει λόγο να μπλοκάρει σε διαχειριστικό διαπιστευτήριο.
 */
const readPaidKey = async () => {
  try {
    const token = (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
    const siteId = JSON.parse(fs.readFileSync(path.join(root, '.netlify/state.json'), 'utf8')).siteId;
    if (!token || !siteId) return null;
    const envRes = await fetch(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    if (!envRes.ok) { console.warn(`⚠ κλειδί Open-Meteo: HTTP ${envRes.status} — συνεχίζω με το δωρεάν endpoint`); return null; }
    return ((await envRes.json()).values || []).map(v => v.value).find(Boolean) || null;
  } catch (e) {
    console.warn(`⚠ κλειδί Open-Meteo: ${e.message} — συνεχίζω με το δωρεάν endpoint`);
    return null;
  }
};
const API_KEY = await readPaidKey();

/** ── ΤΑ ΖΕΥΓΗ ΩΡΑΣ: ΜΕΤΡΗΣΗ ΟΡΓΑΝΟΥ ΔΙΠΛΑ ΣΤΟ ΜΟΝΤΕΛΟ ΣΤΙΣ ΙΔΙΕΣ ΣΥΝΤΕΤΑΓΜΕΝΕΣ ── */
const loadWindow = async ([from, to]) => {
  const [y1, m1, d1] = from.split('-');
  const [y2, m2, d2] = to.split('-');
  const asosUrl = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?'
    + STATIONS.map(s => `station=${s[0]}`).join('&')
    + `&data=sknt&data=gust&year1=${y1}&month1=${m1}&day1=${d1}&year2=${y2}&month2=${m2}&day2=${d2}`
    + '&tz=UTC&format=onlycomma&latlon=no&missing=M&trace=T&direct=no&report_type=3&report_type=4';
  const csvRes = await fetch(asosUrl, { signal: AbortSignal.timeout(240000) });
  if (!csvRes.ok) throw new Error(`ASOS HTTP ${csvRes.status}`);
  const csv = await csvRes.text();
  const observed = new Map();
  for (const line of csv.split(String.fromCharCode(10)).slice(1)) {
    const [icao, valid, sknt, gust] = line.trim().split(',');
    if (!icao || !valid || sknt === undefined || sknt === 'M' || sknt === '') continue;
    const kt = Number(sknt);
    if (!Number.isFinite(kt)) continue;
    const d = new Date(`${valid.replace(' ', 'T')}:00Z`);
    if (Number.isNaN(d.getTime())) continue;
    const rounded = new Date(Math.round(d.getTime() / 3600000) * 3600000);
    const key = `${icao}|${rounded.toISOString().slice(0, 13)}`;
    const gap = Math.abs(d.getTime() - rounded.getTime());
    const prev = observed.get(key);
    if (!prev || gap < prev.gap) {
      const g = Number(gust);
      observed.set(key, { gap, kmh: kt * KT_TO_KMH, gustKmh: Number.isFinite(g) ? g * KT_TO_KMH : null });
    }
  }
  const url = (API_KEY ? 'https://customer-api.open-meteo.com/v1/forecast' : 'https://api.open-meteo.com/v1/forecast')
    + `?latitude=${STATIONS.map(s => s[2]).join(',')}&longitude=${STATIONS.map(s => s[3]).join(',')}`
    + '&hourly=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=UTC'
    + `&start_date=${from}&end_date=${to}&models=best_match`
    + (API_KEY ? `&apikey=${encodeURIComponent(API_KEY)}` : '');
  const modelData = await fetchJson(url);
  const entries = Array.isArray(modelData) ? modelData : [modelData];
  const rows = [];
  entries.forEach((entry, k) => {
    const st = STATIONS[k];
    const h = entry.hourly;
    if (!st || !h) return;
    h.time.forEach((t, idx) => {
      const obs = observed.get(`${st[0]}|${t.slice(0, 13)}`);
      const raw = h.wind_speed_10m?.[idx];
      const gustRaw = h.wind_gusts_10m?.[idx];
      if (!obs || typeof raw !== 'number') return;
      // Το `elevation` είναι του ΣΗΜΕΙΟΥ που ρωτήθηκε (§ windGustFloor) — η ίδια πύλη με την παραγωγή.
      const elev = typeof entry.elevation === 'number' ? entry.elevation : null;
      const gust = typeof gustRaw === 'number' ? gustRaw : null;
      rows.push({
        station: st[0], name: st[1], stationIndex: k, time: t,
        obs: obs.kmh, obsGust: obs.gustKmh, raw, gust, elev,
        base: applyGustFloor(raw, gust, elev),
      });
    });
  });
  return rows;
};

/** ── ΤΟ ΣΧΗΜΑ ΤΩΝ ΥΠΟΨΗΦΙΩΝ ────────────────────────────────────────────────────
 * Ράμπα: πλήρης διόρθωση στην άπνοια, μηδέν από `t` και πάνω. Κρατιέται μονότονη (c < t), ώστε
 * να μη γίνει ποτέ ένας πιο δυνατός άνεμος μικρότερος από έναν πιο αδύναμο μετά τη διόρθωση.
 * Το `landOnly` αντιγράφει την πύλη του δαπέδου: πάνω από νερό η συμπίεση ΔΕΝ υπάρχει.
 */
const rampAdd = (v, c, t) => (v >= t ? v : v + c * (1 - v / t));
const rampMul = (v, m, t) => (v >= t ? v : v * (1 + (m - 1) * (1 - v / t)));
const onLand = r => typeof r.elev === 'number' && r.elev > 0;
const CANDIDATES = [
  ['σήμερα (δάπεδος μόνο)', r => r.base],
  ...[[2, 12], [3, 12], [3, 16], [3, 19], [4, 19], [2, 19], [3, 25], [5, 19]].map(([c, t]) =>
    [`+${c} ως τα ${t} (στεριά)`, r => (onLand(r) ? rampAdd(r.base, c, t) : r.base)]),
  ...[[3, 19], [3, 12]].map(([c, t]) =>
    [`+${c} ως τα ${t} (ΠΑΝΤΟΥ)`, r => rampAdd(r.base, c, t)]),
  ...[[1.4, 19], [1.6, 19]].map(([m, t]) =>
    [`x${m} ως τα ${t} (στεριά)`, r => (onLand(r) ? rampMul(r.base, m, t) : r.base)]),
];

const scoreOf = (rows, f) => {
  const n = rows.length || 1;
  const err = rows.map(r => f(r) - r.obs);
  const weak = rows.filter(r => r.base < 12);
  const strong = rows.filter(r => getBeaufortLevel(r.obs) >= 5);
  let ok = 0;
  let falseCalm = 0;
  let falseAlarm = 0;
  let total = 0;
  for (const level of ['protected', 'partial', 'exposed']) {
    const tone = kmh => resolveConditionTone({
      exposureLevel: level, beaufort: getBeaufortLevel(kmh), isEnclosedCove: false,
      seaStateM: undefined, windSpeedKmh: kmh,
    });
    for (const r of rows) {
      const truth = tone(r.obs);
      const shown = tone(f(r));
      total++;
      if (shown === truth) ok++;
      if (shown === 'blue' && truth !== 'blue') falseCalm++;
      if (shown !== 'blue' && truth === 'blue') falseAlarm++;
    }
  }
  const pushedUp = rows.filter(r => getBeaufortLevel(r.base) <= 2 && getBeaufortLevel(f(r)) >= 3);
  return {
    hours: rows.length,
    maeKmh: Number((err.reduce((s, e) => s + Math.abs(e), 0) / n).toFixed(2)),
    biasKmh: Number((err.reduce((s, e) => s + e, 0) / n).toFixed(2)),
    weakBiasKmh: Number(mean(weak.map(r => f(r) - r.obs)).toFixed(2)),
    bftExactPct: pct(rows.filter(r => getBeaufortLevel(f(r)) === getBeaufortLevel(r.obs)).length, rows.length),
    bftUnderPct: pct(rows.filter(r => getBeaufortLevel(f(r)) <= getBeaufortLevel(r.obs) - 1).length, rows.length),
    bftOverPct: pct(rows.filter(r => getBeaufortLevel(f(r)) >= getBeaufortLevel(r.obs) + 1).length, rows.length),
    missedStrongPct: pct(strong.filter(r => getBeaufortLevel(f(r)) < 5).length, strong.length),
    colourOkPct: pct(ok, total),
    falseCalmPct: pct(falseCalm, total),
    falseAlarmPct: pct(falseAlarm, total),
    // ΑΚΤΙΝΑ ΕΚΡΗΞΗΣ: πόσες ώρες σπρώχνονται από «≤2 Μποφόρ» στα 3 — και πόσες το άξιζαν.
    pushedTo3Pct: pct(pushedUp.length, rows.length),
    pushedTo3JustifiedPct: pct(pushedUp.filter(r => getBeaufortLevel(r.obs) >= 3).length, pushedUp.length),
  };
};

const bandTable = (rows, key, label) => {
  const BANDS = [[0, 4], [4, 8], [8, 12], [12, 16], [16, 20], [20, 28], [28, 200]];
  console.log(`\n=== ${label} ===`);
  console.log('  ζώνη          | ώρες | δικός μας | όργανο | μεροληψία | το όργανο ≥1 Μπφ πάνω');
  const out = [];
  for (const [lo, hi] of BANDS) {
    const rs = rows.filter(r => key(r) >= lo && key(r) < hi);
    if (rs.length < 30) { console.log(`  ${(`${lo}-${hi} χλμ/ώ`).padEnd(13)} | ${String(rs.length).padStart(4)} | δείγμα πολύ μικρό`); continue; }
    const ours = mean(rs.map(r => r.base));
    const obs = mean(rs.map(r => r.obs));
    const higher = pct(rs.filter(r => getBeaufortLevel(r.obs) >= getBeaufortLevel(r.base) + 1).length, rs.length);
    out.push({ band: `${lo}-${hi}`, hours: rs.length, oursKmh: Number(ours.toFixed(2)), obsKmh: Number(obs.toFixed(2)),
      biasKmh: Number((ours - obs).toFixed(2)), obsHigherPct: higher });
    console.log(`  ${(`${lo}-${hi} χλμ/ώ`).padEnd(13)} | ${String(rs.length).padStart(4)} | ${ours.toFixed(2).padStart(9)} | `
      + `${obs.toFixed(2).padStart(6)} | ${fmt(ours - obs).padStart(9)} | ${higher}%`);
  }
  return out;
};

const report = {};
for (const win of WINDOWS) {
  const label = win.join(' → ');
  console.log(`\n\n################ ΠΑΡΑΘΥΡΟ ${label} ################`);
  const rows = await loadWindow(win);
  const land = rows.filter(onLand);
  const sea = rows.filter(r => typeof r.elev === 'number' && r.elev <= 0);
  console.log(`ζεύγη: ${rows.length} ώρες-σταθμοί · στεριά ${land.length} · νερό ${sea.length}`);

  // 1. ΟΙ ΔΥΟ ΔΕΣΜΕΥΣΕΙΣ — και γιατί δεν λένε το ίδιο πράγμα.
  const byOursLand = bandTable(land, r => r.base, 'ΑΝΑ ΔΙΚΟ ΜΑΣ ΝΟΥΜΕΡΟ — ΣΗΜΕΙΟ ΣΤΕΡΙΑΣ (αυτό βλέπει ο επισκέπτης)');
  const byOursSea = bandTable(sea, r => r.base, 'ΑΝΑ ΔΙΚΟ ΜΑΣ ΝΟΥΜΕΡΟ — ΣΗΜΕΙΟ ΣΤΟ ΝΕΡΟ (εκεί ο δάπεδος σιωπά)');
  const byObsLand = bandTable(land, r => r.obs, 'ΑΝΑ ΝΟΥΜΕΡΟ ΟΡΓΑΝΟΥ — ΣΤΕΡΙΑ (η αντίστροφη δέσμευση· ΜΗΝ τη διαβάσεις ως το ίδιο πράγμα)');

  // 1β. Η ΑΚΡΙΒΗΣ ΩΡΑ ΤΟΥ §Γ34 — και τι έχει ΗΔΗ κάνει εκεί ο δάπεδος ριπής.
  // Το §Γ34 μέτρησε «μέσος 4,6 → όργανο 7,6» πάνω στον ΩΜΟ μέσο. Ο δάπεδος όμως ήδη τρέχει σε
  // αυτές τις ώρες όταν το σημείο έχει στεριά. Άρα το ερώτημα δεν είναι «πόσο λείπει από τον ωμό»
  // αλλά «πόσο λείπει ΑΚΟΜΑ μετά τον δάπεδο» — και μόνο αυτό δικαιολογεί δεύτερη διόρθωση.
  console.log('\n=== ΟΙ ΩΡΕΣ ΤΟΥ §Γ34 (ωμό μοντέλο ≤2 Μπφ ΚΑΙ λόγος ριπής ≥3) ===');
  console.log('  σημείο  | ώρες | ωμός | μετά τον δάπεδο | όργανο | υπόλοιπο | το όργανο λέει ≥3 Μπφ');
  const g34 = {};
  for (const [tag, rs] of [['στεριά', land], ['νερό', sea]]) {
    const sub = rs.filter(r => getBeaufortLevel(r.raw) <= 2 && r.raw > 0 && typeof r.gust === 'number' && r.gust / r.raw >= 3);
    if (sub.length < 20) { console.log(`  ${tag.padEnd(7)} | ${String(sub.length).padStart(4)} | δείγμα πολύ μικρό`); continue; }
    const rawM = mean(sub.map(r => r.raw));
    const baseM = mean(sub.map(r => r.base));
    const obsM = mean(sub.map(r => r.obs));
    g34[tag] = { hours: sub.length, rawKmh: Number(rawM.toFixed(2)), baseKmh: Number(baseM.toFixed(2)),
      obsKmh: Number(obsM.toFixed(2)), residualKmh: Number((baseM - obsM).toFixed(2)),
      obsAtLeast3Pct: pct(sub.filter(r => getBeaufortLevel(r.obs) >= 3).length, sub.length) };
    console.log(`  ${tag.padEnd(7)} | ${String(sub.length).padStart(4)} | ${rawM.toFixed(2).padStart(4)} | ${baseM.toFixed(2).padStart(15)} | `
      + `${obsM.toFixed(2).padStart(6)} | ${fmt(baseM - obsM).padStart(8)} | ${g34[tag].obsAtLeast3Pct}%`);
  }

  // 1γ. ΜΙΛΑΕΙ Ο ΔΑΠΕΔΟΣ Ή ΟΧΙ; Δύο εντελώς διαφορετικοί πληθυσμοί μέσα στον «ασθενή άνεμο».
  // Όπου ο δάπεδος έχει ήδη σηκώσει τον μέσο, μια δεύτερη διόρθωση θα διπλομετρούσε. Το μόνο
  // μέρος όπου μια διόρθωση μέσου είναι καν συζητήσιμη είναι εκεί που ο δάπεδος ΣΩΠΑΙΝΕΙ.
  console.log('\n=== ΑΣΘΕΝΗΣ ΑΝΕΜΟΣ (<12 χλμ/ώ), ΣΤΕΡΙΑ — ΜΕ ΚΑΙ ΧΩΡΙΣ ΔΑΠΕΔΟ ===');
  console.log('  πληθυσμός        | ώρες | δικό μας | όργανο | μεροληψία | το όργανο ≥1 Μπφ πάνω');
  const floorSplit = {};
  for (const [tag, test] of [['ο δάπεδος μίλησε', r => r.base > r.raw + 0.01], ['ο δάπεδος σώπασε', r => r.base <= r.raw + 0.01]]) {
    const rs = land.filter(r => r.base < 12).filter(test);
    if (rs.length < 30) { console.log(`  ${tag.padEnd(16)} | ${String(rs.length).padStart(4)} | δείγμα πολύ μικρό`); continue; }
    const oursM = mean(rs.map(r => r.base));
    const obsM = mean(rs.map(r => r.obs));
    floorSplit[tag] = { hours: rs.length, oursKmh: Number(oursM.toFixed(2)), obsKmh: Number(obsM.toFixed(2)),
      biasKmh: Number((oursM - obsM).toFixed(2)),
      obsHigherPct: pct(rs.filter(r => getBeaufortLevel(r.obs) >= getBeaufortLevel(r.base) + 1).length, rs.length) };
    console.log(`  ${tag.padEnd(16)} | ${String(rs.length).padStart(4)} | ${oursM.toFixed(2).padStart(8)} | ${obsM.toFixed(2).padStart(6)} | `
      + `${fmt(oursM - obsM).padStart(9)} | ${floorSplit[tag].obsHigherPct}%`);
  }

  // 2. ΟΙ ΥΠΟΨΗΦΙΕΣ — στο σύνολο του παραθύρου.
  console.log('\n=== ΥΠΟΨΗΦΙΕΣ ΔΙΟΡΘΩΣΕΙΣ (κριτής: χρώμα, όχι χλμ/ώ) ===');
  console.log('  διόρθωση                  | σφάλμα | μερολ. | ασθενής | σωστό Μπφ | σωστό χρώμα | ψεύτ.ηρεμία | ψεύτ.συναγ. | 2→3 Μπφ | δικαιολ.');
  const candidateRows = [];
  for (const [name, f] of CANDIDATES) {
    const s = scoreOf(rows, f);
    candidateRows.push({ name, ...s });
    console.log(`  ${name.padEnd(25)} | ${s.maeKmh.toFixed(2).padStart(6)} | ${fmt(s.biasKmh).padStart(6)} | `
      + `${fmt(s.weakBiasKmh).padStart(7)} | ${(`${s.bftExactPct}%`).padStart(9)} | ${(`${s.colourOkPct}%`).padStart(11)} | `
      + `${(`${s.falseCalmPct}%`).padStart(11)} | ${(`${s.falseAlarmPct}%`).padStart(11)} | ${(`${s.pushedTo3Pct}%`).padStart(7)} | ${s.pushedTo3JustifiedPct}%`);
  }

  // 3. ΑΛΛΗ ΓΕΩΓΡΑΦΙΑ: ζυγά αεροδρόμια βαθμονόμηση, τα ΜΟΝΑ κριτής.
  console.log('\n=== ΙΔΙΕΣ ΥΠΟΨΗΦΙΕΣ ΣΕ ΑΛΛΟΥΣ ΣΤΑΘΜΟΥΣ (ζυγοί | μονοί: σωστό χρώμα / ψεύτικη ηρεμία / ψεύτικος συναγερμός) ===');
  const splitRows = [];
  for (const [name, f] of CANDIDATES) {
    const a = scoreOf(rows.filter(r => r.stationIndex % 2 === 0), f);
    const b = scoreOf(rows.filter(r => r.stationIndex % 2 === 1), f);
    splitRows.push({ name, even: a, odd: b });
    console.log(`  ${name.padEnd(25)} | ${(`${a.colourOkPct}% / ${a.falseCalmPct}% / ${a.falseAlarmPct}%`).padStart(24)} | `
      + `${b.colourOkPct}% / ${b.falseCalmPct}% / ${b.falseAlarmPct}%`);
  }

  report[label] = { hours: rows.length, landHours: land.length, seaHours: sea.length, gammaThirtyFourHours: g34, weakLandByFloor: floorSplit,
    byOursLand, byOursSea, byObsLand, candidates: candidateRows, stationSplit: splitRows };

  const outDir = path.join(root, 'reports/weather');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `weak-wind-lift-${win.join('_')}.json`);
  const tmp = `${out}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ generatedAt: new Date().toISOString(), window: label, ...report[label] }, null, 2), 'utf8');
  fs.renameSync(tmp, out);
  console.log(`\nαναφορά: ${path.relative(root, out)}`);
}
